// 关卡评价体系：珍珠评级 / 深渊纪录 / 数字格式化。
// 这些数字会直接写进存档并驱动解锁，所以边界值（未通关、NaN、越界、破纪录）必须逐个钉死。

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PEARLS_PER_LEVEL,
  abyssRecord,
  bonusReached,
  clampPearls,
  formatMeters,
  formatNumber,
  formatTime,
  levelPearls,
  pearlsOfZone,
  totalPearls,
} from "../js/score.mjs";

describe("珍珠评级", () => {
  const level = { id: "3-4", star3: { type: "parTime", value: 60 } };

  it("没通关就是 0 颗，无论数据多好看", () => {
    const result = levelPearls(level, { won: false, hits: 0, time: 12, bestFrenzy: 2, shoalPeak: 3, eaten: 99 });
    assert.equal(result.pearls, 0);
    assert.deepEqual(result.stars, [false, false, false]);
  });

  it("通关 1 颗；全程未被吃再 1 颗；效率目标达成第 3 颗", () => {
    assert.equal(levelPearls(level, { won: true, hits: 3, time: 120 }).pearls, 1);
    assert.equal(levelPearls(level, { won: true, hits: 0, time: 120 }).pearls, 2);
    const full = levelPearls(level, { won: true, hits: 0, time: 40 });
    assert.equal(full.pearls, 3);
    assert.deepEqual(full.stars, [true, true, true]);
    assert.equal(PEARLS_PER_LEVEL, 3);
  });

  it("上限恒为 3，绝不会出现第 4 颗", () => {
    const generous = { id: "1-1", star3: { type: "eatCount", value: 1 } };
    for (const hits of [0, 1, 7]) {
      const r = levelPearls(generous, { won: true, hits, time: 5, bestFrenzy: 3, shoalPeak: 9, eaten: 50 });
      assert.ok(r.pearls <= PEARLS_PER_LEVEL);
      assert.equal(r.stars.filter(Boolean).length, r.pearls);
    }
  });

  it("缺字段的 result 不会崩，也不会白送珍珠", () => {
    assert.equal(levelPearls(level).pearls, 0);
    assert.equal(levelPearls(level, {}).pearls, 0);
    // 关键：缺 hits 不能被当成“零次被吃”白送一颗珍珠，只能拿到通关那 1 颗。
    assert.equal(levelPearls(level, { won: true }).pearls, 1, "hits 缺失不算未被吃");
    assert.equal(levelPearls(level, { won: true, hits: null }).pearls, 1, "hits 为 null 更不算");
    assert.equal(levelPearls(undefined, { won: true, hits: 1 }).pearls, 1, "关卡缺失也不该崩");
  });

  it("labels 是给 UI 翻译用的机器可读串", () => {
    assert.deepEqual(levelPearls(level, { won: false }).labels, ["pass", "noHit", "bonus"]);
    assert.deepEqual(levelPearls(level, { won: true, hits: 0, time: 40 }).labels, [
      "pass",
      "noHit",
      "parTime:60",
    ]);
    assert.equal(levelPearls({ star3: { type: "frenzy", value: 2 } }, { won: true, hits: 0, bestFrenzy: 2 }).labels[2], "frenzy:2");
  });
});

describe("隐藏效率目标 bonusReached", () => {
  it("四种目标类型各自判定", () => {
    assert.equal(bonusReached({ type: "parTime", value: 60 }, { time: 59.9 }), true);
    assert.equal(bonusReached({ type: "parTime", value: 60 }, { time: 60.1 }), false);
    assert.equal(bonusReached({ type: "frenzy", value: 2 }, { bestFrenzy: 2 }), true);
    assert.equal(bonusReached({ type: "frenzy", value: 2 }, { bestFrenzy: 1 }), false);
    assert.equal(bonusReached({ type: "shoal", value: 3 }, { shoalPeak: 3 }), true);
    assert.equal(bonusReached({ type: "shoal", value: 3 }, { shoalPeak: 2 }), false);
    assert.equal(bonusReached({ type: "eatCount", value: 40 }, { eaten: 40 }), true);
    assert.equal(bonusReached({ type: "eatCount", value: 40 }, { eaten: 39 }), false);
  });

  it("没配 star3 / 未知类型 / 缺数据一律不算达成", () => {
    assert.equal(bonusReached(null), false);
    assert.equal(bonusReached(undefined), false);
    assert.equal(bonusReached({ type: "unknown" }, { time: 1 }), false);
    assert.equal(bonusReached({ type: "parTime", value: 60 }, {}), false, "没有用时就不算达标");
  });
});

describe("珍珠统计", () => {
  it("clampPearls 把所有脏值压进 0..3", () => {
    assert.equal(clampPearls(0), 0);
    assert.equal(clampPearls(3), 3);
    assert.equal(clampPearls(4), 3, "越界钳到上限，绝不显示 4/3");
    assert.equal(clampPearls(-2), 0);
    assert.equal(clampPearls(2.7), 2, "小数截断");
    assert.equal(clampPearls(NaN), 0);
    assert.equal(clampPearls(Infinity), 0);
    assert.equal(clampPearls("2"), 2);
    assert.equal(clampPearls("abc"), 0);
    assert.equal(clampPearls(null), 0);
    assert.equal(clampPearls(undefined), 0);
  });

  it("totalPearls 累加全站最佳，脏值不参与", () => {
    assert.equal(totalPearls({}), 0);
    assert.equal(totalPearls({ "1-1": 3, "1-2": 2, "1-3": 0 }), 5);
    assert.equal(totalPearls({ "1-1": 3, "1-2": NaN, "1-3": 9 }), 6);
  });

  it("pearlsOfZone 只统计本海域的关卡", () => {
    const stars = { "1-1": 3, "1-2": 1, "2-1": 3 };
    assert.equal(pearlsOfZone(stars, ["1-1", "1-2", "1-3"]), 4);
    assert.equal(pearlsOfZone(stars, ["2-1"]), 3);
    assert.equal(pearlsOfZone(stars, []), 0);
    assert.equal(pearlsOfZone({}, ["1-1"]), 0);
  });
});

describe("深渊无尽纪录", () => {
  it("首潜即破纪录", () => {
    const r = abyssRecord({}, { meters: 320, score: 5400 });
    assert.deepEqual(r.best, { meters: 320, score: 5400 });
    assert.equal(r.isRecord, true);
    assert.equal(r.meters, 320);
    assert.equal(r.score, 5400);
  });

  it("纪录只增不减，任意一项刷新都算破纪录", () => {
    const previous = { meters: 300, score: 9000 };
    assert.equal(abyssRecord(previous, { meters: 299, score: 9000 }).isRecord, false);
    assert.equal(abyssRecord(previous, { meters: 301, score: 1 }).isRecord, true, "米数刷新也算");
    assert.equal(abyssRecord(previous, { meters: 1, score: 9001 }).isRecord, true, "分数刷新也算");
    assert.deepEqual(abyssRecord(previous, { meters: 120, score: 40 }).best, { meters: 300, score: 9000 });
  });

  it("脏值与负数被清成 0，不会污染纪录", () => {
    const r = abyssRecord({ meters: NaN, score: -50 }, { meters: "88.9", score: "1200" });
    assert.deepEqual(r.best, { meters: 88, score: 1200 });
    assert.deepEqual(abyssRecord({}, { meters: -5, score: Infinity }).best, { meters: 0, score: 0 });
    assert.deepEqual(abyssRecord({}, {}).best, { meters: 0, score: 0 });
  });
});

describe("数字格式化", () => {
  it("formatNumber 千分位、取整、脏值归 0", () => {
    assert.equal(formatNumber(0), "0");
    assert.equal(formatNumber(1280), "1,280");
    assert.equal(formatNumber(1234567), "1,234,567");
    assert.equal(formatNumber(99.9), "99");
    assert.equal(formatNumber(NaN), "0");
    assert.equal(formatNumber(Infinity), "0", "Infinity 会显示成 ∞，必须挡在门外");
    assert.equal(formatNumber(-5), "0", "分数不该出现负数");
    assert.equal(formatNumber(undefined), "0");
    assert.equal(formatNumber("1280"), "1,280");
  });

  it("formatMeters 带单位", () => {
    assert.equal(formatMeters(0), "0 m");
    assert.equal(formatMeters(320.7), "320 m");
    assert.equal(formatMeters(NaN), "0 m");
    assert.equal(formatMeters(Infinity), "0 m");
  });

  it("formatTime 十分之一秒精度且不为负", () => {
    assert.equal(formatTime(0), "0.0s");
    assert.equal(formatTime(12.34), "12.3s");
    assert.equal(formatTime(59.96), "59.9s");
    assert.equal(formatTime(-3), "0.0s");
    assert.equal(formatTime(NaN), "0.0s");
    assert.equal(formatTime(Infinity), "0.0s");
  });
});
