// 倒退贪吃蛇 Uncoil · 计分口径单测
import test from "node:test";
import assert from "node:assert/strict";
import { starsFor, parSlack, shedProgress, pelletsLeft, isRecord, starMarks } from "../js/score.mjs";

test("步数不劣于 par 即三星", () => {
  assert.equal(starsFor(20, 20), 3);
  assert.equal(starsFor(12, 20), 3);
});

test("二星区间 = par + 25% 松弛（向上取整）", () => {
  assert.equal(parSlack(20), 5);
  assert.equal(starsFor(25, 20), 2);
  assert.equal(starsFor(26, 20), 1);
});

test("步数远超 par 只给一星，且永不为零", () => {
  assert.equal(starsFor(999, 20), 1);
  assert.ok(starsFor(99999, 1) >= 1);
});

test("非法输入不炸：负数 / 0 / 非数字", () => {
  assert.equal(starsFor(-5, 20), 3);
  assert.equal(starsFor(10, 0), 1);
  assert.equal(starsFor(Number.NaN, 20), 1);
});

test("蜕皮进度：原长为 0，归 1 节为 1，单调", () => {
  assert.equal(shedProgress(100, 100), 0);
  assert.equal(shedProgress(1, 100), 1);
  assert.equal(shedProgress(50, 100), 50 / 99);
  assert.ok(shedProgress(40, 100) > shedProgress(60, 100));
  assert.equal(shedProgress(1, 1), 1, "单节蛇视为已完成");
});

test("进度钳制在 0..1（越界数据不得溢出）", () => {
  assert.equal(shedProgress(0, 5), 1);
  assert.equal(shedProgress(9, 5), 0);
});

test("剩余丸数：含当前激活的这一颗，吃完为 0", () => {
  assert.equal(pelletsLeft(0, 5), 5);
  assert.equal(pelletsLeft(4, 5), 1);
  assert.equal(pelletsLeft(-1, 5), 0);
});

test("新纪录判定：无记录即算，步数更少才算", () => {
  assert.equal(isRecord(undefined, 30), true);
  assert.equal(isRecord(0, 30), true);
  assert.equal(isRecord(30, 29), true);
  assert.equal(isRecord(30, 30), false);
  assert.equal(isRecord(30, 31), false);
});

test("星级标记三格满位", () => {
  assert.equal(starMarks(3), "★★★");
  assert.equal(starMarks(2), "★★☆");
  assert.equal(starMarks(0), "☆☆☆");
  assert.equal(starMarks(9), "★★★", "越界钳制");
});
