import test from "node:test";
import assert from "node:assert/strict";

import { betterRecord, clearedCount, formatDuration, rankKey, starBudget, starsFor, totalStars } from "../js/score.mjs";

test("星级阈值：零误判且在快档内拿三星", () => {
  assert.equal(starsFor({ suspectCount: 3, timeMs: 30_000, mistakes: 0 }), 3);
  assert.equal(starsFor({ suspectCount: 3, timeMs: 105_000, mistakes: 0 }), 3, "正好卡在快档边界");
  assert.equal(starsFor({ suspectCount: 3, timeMs: 105_001, mistakes: 0 }), 2);
  assert.equal(starsFor({ suspectCount: 3, timeMs: 30_000, mistakes: 1 }), 2, "一次误判封顶二星");
  assert.equal(starsFor({ suspectCount: 3, timeMs: 210_000, mistakes: 1 }), 2);
  assert.equal(starsFor({ suspectCount: 3, timeMs: 210_001, mistakes: 1 }), 1);
  assert.equal(starsFor({ suspectCount: 3, timeMs: 10_000, mistakes: 2 }), 1);
});

test("星级阈值随案卷规模放宽", () => {
  assert.deepEqual(starBudget(3), { quick: 105_000, patient: 210_000 });
  assert.deepEqual(starBudget(5), { quick: 175_000, patient: 350_000 });
  assert.deepEqual(starBudget(0), { quick: 35_000, patient: 70_000 });
  assert.equal(starsFor({ suspectCount: 5, timeMs: 170_000, mistakes: 0 }), 3);
  assert.equal(starsFor({ suspectCount: 3, timeMs: 170_000, mistakes: 0 }), 2);
});

test("脏输入不produce NaN 星级", () => {
  assert.equal(starsFor({ suspectCount: "x", timeMs: NaN, mistakes: -3 }), 3);
  assert.equal(Number.isInteger(starsFor({ suspectCount: 4, timeMs: undefined, mistakes: undefined })), true);
});

test("评级映射与展示时长", () => {
  assert.equal(rankKey(3), "rank3");
  assert.equal(rankKey(2), "rank2");
  assert.equal(rankKey(1), "rank1");
  assert.equal(rankKey(0), "rank2", "异常值回落到二星档，永不空白");
  assert.equal(formatDuration(0), "00:00");
  assert.equal(formatDuration(59_400), "00:59");
  assert.equal(formatDuration(61_000), "01:01");
  assert.equal(formatDuration(3_723_000), "62:03");
  assert.equal(formatDuration(-5), "00:00");
  assert.equal(formatDuration(NaN), "00:00");
});

test("存档比较：误判少者优先，其次用时短者", () => {
  const fast = { timeMs: 60_000, mistakes: 1, stars: 2 };
  const clean = { timeMs: 90_000, mistakes: 0, stars: 3 };
  assert.equal(betterRecord(null, fast), fast);
  assert.equal(betterRecord(fast, null), fast);
  assert.equal(betterRecord(fast, clean), clean, "零误判胜过快但出错");
  const slower = { timeMs: 120_000, mistakes: 0, stars: 3 };
  assert.equal(betterRecord(clean, slower), clean);
  const quicker = { timeMs: 70_000, mistakes: 0, stars: 3 };
  assert.equal(betterRecord(clean, quicker), quicker);
});

test("汇总：总星数与结案数只数有效记录", () => {
  const progress = {
    cases: {
      1: { timeMs: 60_000, mistakes: 0, stars: 3 },
      2: { timeMs: 90_000, mistakes: 1, stars: 2 },
      3: null,
    },
  };
  assert.equal(totalStars(progress), 5);
  assert.equal(clearedCount(progress), 2);
  assert.equal(totalStars({}), 0);
  assert.equal(clearedCount(undefined), 0);
});
