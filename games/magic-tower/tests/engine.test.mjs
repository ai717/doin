// engine.test.mjs — 伤害公式 / 移动结算 / 战斗门禁 / 寻路 / 1000 步随机游走不变式
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CH,
  battlePreview,
  cellAt,
  createState,
  currentFloor,
  findPath,
  floorMonsters,
  fromSnapshot,
  index,
  reachableMask,
  shopOptions,
  shopPrice,
  step,
  threatOf,
  toSnapshot,
} from "../js/engine.mjs";
import { ITEMS, MONSTERS, START_STATS } from "../js/data.mjs";
import { LEVELS } from "../js/levels.mjs";

// 便于构造小场景：11×11，四周石墙
function tiny(rows, monsters = { 1: "mossSlime" }) {
  const border = "###########";
  const padded = rows.map((row) => `#${row.padEnd(9, "#").slice(0, 9)}#`);
  while (padded.length < 9) padded.push("#.........#");
  return [{ id: 1, zone: 1, monsters, rows: [border, ...padded.slice(0, 9), border] }];
}

describe("engine: 透明伤害公式", () => {
  it("勇者先攻，回合数向上取整，一击必杀零战损", () => {
    const hero = { hp: 100, atk: 30, def: 10 };
    const mon = { hp: 25, atk: 40, def: 5 };
    const preview = battlePreview(hero, mon);
    assert.equal(preview.perHit, 25);
    assert.equal(preview.turns, 1);
    assert.equal(preview.damage, 0);
    assert.equal(threatOf(preview), "clear");
  });

  it("战损 =（回合数 − 1）× 每击伤害", () => {
    const preview = battlePreview({ hp: 500, atk: 20, def: 8 }, { hp: 60, atk: 30, def: 5 });
    assert.equal(preview.perHit, 15);
    assert.equal(preview.turns, 4);
    assert.equal(preview.perHitTaken, 22);
    assert.equal(preview.damage, 66);
    assert.equal(threatOf(preview), "hurt");
  });

  it("无法破防与致死战损都判为不可敌", () => {
    const armor = battlePreview({ hp: 999, atk: 10, def: 5 }, { hp: 50, atk: 9, def: 10 });
    assert.equal(armor.blocked, true);
    assert.equal(armor.canWin, false);
    assert.equal(threatOf(armor), "fatal");

    const mortal = battlePreview({ hp: 40, atk: 30, def: 0 }, { hp: 300, atk: 20, def: 0 });
    assert.equal(mortal.canWin, false);
    assert.equal(threatOf(mortal), "fatal");
    // 战损恰好等于当前生命同样视为致死（必须严格剩余）
    const exact = battlePreview({ hp: 90, atk: 10, def: 0 }, { hp: 100, atk: 10, def: 0 });
    assert.equal(exact.damage, 90);
    assert.equal(exact.canWin, false);
    const enough = battlePreview({ hp: 91, atk: 10, def: 0 }, { hp: 100, atk: 10, def: 0 });
    assert.equal(enough.canWin, true);
  });
});

describe("engine: 初始状态", () => {
  const state = createState(LEVELS);

  it("起点在 1 层的入口楼梯上，属性取自总表", () => {
    assert.equal(state.floor, 1);
    assert.equal(cellAt(state, state.x, state.y), CH.DOWN);
    assert.equal(state.hp, START_STATS.hp);
    assert.equal(state.atk, START_STATS.atk);
    assert.equal(state.def, START_STATS.def);
    assert.deepEqual(state.keys, { ...START_STATS.keys });
    assert.equal(state.status, "playing");
  });

  it("24 层全部载入，且只标记 1 层为已探索", () => {
    assert.equal(state.floors.length, 24);
    assert.equal(state.floors.filter((f) => f.visited).length, 1);
  });
});

describe("engine: 移动与交互结算", () => {
  it("撞墙返回 null action 且不消耗步数", () => {
    const state = createState(LEVELS);
    const before = state.stats.steps;
    const result = step(state, { type: "move", dx: 0, dy: 1 });
    assert.equal(result.action, null);
    assert.equal(result.events[0].type, "blocked");
    assert.equal(result.state.stats.steps, before);
  });

  it("拾取宝石即时抬升属性并清空格子", () => {
    const state = createState(tiny(["....A...."]));
    const next = step({ ...state, x: 4, y: 1 }, { type: "move", dx: 1, dy: 0 });
    assert.equal(next.action.type, "walk");
    assert.equal(next.state.atk, START_STATS.atk + ITEMS.A.atk);
    assert.equal(cellAt(next.state, 5, 1), CH.FLOOR);
  });

  it("拾取血瓶同时抬升当前与上限", () => {
    const state = createState(tiny(["....p...."]));
    const next = step({ ...state, x: 4, y: 1 }, { type: "move", dx: 1, dy: 0 });
    assert.equal(next.state.hp, START_STATS.hp + ITEMS.p.hp);
    assert.equal(next.state.hpMax, START_STATS.hp + ITEMS.p.hp);
  });

  it("撞门消耗一把同色钥匙，勇者停在原地", () => {
    const state = createState(tiny(["....Y...."]));
    const withKey = { ...state, x: 4, y: 1, keys: { y: 1, b: 0, r: 0 } };
    const opened = step(withKey, { type: "move", dx: 1, dy: 0 });
    assert.equal(opened.action.type, "open");
    assert.equal(opened.state.keys.y, 0);
    assert.equal(opened.state.x, 4);
    assert.equal(cellAt(opened.state, 5, 1), CH.FLOOR);

    const locked = step({ ...state, x: 4, y: 1, keys: { y: 0, b: 0, r: 0 } }, { type: "move", dx: 1, dy: 0 });
    assert.equal(locked.action, null);
    assert.equal(locked.events[0].reason, "locked");
  });

  it("击杀怪物：扣战损、收金币、占格", () => {
    const state = createState(tiny(["..1......"]));
    const next = step({ ...state, x: 2, y: 1 }, { type: "move", dx: 1, dy: 0 });
    assert.equal(next.action.type, "battle");
    const mon = MONSTERS.mossSlime;
    const preview = battlePreview(START_STATS, mon);
    assert.equal(next.state.hp, START_STATS.hp - preview.damage);
    assert.equal(next.state.gold, mon.gold);
    assert.equal(next.state.stats.slain, 1);
    assert.equal(next.state.x, 3);
  });

  it("致死与无法破防的怪物一律挡住，杜绝误触自杀", () => {
    const state = createState(tiny(["..1......"], { 1: "trueDemon" }));
    const next = step({ ...state, x: 2, y: 1 }, { type: "move", dx: 1, dy: 0 });
    assert.equal(next.action, null);
    assert.equal(next.state.hp, state.hp);
    const armored = step({ ...state, x: 2, y: 1, atk: 50, def: 99999 }, { type: "move", dx: 1, dy: 0 });
    assert.equal(armored.action, null);
    assert.equal(armored.state.hp, state.hp);
  });

  it("暗墙在小偷获救前不可通行，获救后可通行", () => {
    const state = createState(tiny(["..x......"]));
    const closed = step({ ...state, x: 2, y: 1 }, { type: "move", dx: 1, dy: 0 });
    assert.equal(closed.action, null);
    assert.equal(closed.events[0].reason, "sealed");
    const opened = step({ ...state, x: 2, y: 1, flags: { ...state.flags, thief: true } }, { type: "move", dx: 1, dy: 0 });
    assert.equal(opened.action.type, "walk");
  });

  it("踏上楼梯切层并落在对向楼梯上", () => {
    const border = "###########";
    const levels = [
      { id: 1, zone: 1, monsters: {}, rows: [border, "#.^.......#", "#.........#", "#.........#", "#.........#", "#.........#", "#.........#", "#.........#", "#.........#", "#..v......#", border] },
      { id: 2, zone: 1, monsters: {}, rows: [border, "#.v.......#", "#.........#", "#.........#", "#.........#", "#.........#", "#.........#", "#.........#", "#.........#", "#..^......#", border] },
    ];
    const state = createState(levels);
    const up = step({ ...state, x: 2, y: 2 }, { type: "move", dx: 0, dy: -1 });
    assert.equal(up.events[0].type, "stairs");
    assert.equal(up.state.floor, 2);
    assert.equal(cellAt(up.state, up.state.x, up.state.y), CH.DOWN);
    assert.equal(up.state.floors[1].visited, true);
  });

  it("站在楼梯上可以用 use 意图再次切层", () => {
    const state = createState(LEVELS);
    const up = step({ ...state, x: state.x, y: state.y - 0 }, { type: "use" });
    // 1 层 v 是入口，没有下一层；只断言不会抛错
    assert.ok(up.state);
  });
});

describe("engine: 商店", () => {
  it("价格随购买次数递增，金币不足时拒绝", () => {
    const state = createState(tiny(["....M...."]));
    const atShop = { ...state, x: 5, y: 1, gold: 500 };
    assert.equal(shopOptions(atShop)[0].price, shopPrice(atShop, 1, "hp"));
    const first = shopOptions(atShop)[0].price;
    const bought = step(atShop, { type: "buy", kind: "hp" });
    assert.equal(bought.action.type, "buy");
    assert.ok(shopOptions(bought.state)[0].price > first);

    const poor = step({ ...atShop, gold: 0 }, { type: "buy", kind: "atk" });
    assert.equal(poor.action, null);
    assert.equal(poor.events[0].reason, "poor");
  });
});

describe("engine: 寻路与可达区域", () => {
  it("可达区域止步于怪物与门", () => {
    const state = createState(tiny(["....1...."]));
    const mask = reachableMask({ ...state, x: 1, y: 1 });
    assert.equal(mask[index(4, 1)], 1);
    assert.equal(mask[index(5, 1)], 0);
  });

  it("findPath 给出最短四向路径，不可达返回 null", () => {
    const state = createState(tiny(["........."]));
    const path = findPath({ ...state, x: 1, y: 1 }, 4, 3);
    assert.ok(Array.isArray(path));
    assert.equal(path.length, 5);
    // 墙格与越界格一律不可达
    assert.equal(findPath({ ...state, x: 1, y: 1 }, 0, 0), null);
    assert.equal(findPath({ ...state, x: 1, y: 1 }, 20, 20), null);
  });
});

describe("engine: 存档快照", () => {
  it("往返一致，坏数据被归一化", () => {
    const state = createState(LEVELS);
    const snap = toSnapshot(state);
    const restored = fromSnapshot(snap, LEVELS);
    assert.equal(restored.hp, state.hp);
    assert.equal(restored.atk, state.atk);
    assert.equal(restored.floor, 1);
    assert.equal(restored.floors[0].cells.join(""), state.floors[0].cells.join(""));

    assert.equal(fromSnapshot(null, LEVELS), null);
    const broken = fromSnapshot(
      { floor: 999, x: -3, y: 40, hp: -5, atk: "x", def: null, keys: { y: -2 }, stats: {}, floors: snap.floors },
      LEVELS,
    );
    assert.equal(broken.floor, 24);
    assert.ok(broken.hp >= 1);
    assert.ok(broken.keys.y >= 0);
    assert.equal(broken.atk, START_STATS.atk);
  });
});

// 确定性 PRNG（mulberry32），用于随机游走
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("engine: 1000 步随机游走不变式", () => {
  it("任意合法分支下都不抛错、不卡死、不变式守恒", () => {
    const rand = mulberry32(20261103);
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];
    let state = createState(LEVELS);
    let moves = 0;
    for (let i = 0; i < 1400 && state.status === "playing"; i += 1) {
      const dir = dirs[Math.floor(rand() * 4)];
      const result = step(state, { type: "move", dx: dir.dx, dy: dir.dy });
      if (!result.action) {
        assert.equal(result.state, state, "无效动作不得改变状态");
        continue;
      }
      moves += 1;
      state = result.state;
      assert.ok(state.hp >= 1, "存活时生命必须为正");
      assert.ok(state.hp <= state.hpMax, "生命不得超过上限");
      assert.ok(state.atk >= 1 && state.def >= 0, "攻防不得为负");
      assert.ok(state.gold >= 0);
      assert.ok(state.keys.y >= 0 && state.keys.b >= 0 && state.keys.r >= 0);
      assert.ok(state.floor >= 1 && state.floor <= 24);
      assert.ok(state.x >= 0 && state.x < 11 && state.y >= 0 && state.y < 11);
    }
    assert.ok(moves > 1000, `随机游走有效步数不足：${moves}`);
    assert.ok(["playing", "victory"].includes(state.status));
  });

  it("同种子同输入序列得到逐帧一致的状态", () => {
    const run = (seed) => {
      const rand = mulberry32(seed);
      const dirs = [
        { dx: 0, dy: -1 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
      ];
      let state = createState(LEVELS);
      const trace = [];
      for (let i = 0; i < 220; i += 1) {
        const dir = dirs[Math.floor(rand() * 4)];
        const result = step(state, { type: "move", dx: dir.dx, dy: dir.dy });
        if (!result.action) continue;
        state = result.state;
        trace.push(`${state.floor}:${state.x},${state.y}:${state.hp}:${state.gold}`);
      }
      return trace.join("|");
    };
    assert.equal(run(7), run(7));
    assert.notEqual(run(7), run(8));
  });
});

describe("engine: 楼层魔物雷达数据", () => {
  it("聚合数量并按当前属性给出战损分级", () => {
    const state = createState(LEVELS);
    const list = floorMonsters(state, 1);
    assert.ok(list.length >= 1);
    const slime = list.find((entry) => entry.id === "mossSlime");
    assert.ok(slime);
    assert.ok(slime.count >= 1);
    assert.ok(["clear", "hurt", "fatal"].includes(slime.threat));
    assert.equal(currentFloor(state).id, 1);
  });
});
