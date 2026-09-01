import assert from "node:assert/strict";
import test from "node:test";

import { isSolved, isTrackComplete } from "../engine.mjs";
import { createLevelState, LEVELS } from "../levels.mjs";
import { replayActions, solve } from "../solver.mjs";

function colorsIn(level) {
  return new Set(level.tracks.flat());
}

test("the stabilization release contains six newly generated difficulty levels", () => {
  assert.equal(LEVELS.length, 6);
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(level.id, index + 1);
    assert.equal(level.chapter, 1);
    assert.match(level.seed, /^stabilize-/);
  }
  assert.deepEqual(
    LEVELS.map((level) => [level.capacity, level.dockCount, colorsIn(level).size]),
    [[2, 1, 2], [3, 1, 3], [3, 1, 3], [3, 1, 4], [3, 2, 4], [3, 2, 4]],
  );
  assert.deepEqual(LEVELS.map((level) => level.par), [3, 6, 8, 7, 7, 8]);
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

test("each level par is the 0-1 BFS minimum and its path wins", () => {
  for (const level of LEVELS) {
    const initial = createLevelState(level);
    const result = solve(initial, { nodeLimit: 2_000_000, timeLimitMs: 5_000 });
    assert.equal(result.status, "solved", `level ${level.id} did not solve`);
    assert.equal(result.par, level.par, `level ${level.id} par drifted`);
    const finalState = replayActions(initial, result.actions);
    assert.equal(isSolved(finalState), true, `level ${level.id} replay did not win`);
  }
});

test("the stabilization release keeps special mechanics out of the six levels", () => {
  assert.equal(LEVELS.every((level) => level.modifiers.length === 0), true);
});
