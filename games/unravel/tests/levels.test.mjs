import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { generateBoard, solveBoard } from "../js/engine.mjs";
import { getLevel, LEVELS, levelSeed, RELAX_PARAMS } from "../js/levels.mjs";

test("level table shape: 40 levels across 4 chapters", () => {
  assert.equal(LEVELS.length, 40);
  LEVELS.forEach((level, i) => {
    assert.equal(level.id, i + 1);
    assert.equal(level.chapter, Math.floor(i / 10) + 1);
    assert.ok(level.parMs > 0);
    assert.ok(Array.isArray(level.triplets) && level.triplets.length === level.colors.length);
    assert.ok(level.triplets.every((t) => t === 1 || t === 2));
    assert.ok(level.colors.length >= 3 && level.colors.length <= 6);
    assert.equal(new Set(level.colors).size, level.colors.length, "colors unique");
    assert.ok(level.minFree >= 1);
    assert.ok(level.spanMin < level.spanMax && level.spanMin >= 60 && level.spanMax <= 180);
  });
});

test("difficulty curve ramps up", () => {
  for (const level of LEVELS) {
    const deep = level.triplets.filter((t) => t === 2).length;
    const spreadPressure = level.colors.length * 2;
    if (level.id >= 6) assert.ok(deep >= 1, `level ${level.id} needs a deep color`);
    if (level.chapter >= 3) {
      assert.ok(level.colors.length >= 5, `level ${level.id} needs 5+ colors`);
      assert.ok(spreadPressure >= 10, "5+ colors mean real slot pressure");
    }
    if (level.chapter === 4) {
      assert.ok(level.spanMin >= 115, `level ${level.id} needs dense crossings`);
      assert.equal(level.minFree, 1, "chapter 4 keeps little slack");
    }
  }
});

test("chapter mechanic progression", () => {
  for (const level of LEVELS) {
    if (level.chapter === 1) {
      assert.equal(level.knots, 0, "chapter 1 has no knots");
      assert.equal(level.duals, 0, "chapter 1 has no dual strands");
    }
    if (level.chapter === 2) {
      assert.ok(level.knots >= 1, "chapter 2 introduces knots");
      assert.equal(level.duals, 0);
    }
    if (level.chapter === 3) {
      assert.ok(level.duals >= 1, "chapter 3 introduces dual strands");
    }
    if (level.chapter === 4) {
      assert.ok(level.knots >= 2 && level.duals >= 2, "chapter 4 combines twists");
    }
  }
});

test("every level generates, solves and plays to victory", () => {
  for (const level of LEVELS) {
    const board = generateBoard(level, levelSeed(level.id), "level");
    assert.equal(board.strands.length, board.solution.length);
    const moves = solveBoard(board);
    assert.ok(moves, `level ${level.id} unsolvable`);
  }
});

test("relax template generates a solvable board", () => {
  const board = generateBoard(RELAX_PARAMS, 7, "relax");
  assert.ok(solveBoard(board));
});

test("getLevel falls back to level 1", () => {
  assert.equal(getLevel(999).id, 1);
  assert.equal(getLevel(12).id, 12);
});

test("levels.mjs carries zero hardcoded Chinese", () => {
  const src = readFileSync(new URL("../js/levels.mjs", import.meta.url), "utf8");
  assert.ok(!/[\u4e00-\u9fa5]/.test(src), "levels.mjs must not contain CJK");
});
