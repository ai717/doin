// storage.test.mjs — 存档口径测试
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeStorageData, loadGameData, saveGameData,
  bestOf, totalStarsOf, flawlessCountOf,
  updateWithRunResult, rollDailyIfNeeded, updateDailyResult,
} from "../js/storage.mjs";

describe("storage: 归一化与降级", () => {
  it("坏数据归一化为默认态", () => {
    const a = normalizeStorageData(null);
    assert.equal(a.gamesPlayed, 0);
    assert.equal(a.soundEnabled, true);
    assert.equal(Object.keys(a.levelStars).length, 0);
    assert.equal(a.chapterProgress[1], "open");

    const b = normalizeStorageData("string-not-object");
    assert.equal(b.gamesPlayed, 0);

    const c = normalizeStorageData([]);
    assert.equal(c.gamesPlayed, 0);
  });

  it("正常数据归一化保留字段", () => {
    const src = {
      levelStars: { level_1_1: { stars: 2, flawless: false, bestMisses: 3, bestMs: 45000 } },
      chapterProgress: { 1: "done", 2: "open" },
      dailyDate: "2026-09-28",
      dailyBestMisses: 1,
      dailyBestMs: 30000,
      soundEnabled: false,
      gamesPlayed: 5,
    };
    const out = normalizeStorageData(src);
    assert.equal(out.levelStars["level_1_1"].stars, 2);
    assert.equal(out.chapterProgress[1], "done");
    assert.equal(out.chapterProgress[2], "open");
    assert.equal(out.soundEnabled, false);
    assert.equal(out.gamesPlayed, 5);
  });

  it("levelStars 越界值被钳制", () => {
    const out = normalizeStorageData({
      levelStars: { level_1_1: { stars: 99, flawless: "yes", bestMisses: -1, bestMs: -100 } },
    });
    assert.equal(out.levelStars["level_1_1"].stars, 3);
    assert.equal(out.levelStars["level_1_1"].flawless, false);
    assert.equal(out.levelStars["level_1_1"].bestMisses, 0);
    assert.equal(out.levelStars["level_1_1"].bestMs, 0);
  });

  it("非 level_ 前缀的 key 被丢弃", () => {
    const out = normalizeStorageData({
      levelStars: { foo: { stars: 1 }, level_1_1: { stars: 1 } },
    });
    assert.equal(out.levelStars.foo, undefined);
    assert.equal(out.levelStars["level_1_1"].stars, 1);
  });
});

describe("storage: 内存降级往返读写一致", () => {
  it("save → load 往返一致", () => {
    const data = {
      levelStars: { level_1_1: { stars: 3, flawless: true, bestMisses: 0, bestMs: 30000 } },
      chapterProgress: { 1: "done" },
      dailyDate: "2026-09-28",
      dailyBestMisses: 1,
      dailyBestMs: 60000,
      soundEnabled: true,
      gamesPlayed: 10,
    };
    const saved = saveGameData(data);
    const loaded = loadGameData();
    assert.deepEqual(loaded, saved);
  });
});

describe("storage: 取数与统计", () => {
  it("bestOf 返回某关最佳成绩；未玩过返回 null", () => {
    const data = normalizeStorageData({
      levelStars: { level_1_1: { stars: 2, flawless: false, bestMisses: 1, bestMs: 60000 } },
    });
    assert.equal(bestOf(data, "level_1_1").stars, 2);
    assert.equal(bestOf(data, "level_1_2"), null);
  });

  it("totalStarsOf 与 flawlessCountOf", () => {
    const data = normalizeStorageData({
      levelStars: {
        level_1_1: { stars: 3, flawless: true },
        level_1_2: { stars: 2, flawless: false },
        level_1_3: { stars: 1, flawless: true },
      },
    });
    assert.equal(totalStarsOf(data), 6);
    assert.equal(flawlessCountOf(data), 2);
  });

  it("空存档 totalStarsOf / flawlessCountOf = 0", () => {
    const data = normalizeStorageData(null);
    assert.equal(totalStarsOf(data), 0);
    assert.equal(flawlessCountOf(data), 0);
  });
});

describe("storage: updateWithRunResult", () => {
  it("首次记录直接写入", () => {
    const base = normalizeStorageData(null);
    const next = updateWithRunResult(base, {
      levelId: "level_1_1", stars: 2, flawless: false, misses: 1, timeMs: 60000,
    });
    assert.equal(next.levelStars["level_1_1"].stars, 2);
    assert.equal(next.levelStars["level_1_1"].bestMisses, 1);
    assert.equal(next.gamesPlayed, 1);
  });

  it("更好成绩更新；更差成绩保留旧值", () => {
    const base = normalizeStorageData({
      levelStars: { level_1_1: { stars: 2, flawless: false, bestMisses: 3, bestMs: 60000 } },
    });
    const better = updateWithRunResult(base, {
      levelId: "level_1_1", stars: 3, flawless: true, misses: 0, timeMs: 30000,
    });
    assert.equal(better.levelStars["level_1_1"].stars, 3);
    assert.equal(better.levelStars["level_1_1"].flawless, true);
    assert.equal(better.levelStars["level_1_1"].bestMisses, 0);
    assert.equal(better.levelStars["level_1_1"].bestMs, 30000);

    const worse = updateWithRunResult(better, {
      levelId: "level_1_1", stars: 1, flawless: false, misses: 5, timeMs: 120000,
    });
    assert.equal(worse.levelStars["level_1_1"].stars, 3);  // 保留更好
    assert.equal(worse.levelStars["level_1_1"].bestMisses, 0);
    assert.equal(worse.levelStars["level_1_1"].bestMs, 30000);
  });

  it("null run 不破坏数据", () => {
    const base = normalizeStorageData({ gamesPlayed: 5 });
    const next = updateWithRunResult(base, null);
    assert.equal(next.gamesPlayed, 6);
  });
});

describe("storage: daily 滚动与更新", () => {
  it("跨天清零每日成绩", () => {
    const base = normalizeStorageData({
      dailyDate: "2026-09-27",
      dailyBestMisses: 2,
      dailyBestMs: 60000,
    });
    const next = rollDailyIfNeeded(base, "2026-09-28");
    assert.equal(next.dailyDate, "2026-09-28");
    assert.equal(next.dailyBestMisses, Number.MAX_SAFE_INTEGER);
    assert.equal(next.dailyBestMs, Number.MAX_SAFE_INTEGER);
  });

  it("同日不清零", () => {
    const base = normalizeStorageData({
      dailyDate: "2026-09-28",
      dailyBestMisses: 1,
      dailyBestMs: 30000,
    });
    const next = rollDailyIfNeeded(base, "2026-09-28");
    assert.equal(next.dailyBestMisses, 1);
    assert.equal(next.dailyBestMs, 30000);
  });

  it("updateDailyResult 更少错更新；同错更少时更新；更差不更新", () => {
    const base = normalizeStorageData({
      dailyDate: "2026-09-28",
      dailyBestMisses: 3,
      dailyBestMs: 60000,
    });
    const better = updateDailyResult(base, "2026-09-28", 2, 70000);
    assert.equal(better.dailyBestMisses, 2);
    assert.equal(better.dailyBestMs, 70000);

    const sameMissBetterTime = updateDailyResult(better, "2026-09-28", 2, 50000);
    assert.equal(sameMissBetterTime.dailyBestMisses, 2);
    assert.equal(sameMissBetterTime.dailyBestMs, 50000);

    const worse = updateDailyResult(sameMissBetterTime, "2026-09-28", 4, 100000);
    assert.equal(worse.dailyBestMisses, 2);
    assert.equal(worse.dailyBestMs, 50000);
  });

  it("跨天首次记录直接写入", () => {
    const base = normalizeStorageData({ dailyDate: "2026-09-27" });
    const next = updateDailyResult(base, "2026-09-28", 1, 30000);
    assert.equal(next.dailyDate, "2026-09-28");
    assert.equal(next.dailyBestMisses, 1);
    assert.equal(next.dailyBestMs, 30000);
  });
});