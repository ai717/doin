// engine.test.mjs: 物理与规则层 —— 固定步长可重放、约束收敛、意图合法性、终止态 no-op

import test from "node:test";
import assert from "node:assert/strict";

import {
  WORLD,
  CANDY_R,
  FIXED_DT,
  createState,
  stepFrame,
  simulate,
  applyIntent,
  cutRopes,
  swipeCut,
  isPlaying,
  ropeGeometry,
  starsOf,
} from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";

function level(over = {}) {
  return {
    id: 999,
    box: 1,
    name: { zh: "t", en: "t" },
    hint: { zh: "t", en: "t" },
    candy: [450, 200],
    monster: { at: [-9999, -9999], r: 1 },
    ropes: [{ a: [450, 100], len: 100 }],
    stars: [],
    ...over,
  };
}

function run(state, seconds) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i += 1) {
    stepFrame(state, FIXED_DT);
    if (state.status !== "playing") break;
  }
  return state;
}

test("单摆周期接近理论值（小角度）", () => {
  const len = 150;
  const state = createState(level({ candy: [460, 100 + len], ropes: [{ a: [450, 100], len }] }));
  // 记录 x 穿越锚点正下方的次数来测周期
  let crossings = 0;
  let prev = state.candy.x - 450;
  const theory = 2 * Math.PI * Math.sqrt(len / 1500);
  const steps = Math.round(6 / FIXED_DT);
  let firstT = 0;
  let lastT = 0;
  for (let i = 0; i < steps; i += 1) {
    stepFrame(state, FIXED_DT);
    const cur = state.candy.x - 450;
    if (prev > 0 && cur <= 0) {
      crossings += 1;
      if (crossings === 1) firstT = state.t;
      lastT = state.t;
    }
    prev = cur;
  }
  assert.ok(crossings >= 3, `穿越次数过少：${crossings}`);
  const measured = (lastT - firstT) / (crossings - 1);
  assert.ok(
    Math.abs(measured - theory) / theory < 0.22,
    `周期偏差过大：实测 ${measured.toFixed(3)}s vs 理论 ${theory.toFixed(3)}s`
  );
});

test("自由落体：0.5s 后竖直速度接近 g·t", () => {
  const state = createState(level({ ropes: [] }));
  run(state, 0.5);
  assert.ok(Math.abs(state.candy.vy - 750) < 60, `vy=${state.candy.vy.toFixed(1)}`);
  assert.ok(state.candy.y > 200 + 150, "应已明显下落");
});

test("刚性绳把糖约束在绳长内（只拉不推）", () => {
  const state = createState(level({ candy: [450, 250], ropes: [{ a: [450, 100], len: 100 }] }));
  run(state, 3);
  const d = Math.hypot(state.candy.x - 450, state.candy.y - 100);
  assert.ok(d <= 100 + CANDY_R, `绳被拉伸：${d.toFixed(2)}`);
  assert.ok(d > 60, `绳松弛异常：${d.toFixed(2)}`);
});

test("弹性绳在重力下围绕预期平衡长度振荡（振荡中心 = rest + stretch）", () => {
  const rest = 70;
  const stretch = 110;
  const state = createState(
    level({ candy: [450, 100 + rest], ropes: [{ a: [450, 100], elastic: { rest, stretch } }] })
  );
  run(state, 2);
  // 弹性绳阻尼很弱，会持续振荡：取一个完整振荡区间的 min/max 中点作为平衡长度
  let min = Infinity;
  let max = -Infinity;
  const steps = Math.round(2 / FIXED_DT);
  for (let i = 0; i < steps; i += 1) {
    stepFrame(state, FIXED_DT);
    const d = Math.hypot(state.candy.x - 450, state.candy.y - 100);
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  const center = (min + max) / 2;
  assert.ok(max - min > 20, `应仍在振荡，实测振幅 ${(max - min).toFixed(1)}`);
  assert.ok(
    Math.abs(center - (rest + stretch)) / (rest + stretch) < 0.12,
    `振荡中心 ${center.toFixed(1)} 偏离平衡长度 ${rest + stretch}`
  );
});

test("切断弹性绳产生弹射，且速度不超过安全上限", () => {
  const state = createState(
    level({ candy: [450, 260], ropes: [{ a: [450, 100], elastic: { rest: 70, stretch: 110 } }] })
  );
  run(state, 3);
  cutRopes(state, [0]);
  const speed = Math.hypot(state.candy.vx, state.candy.vy);
  assert.ok(speed > 100, `应有弹射速度，实测 ${speed.toFixed(1)}`);
  assert.ok(speed <= 2600, `速度超过安全上限：${speed.toFixed(1)}`);
});

test("划刀：跨越绳的线段切断，不相交的线段不动", () => {
  const state = createState(level({ candy: [450, 200], ropes: [{ a: [450, 100], len: 100 }] }));
  const miss = swipeCut(state, 0, 500, 100, 500);
  assert.equal(miss.length, 0, "不相交的划刀不该切到绳");
  const hit = swipeCut(state, 400, 150, 500, 150);
  assert.deepEqual(hit, [0]);
  assert.equal(state.ropes[0].cut, true);
  assert.equal(state.cuts, 1);
});

test("终止态：胜利或失败后一切意图 no-op 且不抛错", () => {
  const state = createState(level({ ropes: [], monster: { at: [450, 560], r: 40 } }));
  run(state, 3);
  assert.equal(state.status, "won");
  assert.equal(isPlaying(state), false);
  for (const intent of [
    { type: "cut", x1: 0, y1: 0, x2: WORLD.w, y2: WORLD.h },
    { type: "cutRopes", indices: [0] },
    { type: "popBubble" },
    { type: "puff", index: 0 },
    { type: "slide", index: 0, t: 0.5 },
  ]) {
    const res = applyIntent(state, intent);
    assert.equal(res.ok, false, `${intent.type} 在终止态应被拒绝`);
    assert.equal(res.detail, "terminal");
  }
  assert.equal(state.cuts, 0);
});

test("非法意图静默失败，绝不抛错", () => {
  const state = createState(level({ monster: { at: [-9999, -9999], r: 1 } }));
  assert.equal(applyIntent(state, null).ok, false);
  assert.equal(applyIntent(state, { type: "unknown" }).detail, "unknown");
  assert.equal(applyIntent(state, { type: "popBubble" }).detail, "no-bubble");
  assert.equal(applyIntent(state, { type: "puff", index: 9 }).detail, "cooling");
  assert.equal(applyIntent(state, { type: "slide", index: 0, t: 0.5 }).detail, "no-rail");
  assert.equal(isPlaying(state), true, "非法意图不应改变状态");
});

test("气泡把糖托起，戳破后重新下落", () => {
  const state = createState(
    level({ ropes: [], bubbles: [{ at: [450, 300], r: 60 }], monster: { at: [-9999, -9999], r: 1 } })
  );
  state.candy.x = 450;
  state.candy.y = 300;
  run(state, 0.8);
  assert.equal(state.attached, 0, "应被气泡捕获");
  const yIn = state.candy.y;
  run(state, 0.6);
  assert.ok(state.candy.y < yIn, "气泡中应上浮");
  const res = applyIntent(state, { type: "popBubble" });
  assert.equal(res.ok, true);
  assert.equal(state.attached, -1);
  run(state, 0.4);
  assert.ok(state.candy.vy > 0, "戳破后应重新下落");
});

test("尖刺触碰即失败", () => {
  const state = createState(
    level({
      ropes: [],
      spikes: [{ from: [300, 500], to: [600, 500] }],
      monster: { at: [-9999, -9999], r: 1 },
    })
  );
  run(state, 2);
  assert.equal(state.status, "lost");
  assert.equal(state.reason, "spike");
});

test("掉出盒外判负", () => {
  const state = createState(level({ ropes: [], monster: { at: [-9999, -9999], r: 1 } }));
  state.candy.vx = 3000;
  run(state, 3);
  assert.equal(state.status, "lost");
  assert.equal(state.reason, "out");
});

test("糖长时间静止判负（防卡死）", () => {
  const state = createState(
    level({ candy: [450, 600], ropes: [], walls: [{ from: [200, 615], to: [700, 615] }], monster: { at: [-9999, -9999], r: 1 } })
  );
  run(state, 8);
  assert.equal(state.status, "lost");
  assert.equal(state.reason, "settled");
});

test("收星：接触即收下，星级由收星数唯一决定", () => {
  const state = createState(
    level({ ropes: [], stars: [[450, 260], [450, 300]], monster: { at: [450, 560], r: 40 } })
  );
  run(state, 3);
  assert.equal(state.starsTaken, 2);
  assert.equal(starsOf(state), 2);
  assert.equal(state.status, "won");
});

test("滑动锚轨改变悬挂点，且被钳制在 [0,1]", () => {
  const state = createState(
    level({
      candy: [300, 240],
      ropes: [{ rail: { from: [200, 100], to: [600, 100], t: 0 }, len: 140 }],
      monster: { at: [-9999, -9999], r: 1 },
    })
  );
  assert.equal(applyIntent(state, { type: "slide", index: 0, t: 2 }).ok, true);
  assert.equal(state.ropes[0].rail.t, 1);
  assert.equal(applyIntent(state, { type: "slide", index: 0, t: -3 }).ok, true);
  assert.equal(state.ropes[0].rail.t, 0);
});

test("自动绳：到点后才接上，且接上瞬间不产生瞬移", () => {
  const state = createState(
    level({
      candy: [450, 300],
      ropes: [{ a: [450, 120], len: 180, auto: { at: 0.5, grow: 0.5 } }],
      monster: { at: [-9999, -9999], r: 1 },
    })
  );
  assert.equal(state.ropes[0].active, false);
  // 记录接上前后一帧的位移，任何单帧位移都不该超过物理步长能解释的量
  let maxStep = 0;
  const steps = Math.round(2 / FIXED_DT);
  let prev = { x: state.candy.x, y: state.candy.y };
  for (let i = 0; i < steps; i += 1) {
    stepFrame(state, FIXED_DT);
    maxStep = Math.max(maxStep, Math.hypot(state.candy.x - prev.x, state.candy.y - prev.y));
    prev = { x: state.candy.x, y: state.candy.y };
    if (state.status !== "playing") break;
  }
  assert.equal(state.ropes[0].active, true, "到点后自动绳应已接上");
  assert.ok(maxStep < 30, `存在瞬移：单帧最大位移 ${maxStep.toFixed(1)}px`);
});

test("绳几何：松弛产生下垂，绷紧不下垂", () => {
  const state = createState(level({ candy: [450, 200], ropes: [{ a: [450, 100], len: 100 }] }));
  const tight = ropeGeometry(state, state.ropes[0]);
  assert.equal(tight.sag, 0);
  state.candy.y = 160;
  const slack = ropeGeometry(state, state.ropes[0]);
  assert.ok(slack.sag > 0, "松弛时应有下垂");
});

test("1000 步随机游走：任意合法意图序列都不抛错、不卡死、不变式不破", () => {
  let seed = 20260915;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let round = 0; round < 40; round += 1) {
    const lvl = LEVELS[(rnd() * LEVELS.length) | 0];
    const state = createState(lvl);
    for (let step = 0; step < 1000; step += 1) {
      if (state.status !== "playing") break;
      const roll = rnd();
      if (roll < 0.35) {
        applyIntent(state, {
          type: "cut",
          x1: rnd() * WORLD.w,
          y1: rnd() * WORLD.h,
          x2: rnd() * WORLD.w,
          y2: rnd() * WORLD.h,
        });
      } else if (roll < 0.45) {
        applyIntent(state, { type: "popBubble" });
      } else if (roll < 0.55) {
        applyIntent(state, { type: "puff", index: (rnd() * 3) | 0 });
      } else if (roll < 0.7) {
        applyIntent(state, { type: "slide", index: (rnd() * 3) | 0, t: rnd() });
      } else {
        // 纯推进
      }
      stepFrame(state, FIXED_DT);
      // 不变式：坐标有限、速度有界、星级不超总数
      assert.ok(Number.isFinite(state.candy.x) && Number.isFinite(state.candy.y), "坐标出现 NaN");
      assert.ok(
        Math.hypot(state.candy.vx, state.candy.vy) <= 2600 + 1e-6,
        `速度越界 ${Math.hypot(state.candy.vx, state.candy.vy)}`
      );
      assert.ok(state.starsTaken >= 0 && state.starsTaken <= state.stars.length, "星级越界");
    }
    assert.ok(["playing", "won", "lost"].includes(state.status));
  }
});

test("simulate 与手动步进结果一致（可重放）", () => {
  const lvl = LEVELS[0];
  const a = createState(lvl);
  const b = createState(lvl);
  simulate(a, 0.6);
  const steps = Math.round(0.6 / FIXED_DT);
  for (let i = 0; i < steps; i += 1) stepFrame(b, FIXED_DT);
  assert.ok(Math.abs(a.candy.x - b.candy.x) < 1e-9);
  assert.ok(Math.abs(a.candy.y - b.candy.y) < 1e-9);
});
