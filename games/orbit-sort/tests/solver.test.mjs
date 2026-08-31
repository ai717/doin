import assert from "node:assert/strict";
import test from "node:test";

import { createState, isSolved } from "../engine.mjs";
import { replayActions, solve, stateKey } from "../solver.mjs";

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
