// score.test.mjs — 计分与格式化唯一口径
import { test } from "node:test";
import assert from "node:assert/strict";
import * as score from "../js/score.mjs";

test("formatCoins 三档缩写 + 千分位", () => {
  assert.equal(score.formatCoins(0), "0");
  assert.equal(score.formatCoins(999), "999");
  assert.equal(score.formatCoins(1000), "1K");
  assert.equal(score.formatCoins(1500), "1.5K");
  assert.equal(score.formatCoins(12345), "12.3K");
  assert.equal(score.formatCoins(999999), "1000K"); // 边界
  assert.equal(score.formatCoins(1_000_000), "1M");
  assert.equal(score.formatCoins(2_500_000), "2.5M");
  assert.equal(score.formatCoins(123_456_789), "123.5M");
  assert.equal(score.formatCoins(1_000_000_000), "1B");
  assert.equal(score.formatCoins(12_345_678_901), "12.3B");
});

test("formatCoins 负数钳制为 0", () => {
  assert.equal(score.formatCoins(-100), "0");
  assert.equal(score.formatCoins(-999999), "0");
});

test("formatCoins 非数字降级 0", () => {
  assert.equal(score.formatCoins(null), "0");
  assert.equal(score.formatCoins(undefined), "0");
  assert.equal(score.formatCoins("invalid"), "0");
  assert.equal(score.formatCoins(NaN), "0");
});

test("formatStars 等同 formatCoins", () => {
  assert.equal(score.formatStars(50), "50");
  assert.equal(score.formatStars(5000), "5K");
});

test("formatPercent 默认 + 号 + 整数百分比", () => {
  assert.equal(score.formatPercent(0.5), "+50%");
  assert.equal(score.formatPercent(0.03), "+3%");
  assert.equal(score.formatPercent(0.125), "+13%"); // 四舍五入
  assert.equal(score.formatPercent(1.0), "+100%");
});

test("formatPercent 不带符号", () => {
  assert.equal(score.formatPercent(0.5, false), "50%");
  assert.equal(score.formatPercent(0.0, false), "0%");
});

test("formatBowls 千分位 + 钳制 ≥ 0", () => {
  assert.equal(score.formatBowls(1234), "1,234");
  assert.equal(score.formatBowls(1234567), "1,234,567");
  assert.equal(score.formatBowls(-50), "0");
});

test("clampScore 永远 ≥ 0 + 整数化", () => {
  assert.equal(score.clampScore(100), 100);
  assert.equal(score.clampScore(0), 0);
  assert.equal(score.clampScore(-50), 0);
  assert.equal(score.clampScore(3.7), 3);
  assert.equal(score.clampScore(NaN), 0);
  assert.equal(score.clampScore(null), 0);
});

test("summary 提取关键 HUD 字段", () => {
  const s = score.summary({
    coins: 1234.7,
    stars: 10,
    bowlsServed: 500,
    totalCoinsEarned: 99999.9,
    stage: 3,
  });
  assert.equal(s.coins, 1234);
  assert.equal(s.stars, 10);
  assert.equal(s.bowls, 500);
  assert.equal(s.totalEarned, 99999);
  assert.equal(s.stage, 3);
});

test("summary 负数与非法值钳制", () => {
  const s = score.summary({
    coins: -100,
    stars: NaN,
    bowlsServed: undefined,
    stage: "invalid",
  });
  assert.equal(s.coins, 0);
  assert.equal(s.stars, 0);
  assert.equal(s.bowls, 0);
  assert.equal(s.stage, 0);
});