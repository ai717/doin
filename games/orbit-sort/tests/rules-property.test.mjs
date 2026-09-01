import assert from "node:assert/strict";
import test from "node:test";

import { createLevelState, LEVELS } from "../levels.mjs";
import { applyAction, legalActions, validateAction } from "../engine.mjs";
import { stateKey } from "../solver.mjs";

test("every sampled reachable state obeys the single action authority", () => {
  for (const level of LEVELS) {
    const queue = [createLevelState(level)];
    const seen = new Set();
    let sampled = 0;
    while (queue.length && sampled < 5_000) {
      const state = queue.shift();
      const key = stateKey(state);
      if (seen.has(key)) continue;
      seen.add(key);
      sampled += 1;
      const actions = legalActions(state);
      if (state.status === "stuck") assert.equal(actions.length, 0, `level ${level.id} false stuck`);
      for (const action of actions) {
        const result = applyAction(state, action);
        assert.equal(validateAction(state, action).valid, true);
        assert.equal(result.valid, true, `level ${level.id} rejected legal action`);
        assert.notEqual(result.state, state, `level ${level.id} legal action made no change`);
        queue.push(result.state);
      }
    }
    assert.ok(sampled > 0);
  }
});
