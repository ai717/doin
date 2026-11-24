import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../js/game.mjs";

function advance(game, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i += 1) game.tick(1 / 60);
}

test("控制器：开局立即可玩且快照字段完整", () => {
  const game = createGame({ levelIndex: 0 });
  const snap = game.snapshot();
  assert.equal(snap.status, "playing");
  assert.equal(snap.mode, "level");
  assert.equal(snap.levelNumber, 1);
  assert.equal(snap.lives, 3);
  assert.ok(snap.enemies >= 3);
  assert.ok(snap.player.onGround);
  assert.equal(typeof snap.bossMax, "number");
});

test("控制器：固定步进推进时间，暂停后完全冻结", () => {
  const game = createGame({ levelIndex: 0 });
  advance(game, 1);
  const elapsed = game.snapshot().elapsed;
  assert.ok(elapsed > 0.95 && elapsed < 1.1);
  game.pause();
  advance(game, 1);
  assert.equal(game.snapshot().elapsed, elapsed);
  assert.equal(game.snapshot().paused, true);
  game.resume();
  advance(game, 0.5);
  assert.ok(game.snapshot().elapsed > elapsed);
});

test("控制器：输入驱动移动与跳跃", () => {
  const game = createGame({ levelIndex: 0 });
  const start = game.snapshot().player.x;
  game.setInput({ axis: 1 });
  advance(game, 0.2);
  assert.ok(game.snapshot().player.x > start);
  game.setInput({ axis: 0 });
  const ground = game.snapshot().player.y;
  game.pressJump();
  advance(game, 0.15);
  assert.ok(game.snapshot().player.y < ground);
});

test("控制器：单帧超长 tick 不会无限追帧", () => {
  const game = createGame({ levelIndex: 0 });
  game.tick(2);
  assert.ok(game.snapshot().elapsed <= 0.15);
});

test("控制器：跳关立即生效并重置本关资源", () => {
  const game = createGame({ levelIndex: 0 });
  game.loadLevel(5);
  const snap = game.snapshot();
  assert.equal(snap.levelNumber, 6);
  assert.equal(snap.status, "playing");
  assert.equal(snap.lives, 3);
  assert.equal(snap.score, 0);
});

test("控制器：过关后下一关继承生命与得分", () => {
  const game = createGame({ levelIndex: 2 });
  game.debugClear();
  advance(game, 0.1);
  const cleared = game.snapshot();
  assert.equal(cleared.status, "cleared");
  assert.ok(cleared.stars >= 1);
  const score = cleared.score;
  game.nextLevel();
  const next = game.snapshot();
  assert.equal(next.levelNumber, 4);
  assert.equal(next.status, "playing");
  assert.ok(next.score >= score);
});

test("控制器：重开本关清空得分并恢复三条命", () => {
  const game = createGame({ levelIndex: 4 });
  game.debugClear();
  advance(game, 0.1);
  game.restart();
  const snap = game.snapshot();
  assert.equal(snap.levelNumber, 5);
  assert.equal(snap.status, "playing");
  assert.equal(snap.lives, 3);
  assert.equal(snap.score, 0);
});

test("控制器：切换冲刺再切回，关卡位置保留", () => {
  const game = createGame({ levelIndex: 7 });
  game.setMode("rush");
  const rush = game.snapshot();
  assert.equal(rush.mode, "rush");
  assert.equal(rush.rushTime, 90);
  assert.equal(rush.levelNumber, 8);
  game.setMode("level");
  const level = game.snapshot();
  assert.equal(level.mode, "level");
  assert.equal(level.levelNumber, 8);
});

test("控制器：清场事件会进入 drainEvents 队列", () => {
  const game = createGame({ levelIndex: 0 });
  game.debugClear();
  game.tick(1 / 60);
  const events = game.drainEvents();
  assert.ok(events.some((event) => event.type === "clear"));
  assert.deepEqual(game.drainEvents(), []);
});
