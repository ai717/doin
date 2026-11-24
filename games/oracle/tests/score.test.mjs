import test from "node:test";
import assert from "node:assert/strict";

import { LEVELS } from "../js/levels.mjs";
import {
  starsFor,
  formatTime,
  totalStars,
  chapterStars,
  chapterComplete,
  allComplete,
} from "../js/score.mjs";

test("计分：误配次数决定星级", () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(1), 2);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(3), 1);
  assert.equal(starsFor(99), 1);
  assert.equal(starsFor(-4), 3);
  assert.equal(starsFor("abc"), 3);
});

test("计分：用时格式为两位分秒", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(9), "00:09");
  assert.equal(formatTime(65), "01:05");
  assert.equal(formatTime(3599), "59:59");
  assert.equal(formatTime(3600), "60:00");
  assert.equal(formatTime(-8), "00:00");
  assert.equal(formatTime("bad"), "00:00");
});

test("计分：总星与章节星统计", () => {
  const records = {};
  records[LEVELS[0].id] = { stars: 3 };
  records[LEVELS[1].id] = { stars: 1 };
  records[LEVELS[6].id] = { stars: 2 };
  assert.equal(totalStars(records), 6);
  assert.equal(chapterStars(records, 0), 4);
  assert.equal(chapterStars(records, 1), 2);
  assert.equal(chapterStars({}, 0), 0);
  assert.equal(totalStars({}), 0);
  assert.equal(totalStars(null), 0);
});

test("计分：章节完成与全通关判定", () => {
  const chapterRecords = {};
  for (const level of LEVELS.filter((item) => item.chapterIndex === 0)) {
    chapterRecords[level.id] = { stars: 1 };
  }
  assert.equal(chapterComplete(chapterRecords, 0), true);
  assert.equal(chapterComplete(chapterRecords, 1), false);
  assert.equal(allComplete(chapterRecords), false);

  const all = {};
  for (const level of LEVELS) all[level.id] = { stars: 2 };
  assert.equal(allComplete(all), true);
  for (let chapter = 0; chapter < 4; chapter += 1) assert.equal(chapterComplete(all, chapter), true);
});
