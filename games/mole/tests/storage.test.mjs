// storage.test.mjs — 存档归一化 / 降级 / 纪录更新
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeStorageData, loadGameData, saveGameData,
  bestOf, rollDailyIfNeeded, updateWithRunResult,
} from "../js/storage.mjs";

describe("storage: 坏值归一化", () => {
  it("null / 字符串 / 数组 / 数字一律回默认", () => {
    for (const bad of [null, undefined, "oops", 42, [], true]) {
      const clean = normalizeStorageData(bad);
      assert.equal(clean.bestScore.normal, 0);
      assert.equal(clean.soundEnabled, true);
      assert.equal(clean.difficulty, "normal");
      assert.equal(clean.gamesPlayed, 0);
    }
  });

  it("负数与非法数值被钳制", () => {
    const clean = normalizeStorageData({
      bestScore: { easy: -5, normal: "x", crazy: 12.9, daily: null },
      bestCombo: { easy: 3 },
      dailyScore: -100,
      gamesPlayed: Number.NaN,
      soundEnabled: "yes",
      difficulty: "daily",
    });
    assert.equal(clean.bestScore.easy, 0);
    assert.equal(clean.bestScore.normal, 0);
    assert.equal(clean.bestScore.crazy, 12);
    assert.equal(clean.bestScore.daily, 0);
    assert.equal(clean.bestCombo.easy, 3);
    assert.equal(clean.dailyScore, 0);
    assert.equal(clean.gamesPlayed, 0);
    assert.equal(clean.soundEnabled, true, "非布尔回默认 true");
    assert.equal(clean.difficulty, "normal", "daily 不是可选难度");
  });

  it("缺失字段补全为默认", () => {
    const clean = normalizeStorageData({});
    assert.deepEqual(Object.keys(clean).sort(), [
      "bestCombo", "bestScore", "dailyDate", "dailyScore", "difficulty", "gamesPlayed", "soundEnabled",
    ]);
    for (const mode of ["easy", "normal", "crazy", "daily"]) {
      assert.equal(clean.bestScore[mode], 0);
      assert.equal(clean.bestCombo[mode], 0);
    }
  });

  it("dailyDate 超长被截断", () => {
    const clean = normalizeStorageData({ dailyDate: "2026-09-23-0123456789" });
    assert.ok(clean.dailyDate.length <= 16);
  });
});

describe("storage: 读写闭环", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") localStorage.clear();
  });

  it("存取往返一致", () => {
    if (typeof localStorage === "undefined") return;
    const payload = { bestScore: { easy: 1, normal: 2, crazy: 3, daily: 4 }, soundEnabled: false };
    saveGameData(payload);
    const loaded = loadGameData();
    assert.equal(loaded.bestScore.normal, 2);
    assert.equal(loaded.soundEnabled, false);
  });

  it("损坏 JSON 回默认不抛错", () => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem("doin.mole.v1", "{not json");
    const loaded = loadGameData();
    assert.equal(loaded.bestScore.normal, 0);
  });

  it("localStorage 不可用时静默降级内存", () => {
    const clean = saveGameData({ bestScore: { normal: 5 } });
    assert.equal(clean.bestScore.normal, 5);
    assert.equal(bestOf(clean, "normal"), 5);
    assert.equal(bestOf(clean, "nope"), 0);
  });
});

describe("storage: 纪录更新", () => {
  it("刷新最高分与最长连击，局数递增", () => {
    let data = normalizeStorageData({});
    data = updateWithRunResult(data, { mode: "crazy", score: 30, maxCombo: 11 });
    assert.equal(data.bestScore.crazy, 30);
    assert.equal(data.bestCombo.crazy, 11);
    assert.equal(data.gamesPlayed, 1);
    assert.equal(data.difficulty, "crazy");

    data = updateWithRunResult(data, { mode: "crazy", score: 10, maxCombo: 4 });
    assert.equal(data.bestScore.crazy, 30, "低分不覆盖");
    assert.equal(data.bestCombo.crazy, 11, "低连击不覆盖");
    assert.equal(data.gamesPlayed, 2);
  });

  it("每日成绩跨天重置", () => {
    let data = normalizeStorageData({});
    data = updateWithRunResult(data, { mode: "daily", score: 50, maxCombo: 9, date: "2026-09-23" });
    assert.equal(data.dailyScore, 50);
    assert.equal(data.dailyDate, "2026-09-23");

    data = rollDailyIfNeeded(data, "2026-09-23");
    assert.equal(data.dailyScore, 50, "同日保留");

    data = rollDailyIfNeeded(data, "2026-09-24");
    assert.equal(data.dailyScore, 0);
    assert.equal(data.dailyDate, "2026-09-24");
    assert.equal(data.bestScore.daily, 50, "历史最高不受影响");
  });

  it("非法 mode 回落到 normal", () => {
    const data = updateWithRunResult(normalizeStorageData({}), { mode: "hell", score: 7, maxCombo: 2 });
    assert.equal(data.bestScore.normal, 7);
  });
});
