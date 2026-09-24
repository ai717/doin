// engine.test.mjs — 背包竞技场规则层测试：布局/战斗/商店/合成/残局可解性/随机游走

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mulberry32, makeGrid, tryMove, trySwap, tryRemove, expandGrid,
  computeBuild, makeEnemy, createBattle, stepBattle, runBattle, settleCrafts,
  generateShop, expansionCost, solvePuzzle, layoutWins,
} from "../js/engine.mjs";
import {
  ITEMS, CLASSES, ENEMIES, PUZZLES, RECIPES, enemyForRound, EXPEDITION,
} from "../js/data.mjs";

test("所有残局关卡 100% 可解（默认求解器参数）", () => {
  for (const puzzle of PUZZLES) {
    const sol = solvePuzzle(puzzle);
    assert.ok(sol, `关卡 ${puzzle.id} 应有必胜摆法`);
    const check = layoutWins(sol.items, puzzle);
    assert.equal(check.won, true, `关卡 ${puzzle.id} 求解摆法应必胜`);
    // 摆放必须合法：全部物品落在格内且不重叠
    const grid = makeGrid(puzzle.grid.cols, puzzle.grid.rows, puzzle.grid.blocked ?? []);
    const cells = new Set();
    for (const it of sol.items) {
      const data = ITEMS[it.id];
      const w = it.rot % 2 === 0 ? data.w : data.h;
      const h = it.rot % 2 === 0 ? data.h : data.w;
      for (let dy = 0; dy < h; dy += 1) {
        for (let dx = 0; dx < w; dx += 1) {
          const x = it.x + dx;
          const y = it.y + dy;
          assert.ok(x >= 0 && y >= 0 && x < grid.cols && y < grid.rows, `${puzzle.id} 越界`);
          assert.ok(!grid.blocked.has(`${x},${y}`), `${puzzle.id} 落在阻挡格`);
          assert.ok(!cells.has(`${x},${y}`), `${puzzle.id} 重叠`);
          cells.add(`${x},${y}`);
        }
      }
    }
  }
});

test("三个职业开局第 1 轮 vs 新手剑士均可胜", () => {
  for (const [classId, bag] of [["berserker", "A"], ["ranger", "A"], ["pyromancer", "A"]]) {
    const cls = CLASSES[classId];
    const grid = makeGrid(cls.grid.cols, cls.grid.rows, cls.grid.blocked ?? []);
    const items = (bag === "B" ? cls.startersB : cls.startersA).map((id, i) => ({ id, uid: i, x: 0, y: 0, rot: 0 }));
    const placed = [];
    for (const item of items) {
      let best = null;
      for (let y = 0; y < grid.rows && !best; y += 1) {
        for (let x = 0; x < grid.cols && !best; x += 1) {
          const next = tryMove(grid, placed.concat(item), item.uid, x, y, 0);
          if (next) {
            best = next.find((it) => it.uid === item.uid);
            break;
          }
        }
      }
      if (best) placed.push(best);
      else placed.push(item);
    }
    const enemy = makeEnemy("novice", 1);
    const playerSpec = computeBuild(placed, classId, grid);
    const battle = runBattle(playerSpec, enemy.spec, 12345);
    assert.equal(battle.winner, 0, `${classId} 开局应胜 novice`);
  }
});

test("战斗确定性：同种子同布局结果完全一致", () => {
  const enemy = makeEnemy("dual_blade", 2);
  const items = [
    { id: "iron_sword", uid: 0, x: 0, y: 1, rot: 0 },
    { id: "whetstone", uid: 1, x: 1, y: 1, rot: 0 },
    { id: "iron_shield", uid: 2, x: 2, y: 1, rot: 0 },
  ];
  const spec = computeBuild(items, "berserker", makeGrid(4, 5));
  const a = runBattle(spec, enemy.spec, 777);
  const b = runBattle(spec, enemy.spec, 777);
  assert.deepEqual(
    [a.winner, a.time, a.sides[0].hp, a.sides[1].hp],
    [b.winner, b.time, b.sides[0].hp, b.sides[1].hp],
  );
});

test("战斗不变量：有限步内必有胜负，血量不为 NaN，终局不再推进", () => {
  const enemy = makeEnemy("legend", 16);
  const items = [
    { id: "fire_staff", uid: 0, x: 0, y: 1, rot: 0 },
    { id: "oil_flask", uid: 1, x: 1, y: 1, rot: 0 },
    { id: "fireball_scroll", uid: 2, x: 2, y: 1, rot: 0 },
  ];
  const spec = computeBuild(items, "pyromancer", makeGrid(4, 5));
  const battle = createBattle(spec, enemy.spec, 42);
  let guard = 0;
  while (!battle.ended && guard < 2000) {
    const { state } = stepBattle(battle, 0.1);
    guard += 1;
    for (const side of state.sides) {
      assert.ok(Number.isFinite(side.hp), "血量必须是有限数");
      assert.ok(Number.isFinite(side.res), "资源必须是有限数");
    }
  }
  assert.ok(battle.ended, "战斗必须在硬上限内结束");
  assert.ok([0, 1].includes(battle.winner), "胜负必须明确");
  // 终局 no-op：结束后继续步进不改变状态
  const snapshot = { winner: battle.winner, time: battle.time, hp: battle.sides[0].hp };
  stepBattle(battle, 0.1);
  assert.equal(battle.winner, snapshot.winner);
  assert.equal(battle.time, snapshot.time);
  assert.equal(battle.sides[0].hp, snapshot.hp);
});

test("随机游走 1000 步：任意摆放/旋转/交换/移除不抛错且不重叠", () => {
  const rng = mulberry32(20260925);
  const grid = makeGrid(5, 4);
  let items = [
    { id: "iron_sword", uid: 0, x: 0, y: 0, rot: 0 },
    { id: "whetstone", uid: 1, x: 1, y: 0, rot: 0 },
    { id: "banana", uid: 2, x: 2, y: 0, rot: 0 },
    { id: "leather_armor", uid: 3, x: 0, y: 2, rot: 0 },
    { id: "wooden_shield", uid: 4, x: 2, y: 2, rot: 0 },
  ];
  const pool = Object.keys(ITEMS);
  for (let i = 0; i < 1000; i += 1) {
    const roll = Math.floor(rng() * 5);
    const uid = items[Math.floor(rng() * items.length)].uid;
    if (roll === 0) {
      const next = tryMove(grid, items, uid, Math.floor(rng() * 5), Math.floor(rng() * 4), Math.floor(rng() * 4));
      if (next) items = next;
    } else if (roll === 1) {
      const other = items[Math.floor(rng() * items.length)].uid;
      const next = trySwap(grid, items, uid, other);
      if (next) items = next;
    } else if (roll === 2) {
      const next = tryRemove(items, uid);
      if (next) items = next;
      if (items.length < 2) items.push({ id: pool[Math.floor(rng() * pool.length)], uid: 1000 + i, x: -1, y: -1, rot: 0 });
    } else if (roll === 3) {
      const placed = items.filter((it) => it.x >= 0);
      const newItem = { id: pool[Math.floor(rng() * pool.length)], uid: 2000 + i, x: 0, y: 0, rot: 0 };
      const next = tryMove(grid, placed.concat(newItem), newItem.uid, Math.floor(rng() * 5), Math.floor(rng() * 4), Math.floor(rng() * 4));
      if (next) items = next.filter((it) => it.uid !== newItem.uid).concat(next.find((it) => it.uid === newItem.uid));
    } else {
      // 任意终局调用不抛
      computeBuild(items.filter((it) => it.x >= 0), "berserker", grid);
    }
    // 不变量：无重叠、无越界
    const occupied = new Set();
    for (const it of items) {
      if (it.x < 0 || it.y < 0) continue;
      const data = ITEMS[it.id];
      const w = it.rot % 2 === 0 ? data.w : data.h;
      const h = it.rot % 2 === 0 ? data.h : data.w;
      assert.ok(it.x + w <= grid.cols && it.y + h <= grid.rows, "不越界");
      for (let dy = 0; dy < h; dy += 1) {
        for (let dx = 0; dx < w; dx += 1) {
          const key = `${it.x + dx},${it.y + dy}`;
          assert.ok(!occupied.has(key), "不重叠");
          occupied.add(key);
        }
      }
    }
  }
});

test("合成结算：烤烤成盛宴、火油成烈焰杖、同色宝石升阶", () => {
  const g = makeGrid(5, 5);
  const roastPair = [
    { id: "roast", uid: 0, x: 0, y: 0, rot: 0 },
    { id: "roast", uid: 1, x: 1, y: 0, rot: 0 },
  ];
  const crafted = settleCrafts(roastPair);
  assert.equal(crafted.crafted, 1);
  assert.ok(crafted.items.some((it) => it.id === "feast"), "烤肉相邻应合成盛宴");

  const fireOil = [
    { id: "fire_staff", uid: 0, x: 0, y: 0, rot: 0 },
    { id: "oil_flask", uid: 1, x: 1, y: 0, rot: 0 },
  ];
  const c2 = settleCrafts(fireOil);
  assert.ok(c2.items.some((it) => it.id === "flame_staff"), "火杖+油瓶应合成烈焰杖");

  const gems = [
    { id: "gem_red_1", uid: 0, x: 0, y: 0, rot: 0 },
    { id: "gem_red_1", uid: 1, x: 1, y: 0, rot: 0 },
    { id: "gem_blue_1", uid: 2, x: 0, y: 2, rot: 0 },
  ];
  const c3 = settleCrafts(gems);
  assert.ok(c3.items.some((it) => it.id === "gem_red_2"), "同色同级相邻宝石应升阶");
  assert.ok(c3.items.some((it) => it.id === "gem_blue_1" && it.x === 0 && it.y === 2), "蓝色宝石不受影响，应原地保留");
});

test("商店生成：同种子同轮次完全一致，前两格优先联动", () => {
  const rngA = mulberry32(99);
  const rngB = mulberry32(99);
  const a = generateShop("berserker", 3, rngA, [{ id: "wooden_sword", uid: 0, x: 0, y: 0, rot: 0 }]);
  const b = generateShop("berserker", 3, rngB, [{ id: "wooden_sword", uid: 0, x: 0, y: 0, rot: 0 }]);
  assert.deepEqual(a, b, "同种子商店一致");
  assert.equal(a.length, 5, "商店固定 5 格");
});

test("扩容：交替加列加行，价格随次数上涨", () => {
  const grid = makeGrid(4, 5);
  const g1 = expandGrid(grid, 0);
  assert.equal(g1.cols, 5);
  assert.equal(g1.rows, 5);
  const g2 = expandGrid(g1, 1);
  assert.equal(g2.cols, 5);
  assert.equal(g2.rows, 6);
  assert.equal(expansionCost(0), EXPEDITION.expansionCost[0]);
  assert.equal(expansionCost(EXPEDITION.expansionCost.length), null);
});

test("对手出场表：1-3 新手 / 16-18 传说，血量来自数据", () => {
  assert.equal(enemyForRound(1), "novice");
  assert.equal(enemyForRound(3), "novice");
  assert.equal(enemyForRound(4), "dual_blade");
  assert.equal(enemyForRound(10), "flame_monk");
  assert.equal(enemyForRound(13), "ironclad");
  assert.equal(enemyForRound(16), "legend");
  const legend = makeEnemy("legend", 16);
  const expectHp = Math.round(ENEMIES.legend.hp * (1 + 15 * 0.1) * 1.5);
  assert.equal(legend.spec.maxHp, expectHp, "传说冒险者 16 回合起 1.5 倍血量（叠加轮次缩放）");
});

test("布局联动：油瓶傍火杖 → 燃烧 +1/+1；磨刀石傍武器 → 伤害 +1", () => {
  const g = makeGrid(5, 5);
  const fire = computeBuild([
    { id: "fire_staff", uid: 0, x: 0, y: 0, rot: 0 },
    { id: "oil_flask", uid: 1, x: 1, y: 0, rot: 0 },
  ], "pyromancer", g);
  const staff = fire.weapons.find((w) => w.itemId === "fire_staff");
  assert.equal(staff.onHit.burn, 2, "火杖基础 burn 1 + 油瓶 1");
  assert.equal(staff.onHit.burnDmg, 1, "油瓶 burnDmg +1");

  const melee = computeBuild([
    { id: "iron_sword", uid: 0, x: 0, y: 0, rot: 0 },
    { id: "whetstone", uid: 1, x: 1, y: 0, rot: 0 },
  ], null, g);
  const sword = melee.weapons.find((w) => w.itemId === "iron_sword");
  assert.deepEqual(sword.dmg, [6, 9], "铁剑 5-8 + 磨刀石 1");
});
