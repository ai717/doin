import test from "node:test";
import assert from "node:assert/strict";

import {
  AIM_LIMIT, BALL_RADIUS, BUCKET_Y, FEVER_BONUS, HEIGHT, PEG_RADIUS, START_BALLS,
  STATUS_AIM, STATUS_FLIGHT, STATUS_FEVER, STATUS_LOST, STATUS_WON, WIDTH,
  advanceFever, angleToVector, bucketBounds, clampAim, createState, finishFever,
  fire, setAim, simulateShot, stepFrame, traceAim,
} from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";

const eq = assert.strictEqual;

function customLevel(pegs = [], extras = {}) {
  return {
    id: "test",
    chapter: 1,
    pegs: pegs.map((peg, index) => ({
      id: peg.id ?? `t-${index}`,
      x: peg.x,
      y: peg.y,
      type: peg.type ?? "blue",
      shape: peg.shape ?? "circle",
      radius: peg.radius ?? PEG_RADIUS,
      length: peg.length ?? 0,
      thickness: peg.thickness ?? 20,
      angle: peg.angle ?? 0,
    })),
    rotors: extras.rotors ?? [],
    wells: extras.wells ?? [],
  };
}

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

test("初始状态：10 颗弹珠、瞄准可用、目标钉计数正确", () => {
  const level = LEVELS[0];
  const state = createState(level);
  eq(state.ballsLeft, START_BALLS);
  eq(state.status, STATUS_AIM);
  eq(state.orangeLeft, state.orangeTotal);
  eq(state.orangeTotal, level.orangeTotal);
  eq(state.balls.length, 0);
  eq(state.aim, 0);
  assert.ok(state.pegs.every((peg) => peg.active && !peg.hit));
});

test("瞄准角度被钳制在 ±80°，非法角度回退 0", () => {
  eq(AIM_LIMIT, 80);
  eq(clampAim(120), 80);
  eq(clampAim(-120), -80);
  eq(clampAim(Number.NaN), 0);
  eq(clampAim("35"), 35);
  const state = createState(customLevel());
  eq(setAim(state, 120).aim, 80);
  eq(setAim(state, -500).aim, -80);
  const dir = angleToVector(0);
  assert.ok(Math.abs(dir.x) < 1e-9 && Math.abs(dir.y - 1) < 1e-9);
});

test("发射消耗一颗弹珠并产生向右/左的速度分量", () => {
  const state = createState(customLevel());
  const fired = fire(setAim(state, 30));
  eq(fired.ballsLeft, START_BALLS - 1);
  eq(fired.status, STATUS_FLIGHT);
  eq(fired.balls.length, 1);
  assert.ok(fired.balls[0].vx > 0);
  assert.ok(fired.balls[0].vy > 0);
  eq(fire(fired), fired, "飞行中不可再次发射");
  eq(state.status, STATUS_AIM, "旧状态不可被就地修改");
});

test("重力与固定步长：竖直发射时速度持续增加", () => {
  const state = fire(setAim(createState(customLevel()), 0));
  const first = state.balls[0];
  const next = stepFrame(state, 1 / 120);
  const ball = next.balls[0];
  assert.ok(ball.y > first.y);
  assert.ok(ball.vy > first.vy);
  assert.ok(Math.abs(ball.x - first.x) < 1e-6);
});

test("撞钉：命中一次、加分、点亮并发出事件", () => {
  const level = customLevel([{ x: 420, y: 170, type: "blue" }]);
  let state = fire(setAim(createState(level), 0));
  let hitFrame = null;
  for (let i = 0; i < 240 && !hitFrame; i += 1) {
    state = stepFrame(state, 1 / 120);
    if (state.events.some((event) => event.type === "peg")) hitFrame = state;
  }
  assert.ok(hitFrame, "弹珠应当命中正下方的钉子");
  eq(hitFrame.pegs[0].hit, true);
  assert.ok(hitFrame.score >= 100);
  const pegEvent = hitFrame.events.find((event) => event.type === "peg");
  assert.ok(Number.isFinite(pegEvent.x) && Number.isFinite(pegEvent.y));
  const scoreAfter = hitFrame.score;
  const later = stepFrame(hitFrame, 1 / 120);
  assert.ok(later.score >= scoreAfter, "同一颗钉子不得重复计分");
});

test("胶囊药丸钉同样能反弹命中", () => {
  const level = customLevel([{ x: 420, y: 170, type: "orange", shape: "pill", length: 60, angle: 0 }]);
  let state = fire(setAim(createState(level), 0));
  for (let i = 0; i < 240 && state.orangeLeft > 0; i += 1) state = stepFrame(state, 1 / 120);
  eq(state.orangeLeft, 0);
  assert.ok(state.pegs[0].hit);
});

test("侧墙反弹：球心始终留在场内", () => {
  let state = fire(setAim(createState(customLevel()), 78));
  let bounced = false;
  for (let i = 0; i < 600; i += 1) {
    state = stepFrame(state, 1 / 120);
    for (const ball of state.balls) {
      assert.ok(ball.x >= BALL_RADIUS - 0.5 && ball.x <= WIDTH - BALL_RADIUS + 0.5);
      assert.ok(Number.isFinite(ball.vx) && Number.isFinite(ball.vy));
    }
    if (state.balls.some((ball) => ball.vx < 0)) bounced = true;
    if (state.status !== STATUS_FLIGHT && state.status !== STATUS_FEVER) break;
  }
  assert.ok(bounced, "应当发生侧墙反弹");
});

test("接球斗常驻律动，接住返还弹珠或落袋得分", () => {
  const state = createState(customLevel());
  const first = bucketBounds(state);
  const moved = stepFrame(state, 1 / 60);
  const second = bucketBounds(moved);
  assert.notEqual(Math.round(first.left * 100), Math.round(second.left * 100));

  const shot = simulateShot(state, 64, { dt: 1 / 120, maxSteps: 2400 });
  assert.ok(
    shot.ballsLeft > START_BALLS - 1 || shot.score >= 1000,
    "底部应当发生接球或落袋",
  );
  assert.ok(shot.ballsLeft >= 0);
});

test("清空最后一颗橙钉触发狂喜，慢动作结束后结算为胜利", () => {
  const level = customLevel([{ x: 420, y: 170, type: "orange" }]);
  let state = fire(setAim(createState(level), 0));
  for (let i = 0; i < 240 && state.status !== STATUS_FEVER; i += 1) state = stepFrame(state, 1 / 120);
  eq(state.status, STATUS_FEVER);
  eq(state.orangeLeft, 0);
  assert.ok(state.events.some((event) => event.type === "fever"));

  let guard = 0;
  while (state.status === STATUS_FEVER && guard < 2000) {
    state = advanceFever(state, 1 / 120);
    guard += 1;
  }
  eq(state.status, STATUS_WON);
  assert.ok(state.score >= FEVER_BONUS);
  eq(finishFever(state), state, "非狂喜状态 finishFever 必须 no-op");
});

test("贴图边界：弹珠越出底部后进入瞄准态，弹珠数递减", () => {
  let state = fire(setAim(createState(customLevel()), -80));
  for (let i = 0; i < 2400 && state.status === STATUS_FLIGHT; i += 1) state = stepFrame(state, 1 / 120);
  eq(state.status, STATUS_AIM);
  assert.ok(state.ballsLeft <= START_BALLS);
});

test("瞄准导轨：从炮口出发并在钉面处折返", () => {
  const level = customLevel([{ x: 420, y: 200, type: "blue" }]);
  const state = createState(level);
  const trace = traceAim(state, 0, { bounces: 1 });
  assert.ok(trace.points.length > 4);
  assert.ok(Math.abs(trace.points[0].x - 420) < 30);
  assert.ok(trace.points[0].y < 90);
  assert.ok(trace.firstBounce > 0);
  const ballistic = traceAim(createState(customLevel()), 0, { bounces: 1 });
  assert.ok(ballistic.points.length > 2);
});

test("确定性：同一状态与同一 dt 序列结果完全一致", () => {
  const run = () => {
    let state = fire(setAim(createState(LEVELS[5]), 31));
    for (let i = 0; i < 900; i += 1) {
      state = state.status === STATUS_FEVER ? advanceFever(state, 1 / 120) : stepFrame(state, 1 / 120);
    }
    return JSON.stringify({
      status: state.status,
      score: state.score,
      ballsLeft: state.ballsLeft,
      orange: state.orangeLeft,
      bucket: state.bucket.phase.toFixed(6),
      pegs: state.pegs.map((peg) => (peg.hit ? 1 : 0)).join(""),
    });
  };
  eq(run(), run());
});

test("1000 步随机游走：不抛错、数值有限、目标计数守恒", () => {
  const rng = mulberry32(0xabc123);
  let state = createState(LEVELS[3], { seed: 0xabc123 });
  let steps = 0;
  let shots = 0;

  while (steps < 1000) {
    if (state.status === STATUS_AIM) {
      const angle = rng() * 160 - 80;
      state = fire(setAim(state, angle));
      shots += 1;
      steps += 1;
      continue;
    }
    state = state.status === STATUS_FEVER ? advanceFever(state, 1 / 120) : stepFrame(state, 1 / 120);
    steps += 1;
    for (const ball of state.balls) {
      assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y));
      assert.ok(Number.isFinite(ball.vx) && Number.isFinite(ball.vy));
      assert.ok(ball.x > -200 && ball.x < WIDTH + 200);
    }
    assert.ok(Number.isFinite(state.score) && state.score >= 0);
    assert.ok(state.orangeLeft >= 0 && state.orangeLeft <= state.orangeTotal);
    if (state.status === STATUS_WON || state.status === STATUS_LOST) {
      state = createState(LEVELS[3], { seed: state.rng + 1 });
    }
  }
  assert.ok(shots >= 1);
  assert.ok(state.orangeTotal >= 10);
});

test("狂喜计分不重复、终局状态不再推进物理", () => {
  const level = customLevel([{ x: 420, y: 170, type: "orange" }]);
  let state = fire(setAim(createState(level), 0));
  for (let i = 0; i < 240; i += 1) state = stepFrame(state, 1 / 120);
  while (state.status === STATUS_FEVER) state = advanceFever(state, 1 / 120);
  const score = state.score;
  const next = stepFrame(state, 1 / 120);
  eq(next.score, score);
  eq(next.status, STATUS_WON);
  void BUCKET_Y;
  void HEIGHT;
});
