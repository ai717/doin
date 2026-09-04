import test from "node:test";
import assert from "node:assert/strict";
import { STATUS_LOST, STATUS_READY, STATUS_WON } from "../js/engine.mjs";
import { applyAction, createGame, elapsedMs, isOver, restart } from "../js/game.mjs";
import { DIFFICULTIES, getDifficulty, resolveConfig } from "../js/level.mjs";

test("level: 三档经典难度，resolveConfig 一律夹取", () => {
  assert.deepEqual(
    DIFFICULTIES.map((d) => [d.rows, d.cols, d.mines]),
    [
      [9, 9, 10],
      [16, 16, 40],
      [16, 30, 99],
    ]
  );
  assert.equal(getDifficulty("beginner").label, "初级");
  assert.equal(getDifficulty("nope"), null);
  assert.deepEqual(resolveConfig({ difficulty: "expert" }), { rows: 16, cols: 30, mines: 99 });
  // 非法自定义参数被夹取而不是炸掉（cols 缺省走默认 9）
  assert.deepEqual(resolveConfig({ difficulty: "nope", rows: 1, mines: 9999 }), {
    rows: 5,
    cols: 9,
    mines: 36,
  });
});

test("createGame: 初始为 ready，未计时", () => {
  const game = createGame({ difficulty: "beginner" });
  assert.equal(game.state.status, STATUS_READY);
  assert.equal(game.config.mines, 10);
  assert.equal(game.startedAt, 0);
  assert.equal(game.finishedAt, 0);
  assert.equal(elapsedMs(game, 1000), 0);
  assert.equal(isOver(game), false);
});

test("applyAction: 首次有效操作开始计时并返回真实 action", () => {
  const game = createGame({ rows: 9, cols: 9, mines: 10, seed: 5 });
  const action = applyAction(game, "reveal", 40, 1000);
  assert.equal(action, "reveal");
  assert.equal(game.startedAt, 1000);
  assert.equal(game.actionCount, 1);
  assert.equal(elapsedMs(game, 3000), 2000);
  // 无效操作不影响计时与计数
  assert.equal(applyAction(game, "reveal", 40, 5000), null);
  assert.equal(game.startedAt, 1000);
  assert.equal(game.actionCount, 1);
  assert.equal(elapsedMs(game, 5000), 4000);
});

test("applyAction: flag / unflag 计数与状态推进", () => {
  const game = createGame({ rows: 9, cols: 9, mines: 10, seed: 5 });
  applyAction(game, "reveal", 40, 1000);
  const hiddenIndex = game.state.cellState.findIndex((c) => c === 0);
  assert.ok(hiddenIndex >= 0, "首击后应仍有隐藏格可供插旗");
  assert.equal(applyAction(game, "flag", hiddenIndex, 1500), "flag");
  assert.equal(applyAction(game, "flag", hiddenIndex, 1600), "unflag");
  assert.equal(game.actionCount, 3);
});

test("applyAction: 踩雷后 finishedAt 冻结，isOver 为真", () => {
  const game = createGame({ rows: 9, cols: 9, mines: 10, seed: 5 });
  applyAction(game, "reveal", 40, 1000);
  const mineIndex = game.state.mineField.findIndex(
    (v, i) => v === 1 && game.state.cellState[i] === 0
  );
  const action = applyAction(game, "reveal", mineIndex, 4200);
  assert.equal(action, "reveal");
  assert.equal(game.state.status, STATUS_LOST);
  assert.equal(game.finishedAt, 4200);
  assert.equal(isOver(game), true);
  assert.equal(elapsedMs(game, 99999), 3200, "终局后时间冻结");
});

test("applyAction: 通关后 finishedAt 记录且终局操作无效", () => {
  const game = createGame({ rows: 5, cols: 5, mines: 3, seed: 21 });
  applyAction(game, "reveal", 12, 100);
  for (let i = 0; i < 25; i += 1) {
    if (game.state.mineField[i] === 1) continue;
    applyAction(game, "reveal", i, 100 + i * 10);
  }
  assert.equal(game.state.status, STATUS_WON);
  assert.ok(game.finishedAt > 0);
  assert.equal(isOver(game), true);
  assert.equal(applyAction(game, "flag", 0, 99999), null);
});

test("restart: 原地重置并支持切换难度，同一对象引用不失效", () => {
  const game = createGame({ difficulty: "beginner" });
  applyAction(game, "reveal", 40, 1000);
  const same = restart(game, { difficulty: "intermediate" });
  assert.equal(same, game);
  assert.equal(game.state.status, STATUS_READY);
  assert.deepEqual(game.config, { rows: 16, cols: 16, mines: 40 });
  assert.equal(game.startedAt, 0);
  assert.equal(game.finishedAt, 0);
  assert.equal(game.actionCount, 0);
  assert.equal(elapsedMs(game, 8888), 0);
});

test("chord 经控制器触发：点已揭开数字格", () => {
  const game = createGame({ rows: 9, cols: 9, mines: 10, seed: 9 });
  applyAction(game, "reveal", 40, 100);
  const before = game.state.revealedCount;
  const pivot = game.state.lastRevealed.find((i) => game.state.adjacency[i] > 0);
  // 旗数不足 → null；不影响计时起点
  assert.equal(applyAction(game, "reveal", pivot, 200), null);
  assert.equal(game.state.revealedCount, before);
});
