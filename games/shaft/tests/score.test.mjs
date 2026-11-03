import test from "node:test";
import assert from "node:assert/strict";

import {
  POINTS_PER_FLOOR,
  POINTS_PER_HP,
  STAR_RULES,
  floorsPoints,
  lifePoints,
  timeBonus,
  computeScore,
  computeStars,
  starHintValues,
} from "../js/score.mjs";

test("score: floor and life points follow the single scoring contract", () => {
  assert.equal(POINTS_PER_FLOOR, 10);
  assert.equal(POINTS_PER_HP, 15);
  assert.equal(floorsPoints(0), 0);
  assert.equal(floorsPoints(14), 140);
  assert.equal(floorsPoints(-3), 0);
  assert.equal(floorsPoints("21"), 210);
  assert.equal(lifePoints(12), 180);
  assert.equal(lifePoints(-1), 0);
});

test("score: time bonus only rewards beating the par time", () => {
  assert.equal(timeBonus(100, 0), 0, "无尽/无标准用时不发时间奖");
  assert.equal(timeBonus(120, 100), 0, "慢于标准只清零，不倒扣");
  assert.equal(timeBonus(80, 100), 80);
  assert.equal(timeBonus(0, 500), 2000);
  assert.equal(timeBonus(NaN, NaN), 0);
});

test("score: computeScore sums floors, life and time", () => {
  assert.equal(computeScore({ floors: 14, hp: 12, elapsed: 60, parTime: 30 }), 140 + 180 + 0);
  assert.equal(computeScore({ floors: 14, hp: 12, elapsed: 20, parTime: 30 }), 140 + 180 + 40);
  assert.equal(computeScore({}), 0);
  assert.equal(computeScore({ floors: 10, hp: 0, elapsed: 0, parTime: 10 }), 100 + 40);
});

test("score: stars demand clear, life and speed in order", () => {
  const par = 60;
  assert.equal(computeStars({ won: false, hp: 12, maxHp: 12, elapsed: 10, parTime: par }), 0);
  assert.equal(computeStars({ won: true, hp: 1, maxHp: 12, elapsed: 80, parTime: par }), 1);
  assert.equal(computeStars({ won: true, hp: 6, maxHp: 12, elapsed: 90, parTime: par }), 2);
  assert.equal(computeStars({ won: true, hp: 8, maxHp: 12, elapsed: 50, parTime: par }), 3);
  assert.equal(computeStars({ won: true, hp: 8, maxHp: 12, elapsed: 70, parTime: par }), 2, "超时降为两星");
  assert.equal(computeStars({ won: true, hp: 7.9, maxHp: 12, elapsed: 50, parTime: par }), 2);
  assert.equal(computeStars({ won: true, hp: 12, maxHp: 0, elapsed: 1, parTime: par }), 1, "坏上限不得产生 NaN 星");
});

test("score: hint thresholds stay in sync with the star rules", () => {
  const hints = starHintValues();
  assert.equal(hints.life2, Math.round(STAR_RULES.lifeRatio2 * 100));
  assert.equal(hints.life3, Math.round(STAR_RULES.lifeRatio3 * 100));
  assert.ok(hints.life2 < hints.life3);
});
