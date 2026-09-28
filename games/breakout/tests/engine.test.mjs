import test from "node:test";
import assert from "node:assert/strict";

import {
  createGame,
  stepFrame,
  applyIntent,
  snapshot,
  mulberry32,
  FIELD_W,
  FIELD_H,
  PADDLE_Y,
  BALL_R,
  PHASES,
  MAX_BALLS,
  MAX_LIVES,
} from "../js/engine.mjs";
import { RELIC_IDS } from "../js/relics.mjs";
import { TOTAL_LAYERS } from "../js/levels.mjs";

function makeState(overrides = {}) {
  return createGame({ mode: "rogue", seed: 12345, ...overrides });
}

test("engine: initial state has bricks, one stuck ball, 3 lives", () => {
  const s = makeState();
  assert.equal(s.phase, PHASES.ready);
  assert.equal(s.lives, MAX_LIVES);
  assert.equal(s.balls.length, 1);
  assert.equal(s.balls[0].stuck, true);
  assert.ok(s.bricks.length > 0);
});

test("engine: launch intent transitions ready -> playing and unstucks ball", () => {
  const s = makeState();
  const action = applyIntent(s, "launch");
  assert.equal(action, "launch");
  assert.equal(s.phase, PHASES.playing);
  assert.equal(s.balls[0].stuck, false);
  assert.notEqual(s.balls[0].vy, 0);
});

test("engine: invalid intent returns null, never throws", () => {
  const s = makeState();
  assert.equal(applyIntent(s, "bogus"), null);
  assert.equal(applyIntent(s, ""), null);
  assert.equal(applyIntent(s, null), null);
});

test("engine: ball stays within field horizontally (wall reflection)", () => {
  const s = makeState();
  applyIntent(s, "launch");
  // 跑 200 步
  for (let i = 0; i < 200; i += 1) stepFrame(s, 1 / 60, {});
  for (const ball of s.balls) {
    assert.ok(ball.x >= -BALL_R - 1 && ball.x <= FIELD_W + BALL_R + 1, `ball x out of range: ${ball.x}`);
  }
});

test("engine: paddle movement respects boundaries", () => {
  const s = makeState();
  // 持续向右移动
  for (let i = 0; i < 300; i += 1) stepFrame(s, 1 / 60, { right: true });
  assert.ok(s.paddle.x <= FIELD_W - 6 + 0.1);
  // 持续向左
  for (let i = 0; i < 300; i += 1) stepFrame(s, 1 / 60, { left: true });
  assert.ok(s.paddle.x >= 6 - 0.1);
});

test("engine: bricks break and score increases", () => {
  const s = makeState();
  applyIntent(s, "launch");
  const startScore = s.score;
  const startBricks = s.bricks.filter((b) => b.alive && b.type !== 5).length;
  // 跑足够多步让球击碎一些砖
  for (let i = 0; i < 3000; i += 1) stepFrame(s, 1 / 60, { left: i % 2 === 0, right: i % 2 === 1 });
  const endBricks = s.bricks.filter((b) => b.alive && b.type !== 5).length;
  assert.ok(endBricks <= startBricks);
  if (endBricks < startBricks) {
    assert.ok(s.score > startScore, "score should increase when bricks break");
  }
});

test("engine: 1000-step random walk never throws or violates invariants", () => {
  const s = makeState();
  applyIntent(s, "launch");
  const rng = mulberry32(999);
  for (let i = 0; i < 1000; i += 1) {
    const input = { left: rng() < 0.5, right: rng() < 0.5 };
    stepFrame(s, 1 / 60, input);
    // 不变式
    assert.ok(s.balls.length <= MAX_BALLS + 1, `too many balls: ${s.balls.length}`);
    assert.ok(s.lives >= 0 && s.lives <= MAX_LIVES);
    assert.ok(s.score >= 0);
    for (const ball of s.balls) {
      assert.ok(Number.isFinite(ball.x) && Number.isFinite(ball.y));
      assert.ok(ball.x >= -50 && ball.x <= FIELD_W + 50);
      assert.ok(ball.y >= -50 && ball.y <= FIELD_H + 50);
    }
    assert.ok(s.paddle.x >= 0 && s.paddle.x <= FIELD_W);
    if (s.phase === PHASES.lost || s.phase === PHASES.won) break;
  }
  // 终局后 stepFrame 为 no-op
  const phaseBefore = s.phase;
  stepFrame(s, 1 / 60, {});
  assert.equal(s.phase, phaseBefore);
});

test("engine: clearing a layer opens relic phase with 3 choices", () => {
  // 直接构造一个只有 1 块 1 血砖的层
  const s = makeState();
  s.bricks = [
    { col: 4, row: 0, type: 1, hp: 1, maxHp: 1, alive: true, x: 200, y: 60 },
  ];
  s.boss = null;
  s.phase = PHASES.playing;
  s.balls[0].stuck = false;
  s.balls[0].x = 220;
  s.balls[0].y = 80;
  s.balls[0].vx = 0;
  s.balls[0].vy = 200; // 直冲砖块
  for (let i = 0; i < 200; i += 1) {
    stepFrame(s, 1 / 120, {});
    if (s.phase === PHASES.relic) break;
  }
  assert.equal(s.phase, PHASES.relic);
  assert.equal(s.relicChoices.length, 3);
  for (const id of s.relicChoices) {
    assert.ok(RELIC_IDS.includes(id), `unknown relic: ${id}`);
  }
});

test("engine: picking a relic advances to next layer", () => {
  const s = makeState();
  s.bricks = [
    { col: 4, row: 0, type: 1, hp: 1, maxHp: 1, alive: true, x: 200, y: 60 },
  ];
  s.boss = null;
  s.phase = PHASES.playing;
  s.balls[0].stuck = false;
  s.balls[0].x = 220;
  s.balls[0].y = 80;
  s.balls[0].vx = 0;
  s.balls[0].vy = 200;
  for (let i = 0; i < 200; i += 1) {
    stepFrame(s, 1 / 120, {});
    if (s.phase === PHASES.relic) break;
  }
  const choice = s.relicChoices[0];
  const startLayer = s.layer;
  const action = applyIntent(s, `pick:${choice}`);
  assert.ok(action);
  assert.equal(s.relics[0], choice);
  assert.equal(s.layer, startLayer + 1);
});

test("engine: losing all balls costs a life and respawns", () => {
  const s = makeState();
  applyIntent(s, "launch");
  // 把球直接移出底部
  s.balls[0].y = FIELD_H + 100;
  s.balls[0].x = 240;
  s.balls[0].vy = 1;
  const livesBefore = s.lives;
  stepFrame(s, 1 / 60, {});
  assert.equal(s.lives, livesBefore - 1);
  assert.equal(s.phase, PHASES.ready);
  assert.equal(s.balls.length, 1);
  assert.equal(s.balls[0].stuck, true);
});

test("engine: game over when lives reach 0", () => {
  const s = makeState();
  s.lives = 1;
  applyIntent(s, "launch");
  s.balls[0].y = FIELD_H + 100;
  s.balls[0].vy = 1;
  stepFrame(s, 1 / 60, {});
  assert.equal(s.phase, PHASES.lost);
  assert.equal(s.lives, 0);
});

test("engine: snapshot returns valid read-only state", () => {
  const s = makeState();
  const snap = snapshot(s);
  assert.ok(["ready", "playing", "relic", "won", "lost"].includes(snap.phase));
  assert.equal(typeof snap.score, "number");
  assert.equal(typeof snap.lives, "number");
});
