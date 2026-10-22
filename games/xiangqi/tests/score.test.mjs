// 计分唯一口径测试：星级边界、连胜、徽章、记分簿摘要。
import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignStars,
  nextStreak,
  badgeKeyForTier,
  duelSummary,
  MAX_UNDO_PER_DUEL,
} from "../js/score.mjs";

test("campaignStars：≤par 且无悔棋 = 3 星", () => {
  assert.equal(campaignStars(3, 3, false), 3);
  assert.equal(campaignStars(1, 5, false), 3);
  assert.equal(campaignStars(0, 3, false), 0, "无步数不计星");
});

test("campaignStars：悔棋封顶 2 星", () => {
  assert.equal(campaignStars(2, 3, true), 2);
});

test("campaignStars：par+2 内 = 2 星，超出 = 1 星", () => {
  assert.equal(campaignStars(5, 3, false), 2);
  assert.equal(campaignStars(5, 3, true), 2, "步数压线但悔棋封顶 2 星");
  assert.equal(campaignStars(6, 3, true), 1, "悔棋与超步同取更差档");
  assert.equal(campaignStars(7, 3, false), 1);
  assert.equal(campaignStars(99, 3, false), 1);
});

test("campaignStars：par 非法 = 0 星", () => {
  assert.equal(campaignStars(1, 0, false), 0);
  assert.equal(campaignStars(-1, 3, false), 0);
});

test("nextStreak：胜 +1，负/和清零", () => {
  assert.equal(nextStreak(0, true), 1);
  assert.equal(nextStreak(4, true), 5);
  assert.equal(nextStreak(7, false), 0);
});

test("badgeKeyForTier：档位 key 映射徽章键", () => {
  assert.equal(badgeKeyForTier("ai_5"), "badge_ai_5");
  assert.equal(badgeKeyForTier("defender"), "badge_defender");
});

test("duelSummary：空记录零值兜底", () => {
  const summary = duelSummary(null);
  assert.deepEqual(
    { wins: summary.wins, losses: summary.losses, draws: summary.draws, total: summary.total },
    { wins: 0, losses: 0, draws: 0, total: 0 },
  );
});

test("duelSummary：bestStreak 不低于当前 streak", () => {
  assert.equal(duelSummary({ wins: 2, losses: 1, draws: 1, streak: 3, bestStreak: 2, badges: {} }).bestStreak, 3);
  assert.equal(duelSummary({ wins: 1, streak: 0, bestStreak: 5 }).bestStreak, 5);
});

test("MAX_UNDO_PER_DUEL = 3（对战悔棋上限）", () => {
  assert.equal(MAX_UNDO_PER_DUEL, 3);
});
