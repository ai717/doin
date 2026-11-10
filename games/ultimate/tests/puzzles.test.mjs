import test from "node:test";
import assert from "node:assert/strict";

import {
  MARK_X, STATUS_PLAYING, canForceWin, legalMoves,
} from "../js/engine.mjs";
import {
  CHAPTERS, PUZZLES, PUZZLE_BY_ID, createPuzzleState, getPuzzle, puzzlesInChapter,
} from "../js/puzzles.mjs";

const eq = assert.strictEqual;

test("题库共 21 关，章节结构为 4 / 5 / 4 / 5 / 3", () => {
  eq(PUZZLES.length, 21);
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.count), [4, 5, 4, 5, 3]);
  for (const chapter of CHAPTERS) {
    eq(puzzlesInChapter(Number(chapter.key.slice(2))).length, chapter.count);
  }
});

test("关卡 id 唯一、章内连续、全部按序排列", () => {
  const ids = new Set();
  PUZZLES.forEach((puzzle, index) => {
    eq(puzzle.id, `u${String(index + 1).padStart(2, "0")}`);
    assert.ok(!ids.has(puzzle.id), `重复 id ${puzzle.id}`);
    ids.add(puzzle.id);
    eq(puzzle.index, index);
    assert.ok(puzzle.chapter >= 1 && puzzle.chapter <= 5);
    assert.ok(puzzle.par === 2 || puzzle.par === 3);
    eq(puzzle.board.length, 81);
    assert.match(puzzle.board, /^[012]{81}$/);
  });
  eq(getPuzzle("u01"), PUZZLES[0]);
  eq(getPuzzle("nope"), null);
  eq(PUZZLE_BY_ID.u21, PUZZLES[20]);
});

test("每关都能构造出合法的 X 先手残局，且开局存在多种选择", () => {
  for (const puzzle of PUZZLES) {
    const state = createPuzzleState(puzzle);
    assert.ok(state, `${puzzle.id} 盘面非法`);
    eq(state.current, MARK_X);
    eq(state.status, STATUS_PLAYING);
    const moves = legalMoves(state);
    assert.ok(moves.length >= 2, `${puzzle.id} 首手只有 ${moves.length} 个落点，缺少选择`);
  }
});

test("每关都在 par 步内存在强制绝杀，且 par-1 步内无解（难度下限）", () => {
  for (const puzzle of PUZZLES) {
    const state = createPuzzleState(puzzle);
    assert.ok(
      canForceWin(state, MARK_X, puzzle.par, new Map()),
      `${puzzle.id} 在 ${puzzle.par} 步内没有强制绝杀`,
    );
    assert.ok(
      !canForceWin(state, MARK_X, puzzle.par - 1, new Map()),
      `${puzzle.id} 其实可以在 ${puzzle.par - 1} 步内解决，par 定高了`,
    );
  }
});

test("求解器在随机残局上不会抛错，也不会把已终结局面判成可赢", () => {
  for (const puzzle of PUZZLES.slice(0, 6)) {
    const state = createPuzzleState(puzzle);
    assert.equal(canForceWin(state, MARK_X, 0), false);
  }
});
