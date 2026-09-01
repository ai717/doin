import assert from "node:assert/strict";
import test from "node:test";

import { generateLevel, validateLevel } from "../generator.mjs";
import { createLevelState, LEVELS } from "../levels.mjs";
import { isSolved } from "../engine.mjs";
import { replayActions, solve } from "../solver.mjs";

test("published levels pass the same validator used for generated levels", () => {
  const expectedDeadEnds = new Map([[2, 2], [4, 1]]);
  for (const level of LEVELS) {
    const result = validateLevel(level, { nodeLimit: 2_000_000, timeLimitMs: 5_000 });
    assert.equal(result.valid, true, `level ${level.id} rejected: ${result.reason}`);
    assert.equal(result.par, level.par, `level ${level.id} par drifted`);
    assert.ok(Number.isInteger(result.deadEndFirstMoves));
    if (expectedDeadEnds.has(level.id)) {
      assert.equal(result.deadEndFirstMoves, expectedDeadEnds.get(level.id), `level ${level.id} dead-end opening drifted`);
    }
  }
});

test("dead-end legal openings are reported without being rejected", () => {
  const result = validateLevel(LEVELS.find((level) => level.id === 2), { nodeLimit: 500_000, timeLimitMs: 1_000 });
  assert.equal(result.valid, true);
  assert.equal(result.deadEndFirstMoves, 2);
  assert.ok(result.firstMoveChecks.some((check) => check.status === "dead-end"));
  assert.equal(validateLevel(LEVELS.find((level) => level.id === 2), {
    nodeLimit: 500_000,
    timeLimitMs: 1_000,
    maxDeadEndFirstMoves: 0,
  }).reason, "too-many-dead-end-first-moves");
});

test("the seeded generator is reproducible and returns a solvable initial state", () => {
  const first = generateLevel({ seed: "test-seed-1" });
  const second = generateLevel({ seed: "test-seed-1" });
  assert.deepEqual(first, second);
  const validation = validateLevel(first);
  assert.equal(validation.valid, true);
  const result = solve(createLevelState(first));
  assert.equal(result.status, "solved");
  assert.equal(isSolved(replayActions(createLevelState(first), result.actions)), true);
});
