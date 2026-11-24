import test from "node:test";
import assert from "node:assert/strict";

import {
  distanceToSegment,
  mulberry32,
  planShot,
  powerForDistance,
} from "../js/ai.mjs";
import { createMatch, flick, settleShot, sideCounts } from "../js/engine.mjs";

test("AI：距离与力度单调递增且有范围", () => {
  let last = 0;
  for (const distance of [200, 280, 380, 480, 600, 700]) {
    const power = powerForDistance(distance);
    assert.ok(power >= 0.12 && power <= 0.98);
    assert.ok(power > last, `distance ${distance} 力度未递增`);
    last = power;
  }
});

test("AI：点到线段距离计算正确", () => {
  assert.equal(distanceToSegment(0, 5, -10, 0, 10, 0), 5);
  assert.equal(distanceToSegment(0, 0, 0, 0, 0, 0), 0);
  assert.ok(Math.abs(distanceToSegment(5, 5, 0, 0, 10, 0) - 5) < 1e-9);
});

test("AI：只弹本方棋子，方向为单位向量", () => {
  const state = createMatch({ boardId: "board_1gate", mode: "solo", humanSide: "south" });
  const shot = planShot(state, "ai_novice", mulberry32(3));
  assert.ok(shot);
  const puck = state.pucks.find((item) => item.id === shot.puckId);
  assert.ok(puck);
  assert.equal(puck.side, state.turn);
  assert.ok(Math.abs(Math.hypot(shot.dirX, shot.dirY) - 1) < 1e-9);
  assert.ok(shot.power >= 0.1 && shot.power <= 0.99);
});

test("AI：同一随机种子给出同一发弹", () => {
  const state = createMatch({ boardId: "board_2gate" });
  const a = planShot(state, "ai_skilled", mulberry32(99));
  const b = planShot(state, "ai_skilled", mulberry32(99));
  assert.deepEqual(a, b);
});

test("AI：优先避开被堵死的直线", () => {
  const state = createMatch({ boardId: "board_1gate" });
  const center = state.pucks.find((item) => item.id === 2);
  const blocker = state.pucks.find((item) => item.id === 7);
  assert.ok(center && blocker);
  blocker.x = center.x;
  blocker.y = 400;
  blocker.side = "south";
  const shot = planShot(state, "ai_master", mulberry32(7));
  assert.ok(shot);
  assert.notEqual(shot.puckId, center.id, "AI 仍选了被堵死的中间棋子");
});

test("AI：非 AI 回合或终局返回 null", () => {
  const state = createMatch({ boardId: "board_1gate" });
  state.phase = "slide";
  assert.equal(planShot(state, "ai_novice"), null);
  state.phase = "aim";
  state.status = "ended";
  assert.equal(planShot(state, "ai_novice"), null);
});

test("AI：弹射后本方半场棋子数收敛（可完成过线）", () => {
  const state = createMatch({ boardId: "board_1gate", mode: "solo", humanSide: "north", seed: 4 });
  state.turn = "south";
  const before = sideCounts(state).south;
  let guard = 0;
  while (sideCounts(state).south === before && guard < 4) {
    const shot = planShot(state, "ai_master", mulberry32(20 + guard));
    assert.ok(shot);
    flick(state, shot.puckId, shot.dirX, shot.dirY, shot.power);
    settleShot(state);
    guard += 1;
    if (state.status !== "playing") break;
    state.turn = "south";
    state.phase = "aim";
  }
  assert.ok(guard < 4, "大师 AI 四次弹射仍未能过线");
  assert.ok(sideCounts(state).south < before || state.status === "ended");
});
