// engine.test.mjs - the rope geometry, the hazard probes and the state machine.
// Every assertion here is about rules only; nothing touches the DOM.

import test from "node:test";
import assert from "node:assert/strict";
import {
  DRAG_STEP,
  EDGE_MARGIN,
  HAND_RADIUS,
  MAX_PIVOTS,
  STAGE,
  TAU,
  advanceRetract,
  armLength,
  chooseSide,
  createState,
  cross,
  detectHazard,
  dist,
  dragTo,
  hazardShapes,
  normalize01,
  normalizeSigned,
  pathClearance,
  playSolution,
  segmentCircle,
  segmentIntersection,
  segmentPointDistance,
  segmentSegmentDistance,
  spotlightAngle,
  spotlightWedge,
  startRetract,
  tangentPoint,
  tick,
  visiblePath,
  wrapCount,
} from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stage(overrides = {}) {
  return {
    id: 99,
    chapter: 1,
    origin: { x: 80, y: 500 },
    target: null,
    pegs: [],
    lasers: [],
    wires: [],
    dogs: [],
    spotlights: [],
    levers: [],
    ...overrides,
  };
}

const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;

// ---------------------------------------------------------------------------
// 几何基元
// ---------------------------------------------------------------------------

test("cross: 叉积符号决定左右", () => {
  assert.equal(cross(1, 0, 0, 1), 1);
  assert.equal(cross(0, 1, 1, 0), -1);
  assert.equal(cross(2, 4, 1, 2), 0);
});

test("segmentIntersection: 交叉给出交点，平行与不相交返回 null", () => {
  const hit = segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
  assert.ok(hit);
  assert.ok(near(hit.x, 5, 1e-9) && near(hit.y, 5, 1e-9));
  assert.equal(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }), null);
  assert.equal(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: -5 }, { x: 20, y: 5 }), null);
});

test("segmentCircle: 给出进出参数，完全在外为 null，完全在内夹到 [0,1]", () => {
  const cut = segmentCircle({ x: -10, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, 5);
  assert.ok(near(cut.t0, 0.25, 1e-9) && near(cut.t1, 0.75, 1e-9));
  assert.equal(segmentCircle({ x: -10, y: 20 }, { x: 10, y: 20 }, { x: 0, y: 0 }, 5), null);
  const inside = segmentCircle({ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, 5);
  assert.deepEqual(inside, { t0: 0, t1: 1 });
});

test("segmentPointDistance: 垂足超出线段时退化为端点距离", () => {
  const inside = segmentPointDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 3 });
  assert.ok(near(inside.distance, 3, 1e-9));
  assert.ok(near(inside.t, 0.5, 1e-9));
  const outside = segmentPointDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 3 });
  assert.ok(near(outside.distance, Math.hypot(10, 3), 1e-9));
  assert.equal(outside.t, 1);
});

test("segmentSegmentDistance: 相交为 0，平行时取最小间距", () => {
  assert.equal(segmentSegmentDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 }), 0);
  const parallel = segmentSegmentDistance({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 7 }, { x: 10, y: 7 });
  assert.ok(near(parallel, 7, 1e-9));
});

test("tangentPoint: 切点落在圆周上，两侧镜像对称", () => {
  const from = { x: 0, y: 0 };
  const center = { x: 100, y: 0 };
  const plus = tangentPoint(from, center, 30, 1);
  const minus = tangentPoint(from, center, 30, -1);
  assert.ok(near(Math.hypot(plus.x - center.x, plus.y - center.y), 30, 1e-9));
  assert.ok(near(Math.hypot(minus.x - center.x, minus.y - center.y), 30, 1e-9));
  assert.ok(plus.y < 0 && minus.y > 0);
  assert.ok(near(plus.x, minus.x, 1e-9));
  // 切线互相垂直：切点半径与切线夹角 90°
  const dot = (plus.x - center.x) * (plus.x - from.x) + (plus.y - center.y) * (plus.y - from.y);
  assert.ok(near(dot, 0, 1e-9));
});

test("tangentPoint: 锚点落在柱内时退化而不是抛错", () => {
  const degenerate = tangentPoint({ x: 100, y: 0 }, { x: 100, y: 0 }, 30, 1);
  assert.equal(degenerate.degenerate, true);
  assert.ok(near(Math.hypot(degenerate.x - 100, degenerate.y), 30, 0.02));
});

test("chooseSide: 同一输入永远同一侧，镜像输入选相反侧", () => {
  const peg = { x: 50, y: 0, r: 20 };
  const straight = () => chooseSide({ x: 0, y: 0 }, { x: 100, y: 0 }, peg);
  assert.equal(straight(), straight());
  assert.ok([1, -1].includes(straight()));

  const above = chooseSide({ x: 0, y: 0 }, { x: 100, y: 0.8 }, peg);
  const below = chooseSide({ x: 0, y: 0 }, { x: 100, y: -0.8 }, peg);
  assert.ok([1, -1].includes(above) && [1, -1].includes(below));
  assert.equal(above, -below, "上下镜像必须绕不同的一侧");
});

test("normalize01 / normalizeSigned: 角度归一化", () => {
  assert.ok(near(normalize01(-Math.PI / 2), (TAU * 3) / 4, 1e-9));
  assert.ok(near(normalizeSigned(TAU * 1.25), TAU * 0.25, 1e-9));
  assert.ok(near(normalizeSigned(-TAU * 0.25), -TAU * 0.25, 1e-9));
});

// ---------------------------------------------------------------------------
// 绕桩与解绕
// ---------------------------------------------------------------------------

test("绕桩: 手臂被石柱挡住时折叠一次，路径永不穿柱", () => {
  const level = stage({ pegs: [{ x: 400, y: 500, r: 40, kind: "column" }] });
  const state = dragTo(level, createState(level), { x: 700, y: 500 });
  assert.equal(wrapCount(state), 1);
  assert.deepEqual(state.wraps[0].peg, 0);

  const path = visiblePath(level, state);
  assert.deepEqual(path[0], level.origin);
  const tail = path[path.length - 1];
  assert.ok(near(dist(tail, state.hand), 0, 1e-6));
  for (const point of path) assert.ok(dist(point, level.pegs[0]) >= 40 - 0.6);
  for (let i = 1; i < path.length; i += 1) {
    assert.equal(segmentCircle(path[i - 1], path[i], level.pegs[0], 40 - 1), null);
  }
  assert.ok(armLength(level, state) > dist(level.origin, state.hand));
});

test("解绕: 手臂拖回原位后折角自动松开", () => {
  const level = stage({ pegs: [{ x: 400, y: 500, r: 40, kind: "column" }] });
  let state = dragTo(level, createState(level), { x: 700, y: 500 });
  assert.equal(wrapCount(state), 1);
  state = dragTo(level, state, { x: 120, y: 500 });
  assert.equal(wrapCount(state), 0);
  const path = visiblePath(level, state);
  assert.equal(path.length, 2);
});

test("绕桩: 拖动手感按 DRAG_STEP 分步，短拖动一步到位", () => {
  const level = stage();
  const state = dragTo(level, createState(level), { x: 80 + DRAG_STEP, y: 500 });
  assert.equal(state.hand.x, 80 + DRAG_STEP);
  assert.ok(near(state.travelled, DRAG_STEP, 1e-9));
});

test("边界: 拖出舞台被夹在安全边距内", () => {
  const level = stage();
  const state = dragTo(level, createState(level), { x: -999, y: -999 });
  assert.equal(state.hand.x, EDGE_MARGIN);
  assert.equal(state.hand.y, EDGE_MARGIN);
  const far = dragTo(level, createState(level), { x: 9999, y: 9999 });
  assert.equal(far.hand.x, STAGE.width - EDGE_MARGIN);
  assert.equal(far.hand.y, STAGE.height - EDGE_MARGIN);
});

test("确定性: 同起点同输入序列逐帧一致", () => {
  const level = stage({ pegs: [{ x: 400, y: 300, r: 36, kind: "column" }, { x: 560, y: 440, r: 30, kind: "column" }] });
  const run = () => {
    let state = createState(level);
    const rng = mulberry32(20240607);
    for (let i = 0; i < 120; i += 1) {
      state = dragTo(level, state, { x: 60 + rng() * 720, y: 60 + rng() * 440 });
      if (state.status !== "aim") break;
    }
    return state;
  };
  const a = run();
  const b = run();
  assert.deepEqual(a.hand, b.hand);
  assert.deepEqual(a.wraps, b.wraps);
  assert.equal(a.travelled, b.travelled);
  assert.equal(a.status, b.status);
});

test("不变式: 1200 步随机游走不产生 NaN、不越界、不超桩数、臂长单调", () => {
  const level = stage({
    pegs: [
      { x: 320, y: 260, r: 34, kind: "column" },
      { x: 520, y: 380, r: 28, kind: "column" },
    ],
  });
  const rng = mulberry32(987654321);
  let state = createState(level);
  let previous = 0;
  let steps = 0;
  for (let i = 0; i < 1200; i += 1) {
    steps += 1;
    state = dragTo(level, state, { x: rng() * STAGE.width, y: rng() * STAGE.height });
    assert.equal(state.status, "aim");
    assert.ok(Number.isFinite(state.hand.x) && Number.isFinite(state.hand.y), "hand stays finite");
    assert.ok(state.hand.x >= EDGE_MARGIN - 1e-6 && state.hand.x <= STAGE.width - EDGE_MARGIN + 1e-6);
    assert.ok(state.hand.y >= EDGE_MARGIN - 1e-6 && state.hand.y <= STAGE.height - EDGE_MARGIN + 1e-6);
    assert.ok(wrapCount(state) <= MAX_PIVOTS, "pivot budget holds");
    assert.ok(state.travelled >= previous - 1e-9, "travel is monotonic");
    previous = state.travelled;
    const path = visiblePath(level, state);
    assert.deepEqual(path[0], level.origin);
    assert.ok(near(dist(path[path.length - 1], state.hand), 0, 1e-6));
    const reach = armLength(level, state);
    assert.ok(Number.isFinite(reach) && reach >= dist(level.origin, state.hand) - 1e-6);
  }
  assert.equal(steps, 1200);
  assert.ok(state.travelled > 0);
});

test("不变式: 带危险的关卡随机游走只有三种收场", () => {
  const level = LEVELS[9];
  const rng = mulberry32(4242);
  let state = createState(level);
  for (let i = 0; i < 400; i += 1) {
    state = dragTo(level, state, { x: rng() * STAGE.width, y: rng() * STAGE.height });
    if (state.status !== "aim") break;
  }
  assert.ok(["aim", "shock", "retract"].includes(state.status));
  if (state.status === "shock") assert.ok(["laser", "wire", "dog", "spot"].includes(state.failure.kind));
});

// ---------------------------------------------------------------------------
// 危险
// ---------------------------------------------------------------------------

test("激光: 手臂横穿光束立刻触电", () => {
  const level = stage({ lasers: [{ x1: 400, y1: 0, x2: 400, y2: STAGE.height }] });
  const state = dragTo(level, createState(level), { x: 600, y: 500 });
  assert.equal(state.status, "shock");
  assert.equal(state.failure.kind, "laser");
});

test("铁丝网: 矩形任一边被手臂切到就算触网", () => {
  const level = stage({ wires: [{ x: 300, y: 340, w: 160, h: 14 }] });
  const state = dragTo(level, createState(level), { x: 400, y: 300 });
  assert.equal(state.status, "shock");
  assert.equal(state.failure.kind, "wire");
});

test("恶犬: 手臂进入犬只警戒圈就算被咬", () => {
  const level = stage({ dogs: [{ x: 400, y: 500, r: 46 }] });
  const state = dragTo(level, createState(level), { x: 700, y: 500 });
  assert.equal(state.status, "shock");
  assert.equal(state.failure.kind, "dog");
});

test("探照灯: 只照手掌，光锥扫过手臂不算失败", () => {
  const level = stage({
    spotlights: [{ x: 400, y: 500, angle: -Math.PI / 2, spread: 0.3, length: 260 }],
  });
  const lit = dragTo(level, createState(level), { x: 700, y: 100 });
  assert.equal(lit.status, "aim", "只有手臂穿过光锥时不该判失败");
  assert.equal(detectHazard(level, lit), null);

  const caught = dragTo(level, lit, { x: 400, y: 400 });
  assert.equal(caught.status, "shock");
  assert.equal(caught.failure.kind, "spot");
});

test("探照灯: 摆动模式按正弦推进，静止模式保持不动", () => {
  const sway = { x: 100, y: 100, angle: 0, amplitude: 0.7, period: 6, phase: 0 };
  assert.ok(near(spotlightAngle(sway, 0), 0, 1e-9));
  assert.ok(spotlightAngle(sway, 1.5) > 0);
  assert.ok(spotlightAngle(sway, 4.5) < 0);
  assert.ok(near(spotlightAngle(sway, 6), spotlightAngle(sway, 0), 1e-9));

  const fixed = { x: 100, y: 100, angle: 0.4 };
  assert.equal(spotlightAngle(fixed, 12), 0.4);
  const wedge = spotlightWedge(fixed, 0);
  assert.equal(wedge.x, 100);
  assert.equal(wedge.points.length, 10);
});

test("探照灯: tick 只在有光锥的关卡推进时间", () => {
  const still = stage();
  const s0 = createState(still);
  assert.equal(tick(still, s0, 0.5), s0);

  const swaying = stage({ spotlights: [{ x: 700, y: 80, angle: 2, amplitude: 0.4, period: 5 }] });
  const s1 = tick(swaying, createState(swaying), 0.5);
  assert.ok(near(s1.time, 0.5, 1e-9));
});

test("电闸: 按下拉杆后成组激光熄灭，没按就照旧致命", () => {
  const level = stage({
    levers: [{ x: 240, y: 500, group: "gate" }],
    lasers: [{ x1: 400, y1: 0, x2: 400, y2: STAGE.height, group: "gate" }],
  });
  const doomed = dragTo(level, createState(level), { x: 600, y: 500 });
  assert.equal(doomed.status, "shock");

  let state = dragTo(level, createState(level), { x: 240, y: 500 });
  assert.equal(state.levers.gate, true);
  state = dragTo(level, state, { x: 600, y: 500 });
  assert.equal(state.status, "aim");
  assert.equal(hazardShapes(level, state).lasers.length, 0);
});

// ---------------------------------------------------------------------------
// 抓取与回弹
// ---------------------------------------------------------------------------

test("抓取: 手掌进入宝物范围立刻进入回弹，回弹结束判胜", () => {
  const level = stage({ target: { x: 700, y: 500, r: 20, key: "diamond" } });
  let state = dragTo(level, createState(level), { x: 700, y: 500 });
  assert.equal(state.status, "retract");
  assert.equal(state.grabbed, true);
  assert.ok(state.flight.points.length >= 2);

  const before = state.hand;
  state = advanceRetract(level, state, 0.05);
  assert.equal(state.status, "retract");
  assert.ok(dist(state.hand, before) > 0);

  for (let i = 0; i < 200 && state.status === "retract"; i += 1) state = advanceRetract(level, state, 0.05);
  assert.equal(state.status, "won");
  assert.deepEqual(state.hand, level.origin);
});

test("回弹: 回弹中再拖动手臂不起作用", () => {
  const level = stage({ target: { x: 700, y: 500, r: 20, key: "diamond" } });
  let state = dragTo(level, createState(level), { x: 700, y: 500 });
  assert.equal(state.status, "retract");
  const frozen = dragTo(level, state, { x: 300, y: 300 });
  assert.equal(frozen, state);
});

test("startRetract: 直接调用也能把当前手臂变成回弹轨迹", () => {
  const level = stage({ pegs: [{ x: 400, y: 500, r: 40, kind: "column" }] });
  const aiming = dragTo(level, createState(level), { x: 700, y: 500 });
  const retracting = startRetract(level, aiming);
  assert.equal(retracting.status, "retract");
  assert.ok(retracting.flight.total >= armLength(level, aiming) - 1e-6);
  assert.equal(retracting.flightRemain, retracting.flight.total);
});

// ---------------------------------------------------------------------------
// 距离余量
// ---------------------------------------------------------------------------

test("pathClearance: 无危险返回 Infinity，有危险返回有限余量", () => {
  const empty = stage();
  assert.equal(pathClearance(empty, createState(empty)), Infinity);

  const level = stage({ lasers: [{ x1: 400, y1: 0, x2: 400, y2: 480 }] });
  const state = dragTo(level, createState(level), { x: 700, y: 520 });
  const clearance = pathClearance(level, state);
  assert.ok(Number.isFinite(clearance));
  assert.ok(clearance > 0);
  assert.ok(clearance < HAND_RADIUS * 4);
});

test("playSolution: 关卡 1 的作者路线在真引擎里能打通", () => {
  const level = LEVELS[0];
  const state = playSolution(level);
  assert.ok(["retract", "won"].includes(state.status));
  assert.ok(state.travelled > 0);
});
