import test from "node:test";
import assert from "node:assert/strict";
import { starsFor, levelScore, boardStars, totalStars, clearedLevels, atlasIds, atlasTotal, bestMs } from "../js/score.mjs";

function sampleProgress() {
  return {
    boards: {
      zh: {
        board_history: {
          levels: {
            0: { stars: 3, hintsUsed: 0, ms: 42000 },
            1: { stars: 2, hintsUsed: 1, ms: 61000 },
          },
          atlas: { idiom_h01: true, idiom_h02: true },
        },
        board_nature: {
          levels: { 0: { stars: 1, hintsUsed: 2, ms: 90000 } },
          atlas: { idiom_n01: true },
        },
      },
      en: {
        board_history: { levels: {}, atlas: {} },
      },
    },
  };
}

test("评级：零提示三星、一次二星、两次及以上一星", () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(1), 2);
  assert.equal(starsFor(2), 1);
  assert.equal(starsFor(9), 1);
  assert.equal(starsFor(-1), 3);
  assert.equal(starsFor("abc"), 3);
});

test("评分：词数越多越高，提示与耗时扣分", () => {
  const base = levelScore({ entries: 6, hintsUsed: 0, elapsedMs: 30000 });
  assert.ok(base > levelScore({ entries: 6, hintsUsed: 2, elapsedMs: 30000 }));
  assert.ok(levelScore({ entries: 6, hintsUsed: 0, elapsedMs: 30000 }) >= levelScore({ entries: 6, hintsUsed: 0, elapsedMs: 90000 }));
  assert.ok(levelScore({ entries: 8, hintsUsed: 0, elapsedMs: 30000 }) > levelScore({ entries: 4, hintsUsed: 0, elapsedMs: 30000 }));
  assert.ok(levelScore({}) >= 120);
});

test("进度：按榜汇总星数、关卡数、图鉴数与最佳用时", () => {
  const progress = sampleProgress();
  assert.equal(boardStars(progress, "zh", "board_history"), 5);
  assert.equal(totalStars(progress, "zh"), 6);
  assert.equal(clearedLevels(progress, "zh", "board_history"), 2);
  assert.deepEqual(atlasIds(progress, "zh", "board_history"), ["idiom_h01", "idiom_h02"]);
  assert.equal(atlasTotal(progress, "zh"), 3);
  assert.equal(bestMs(progress, "zh", "board_history", 0), 42000);
  assert.equal(boardStars(progress, "en", "board_history"), 0);
});
