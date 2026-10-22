// score.test.mjs —— 计分口径：每格 +1、每行/列 +10、十字 +25（经典原味，三档难度不倍率）。
import test from "node:test";
import assert from "node:assert/strict";
import {
  SCORE_PER_CELL,
  SCORE_PER_LINE,
  SCORE_CROSS,
  scoreForPlacement,
  lineScore,
} from "../js/score.mjs";

test("score: classic flavor constants", () => {
  assert.equal(SCORE_PER_CELL, 1);
  assert.equal(SCORE_PER_LINE, 10);
  assert.equal(SCORE_CROSS, 25);
});

test("scoreForPlacement: cells + lines + cross bonus", () => {
  assert.equal(scoreForPlacement(4, 0, false), 4); // 纯放置
  assert.equal(scoreForPlacement(3, 1, false), 13); // 3 格 + 1 行
  assert.equal(scoreForPlacement(3, 2, false), 23); // 3 格 + 2 行
  assert.equal(scoreForPlacement(1, 2, true), 46); // 1 格 + 行+列 + 十字加码
  assert.equal(scoreForPlacement(4, 3, true), 59); // 4 格 + 3 行 + 十字
});

test("scoreForPlacement: clamps junk input to non-negative", () => {
  assert.equal(scoreForPlacement(-5, -3, false), 0);
  assert.equal(scoreForPlacement(2.7, 1.2, false), 12); // 截断取整
  assert.equal(scoreForPlacement(NaN, NaN, false), 0);
});

test("lineScore: line-only accounting without cell points", () => {
  assert.equal(lineScore(0, false), 0);
  assert.equal(lineScore(1, false), 10);
  assert.equal(lineScore(4, false), 40);
  assert.equal(lineScore(2, true), 45); // 2 行 + 十字加码
});
