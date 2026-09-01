import assert from "node:assert/strict";
import test from "node:test";

import { createState, isSolved } from "../engine.mjs";
import { analyzeOptimalFirstActions, replayActions, solve, stateKey } from "../solver.mjs";
import { createLevelState, levelById } from "../levels.mjs";

test("state keys include track order, modes, completion, docks, and origins", () => {
  const normal = createState({ capacity: 2, tracks: [[0], []] });
  const frozen = createState({
    capacity: 2,
    tracks: [{ orbs: [0], mode: "frozen", frozenUntilColor: 0 }, []],
  });
  const originA = structuredClone(normal);
  originA.docks[0] = {
    id: 0,
    unlocked: true,
    orb: { id: "x", color: 0 },
    originTrackId: 0,
  };
  const originB = structuredClone(originA);
  originB.docks[0].originTrackId = 1;
  assert.notEqual(stateKey(normal), stateKey(frozen));
  assert.notEqual(stateKey(originA), stateKey(originB));
  assert.equal(stateKey(normal), stateKey({ ...normal, selectedDockId: 0 }));
});

test("0-1 BFS finds the minimum number of extractions and replays to a win", () => {
  const game = createState({
    levelId: "solver-test",
    capacity: 2,
    dockCount: 1,
    tracks: [[0, 1], [1, 0], []],
  });
  const result = solve(game);
  assert.equal(result.status, "solved");
  assert.equal(result.par, 3);
  assert.equal(result.actions.filter((action) => action.type === "extract").length, result.par);
  const finalState = replayActions(game, result.actions);
  assert.equal(isSolved(finalState), true);
});

test("solver does not treat a timeout as an unsolvable board", () => {
  const game = createState({ capacity: 2, tracks: [[0, 1], [1, 0], []] });
  const result = solve(game, { nodeLimit: 0, timeLimitMs: 5_000 });
  assert.equal(result.status, "timeout");
  assert.equal(result.par, null);
  assert.equal(result.actions, null);
});

test("optimal-first audit exposes branching instead of pretending the answer is unique", () => {
  const level = createState({ capacity: 2, dockCount: 1, tracks: [[0, 1], [1, 0], []] });
  const audit = analyzeOptimalFirstActions(level, { nodeLimit: 100_000, timeLimitMs: 1_000 });
  assert.equal(audit.status, "solved");
  assert.equal(audit.par, 3);
  assert.equal(audit.actions.length, 2);
});

test("level 2 has at least one optimal strategic first move", () => {
  const audit = analyzeOptimalFirstActions(createLevelState(levelById(2)), { nodeLimit: 200_000, timeLimitMs: 1_000 });
  assert.equal(audit.status, "solved");
  assert.equal(audit.par, 6);
  assert.ok(audit.actions.length >= 1);
});

test("levels 3 to 6 each expose a verified optimal opening", () => {
  for (const levelId of [3, 4, 5, 6]) {
    const audit = analyzeOptimalFirstActions(createLevelState(levelById(levelId)), { nodeLimit: 2_000_000, timeLimitMs: 5_000 });
    assert.equal(audit.status, "solved");
    assert.ok(audit.actions.length >= 1);
  }
});
