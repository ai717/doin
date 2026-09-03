import assert from "node:assert/strict";
import test from "node:test";

import { isSolved, isTrackComplete } from "../engine.mjs";
import { CHAPTERS, createLevelState, LEVELS } from "../levels.mjs";
import { replayActions, solve } from "../solver.mjs";

function colorsIn(level) {
  return new Set(level.tracks.flat());
}

test("the campaign contains five themed chapters with twenty unique levels each", () => {
  assert.equal(CHAPTERS.length, 5);
  assert.equal(LEVELS.length, 100);
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(level.id, index + 1);
    assert.equal(level.chapter, Math.floor(index / 20) + 1);
    assert.equal(level.chapterIndex, (index % 20) + 1);
    assert.match(level.seed, /^campaign-v1-c[1-5]-l(?:[1-9]|1\d|20)-d[1-7]-v\d+$/);
  }
  assert.equal(new Set(LEVELS.map((level) => JSON.stringify([level.capacity, level.dockCount, level.tracks]))).size, 100);
  const averages = CHAPTERS.map((chapter) => chapter.difficulties.reduce((sum, value) => sum + value, 0) / 20);
  assert.equal(averages.every((value, index) => index === 0 || value > averages[index - 1]), true);
  for (const chapter of CHAPTERS) {
    assert.equal(chapter.difficulties.length, 20);
    assert.equal(chapter.difficulties.some((value, index) => index > 0 && value < chapter.difficulties[index - 1]), true);
    assert.equal(LEVELS.filter((level) => level.chapter === chapter.id && level.theme === chapter.theme).length, 20);
  }
});

test("each level has exact color counts and is not pre-solved", () => {
  for (const level of LEVELS) {
    const counts = new Map();
    for (const color of level.tracks.flat()) counts.set(color, (counts.get(color) ?? 0) + 1);
    assert.deepEqual(
      [...counts.keys()].sort((a, b) => a - b),
      Array.from({ length: counts.size }, (_, color) => color),
    );
    for (let color = 0; color < counts.size; color += 1) {
      assert.equal(counts.get(color), level.capacity);
    }
    const initial = createLevelState(level);
    assert.equal(isSolved(initial), false);
    assert.equal(
      initial.tracks.some((track) => isTrackComplete(track, level.capacity)),
      false,
    );
  }
});

test("each canonical difficulty template has an exact par and winning replay", () => {
  const representatives = [...new Map(LEVELS.map((level) => [level.sourceLevelId, level])).values()];
  assert.equal(representatives.length, 7);
  for (const level of representatives) {
    const initial = createLevelState(level);
    const result = solve(initial, { nodeLimit: 2_000_000, timeLimitMs: 5_000 });
    assert.equal(result.status, "solved", `level ${level.id} did not solve`);
    assert.equal(result.par, level.par, `level ${level.id} par drifted`);
    const finalState = replayActions(initial, result.actions);
    assert.equal(isSolved(finalState), true, `level ${level.id} replay did not win`);
  }
});

test("the campaign keeps special mechanics out of the one hundred levels", () => {
  assert.equal(LEVELS.every((level) => level.modifiers.length === 0), true);
});
