import test from "node:test";
import assert from "node:assert/strict";

import { createGame, MODE, PHASE } from "../js/game.mjs";
import { COLORS, COLS, ROWS, createGrid, hardDrop } from "../js/engine.mjs";

test("创建双人局：双矩阵、各自种子与快照结构", () => {
  const game = createGame({ mode: MODE.VERSUS, stage: 3, bestOf: 3, seed: 12345 });
  const snapshot = game.snapshot();
  assert.equal(snapshot.mode, MODE.VERSUS);
  assert.equal(snapshot.phase, PHASE.PLAYING);
  assert.equal(snapshot.boards.length, 2);
  assert.equal(game.targetWins, 2);
  assert.notEqual(snapshot.boards[0].active, null);
  assert.notEqual(snapshot.boards[1].active, null);
  assert.equal(snapshot.boards[0].grid.length, ROWS);
  assert.equal(snapshot.boards[1].grid[0].length, COLS);
  assert.notEqual(snapshot.boards[0].queue[0], undefined);
  assert.equal(snapshot.boards[1].isAi, false);
});

test("单人天梯：玩家 1 由 AI 控制，目标为一次 KO", () => {
  const game = createGame({ mode: MODE.SOLO, stage: 0, seed: 77 });
  const snapshot = game.snapshot();
  assert.equal(game.isAi(1), true);
  assert.equal(game.isAi(0), false);
  assert.equal(snapshot.boards[1].isAi, true);
  assert.equal(game.targetWins, 1);
  assert.equal(snapshot.stage, 0);
});

test("左右输入立即改变方块列，AI 席位拒绝输入", () => {
  const game = createGame({ mode: MODE.SOLO, stage: 0, seed: 31 });
  const before = game.boards[0].active.x;
  assert.equal(game.input(0, "left"), true);
  assert.equal(game.boards[0].active.x, before - 1);
  assert.equal(game.input(1, "left"), false);
});

test("硬降触发锁定事件并生成下一块", () => {
  const game = createGame({ mode: MODE.VERSUS, seed: 42 });
  const events = [];
  game.subscribe((event) => events.push(event.type));
  game.input(0, "hard");
  assert.ok(events.includes("lock"));
  assert.ok(events.includes("spawn"));
  assert.ok(game.boards[0].active);
});

test("攻防抵消守恒：4 行 Tetris = 抵消 2 + 反轰 2", () => {
  const game = createGame({ mode: MODE.VERSUS, seed: 555 });
  const attacker = game.boards[0];
  const defender = game.boards[1];

  attacker.grid = createGrid();
  for (let y = 16; y < 20; y += 1) {
    for (let x = 0; x < 9; x += 1) attacker.grid[y][x] = COLORS.J;
  }
  attacker.active = { type: "I", rot: 1, x: 7, y: 0 };
  attacker.grounded = false;

  game.receiveAttack(0, 1, 2);
  assert.equal(attacker.pending.length, 2);

  hardDrop(attacker);
  game.resolveLock(0);

  assert.equal(attacker.stats.attackOut, 4);
  assert.equal(attacker.stats.cancelled, 2);
  assert.equal(attacker.stats.sent, 2);
  assert.equal(attacker.stats.attackOut, attacker.stats.cancelled + attacker.stats.sent, "攻击 = 抵消 + 发出");
  assert.equal(attacker.pending.length, 0);
  assert.equal(defender.pending.length, 2);
  assert.equal(defender.stats.received, 2);
  assert.equal(attacker.lines, 4);
  assert.ok(attacker.score > 0);
});

test("垃圾行顶穿立即 KO，并结束当前赛制", () => {
  const game = createGame({ mode: MODE.SOLO, stage: 0, seed: 808 });
  const player = game.boards[0];
  for (let x = 0; x < COLS; x += 1) player.grid[0][x] = COLORS.T;
  game.receiveAttack(0, 1, 4);
  game.applyPending(0);
  assert.equal(player.ko, true);
  assert.equal(game.phase, PHASE.SERIES_END);
  assert.equal(game.winner, 1);
});

test("BO3 抢二：第二回合结束后系列赛终结", () => {
  const game = createGame({ mode: MODE.VERSUS, bestOf: 3, seed: 909 });
  game.endRound(1);
  assert.deepEqual(game.seriesWins, [1, 0]);
  assert.equal(game.phase, PHASE.ROUND_END);
  assert.equal(game.nextRound(), true);
  assert.equal(game.phase, PHASE.PLAYING);
  game.endRound(1);
  assert.deepEqual(game.seriesWins, [2, 0]);
  assert.equal(game.phase, PHASE.SERIES_END);
  assert.equal(game.winner, 0);
});

test("BO5 抢三与 bestOf 切换", () => {
  const game = createGame({ mode: MODE.VERSUS, bestOf: 5, seed: 1 });
  assert.equal(game.targetWins, 3);
  assert.equal(game.bestOf, 5);
});

test("暂停冻结 step：重力不再推进", () => {
  const game = createGame({ mode: MODE.VERSUS, seed: 66 });
  game.togglePause(true);
  const y = game.boards[0].active.y;
  for (let i = 0; i < 100; i += 1) game.step(0.05);
  assert.equal(game.boards[0].active.y, y);
  game.togglePause(false);
  for (let i = 0; i < 100; i += 1) game.step(0.05);
  assert.ok(game.boards[0].active, "解冻后重力推进并保持可操作方块");
});

test("随机游走 1500 步：输入 + step + AI 不抛错、快照始终合法", () => {
  const rng = (() => {
    let a = 20261110;
    return () => {
      a = (a * 1664525 + 1013904223) >>> 0;
      return a / 4294967296;
    };
  })();
  const game = createGame({ mode: MODE.SOLO, stage: 10, seed: 20261110 });
  const actions = ["left", "right", "rotateCW", "rotateCCW", "hold", "hard"];
  let steps = 0;
  for (let i = 0; i < 1500; i += 1) {
    if (game.phase !== PHASE.PLAYING) {
      game.resetSeries();
      continue;
    }
    if (rng() < 0.55) game.input(0, actions[Math.floor(rng() * actions.length)]);
    if (rng() < 0.1) game.input(0, rng() < 0.5 ? "soft" : "softRelease");
    game.step(0.04);
    steps += 1;
    const snapshot = game.snapshot();
    assert.equal(snapshot.boards.length, 2);
    for (const board of snapshot.boards) {
      assert.equal(board.grid.length, ROWS);
      assert.equal(board.grid[0].length, COLS);
      assert.ok(board.pending >= 0);
      assert.ok(Number.isFinite(board.score));
      assert.ok(board.lines >= 0);
    }
    if (snapshot.phase === PHASE.SERIES_END) {
      assert.ok(snapshot.winner === 0 || snapshot.winner === 1);
    }
  }
  assert.ok(steps > 1000);
});

test("把垃圾行直接塞进对手：receiveAttack 计入 received 并启动缓冲计时", () => {
  const game = createGame({ mode: MODE.VERSUS, seed: 12 });
  game.receiveAttack(1, 0, 5);
  assert.equal(game.boards[1].pending.length, 5);
  assert.equal(game.boards[1].stats.received, 5);
  assert.ok(game.boards[1].garbageTimer > 0);
  game.step(0.5);
  assert.ok(game.boards[1].garbageTimer < 1.5);
});
