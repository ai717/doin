import test from "node:test";
import assert from "node:assert/strict";

import { createBoard, spawnNext, cellsOf, COLS, ROWS, createGrid, COLORS, mulberry32, rotatePiece, moveSide } from "../js/engine.mjs";
import { planPlacement, nextAiAction, analyzeGrid, collectMoves } from "../js/ai.mjs";
import { createGame, MODE, PHASE } from "../js/game.mjs";
import { STAGES } from "../js/levels.mjs";

const PROFILE = { mistake: 0, holdSkill: 0, tetrisBias: 0.4, garbageAware: 0.8, moveMs: 200 };

function assertPlanLegal(board, plan) {
  assert.ok(plan, "必须给出落点");
  const cells = cellsOf(plan.type, plan.rotations);
  for (const [cx, cy] of cells) {
    const x = plan.targetX + cx;
    const y = plan.y + cy;
    assert.ok(x >= 0 && x < COLS, `列 ${x} 越界`);
    assert.ok(y >= 0 && y < ROWS, `行 ${y} 越界`);
  }
}

test("空棋盘上为每种方块给出合法落点", () => {
  for (const type of ["I", "J", "L", "O", "S", "T", "Z"]) {
    const board = createBoard({ seed: 1 });
    board.active = { type, rot: 0, x: 3, y: -1 };
    const plan = planPlacement(board, PROFILE, mulberry32(11));
    assertPlanLegal(board, plan);
  }
});

test("AI 采集落点数量充足且评分有限", () => {
  const board = createBoard({ seed: 2 });
  spawnNext(board);
  const moves = collectMoves(board.grid, board.active.type, PROFILE, 0);
  assert.ok(moves.length >= 8, `落点数量 ${moves.length}`);
  for (const move of moves) {
    assert.ok(Number.isFinite(move.score));
    assert.ok(move.y >= 0 && move.y < ROWS);
  }
});

test("地形分析：洞、高度、崎岖度", () => {
  const grid = createGrid();
  grid[18][0] = COLORS.T;
  grid[19][0] = COLORS.T;
  grid[19][4] = COLORS.Z;
  const stats = analyzeGrid(grid);
  assert.equal(stats.maxHeight, 2);
  assert.equal(stats.holes, 0);
  assert.ok(stats.aggregate >= 2);
  assert.ok(stats.bumpiness >= 2);

  grid[19][1] = 0;
  grid[18][1] = COLORS.J;
  const holed = analyzeGrid(grid);
  assert.equal(holed.holes, 1, "被压住的空格计为一个洞");
});

test("nextAiAction 按 旋转 → 横移 → 硬降 的顺序推进", () => {
  const board = createBoard({ seed: 3 });
  spawnNext(board);
  const plan = { rotations: 1, targetX: board.active.x + 2, useHold: false };
  assert.equal(nextAiAction(plan, board), "rotate");
  assert.equal(rotatePiece(board, 1).ok, true);
  assert.equal(nextAiAction(plan, board), "right");
  assert.equal(moveSide(board, 1), true);
  assert.equal(nextAiAction(plan, board), "right");
  assert.equal(moveSide(board, 1), true);
  assert.equal(nextAiAction(plan, board), "drop");
});

test("AI 实战：最快关卡内能消行并产生攻击", () => {
  const game = createGame({ mode: MODE.SOLO, stage: 21, seed: 424242 });
  const rival = game.boards[1];
  let guard = 0;
  while (guard < 8000 && rival.lines < 2 && game.phase === PHASE.PLAYING) {
    game.stepAi(1, 0.02);
    guard += 1;
  }
  assert.ok(rival.lines >= 2, `AI 消行 ${rival.lines}`);
  assert.ok(rival.score > 0);
  assert.ok(rival.stats.attackOut >= 0);
});

test("规划器尊重 pending：有垃圾压力时优先消行", () => {
  const board = createBoard({ seed: 4 });
  board.active = { type: "I", rot: 0, x: 3, y: -1 };
  // 底部留一行缺口，竖 I 可消四行
  for (let y = 16; y < 20; y += 1) {
    for (let x = 0; x < 9; x += 1) board.grid[y][x] = COLORS.J;
  }
  const plan = planPlacement(board, { ...PROFILE, tetrisBias: 0, garbageAware: 1 }, mulberry32(5));
  assertPlanLegal(board, plan);
  assert.equal(plan.cleared, 4, "应选择四行消除");
});

test("22 关参数完整且速度单调加快", () => {
  assert.equal(STAGES.length, 22);
  let prev = Infinity;
  for (const stage of STAGES) {
    assert.ok(stage.dropMs > 0);
    assert.ok(stage.nameKey.startsWith("stage"));
    assert.ok(stage.mistake >= 0 && stage.mistake <= 1);
    assert.ok(stage.dropMs < prev, `第 ${stage.index + 1} 关应更快`);
    prev = stage.dropMs;
  }
});
