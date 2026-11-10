import test from "node:test";
import assert from "node:assert/strict";

import {
  CLEAR_BONUS, LIFE_BONUS, OUTCOME_CLEAR, OUTCOME_FAIL, levelResult,
  outcomeOf, starsForFossils, totalOf,
} from "../js/score.mjs";

const eq = assert.strictEqual;

function state(overrides = {}) {
  return {
    status: "playing",
    score: 0,
    fossilsGot: 0,
    levelId: "d01",
    player: { lives: 3 },
    ...overrides,
  };
}

test("outcomeOf 只认终局", () => {
  eq(outcomeOf(null), null);
  eq(outcomeOf(state()), null);
  eq(outcomeOf(state({ status: "won" })), OUTCOME_CLEAR);
  eq(outcomeOf(state({ status: "lost" })), OUTCOME_FAIL);
});

test("星评由化石数量决定并夹在 0..3", () => {
  eq(starsForFossils(0), 0);
  eq(starsForFossils(1), 1);
  eq(starsForFossils(3), 3);
  eq(starsForFossils(9), 3);
  eq(starsForFossils(-2), 0);
  eq(starsForFossils("2"), 2);
  eq(starsForFossils("junk"), 0);
});

test("通关结算：基础分 + 清场奖励 + 剩余探险帽奖励", () => {
  const result = levelResult(state({
    status: "won",
    score: 1200,
    fossilsGot: 3,
    player: { lives: 2 },
  }));
  eq(result.outcome, OUTCOME_CLEAR);
  eq(result.stars, 3);
  eq(result.fossils, 3);
  eq(result.score, 1200 + CLEAR_BONUS + 2 * LIFE_BONUS);
  eq(result.levelId, "d01");
});

test("失败结算：保留过程分，但星评为 0", () => {
  const result = levelResult(state({
    status: "lost",
    score: 800,
    fossilsGot: 2,
    player: { lives: 0 },
  }));
  eq(result.outcome, OUTCOME_FAIL);
  eq(result.stars, 0);
  eq(result.fossils, 2);
  eq(result.score, 800);
});

test("未终局没有结算", () => {
  eq(levelResult(state()), null);
});

test("totalOf 汇总最佳分与星数", () => {
  const total = totalOf({
    d01: { stars: 3, bestScore: 1200 },
    d02: { stars: 1, bestScore: 300 },
    bad: null,
  });
  eq(total.stars, 4);
  eq(total.score, 1500);
  assert.deepEqual(totalOf(null), { stars: 0, score: 0 });
});
