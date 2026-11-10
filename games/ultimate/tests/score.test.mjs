import test from "node:test";
import assert from "node:assert/strict";

import {
  OUTCOME_DRAW, OUTCOME_LOSS, OUTCOME_PLAYING, OUTCOME_WIN,
  breakdown, countBigs, outcomeOf, scoreCampaign, scoreDuel,
} from "../js/score.mjs";
import { createEmptyState } from "../js/engine.mjs";
import { createPuzzleState, getPuzzle } from "../js/puzzles.mjs";

const eq = assert.strictEqual;

test("胜负判定口径", () => {
  const empty = createEmptyState();
  eq(outcomeOf(empty, 1), OUTCOME_PLAYING);
  eq(outcomeOf(null, 1), OUTCOME_PLAYING);
  const won = { status: "won", winner: 1 };
  eq(outcomeOf(won, 1), OUTCOME_WIN);
  eq(outcomeOf(won, 2), OUTCOME_LOSS);
  eq(outcomeOf({ status: "draw", winner: 0 }, 1), OUTCOME_DRAW);
});

test("对弈计分：胜 > 和 > 负，且难度系数单调", () => {
  const win = scoreDuel({ outcome: OUTCOME_WIN, moves: 24, ownBigs: 3, tier: "duelist" });
  const draw = scoreDuel({ outcome: OUTCOME_DRAW, moves: 24, ownBigs: 0, tier: "duelist" });
  const loss = scoreDuel({ outcome: OUTCOME_LOSS, moves: 24, ownBigs: 0, tier: "duelist" });
  assert.ok(win.total > draw.total);
  assert.ok(draw.total > loss.total);
  eq(loss.total, 0);

  const easy = scoreDuel({ outcome: OUTCOME_WIN, moves: 24, ownBigs: 3, tier: "novice" });
  const hard = scoreDuel({ outcome: OUTCOME_WIN, moves: 24, ownBigs: 3, tier: "infallible" });
  assert.ok(hard.total > easy.total);

  const quick = scoreDuel({ outcome: OUTCOME_WIN, moves: 12, ownBigs: 3, tier: "duelist" });
  assert.ok(quick.total > win.total, "赢得越快效率分越高");
  eq(win.total, Math.round((win.base + win.bigs + win.efficiency + win.streak) * win.factor));
});

test("连胜奖励封顶五连，平局不涨连胜", () => {
  const base = { outcome: OUTCOME_WIN, moves: 30, ownBigs: 1, tier: "duelist" };
  const five = scoreDuel({ ...base, streakBefore: 5 });
  const nine = scoreDuel({ ...base, streakBefore: 9 });
  eq(five.streak, nine.streak);
  eq(scoreDuel({ outcome: OUTCOME_DRAW, moves: 30, ownBigs: 1, tier: "duelist", streakBefore: 4 }).streak, 0);
});

test("明细行合计等于总分且不含负数", () => {
  const score = scoreDuel({ outcome: OUTCOME_WIN, moves: 18, ownBigs: 2, tier: "master", streakBefore: 2 });
  const rows = breakdown(score);
  eq(rows[rows.length - 1].key, "total");
  eq(rows[rows.length - 1].value, score.total);
  for (const row of rows) assert.ok(row.value >= 0);
});

test("残局计分：星数优先，省步有额外奖励，三星封顶", () => {
  const three = scoreCampaign({ stars: 3, used: 2, par: 3 });
  const two = scoreCampaign({ stars: 2, used: 3, par: 3 });
  const fail = scoreCampaign({ stars: 0, used: 9, par: 2 });
  assert.ok(three.total > two.total);
  eq(fail.total, 0);
  eq(scoreCampaign({ stars: 7, used: 0, par: 0 }).stars, 3);
  assert.ok(three.saved >= 0);
});

test("大格计数与解题盘面一致", () => {
  const puzzle = getPuzzle("u01");
  const state = createPuzzleState(puzzle);
  assert.ok(state);
  eq(countBigs(state, 1) + countBigs(state, 2) <= 9, true);
});
