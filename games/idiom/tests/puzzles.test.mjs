import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARDS,
  ENTRIES_ZH,
  ENTRIES_EN,
  MAX_GRID_ZH,
  MAX_GRID_EN,
  LEVELS_PER_BOARD,
} from "../js/boards.mjs";
import { allPuzzles, getPuzzle, resetPuzzleCacheForTests, poolFor } from "../js/puzzles.mjs";

function keyOf(r, c) {
  return `${r},${c}`;
}

test("题库：八榜齐全，每榜 16 条成语且 id 唯一", () => {
  assert.equal(BOARDS.length, 8);
  for (const lang of ["zh", "en"]) {
    const ids = new Set();
    for (const board of BOARDS) {
      const pool = poolFor(lang, board.id);
      assert.equal(pool.entries.length, 16, `${lang}/${board.id}`);
      for (const entry of pool.entries) {
        assert.ok(!ids.has(entry.id), `duplicate ${entry.id}`);
        ids.add(entry.id);
        assert.ok((lang === "zh" ? entry.zh : entry.en).length >= 3);
        assert.ok(entry.zhDef || entry.enDef);
      }
    }
    assert.equal(ids.size, 128);
  }
});

test("关卡：中英各 80 关全部生成成功且结构完整", () => {
  for (const lang of ["zh", "en"]) {
    const table = lang === "zh" ? ENTRIES_ZH : ENTRIES_EN;
    const max = lang === "zh" ? MAX_GRID_ZH : MAX_GRID_EN;
    const list = allPuzzles(lang);
    assert.equal(list.length, 80);
    for (const { boardId, levelIndex, puzzle } of list) {
      assert.ok(puzzle, `${lang}/${boardId}/${levelIndex} 未生成`);
      assert.equal(puzzle.entries.length, table[levelIndex], `${boardId}/${levelIndex} 条数`);
      assert.ok(puzzle.rows >= 5 && puzzle.rows <= max, `rows ${puzzle.rows}`);
      assert.ok(puzzle.cols >= 5 && puzzle.cols <= max, `cols ${puzzle.cols}`);
      assert.ok(puzzle.cells.length >= puzzle.entries.length);
      const cellKeys = new Set();
      const cellMap = new Map();
      for (const cell of puzzle.cells) {
        const key = keyOf(cell.r, cell.c);
        assert.ok(!cellKeys.has(key), `重复格 ${key}`);
        assert.ok(cell.r >= 0 && cell.r < puzzle.rows);
        assert.ok(cell.c >= 0 && cell.c < puzzle.cols);
        assert.equal(cell.answer.length, 1);
        cellKeys.add(key);
        cellMap.set(key, cell);
      }
      const answerChars = new Set();
      for (const entry of puzzle.entries) {
        assert.equal(entry.answer.length, entry.len);
        assert.ok(entry.clue && entry.clue.length > 2);
        for (let i = 0; i < entry.len; i += 1) {
          const r = entry.row + (entry.dir === "down" ? i : 0);
          const c = entry.col + (entry.dir === "across" ? i : 0);
          const cell = cellMap.get(keyOf(r, c));
          assert.ok(cell, `词条越界 ${entry.answer}`);
          assert.equal(cell.answer, entry.answer[i], `${entry.answer} 第 ${i} 字不一致`);
          answerChars.add(entry.answer[i]);
        }
      }
      for (const char of answerChars) assert.ok(puzzle.rack.includes(char), `字库缺字 ${char}`);
      assert.ok(puzzle.rack.length >= answerChars.size);
      assert.ok(puzzle.intersections >= 1, `${boardId}/${levelIndex} 无交叉`);
      const locked = puzzle.cells.filter((cell) => cell.locked).length;
      if (levelIndex < 3) assert.ok(locked >= 1, "前三关应有预填种子");
      if (levelIndex >= 6) assert.equal(locked, 0, "后四关不应预填");
    }
  }
});

test("关卡：预填格与答案一致，后段关卡词量不倒退", () => {
  for (const lang of ["zh", "en"]) {
    for (const board of BOARDS) {
      let previous = 0;
      for (let level = 0; level < LEVELS_PER_BOARD; level += 1) {
        const puzzle = getPuzzle(lang, board.id, level);
        for (const cell of puzzle.cells) {
          if (cell.locked) assert.equal(typeof cell.answer, "string");
        }
        assert.ok(puzzle.entries.length >= previous, "关卡词量应递增");
        previous = puzzle.entries.length;
      }
    }
  }
});

test("关卡：同种子完全确定，缓存不改变结果", () => {
  const first = getPuzzle("zh", "board_nature", 4);
  resetPuzzleCacheForTests();
  const second = getPuzzle("zh", "board_nature", 4);
  assert.deepEqual(second, first);
});

test("关卡：英文题库是独立单词，不含谚语式占位", () => {
  const puzzle = getPuzzle("en", "board_animals", 2);
  for (const entry of puzzle.entries) {
    assert.match(entry.answer, /^[A-Z]{3,}$/);
    assert.ok(puzzle.rack.includes(entry.answer[0]));
  }
});

test("关卡：图鉴卡 id 与题面词条一一对应", () => {
  for (const lang of ["zh", "en"]) {
    for (const board of BOARDS) {
      const pool = new Set(poolFor(lang, board.id).entries.map((entry) => entry.id));
      for (let level = 0; level < LEVELS_PER_BOARD; level += 1) {
        const puzzle = getPuzzle(lang, board.id, level);
        for (const entry of puzzle.entries) assert.ok(pool.has(entry.entryId), entry.entryId);
      }
    }
  }
});
