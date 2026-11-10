// score.test.mjs - stars and alarm lamps are pure thresholds; nobody else is
// allowed to invent a rating.

import test from "node:test";
import assert from "node:assert/strict";
import { STARS_MAX, alarmFor, clearedCount, starsFor, totalStars } from "../js/score.mjs";
import { getLevel } from "../js/levels.mjs";
import { playSolution } from "../js/engine.mjs";

const level = getLevel(1);

test("星级: 贴着标定路线跑满分，绕远路才掉星", () => {
  assert.equal(STARS_MAX, 3);
  assert.equal(starsFor(level, level.par), 3);
  assert.equal(starsFor(level, level.par * 1.18), 3);
  assert.equal(starsFor(level, level.par * 1.19), 2);
  assert.equal(starsFor(level, level.par * 1.5), 2);
  assert.equal(starsFor(level, level.par * 1.51), 1);
  assert.equal(starsFor(level, level.par * 9), 1);
});

test("星级: 非法输入不抛错，一律一星", () => {
  assert.equal(starsFor(null, 500), 1);
  assert.equal(starsFor(level, 0), 1);
  assert.equal(starsFor(level, -20), 1);
  assert.equal(starsFor(level, Number.NaN), 1);
});

test("星级: 每关的标定路线都拿得到三星", () => {
  for (let id = 1; id <= 20; id += 1) {
    const stage = getLevel(id);
    const state = playSolution(stage);
    assert.equal(starsFor(stage, state.travelled), 3, `#${id} 标定路线应得三星`);
  }
});

test("警报: 只在拖拽时点亮，越近越红", () => {
  assert.equal(alarmFor(0, false), 0);
  assert.equal(alarmFor(Infinity, true), 0);
  assert.equal(alarmFor(50, true), 0);
  assert.equal(alarmFor(44, true), 0);
  assert.equal(alarmFor(43.9, true), 1);
  assert.equal(alarmFor(14, true), 1);
  assert.equal(alarmFor(13.9, true), 2);
  assert.equal(alarmFor(0, true), 2);
});

test("汇总: 星数与藏品数只数有效条目", () => {
  assert.equal(totalStars(null), 0);
  assert.equal(totalStars({}), 0);
  assert.equal(totalStars({ 1: 3, 2: 2 }), 5);
  assert.equal(totalStars({ 1: 3, 2: "x" }), 3);
  assert.equal(clearedCount({}), 0);
  assert.equal(clearedCount({ 1: 3, 5: 1 }), 2);
});
