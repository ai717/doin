import test from "node:test";
import assert from "node:assert/strict";

import { mulberry32 } from "../js/ai.mjs";
import {
  WORLD,
  PLAY_MAX_X,
  PLAY_MAX_Y,
  PLAY_MIN_X,
  PLAY_MIN_Y,
  advance,
  canFlick,
  createMatch,
  debugCrossAll,
  drainEvents,
  flick,
  setPaused,
  settleShot,
  sideCounts,
  snapshot,
} from "../js/engine.mjs";

function near(a, b, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

test("开局：十枚棋子、五五分区、单孔盘就绪", () => {
  const state = createMatch({ boardId: "board_1gate", mode: "solo", humanSide: "south" });
  assert.equal(state.pucks.length, 10);
  const counts = sideCounts(state);
  assert.equal(counts.south, 5);
  assert.equal(counts.north, 5);
  assert.equal(state.turn, "south");
  assert.equal(state.phase, "aim");
  assert.equal(state.status, "playing");
  assert.equal(state.round, 0);
  assert.equal(state.gates.length, 1);
  assert.equal(state.gates[0].x, WORLD.width * 0.5);
  assert.equal(state.gates[0].y, WORLD.height / 2);
  for (const puck of state.pucks) {
    assert.equal(puck.vx, 0);
    assert.equal(puck.vy, 0);
    assert.ok(puck.x >= PLAY_MIN_X && puck.x <= PLAY_MAX_X);
    assert.ok(puck.y >= PLAY_MIN_Y && puck.y <= PLAY_MAX_Y);
  }
});

test("弹射：合法棋子进入滑行并记录回合", () => {
  const state = createMatch({ boardId: "board_1gate" });
  const puck = state.pucks.find((item) => item.side === "south");
  assert.equal(canFlick(state, puck.id), true);
  const shot = flick(state, puck.id, 0, -1, 0.4);
  assert.ok(shot);
  assert.equal(state.phase, "slide");
  assert.equal(state.round, 1);
  assert.ok(puck.vy < 0);
  assert.ok(Math.hypot(puck.vx, puck.vy) > WORLD.minFlickSpeed);
  const events = drainEvents(state);
  assert.equal(events.some((event) => event.type === "flick"), true);
});

test("弹射：非法意图一律静默返回 null", () => {
  const state = createMatch({ boardId: "board_1gate" });
  const north = state.pucks.find((item) => item.side === "north");
  assert.equal(flick(state, north.id, 0, 1, 0.5), null);
  assert.equal(flick(state, 999, 0, 1, 0.5), null);
  assert.equal(flick(state, state.pucks[0].id, 0, 0, 0.5), null);
  state.paused = true;
  assert.equal(flick(state, state.pucks[0].id, 0, 1, 0.5), null);
  state.paused = false;
  state.status = "ended";
  assert.equal(flick(state, state.pucks[0].id, 0, 1, 0.5), null);
});

test("物理：同一发弹在固定步长下完全可复现", () => {
  const a = createMatch({ boardId: "board_1gate", seed: 5 });
  const b = createMatch({ boardId: "board_1gate", seed: 5 });
  const puckA = a.pucks.find((item) => item.id === 2);
  const puckB = b.pucks.find((item) => item.id === 2);
  flick(a, puckA.id, 0.32, -0.95, 0.52);
  flick(b, puckB.id, 0.32, -0.95, 0.52);
  for (let i = 0; i < 150; i += 1) {
    advance(a, 1 / 60);
    advance(b, 1 / 60);
  }
  for (let i = 0; i < a.pucks.length; i += 1) {
    assert.ok(near(a.pucks[i].x, b.pucks[i].x, 1e-6));
    assert.ok(near(a.pucks[i].y, b.pucks[i].y, 1e-6));
    assert.ok(near(a.pucks[i].vx, b.pucks[i].vx, 1e-6));
    assert.ok(near(a.pucks[i].vy, b.pucks[i].vy, 1e-6));
  }
});

test("物理：摩擦让棋子最终全部停稳且不越界", () => {
  const state = createMatch({ boardId: "board_3gate" });
  flick(state, 2, 0.9, -0.44, 1);
  let guard = 0;
  while (state.phase === "slide" && guard < 900) {
    advance(state, 1 / 60);
    guard += 1;
  }
  assert.ok(guard < 900, "棋子未在合理时间内停稳");
  for (const puck of state.pucks) {
    assert.equal(puck.vx, 0);
    assert.equal(puck.vy, 0);
    assert.ok(puck.x >= PLAY_MIN_X - 0.01 && puck.x <= PLAY_MAX_X + 0.01);
    assert.ok(puck.y >= PLAY_MIN_Y - 0.01 && puck.y <= PLAY_MAX_Y + 0.01);
    assert.ok(Number.isFinite(puck.x) && Number.isFinite(puck.y));
  }
});

test("过线：正对孔门弹射可穿线到对方半场并交出回合", () => {
  const state = createMatch({ boardId: "board_1gate" });
  const puck = state.pucks.find((item) => item.id === 2);
  assert.ok(puck);
  flick(state, puck.id, 0, -1, 0.22);
  settleShot(state);
  assert.equal(puck.side, "north");
  assert.ok(puck.y < WORLD.height / 2);
  const counts = sideCounts(state);
  assert.equal(counts.south, 4);
  assert.equal(counts.north, 6);
  assert.equal(state.status, "playing");
  assert.equal(state.turn, "north");
  assert.equal(state.phase, "aim");
});

test("桌缝：偏离孔门的弹射会被弹回本方半场", () => {
  const state = createMatch({ boardId: "board_1gate" });
  const puck = state.pucks.find((item) => item.x < WORLD.width * 0.4 && item.side === "south");
  assert.ok(puck);
  flick(state, puck.id, 0, -1, 0.3);
  settleShot(state);
  assert.equal(puck.side, "south");
  assert.ok(puck.y > WORLD.height / 2);
  const counts = sideCounts(state);
  assert.equal(counts.south, 5);
  assert.equal(counts.north, 5);
});

test("暂停：冻结位移与计时，继续后恢复", () => {
  const state = createMatch({ boardId: "board_1gate" });
  flick(state, 2, 0, -1, 0.5);
  advance(state, 1 / 60);
  const before = snapshot(state);
  setPaused(state, true);
  advance(state, 2);
  const frozen = snapshot(state);
  assert.equal(frozen.time, before.time);
  assert.equal(frozen.pucks[2].x, before.pucks[2].x);
  assert.equal(frozen.pucks[2].y, before.pucks[2].y);
  setPaused(state, false);
  advance(state, 0.2);
  assert.ok(snapshot(state).time > frozen.time);
});

test("胜负：清空本方半场立即结束并判胜", () => {
  const state = createMatch({ boardId: "board_1gate" });
  assert.equal(debugCrossAll(state, "south"), 5);
  advance(state, 0.2);
  assert.equal(state.status, "ended");
  assert.equal(state.winner, "south");
  assert.equal(state.reason, "cleared");
  assert.equal(sideCounts(state).south, 0);
});

test("胜负：回合上限按半场剩余棋子判平", () => {
  const state = createMatch({ boardId: "board_1gate" });
  state.round = state.maxRounds - 1;
  const puck = state.pucks.find((item) => item.x < WORLD.width * 0.4 && item.side === "south");
  flick(state, puck.id, -1, 0, 0.05);
  settleShot(state);
  assert.equal(state.status, "ended");
  assert.equal(state.reason, "limit");
  assert.equal(state.winner, "draw");
  assert.equal(state.round, state.maxRounds);
});

test("随机游走：一千二百步任意弹射不抛错且不变量守恒", () => {
  const rng = mulberry32(0x51ce);
  let state = createMatch({ boardId: "board_2gate", seed: 11 });
  for (let step = 0; step < 1200; step += 1) {
    if (state.status !== "playing") {
      state = createMatch({ boardId: "board_2gate", seed: step + 1 });
    }
    if (state.phase === "aim") {
      const own = state.pucks.filter((puck) => puck.side === state.turn && puck.vx === 0 && puck.vy === 0);
      if (own.length) {
        const puck = own[Math.floor(rng() * own.length)];
        const angle = rng() * Math.PI * 2;
        flick(state, puck.id, Math.cos(angle), Math.sin(angle), 0.08 + rng() * 0.92);
      }
    }
    advance(state, 1 / 60);
    assert.equal(state.pucks.length, 10);
    const counts = sideCounts(state);
    assert.equal(counts.south + counts.north, 10);
    for (const puck of state.pucks) {
      assert.ok(Number.isFinite(puck.x) && Number.isFinite(puck.y), `step ${step} 坐标非有限`);
      assert.ok(puck.x >= PLAY_MIN_X - 0.01 && puck.x <= PLAY_MAX_X + 0.01, `step ${step} x 越界 ${puck.x}`);
      assert.ok(puck.y >= PLAY_MIN_Y - 0.01 && puck.y <= PLAY_MAX_Y + 0.01, `step ${step} y 越界 ${puck.y}`);
    }
    assert.ok(["playing", "ended"].includes(state.status));
    assert.ok(state.round <= state.maxRounds);
    assert.ok(Number.isFinite(state.time));
  }
});
