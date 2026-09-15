// storage.test.mjs — Piano Tiles 存档测试
// 只测纯函数 normalizeStorageData / updateWithRunResult
// 真实 localStorage 交互在浏览器端集成测试覆盖

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeStorageData, updateWithRunResult,
} from "../js/storage.mjs";

describe("storage: normalizeStorageData", () => {
  it("空/null/数组 → 返回默认值", () => {
    const d = normalizeStorageData(null);
    assert.equal(d.bestScore, 0);
    assert.equal(d.bestCombo, 0);
    assert.equal(d.bestRank, null);
    assert.equal(d.gamesPlayed, 0);
    assert.equal(d.soundEnabled, true);
  });

  it("空对象 → 返回默认值", () => {
    const d = normalizeStorageData({});
    assert.equal(d.bestScore, 0);
    assert.equal(d.bestCombo, 0);
    assert.equal(d.gamesPlayed, 0);
    assert.equal(d.soundEnabled, true);
  });

  it("数组 / 字符串非法类型 → 默认", () => {
    const d = normalizeStorageData([1, 2, 3]);
    assert.equal(d.bestScore, 0);
    const d2 = normalizeStorageData("garbage");
    assert.equal(d2.bestScore, 0);
  });

  it("坏类型字段被纠正为默认", () => {
    const d = normalizeStorageData({
      bestScore: "abc",
      bestCombo: -1,
      bestRank: 123,
      gamesPlayed: null,
      soundEnabled: "yes",
    });
    assert.equal(d.bestScore, 0);
    assert.equal(d.bestCombo, 0);
    assert.equal(d.bestRank, null);
    assert.equal(d.gamesPlayed, 0);
    assert.equal(d.soundEnabled, true);
  });

  it("正常值完整保留", () => {
    const d = normalizeStorageData({
      bestScore: 1234,
      bestCombo: 56,
      bestRank: "手速大师",
      gamesPlayed: 42,
      soundEnabled: false,
    });
    assert.equal(d.bestScore, 1234);
    assert.equal(d.bestCombo, 56);
    assert.equal(d.bestRank, "手速大师");
    assert.equal(d.gamesPlayed, 42);
    assert.equal(d.soundEnabled, false);
  });

  it("非有限数字被纠正", () => {
    const d = normalizeStorageData({
      bestScore: Infinity,
      bestCombo: NaN,
      gamesPlayed: undefined,
    });
    assert.equal(d.bestScore, 0);
    assert.equal(d.bestCombo, 0);
    assert.equal(d.gamesPlayed, 0);
  });
});

describe("storage: updateWithRunResult", () => {
  const prev = { bestScore: 100, bestCombo: 20, bestRank: null, gamesPlayed: 5, soundEnabled: true };

  it("新纪录更新 bestScore / bestCombo / bestRank", () => {
    const next = updateWithRunResult(prev, { score: 200, maxCombo: 30, rankName: "快手" });
    assert.equal(next.bestScore, 200);
    assert.equal(next.bestCombo, 30);
    assert.equal(next.bestRank, "快手");
    assert.equal(next.gamesPlayed, 6);
  });

  it("旧纪录不覆盖", () => {
    const next = updateWithRunResult(prev, { score: 50, maxCombo: 10, rankName: null });
    assert.equal(next.bestScore, 100);
    assert.equal(next.bestCombo, 20);
    assert.equal(next.gamesPlayed, 6);
  });

  it("最高分相同但 combo 更高 → 更新 combo", () => {
    const next = updateWithRunResult(prev, { score: 100, maxCombo: 25, rankName: "快手" });
    assert.equal(next.bestScore, 100); // 不变
    assert.equal(next.bestCombo, 25);  // 更新
    assert.equal(next.bestRank, "快手");
  });

  it("gamesPlayed 始终 +1", () => {
    const next = updateWithRunResult(prev, { score: 0, maxCombo: 0 });
    assert.equal(next.gamesPlayed, prev.gamesPlayed + 1);
  });
});
