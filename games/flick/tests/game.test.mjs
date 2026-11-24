import test from "node:test";
import assert from "node:assert/strict";

import { createGame } from "../js/game.mjs";
import { mulberry32 } from "../js/ai.mjs";

test("控制器：默认即开即玩，快照结构完整", () => {
  const game = createGame({ seed: 1 });
  const snapshot = game.snapshot();
  assert.equal(snapshot.mode, "solo");
  assert.equal(snapshot.boardId, "board_1gate");
  assert.equal(snapshot.humanSide, "south");
  assert.equal(snapshot.status, "playing");
  assert.equal(snapshot.phase, "aim");
  assert.equal(snapshot.turn, "south");
  assert.equal(snapshot.pucks.length, 10);
  assert.equal(snapshot.counts.south, 5);
  assert.equal(snapshot.counts.north, 5);
  assert.ok(Array.isArray(snapshot.gates));
  assert.equal(snapshot.gates.length, 1);
});

test("控制器：弹射与推进回到下一回合", () => {
  const game = createGame({ seed: 2 });
  const puck = game.snapshot().pucks.find((item) => item.id === 2);
  const shot = game.flick(puck.id, 0, -1, 0.22);
  assert.ok(shot);
  let guard = 0;
  while (game.snapshot().phase === "slide" && guard < 600) {
    game.tick(1 / 60);
    guard += 1;
  }
  const snapshot = game.snapshot();
  assert.equal(snapshot.turn, "north");
  assert.equal(snapshot.phase, "aim");
  assert.equal(snapshot.status, "playing");
  assert.equal(snapshot.counts.south, 4);
});

test("控制器：配置新盘面立即重置对局", () => {
  const game = createGame({ seed: 3 });
  assert.equal(game.snapshot().gates.length, 1);
  game.configure({ mode: "duel", boardId: "board_3gate", humanSide: "north" });
  const snapshot = game.snapshot();
  assert.equal(snapshot.mode, "duel");
  assert.equal(snapshot.boardId, "board_3gate");
  assert.equal(snapshot.humanSide, "north");
  assert.equal(snapshot.gates.length, 3);
  assert.equal(snapshot.round, 0);
  assert.equal(snapshot.counts.south, 5);
  assert.equal(game.settings.boardId, "board_3gate");
});

test("控制器：暂停、继续与重启", () => {
  const game = createGame({ seed: 4 });
  game.flick(2, 0, -1, 0.5);
  game.tick(1 / 60);
  const before = game.snapshot();
  game.pause();
  assert.equal(game.snapshot().paused, true);
  game.tick(1);
  const frozen = game.snapshot();
  assert.equal(frozen.time, before.time);
  assert.equal(frozen.pucks[2].y, before.pucks[2].y);
  game.resume();
  assert.equal(game.snapshot().paused, false);
  game.restart();
  const restarted = game.snapshot();
  assert.equal(restarted.round, 0);
  assert.equal(restarted.counts.south, 5);
  assert.equal(restarted.status, "playing");
});

test("控制器：AI 计划只读取当前回合方", () => {
  const game = createGame({ seed: 5, humanSide: "north" });
  game.configure({ mode: "solo", humanSide: "north", difficulty: "ai_master" });
  const shot = game.planAiShot(mulberry32(8));
  assert.ok(shot);
  const snapshot = game.snapshot();
  const puck = snapshot.pucks.find((item) => item.id === shot.puckId);
  assert.equal(puck.side, snapshot.turn);
});

test("控制器：调试直通可结算胜局并派发 end 事件", () => {
  const game = createGame({ seed: 6 });
  assert.equal(game.debugCrossAll("south"), 5);
  game.settle();
  const events = game.drainEvents();
  const end = events.find((event) => event.type === "end");
  assert.ok(end);
  assert.equal(end.winner, "south");
  assert.equal(end.reason, "cleared");
  const snapshot = game.snapshot();
  assert.equal(snapshot.status, "ended");
  assert.equal(snapshot.winner, "south");
  assert.equal(snapshot.counts.south, 0);
});
