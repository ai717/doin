import assert from "node:assert/strict";
import test from "node:test";

import { generateLevel, validateLevel } from "../generator.mjs";
import { createLevelState, LEVELS } from "../levels.mjs";
import { isSolved } from "../engine.mjs";
import { replayActions, solve } from "../solver.mjs";

test("published levels pass the same validator used for generated levels", () => {
  const representatives = [...new Map(LEVELS.map((level) => [level.sourceLevelId, level])).values()];
  assert.equal(representatives.length, 7);
  for (const level of representatives) {
    const result = validateLevel(level, { nodeLimit: 2_000_000, timeLimitMs: 5_000 });
    assert.equal(result.valid, true, `level ${level.id} rejected: ${result.reason}`);
    assert.equal(result.par, level.par, `level ${level.id} par drifted`);
    assert.ok(Number.isInteger(result.deadEndFirstMoves));
    assert.equal(result.deadEndFirstMoves, 0, `level ${level.id} has dead-end openings (generator guarantees 0)`);
  }
});

test("dead-end legal openings are reported without being rejected", () => {
  // Build a level that is known to have a dead-end first move and verify
  // validator reports it without rejecting the whole level.
  const deadEndLevel = {
    id: "audit-de", chapter: 1, capacity: 3, dockCount: 1,
    tracks: [[0, 2, 1], [1, 2, 0], [2, 1, 0], []],
    modifiers: [], seed: "audit-dead-end", par: 6,
  };
  const result = validateLevel(deadEndLevel, { nodeLimit: 500_000, timeLimitMs: 1_000 });
  assert.equal(result.valid, true);
  assert.ok(result.deadEndFirstMoves >= 1);
  assert.ok(result.firstMoveChecks.some((check) => check.status === "dead-end"));
  assert.equal(validateLevel(deadEndLevel, {
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
