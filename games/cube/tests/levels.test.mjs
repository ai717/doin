import test from "node:test";
import assert from "node:assert/strict";

import {
  applyMoves,
  createSolved,
  invertMove,
  isSolved,
  movesFromText,
} from "../js/engine.mjs";
import {
  CHAPTERS,
  LEVELS,
  LEVEL_BY_ID,
  firstLevelId,
  levelsOfChapter,
  nextLevelId,
} from "../js/levels.mjs";

test("academy has 19 stages split 4/5/4/3/3", () => {
  assert.equal(LEVELS.length, 19);
  assert.deepEqual(CHAPTERS.map((chapter) => chapter.levelIds.length), [4, 5, 4, 3, 3]);
  const total = CHAPTERS.reduce((sum, chapter) => sum + levelsOfChapter(chapter.id).length, 0);
  assert.equal(total, 19);
  assert.equal(firstLevelId(), "c01");
});

test("level ids are unique and fully indexed", () => {
  const ids = new Set();
  for (const level of LEVELS) {
    assert.equal(ids.has(level.id), false, `duplicate id ${level.id}`);
    ids.add(level.id);
    assert.equal(LEVEL_BY_ID[level.id], level);
    assert.equal(level.size, 3);
    assert.ok(level.par >= level.scramble.split(/\s+/).length);
    assert.ok(level.goalKey.startsWith("goal"));
    assert.ok(level.chapter >= 1 && level.chapter <= 5);
  }
  assert.equal(ids.size, 19);
});

test("every academy scramble is legal and reversible", () => {
  for (const level of LEVELS) {
    const moves = movesFromText(level.scramble);
    assert.ok(moves.length >= 3, `${level.id} needs a real scramble`);
    const cube = applyMoves(createSolved(3), moves);
    assert.equal(isSolved(cube), false, `${level.id} should start scrambled`);
    const rewind = moves.slice().reverse().map(invertMove);
    assert.ok(isSolved(applyMoves(cube, rewind)), `${level.id} inverse should solve`);
  }
});

test("chapter metadata points at real stages", () => {
  for (const chapter of CHAPTERS) {
    const levels = levelsOfChapter(chapter.id);
    assert.equal(levels.length, chapter.levelIds.length);
    for (const level of levels) assert.equal(level.chapter, chapter.id);
  }
  assert.deepEqual(levelsOfChapter(99), []);
});

test("academy ladder advances in order and stops at the end", () => {
  let cursor = firstLevelId();
  const seen = [];
  while (cursor) {
    seen.push(cursor);
    cursor = nextLevelId(cursor);
  }
  assert.deepEqual(seen, LEVELS.map((level) => level.id));
  assert.equal(nextLevelId("c19"), null);
  assert.equal(nextLevelId("missing"), LEVELS[0].id);
});
