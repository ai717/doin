import assert from "node:assert/strict";
import test from "node:test";

import { isSolved, isTrackComplete } from "../engine.mjs";
import { createLevelState, LEVELS } from "../levels.mjs";
import { replayActions, solve } from "../solver.mjs";

function colorsIn(level) {
  return new Set(level.tracks.flat());
}

test("the published mainline release contains seven randomly generated difficulty levels", () => {
  assert.equal(LEVELS.length, 7);
  for (const [index, level] of LEVELS.entries()) {
    assert.equal(level.id, index + 1);
    assert.equal(level.chapter, 1);
    assert.match(level.seed, /^1788344956434-L[1-7]-\d+$/);
  }
  // 难度渐进：cap 3→3→4→4→4→5→5；col 3→3→3→3→4→4→5；dock 2→1→2→1→2→1→2
  // 严格符合：新参数(cap/col)首次出现给2dock，下一关收回为1dock；emptyCount=1固定
  assert.deepEqual(
    LEVELS.map((level) => [level.capacity, level.dockCount, colorsIn(level).size]),
    [[3, 2, 3], [3, 1, 3], [4, 2, 3], [4, 1, 3], [4, 2, 4], [5, 1, 4], [5, 2, 5]],
  );
  assert.deepEqual(LEVELS.map((level) => level.par), [7, 7, 11, 13, 14, 23, 26]);
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

test("the published mainline keeps special mechanics out of the seven levels", () => {
  assert.equal(LEVELS.every((level) => level.modifiers.length === 0), true);
});
