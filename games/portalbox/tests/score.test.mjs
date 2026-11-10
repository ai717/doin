import test from "node:test";
import assert from "node:assert/strict";

import {
  BASE_SCORE, OUTCOME_CLEAR, OUTCOME_FAIL, STAR_SCORE, STEP_SCORE,
  levelResult, outcomeOf, starsForSteps, totalOf,
} from "../js/score.mjs";

const eq = assert.strictEqual;

function state(overrides = {}) {
  return {
    status: "playing",
    solved: false,
    steps: 0,
    levelId: "p01",
    ...overrides,
  };
}

test("outcomeOf 只认终局", () => {
  eq(outcomeOf(null), null);
  eq(outcomeOf(state()), null);
  eq(outcomeOf(state({ status: "won" })), OUTCOME_CLEAR);
  eq(outcomeOf(state({ solved: true })), OUTCOME_CLEAR);
  eq(outcomeOf(state({ status: "lost" })), OUTCOME_FAIL);
});

test("星评：最优 +3 内三星，+9 内两星，其余一星", () => {
  eq(starsForSteps(5, 5), 3);
  eq(starsForSteps(8, 5), 3);
  eq(starsForSteps(9, 5), 2);
  eq(starsForSteps(14, 5), 2);
  eq(starsForSteps(15, 5), 1);
  eq(starsForSteps(0, 0), 3);
});

test("通关结算：星评、步数与得分", () => {
  const result = levelResult(state({ solved: true, status: "won", steps: 7 }), { id: "p01", optimal: 5 });
  eq(result.outcome, OUTCOME_CLEAR);
  eq(result.stars, 3);
  eq(result.steps, 7);
  eq(result.optimal, 5);
  eq(result.score, BASE_SCORE + 3 * STAR_SCORE + Math.max(0, 5 + 10 - 7) * STEP_SCORE);
  eq(result.levelId, "p01");
});

test("步数超过两星阈值只给一星", () => {
  const result = levelResult(state({ solved: true, steps: 20 }), { optimal: 5 });
  eq(result.stars, 1);
  eq(result.score, BASE_SCORE + STAR_SCORE + 0);
});

test("未终局没有结算", () => {
  eq(levelResult(state(), { optimal: 5 }), null);
});

test("totalOf 汇总最佳分与星数", () => {
  const total = totalOf({
    p01: { stars: 3, bestScore: 2100 },
    p02: { stars: 1, bestScore: 900 },
    bad: null,
  });
  eq(total.stars, 4);
  eq(total.score, 3000);
  assert.deepEqual(totalOf(null), { stars: 0, score: 0 });
});
