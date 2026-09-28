// score.test.mjs —— 计分口径验收：分值表、钳制、三星评级、加命门槛与展示格式化。
// 分数由 engine 累加，score.mjs 只提供安全上限与展示；本文件钉死"UI 拿到的数永不为负、永不越界"。

import test from "node:test";
import assert from "node:assert/strict";

import {
  SCORE_MAX,
  EXTRA_LIFE_AT,
  GHOST_VALUES,
  FRUIT_TABLE,
  clampInt,
  ghostScore,
  fruitScore,
  pelletScore,
  rateRun,
  extraLifeThresholds,
  formatScore,
  formatClock,
} from "../js/score.mjs";
import { GHOST_SCORE, PELLET_SCORE, POWER_SCORE, FRUIT_SCORE } from "../js/engine.mjs";

test("分值表与 engine 同源，不许在 score 层另立一套", () => {
  assert.deepEqual(GHOST_VALUES, GHOST_SCORE, "幽灵连吃分表必须与 engine 完全一致");
  assert.deepEqual(FRUIT_TABLE, FRUIT_SCORE);
  assert.equal(pelletScore(false), PELLET_SCORE);
  assert.equal(pelletScore(true), PELLET_SCORE * 2, "糖浆区的豆是双倍分");
  assert.equal(POWER_SCORE, 50, "能量豆基础分锁定 50");
});

test("clampInt：脏值、越界、小数全部落到合法区间", () => {
  assert.equal(clampInt(5, 0, 10), 5);
  assert.equal(clampInt(-1, 0, 10), 0);
  assert.equal(clampInt(11, 0, 10), 10);
  assert.equal(clampInt(2.6, 0, 10), 3, "四舍五入而不是截断");
  assert.equal(clampInt(NaN, 0, 10, 7), 7);
  assert.equal(clampInt(Infinity, 0, 10, 7), 7);
  assert.equal(clampInt("4", 0, 10), 4, "字符串数字也要算");
  assert.equal(clampInt(undefined, 0, 10, 2), 2);
});

test("连吃幽灵：200/400/800/1600，越界一律取最高档", () => {
  assert.deepEqual([0, 1, 2, 3].map(ghostScore), [200, 400, 800, 1600]);
  assert.equal(ghostScore(9), 1600, "第五只以后按最高档给");
  assert.equal(ghostScore(-5), 200, "负数序号回落到第一档");
  assert.equal(ghostScore(undefined), 200);
  assert.equal(ghostScore("2"), 800);
});

test("水果分按关数取档，越界取最高档", () => {
  assert.equal(fruitScore(1), 100);
  assert.equal(fruitScore(2), 300);
  assert.equal(fruitScore(8), 5000);
  assert.equal(fruitScore(99), 5000, "超过表长取最后一档");
  assert.equal(fruitScore(0), 100, "0 关按第 1 关算");
});

test("三星评级：清盘是前提，另两项独立计", () => {
  const zero = rateRun({ cleared: false, deaths: 0, timeMs: 10, parMs: 100 });
  assert.equal(zero.stars, 0, "没清盘一颗星都不给");
  assert.equal(zero.detail.clear, false);

  const all = rateRun({ cleared: true, deaths: 0, timeMs: 90, parMs: 100 });
  assert.equal(all.stars, 3);
  assert.deepEqual(all.detail, { clear: true, noDeath: true, fast: true });

  const died = rateRun({ cleared: true, deaths: 1, timeMs: 90, parMs: 100 });
  assert.equal(died.stars, 2);
  assert.equal(died.detail.noDeath, false);

  const slow = rateRun({ cleared: true, deaths: 0, timeMs: 101, parMs: 100 });
  assert.equal(slow.stars, 2);
  assert.equal(slow.detail.fast, false);

  assert.equal(rateRun({ cleared: true, deaths: 2, timeMs: 200, parMs: 100 }).stars, 1);
  assert.equal(rateRun({ cleared: true, timeMs: 100, parMs: 100 }).stars, 3, "压线算达标");
  assert.equal(rateRun({ cleared: true, deaths: 0, timeMs: 50, parMs: 0 }).stars, 2, "没有标准线时拿不到限时星");
});

test("加命门槛：每满 10000 分奖一条命，只数跨过的门槛", () => {
  assert.equal(extraLifeThresholds(0, 9999), 0);
  assert.equal(extraLifeThresholds(0, 10000), 1);
  assert.equal(extraLifeThresholds(9999, 10001), 1);
  assert.equal(extraLifeThresholds(0, 25000), 2);
  assert.equal(extraLifeThresholds(10000, 10000), 0, "分数没涨不该加命");
  assert.equal(extraLifeThresholds(20000, 10000), 0, "分数倒退也不该加命");
  assert.equal(EXTRA_LIFE_AT, 10000);
});

test("展示格式化：六位补零、时钟 mm:ss、负数与脏值不炸", () => {
  assert.equal(formatScore(0), "000000");
  assert.equal(formatScore(1234), "001234");
  assert.equal(formatScore(SCORE_MAX), String(SCORE_MAX));
  assert.equal(formatScore(-50), "000000", "负分不该显示出来");
  assert.equal(formatScore(NaN), "000000");

  assert.equal(formatClock(0), "00:00");
  assert.equal(formatClock(65), "01:05");
  assert.equal(formatClock(59.6), "01:00", "四舍五入到整秒");
  assert.equal(formatClock(-3), "00:00");
  assert.equal(formatClock(undefined), "00:00");
  assert.equal(formatClock(3600), "60:00");
});
