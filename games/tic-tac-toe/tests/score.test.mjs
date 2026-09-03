import test from "node:test";
import assert from "node:assert/strict";
import { EMPTY, PLAYER_O, PLAYER_X, createState, applyMove } from "../js/engine.mjs";
import { DIFFICULTY_EASY, DIFFICULTY_MASTER, DIFFICULTY_NORMAL } from "../js/ai.mjs";
import {
  OUTCOME_DRAW,
  OUTCOME_LOSS,
  OUTCOME_WIN,
  breakdown,
  countEmpty,
  difficultyFactor,
  outcomeOf,
  scoreResult,
} from "../js/score.mjs";

function won(emptyLeft) {
  const state = createState({ size: 3 });
  state.status = "won";
  state.winner = PLAYER_X;
  state.board = state.board.fill(EMPTY).map((_, i) => (i < 9 - emptyLeft ? PLAYER_X : EMPTY));
  return state;
}

test("outcomeOf: 胜平负与未终局", () => {
  const state = createState({ size: 3 });
  assert.equal(outcomeOf(state, PLAYER_X), "playing");

  const win = applyMove(applyMove(applyMove(applyMove(applyMove(state, 0), 3), 1), 4), 2);
  assert.equal(outcomeOf(win, PLAYER_X), OUTCOME_WIN);
  assert.equal(outcomeOf(win, PLAYER_O), OUTCOME_LOSS);

  const draw = createState({ size: 3 });
  draw.status = "draw";
  assert.equal(outcomeOf(draw, PLAYER_X), OUTCOME_DRAW);
});

test("countEmpty: 统计剩余空格", () => {
  assert.equal(countEmpty(createState({ size: 3 })), 9);
  assert.equal(countEmpty(createState({ size: 4 })), 16);
  assert.equal(countEmpty(applyMove(createState({ size: 3 }), 4)), 8);
});

test("基础分：胜 100 / 平 30 / 负 0，且不受空格数影响", () => {
  assert.equal(scoreResult({ outcome: OUTCOME_WIN, difficulty: DIFFICULTY_NORMAL }).total, 100);
  assert.equal(scoreResult({ outcome: OUTCOME_DRAW, difficulty: DIFFICULTY_NORMAL, empty: 4 }).total, 30);
  assert.equal(scoreResult({ outcome: OUTCOME_LOSS, difficulty: DIFFICULTY_NORMAL, empty: 4 }).total, 0);
});

test("效率奖励：仅胜局生效，按剩余空格计", () => {
  const fast = scoreResult({ outcome: OUTCOME_WIN, empty: 4, difficulty: DIFFICULTY_NORMAL });
  const slow = scoreResult({ outcome: OUTCOME_WIN, empty: 0, difficulty: DIFFICULTY_NORMAL });
  assert.equal(fast.efficiency, 32);
  assert.equal(slow.efficiency, 0);
  assert.equal(fast.total, 132);
  assert.equal(scoreResult({ outcome: OUTCOME_DRAW, empty: 4 }).efficiency, 0);
});

test("连胜奖励：首胜不给，第 5 连胜起封顶 100", () => {
  assert.equal(scoreResult({ outcome: OUTCOME_WIN, streakBefore: 0 }).streak, 0);
  assert.equal(scoreResult({ outcome: OUTCOME_WIN, streakBefore: 1 }).streak, 20);
  assert.equal(scoreResult({ outcome: OUTCOME_WIN, streakBefore: 5 }).streak, 100);
  assert.equal(scoreResult({ outcome: OUTCOME_WIN, streakBefore: 99 }).streak, 100);
  assert.equal(scoreResult({ outcome: OUTCOME_DRAW, streakBefore: 3 }).streak, 0);
});

test("难度系数：轻松 0.6 / 普通 1.0 / 大师 1.6，且合计四舍五入", () => {
  assert.equal(difficultyFactor(DIFFICULTY_EASY), 0.6);
  assert.equal(difficultyFactor(DIFFICULTY_NORMAL), 1);
  assert.equal(difficultyFactor(DIFFICULTY_MASTER), 1.6);
  assert.equal(scoreResult({ outcome: OUTCOME_WIN, difficulty: DIFFICULTY_EASY }).total, 60);
  assert.equal(scoreResult({ outcome: OUTCOME_WIN, difficulty: DIFFICULTY_MASTER }).total, 160);
  // (100 + 8 + 0) * 0.6 = 64.8 -> 65
  assert.equal(scoreResult({ outcome: OUTCOME_WIN, empty: 1, difficulty: DIFFICULTY_EASY }).total, 65);
});

test("脏输入被夹到合法范围，不产出 NaN", () => {
  const score = scoreResult({ outcome: OUTCOME_WIN, empty: -5, streakBefore: -3, difficulty: "nope" });
  assert.equal(score.efficiency, 0);
  assert.equal(score.streak, 0);
  assert.equal(score.factor, 1);
  assert.equal(Number.isNaN(score.total), false);
});

test("breakdown: 四行明细且合计等于 scoreResult", () => {
  const rows = breakdown({ outcome: OUTCOME_WIN, empty: 3, streakBefore: 2, difficulty: DIFFICULTY_NORMAL });
  assert.deepEqual(rows.map((r) => r.key), ["base", "efficiency", "streak", "total"]);
  assert.deepEqual(rows.map((r) => r.value), [100, 24, 40, 164]);
  assert.equal(rows[3].value, scoreResult({ outcome: OUTCOME_WIN, empty: 3, streakBefore: 2 }).total);
});
