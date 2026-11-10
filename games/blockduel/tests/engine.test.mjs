import test from "node:test";
import assert from "node:assert/strict";

import {
  COLS,
  ROWS,
  PIECE_TYPES,
  LOCK_DELAY,
  GARBAGE_DELAY,
  GARBAGE_COLOR,
  ATTACK_TABLE,
  TSPIN_ATTACK_TABLE,
  createBoard,
  createGrid,
  spawnPiece,
  spawnNext,
  moveSide,
  rotatePiece,
  hardDrop,
  lockPiece,
  findFullRows,
  removeRows,
  attackFor,
  comboBonusOf,
  addIncoming,
  cancelPending,
  insertGarbage,
  flushGarbage,
  makeGarbageHoles,
  BagRandomizer,
  mulberry32,
  cellsOf,
  collide,
  COLORS,
} from "../js/engine.mjs";

test("7-Bag 任意连续 7 块包含七种方块各一次", () => {
  const bag = new BagRandomizer(PIECE_TYPES, mulberry32(20261110));
  const drawn = [];
  for (let i = 0; i < 140; i += 1) drawn.push(bag.next());
  for (let start = 0; start + 7 <= drawn.length; start += 7) {
    const slice = drawn.slice(start, start + 7);
    assert.deepEqual([...slice].sort(), [...PIECE_TYPES].sort());
  }
});

test("SRS 墙踢：竖 I 贴左墙旋转被推回场内", () => {
  const board = createBoard({ seed: 1 });
  board.active = { type: "I", rot: 1, x: -2, y: 0 };
  const result = rotatePiece(board, 1);
  assert.equal(result.ok, true);
  assert.equal(board.active.rot, 2);
  assert.equal(board.active.x, 0);
  for (const [cx, cy] of cellsOf(board.active.type, board.active.rot)) {
    const x = board.active.x + cx;
    const y = board.active.y + cy;
    assert.ok(x >= 0 && x < COLS, "旋转后仍在列内");
    assert.ok(y < ROWS);
  }
});

test("攻击表与连击、B2B 换算", () => {
  assert.equal(ATTACK_TABLE[4], 4);
  assert.equal(TSPIN_ATTACK_TABLE[3], 6);
  assert.equal(attackFor({ lines: 1 }), 0);
  assert.equal(attackFor({ lines: 2 }), 1);
  assert.equal(attackFor({ lines: 3 }), 2);
  assert.equal(attackFor({ lines: 4 }), 4);
  assert.equal(attackFor({ lines: 4, b2bBefore: true }), 5);
  assert.equal(attackFor({ lines: 2, tspin: true }), 4);
  assert.equal(attackFor({ lines: 3, tspin: true }), 6);
  assert.equal(comboBonusOf(1), 0);
  assert.equal(comboBonusOf(2), 1);
  assert.equal(comboBonusOf(4), 2);
  assert.equal(attackFor({ lines: 2, combo: 2 }), 2);
});

test("消行计分、combo 断档归零与 B2B 标记", () => {
  const board = createBoard({ seed: 2 });
  board.grid = createGrid();
  for (let y = 16; y < 20; y += 1) {
    for (let x = 0; x < 9; x += 1) board.grid[y][x] = COLORS.J;
  }
  board.active = { type: "I", rot: 1, x: 7, y: 0 };
  hardDrop(board);
  const first = lockPiece(board);
  assert.equal(first.lines, 4);
  assert.equal(first.attack, 4);
  assert.equal(first.ko, false);
  assert.equal(board.combo, 1);
  assert.equal(board.b2b, true);

  const empty = createBoard({ seed: 3 });
  empty.grid = createGrid();
  empty.active = { type: "O", rot: 0, x: 3, y: 0 };
  hardDrop(empty);
  lockPiece(empty);
  assert.equal(empty.combo, 0, "无消行的锁定必须打断连击");
});

test("锁定后棋盘无满行且尺寸不变", () => {
  const board = createBoard({ seed: 9 });
  spawnNext(board);
  for (let i = 0; i < 40; i += 1) {
    board.active = { type: PIECE_TYPES[i % 7], rot: 0, x: 2, y: 0 };
    hardDrop(board);
    const result = lockPiece(board);
    assert.equal(findFullRows(board.grid).length, 0);
    assert.equal(board.grid.length, ROWS);
    assert.equal(board.grid[0].length, COLS);
    assert.ok(result.lines >= 0 && result.lines <= 4);
    if (board.ko) break;
    spawnNext(board);
  }
});

test("垃圾行：先进入缓冲、可 1:1 抵消、到点整波升起", () => {
  const board = createBoard({ seed: 4 });
  addIncoming(board, 5, board.rng);
  assert.equal(board.pending.length, 5);
  assert.equal(board.garbageTimer, GARBAGE_DELAY);
  assert.equal(board.stats.received, 5);

  const left = cancelPending(board, 3);
  assert.equal(left, 0);
  assert.equal(board.pending.length, 2);
  assert.equal(board.stats.cancelled, 3);

  const flushed = flushGarbage(board);
  assert.equal(flushed.rows, 2);
  assert.equal(board.pending.length, 0);
  assert.equal(board.stats.garbageApplied, 2);
  assert.equal(board.garbageTimer, 0);
  assert.equal(board.ko, false);
  for (let y = ROWS - 2; y < ROWS; y += 1) {
    const holes = board.grid[y].filter((cell) => cell === 0).length;
    assert.equal(holes, 1, "每行垃圾必须恰好一个孔");
    assert.ok(board.grid[y].includes(GARBAGE_COLOR ?? "G"));
  }
});

test("垃圾行同波对齐与顶穿判定", () => {
  const holes = makeGarbageHoles(6, mulberry32(7), 1);
  assert.equal(new Set(holes).size, 1, "100% 对齐时所有孔同列");

  const board = createBoard({ seed: 5 });
  for (let x = 0; x < COLS; x += 1) board.grid[0][x] = COLORS.T;
  const result = insertGarbage(board, [3, 3, 3, 3]);
  assert.equal(result.ko, true);
  assert.equal(board.ko, true);
});

test("随机游走 1200 块：不抛错、不卡死、不变式守恒", () => {
  const rng = mulberry32(20261110);
  const board = createBoard({ seed: 20261110, gravity: 120 });
  spawnNext(board);
  let pieces = 0;
  let locks = 0;
  for (let step = 0; step < 1200; step += 1) {
    if (!board.active) spawnNext(board);
    const action = Math.floor(rng() * 6);
    if (action === 0) moveSide(board, -1);
    else if (action === 1) moveSide(board, 1);
    else if (action === 2) rotatePiece(board, 1);
    else if (action === 3) rotatePiece(board, -1);
    else if (action === 4 && rng() < 0.5) board.gravityAcc = 0;

    if (rng() < 0.18) addIncoming(board, 1 + Math.floor(rng() * 4), board.rng);
    if (board.pending.length > 0 && rng() < 0.12) cancelPending(board, 1 + Math.floor(rng() * 2));

    hardDrop(board);
    const result = lockPiece(board);
    locks += 1;
    pieces += 1;

    assert.equal(board.grid.length, ROWS);
    assert.equal(board.grid[0].length, COLS);
    assert.equal(findFullRows(board.grid).length, 0);
    assert.ok(Number.isFinite(board.score));
    assert.ok(board.lines >= 0);
    assert.ok(board.pending.length >= 0);
    assert.ok(result.attack >= 0);
    assert.ok(board.stats.cancelled <= board.stats.attackOut + board.stats.received);

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const cell = board.grid[y][x];
        assert.ok(cell === 0 || typeof cell === "string");
      }
    }

    if (board.ko) {
      board.ko = false;
      board.grid = createGrid();
      board.pending = [];
      board.garbageTimer = 0;
      board.combo = 0;
      board.b2b = false;
    }
    spawnNext(board);
  }
  assert.ok(pieces >= 1200);
  assert.ok(locks >= 1200);
});

test("锁定延时与垃圾缓冲常量符合策划", () => {
  assert.equal(LOCK_DELAY, 0.5);
  assert.equal(GARBAGE_DELAY, 1.5);
});

test("removeRows 从底部补空行", () => {
  const grid = createGrid();
  for (let x = 0; x < COLS; x += 1) grid[19][x] = COLORS.L;
  const next = removeRows(grid, [19]);
  assert.equal(next.length, ROWS);
  assert.equal(next[0].every((cell) => cell === 0), true);
  assert.equal(next[19].every((cell) => cell === 0), true);
});

test("collide 只拦截可见区与越界", () => {
  const board = createBoard({ seed: 6 });
  assert.equal(collide(board.grid, "O", 0, 3, -1), false, "负行允许存在");
  assert.equal(collide(board.grid, "O", 0, 9, 0), true, "超右边界");
  board.grid[19][4] = COLORS.Z;
  assert.equal(collide(board.grid, "O", 0, 3, 18), true, "底部已占用");
});
