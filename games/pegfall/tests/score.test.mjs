import test from "node:test";
import assert from "node:assert/strict";

import {
  OUTCOME_CLEAR, OUTCOME_FAIL, STAR_THRESHOLDS, levelResult, outcomeOf, starsForBalls, totalOf,
} from "../js/score.mjs";

const eq = assert.strictEqual;

test("星评阈值：剩余 5 颗三星、2 颗两星、其余一星", () => {
  assert.deepEqual([...STAR_THRESHOLDS], [5, 2]);
  eq(starsForBalls(10), 3);
  eq(starsForBalls(5), 3);
  eq(starsForBalls(4), 2);
  eq(starsForBalls(2), 2);
  eq(starsForBalls(1), 1);
  eq(starsForBalls(0), 1);
  eq(starsForBalls(-3), 1);
});

test("终局结果：清关按剩余弹珠给星，失败零星", () => {
  const won = levelResult({ status: "won", score: 52000, ballsLeft: 6, orangeLeft: 0, orangeTotal: 14 });
  eq(won.outcome, OUTCOME_CLEAR);
  eq(won.stars, 3);
  eq(won.score, 52000);
  eq(won.ballsLeft, 6);

  const lost = levelResult({ status: "lost", score: 8000, ballsLeft: 0, orangeLeft: 3, orangeTotal: 14 });
  eq(lost.outcome, OUTCOME_FAIL);
  eq(lost.stars, 0);

  eq(levelResult({ status: "aim" }), null);
  eq(outcomeOf(null), null);
  eq(outcomeOf({ status: "won" }), OUTCOME_CLEAR);
  eq(outcomeOf({ status: "lost" }), OUTCOME_FAIL);
});

test("累计成绩：非法记录不计入", () => {
  const total = totalOf({
    p01: { stars: 3, bestScore: 12000 },
    p02: { stars: "2", bestScore: "8000" },
    p03: { stars: -1, bestScore: -5 },
  });
  eq(total.stars, 5);
  eq(total.score, 20000);
  assert.deepEqual(totalOf(null), { score: 0, stars: 0 });
});
