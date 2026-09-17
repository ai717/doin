import test from "node:test";
import assert from "node:assert/strict";
import {
  createSolvedBoard,
  findBlank,
  isSolved,
  countInversions,
  isSolvable,
  getSlidePath,
  applyMove,
  moveByDirection,
  shuffleBoard,
  createRng,
} from "../js/engine.mjs";

test("engine: createSolvedBoard creates valid sequential numbers with blank at end", () => {
  for (const size of [3, 4, 5]) {
    const b = createSolvedBoard(size);
    assert.equal(b.length, size * size);
    for (let i = 0; i < size * size - 1; i++) {
      assert.equal(b[i], i + 1);
    }
    assert.equal(b[size * size - 1], 0);
    assert.equal(isSolved(b, size), true);
  }
});

test("engine: isSolved accurately distinguishes solved and unsolved boards", () => {
  const b = createSolvedBoard(4);
  assert.equal(isSolved(b, 4), true);

  // 破坏一个方块
  b[0] = 2;
  b[1] = 1;
  assert.equal(isSolved(b, 4), false);
});

test("engine: countInversions and isSolvable invariant checks", () => {
  const b3 = createSolvedBoard(3);
  assert.equal(countInversions(b3), 0);
  assert.equal(isSolvable(b3, 3), true);

  // 交换 1 和 2，逆序数变为 1 (奇数)，3x3 变为不可解
  const b3Bad = [...b3];
  b3Bad[0] = 2;
  b3Bad[1] = 1;
  assert.equal(countInversions(b3Bad), 1);
  assert.equal(isSolvable(b3Bad, 3), false);

  // 4x4 终态可解
  const b4 = createSolvedBoard(4);
  assert.equal(isSolvable(b4, 4), true);

  // 4x4 交换 14 和 15 (著名的 Sam Loyd 恶作剧局面)，变成绝对不可解
  const b4Bad = [...b4];
  b4Bad[13] = 15;
  b4Bad[14] = 14;
  assert.equal(isSolvable(b4Bad, 4), false);
});

test("engine: multi-tile push (整行整列连推) shifts all intermediate tiles", () => {
  const size = 4;
  const board = createSolvedBoard(size);
  // 空格在 (3, 3), 值为 0
  // 点击 (3, 0) 的方块 (值为 13)
  // (3, 1)是14, (3, 2)是15
  // 连推应将 15移到(3,3)，14移到(3,2)，13移到(3,1)，空格转移到(3,0)
  const path = getSlidePath(board, size, 3, 0);
  assert.ok(path);
  assert.equal(path.direction, "right");
  assert.equal(path.tiles.length, 3);
  assert.deepEqual(path.tiles.map((t) => t.value), [15, 14, 13]);

  const res = applyMove(board, size, 3, 0);
  assert.equal(res.success, true);
  assert.equal(res.newBoard[3 * size + 0], 0); // 空格在 (3, 0)
  assert.equal(res.newBoard[3 * size + 1], 13);
  assert.equal(res.newBoard[3 * size + 2], 14);
  assert.equal(res.newBoard[3 * size + 3], 15);
});

test("engine: invalid moves (diagonal or out of bounds) return no-op safely", () => {
  const board = createSolvedBoard(4);
  // 空格在 (3, 3)
  // (0, 0) 不在同一行或同一列
  const res = applyMove(board, 4, 0, 0);
  assert.equal(res.success, false);
  assert.equal(res.action, null);
  assert.deepEqual(res.newBoard, board);

  // 越界坐标
  const oob = applyMove(board, 4, -1, 3);
  assert.equal(oob.success, false);
});

test("engine: moveByDirection correctly translates directional inputs", () => {
  const board = createSolvedBoard(3);
  // 3x3 终态:
  // 1 2 3
  // 4 5 6
  // 7 8 0
  // 空格在 (2, 2)

  // push-tile 模式: 按 'down'，应把上方的 6 往下推到空格
  const res = moveByDirection(board, 3, "down", "push-tile");
  assert.equal(res.success, true);
  assert.equal(res.newBoard[2 * 3 + 2], 6);
  assert.equal(res.newBoard[1 * 3 + 2], 0);

  // push-tile 模式: 向上推越界（下方无邻居）返回 false
  const resUp = moveByDirection(board, 3, "up", "push-tile");
  assert.equal(resUp.success, false);
});

test("engine: 1000 random walk steps maintain permutation and solvability invariants", () => {
  const rng = createRng(987654321);
  let board = createSolvedBoard(4);

  for (let i = 0; i < 1000; i++) {
    const blank = findBlank(board, 4);
    assert.notEqual(blank.index, -1);

    const dirs = ["up", "down", "left", "right"];
    const d = dirs[Math.floor(rng() * dirs.length)];
    const res = moveByDirection(board, 4, d, "push-tile");
    if (res.success) {
      board = res.newBoard;
      // 验证每次移动后依然 100% 具备数学可解性
      assert.equal(isSolvable(board, 4), true);

      // 验证数字集合依然完整 0 ~ 15
      const counts = new Set(board);
      assert.equal(counts.size, 16);
    }
  }
});

test("engine: shuffleBoard produces solvable and non-solved starting boards", () => {
  const rng = createRng(42);
  for (const size of [3, 4, 5]) {
    for (let i = 0; i < 20; i++) {
      const b = shuffleBoard(size, 80, rng);
      assert.equal(b.length, size * size);
      assert.equal(isSolvable(b, size), true, `Size ${size} shuffle must be solvable`);
      assert.equal(isSolved(b, size), false, `Size ${size} shuffle should not already be solved`);
    }
  }
});
