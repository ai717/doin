// filepath: games/ice-slide/tests/score.test.mjs
// 星级口径测试：完美/接近/通关三档边界（含小 par 关的二星档非空）、异常输入钳制、门槛自洽。
import { test } from "node:test";
import assert from "node:assert/strict";
import { starsFor, twoStarThreshold, nextStarThreshold, MAX_STARS, TWO_STAR_GRACE } from "../js/score.mjs";

test("score: 常量口径（二星宽限 0.3、最高 3 星）", () => {
  assert.equal(TWO_STAR_GRACE, 0.3);
  assert.equal(MAX_STARS, 3);
});

test("score: 步数 = par 即三星（完美通关）", () => {
  for (const par of [1, 2, 4, 7, 11, 15]) {
    assert.equal(starsFor(par, par), 3, `par=${par} 完美步数应三星`);
  }
});

test("score: 二星门槛约 par × 1.3，且任何 par 下二星档非空", () => {
  // 门槛值：par + max(1, floor(par*0.3))
  assert.equal(twoStarThreshold(1), 2); // 小关也至少宽 1 步
  assert.equal(twoStarThreshold(2), 3);
  assert.equal(twoStarThreshold(3), 4);
  assert.equal(twoStarThreshold(4), 5);
  assert.equal(twoStarThreshold(7), 9);
  assert.equal(twoStarThreshold(10), 13);
  for (const par of [1, 2, 3, 4, 7, 11, 15]) {
    assert.ok(twoStarThreshold(par) > par, `par=${par} 二星档不应为空`);
    assert.equal(starsFor(twoStarThreshold(par), par), 2, `par=${par} 压线应二星`);
    assert.equal(starsFor(twoStarThreshold(par) + 1, par), 1, `par=${par} 超门槛应一星`);
    assert.equal(starsFor(par + 1, par), 2, `par=${par} 刚超 par 应落二星`);
  }
});

test("score: 异常输入钳制（NaN/负数/小数向下取整）", () => {
  assert.equal(starsFor(NaN, 5), 3); // NaN 步数钳成 0，0 <= par 即完美
  assert.equal(starsFor(-3, 5), 3); // 负步数同理
  assert.equal(starsFor(5, NaN), 1); // par 异常按 1 计，5 > 2
  assert.equal(starsFor(1, NaN), 3); // 1 <= 1
  assert.equal(starsFor(2, NaN), 2); // 2 <= 门槛 2
  assert.equal(starsFor(2.9, 2), 3); // 2.9 -> 2
  assert.equal(starsFor(0, 0), 3); // par 0 按 1 计
});

test("score: nextStarThreshold 与 starsFor 口径自洽", () => {
  for (const par of [1, 3, 5, 8, 12, 15]) {
    const { three, two } = nextStarThreshold(par);
    assert.equal(three, par);
    assert.equal(starsFor(three, par), 3);
    assert.equal(starsFor(three + 1, par), 2);
    assert.equal(starsFor(two, par), 2);
    assert.equal(starsFor(two + 1, par), 1);
  }
});
