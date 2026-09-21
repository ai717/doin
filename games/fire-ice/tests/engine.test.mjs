// 森林冰火人 · 引擎规则测试
// 覆盖：元素相克、死亡重生+宝石保留、按钮门、双色门限行、传送、冻结桥、
//       双出口同步、星星计算、大步数随机游走不变式

import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, stepFrame, computeStars, T } from "../js/engine.mjs";
import { getLevel } from "../js/levels.mjs";

const DT = 1 / 60;

function step(state, inp = {}) {
  return stepFrame(state, DT, inp).state;
}

function steps(state, inp, n) {
  for (let i = 0; i < n; i++) state = step(state, inp);
  return state;
}

function events(state, inp = {}) {
  return stepFrame(state, DT, inp).events;
}

// 确定性 PRNG（mulberry32）
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LV1 = () => createInitialState(getLevel(0), { levelIndex: 0 });

test("元素相克：火人遇水亡、冰人遇岩浆亡、毒液双杀", () => {
  // 1-1 r12：###M#####.##.#####W# → M@3（岩浆）、W@18（水）
  let s = LV1();
  s.fire.x = 18.5;
  s.fire.y = 12.1;
  s.fire.vy = 0;
  const r1 = stepFrame(s, DT, {});
  assert.ok(r1.events.some((e) => e.type === "death" && e.kind === "fire"), "火人应死于水面");
  assert.equal(r1.state.stats.deaths, 1);

  s = LV1();
  s.ice.x = 3.5;
  s.ice.y = 12.1;
  s.ice.vy = 0;
  const r2 = stepFrame(s, DT, {});
  assert.ok(r2.events.some((e) => e.type === "death" && e.kind === "ice"), "冰人应死于岩浆");

  // 毒液双杀：把 r12 某格改成 GOO，火人站上去
  s = LV1();
  s.map[12][10] = T.GOO;
  s.fire.x = 10.5;
  s.fire.y = 12.1;
  s.fire.vy = 0;
  const r3 = stepFrame(s, DT, {});
  assert.ok(r3.events.some((e) => e.type === "death" && e.kind === "fire"), "火人应死于毒液");
});

test("宽容容错：死亡原地重生、已收集宝石保留", () => {
  let s = LV1();
  // 收集红宝石 r@(3.5,12.5)：地面起跳经过宝石
  s.fire.x = 3.5;
  s.fire.y = 12.0;
  s = steps(s, { fire: { jump: true } }, 40);
  assert.ok(s.stats.gems.red >= 1, `应收集到红宝石（red=${s.stats.gems.red}）`);

  // 火人踩水死亡
  s.fire.x = 18.5;
  s.fire.y = 12.1;
  s.fire.vy = 0;
  s = step(s);
  const redBefore = s.stats.gems.red;
  assert.equal(s.stats.deaths, 1);
  assert.ok(redBefore >= 1, "死亡后宝石保留");
  assert.ok(Math.abs(s.fire.x - s.fire.spawnX) < 0.01, "火人回到出生点 x");
  assert.ok(Math.abs(s.fire.y - s.fire.spawnY) < 0.01, "火人回到出生点 y");
  assert.equal(s.status, "playing", "死亡不重置关卡");
});

test("按钮开/关门：站上开、移开保持 1.2s 后关", () => {
  // 1-2：o@3 控制 D@6，按钮地面 y=12
  let s = createInitialState(getLevel(1), { levelIndex: 1 });
  s.fire.x = 3.5;
  s.fire.y = 12.0;
  s = steps(s, {}, 2);
  assert.equal(s.doors[0].open, true, "踩按钮应开门");

  // 移开按钮
  s.fire.x = 1.0;
  s.fire.y = 12.0;
  s = steps(s, {}, 3);
  assert.equal(s.doors[0].open, true, "移开瞬间门保持开启");
  // 超过 DOOR_KEEP（1.2s）
  s = steps(s, {}, 90);
  assert.equal(s.doors[0].open, false, "超时后门应关闭");
});

test("双色门限行：红门仅火人可过", () => {
  // 1-3：o@3 开红门 d@6
  let s = createInitialState(getLevel(2), { levelIndex: 2 });
  s.fire.x = 3.5;
  s.fire.y = 12.0;
  s = steps(s, {}, 2);
  assert.equal(s.doors[0].open, true, "红门应打开");
  assert.equal(s.doors[0].color, "red");

  // 火人穿过红门
  s.fire.x = 5.8;
  s.fire.y = 12.0;
  s = steps(s, { fire: { right: true } }, 20);
  assert.ok(s.fire.x > 7.2, `火人应穿过红门（x=${s.fire.x.toFixed(2)}）`);

  // 冰人被红门挡在左侧
  let s2 = createInitialState(getLevel(2), { levelIndex: 2 });
  s2.fire.x = 3.5;
  s2.fire.y = 12.0;
  s2 = steps(s2, {}, 2); // 开门
  s2.ice.x = 5.8;
  s2.ice.y = 12.0;
  s2 = steps(s2, { ice: { right: true } }, 30);
  assert.ok(s2.ice.x < 6.5, `冰人应被红门挡住（x=${s2.ice.x.toFixed(2)}）`);
});

test("传送门：触发后传送到配对门旁", () => {
  // 4-2（索引 25）：T@10 ↔ T@12
  let s = createInitialState(getLevel(25), { levelIndex: 25 });
  s.fire.x = 10.5;
  s.fire.y = 12.0;
  s = steps(s, {}, 8);
  assert.ok(s.fire.x > 13.0 && s.fire.x < 14.0, `火人应传到配对门旁（x=${s.fire.x.toFixed(2)}）`);
});

test("冻结桥：冰人冻结岩浆成桥，火人可走过", () => {
  // 2-2：Z@7.5 冻结点，M@8 岩浆
  let s = createInitialState(getLevel(9), { levelIndex: 9 });
  // 冰人站冻结点旁冻结
  s.ice.x = 7.5;
  s.ice.y = 12.0;
  s = step(s, { freeze: true });
  assert.ok(s.freezeSpots[0].frozenUntil > s.elapsed, "冻结点应被激活");

  // 火人从岩浆上方落下 → 落到冰桥顶（与地面齐平 12.0），不死亡
  s.fire.x = 8.5;
  s.fire.y = 11.2;
  s.fire.vy = 0;
  s = steps(s, {}, 40);
  assert.equal(s.stats.deaths, 0, "冻结后火人不应死于岩浆");
  assert.ok(s.fire.y > 11.6, "火人应站在冰桥顶部");
});

test("双出口同步：两人同时到门前才通关", () => {
  // 1-2：X@8.5、Y@11.5，站 r10 平台 y=10
  let s = createInitialState(getLevel(1), { levelIndex: 1 });
  s.fire.x = 8.5;
  s.fire.y = 10.5;
  s.ice.x = 4.0;
  s.ice.y = 10.5;
  s = step(s);
  assert.equal(s.status, "playing", "仅一人到位不应通关");

  s.ice.x = 11.5;
  s = step(s);
  assert.equal(s.status, "won", "两人同时到位应通关");
});

test("computeStars：全收集+零死亡=3星、全收集=2星、通关=1星", () => {
  assert.equal(computeStars({ totalGems: 5, gems: { red: 5, blue: 0, gold: 0 }, deaths: 0 }), 3);
  assert.equal(computeStars({ totalGems: 5, gems: { red: 2, blue: 2, gold: 1 }, deaths: 1 }), 2);
  assert.equal(computeStars({ totalGems: 5, gems: { red: 1, blue: 0, gold: 0 }, deaths: 2 }), 1);
  assert.equal(computeStars({ totalGems: 0, gems: { red: 0, blue: 0, gold: 0 }, deaths: 0 }), 1);
});

test("大步数随机游走：1000 步任意合法输入不变式不破", () => {
  const rng = mulberry32(20260920);
  let s = LV1();
  let prevDeaths = 0;
  for (let i = 0; i < 1000; i++) {
    const inp = {
      fire: {
        left: rng() < 0.25,
        right: rng() < 0.25,
        jump: rng() < 0.15
      },
      ice: {
        left: rng() < 0.25,
        right: rng() < 0.25,
        jump: rng() < 0.15
      },
      freeze: rng() < 0.05
    };
    s = step(s, inp);
    // 不变式
    assert.ok(Number.isFinite(s.fire.x) && Number.isFinite(s.fire.y), "火人坐标合法");
    assert.ok(Number.isFinite(s.ice.x) && Number.isFinite(s.ice.y), "冰人坐标合法");
    const got = s.stats.gems.red + s.stats.gems.blue + s.stats.gems.gold;
    assert.ok(got <= s.stats.totalGems, "宝石收集数不超过总数");
    assert.ok(s.stats.deaths >= prevDeaths, "死亡数单调不减");
    prevDeaths = s.stats.deaths;
  }
});
