// filepath: games/sokoban/tests/score.test.mjs
// 计分口径单元测试：满分、超推扣分、超时扣分、星级阈值、时间格式。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PERFECT,
  BASE_SCORE,
  pushScore,
  timeScore,
  scoreRun,
  starsFor,
  formatTime,
  targetSeconds,
} from "../js/score.mjs";

test("score: 满分恰为 PERFECT=1000 且各分量封顶", () => {
  const run = scoreRun({ pushes: 2, timeMs: 1000, par: 2 });
  assert.equal(run.total, PERFECT);
  assert.equal(run.base, BASE_SCORE);
  assert.equal(run.push, 350);
  assert.equal(run.time, 250);
});

test("score: 推数分超 par 每推扣 9，下限 70", () => {
  assert.equal(pushScore(2, 2), 350);
  assert.equal(pushScore(3, 2), 341);
  assert.equal(pushScore(4, 2), 332);
  const far = pushScore(999, 2);
  assert.equal(far, 70);
});

test("score: 时间分每 10s 扣 6，下限 60；宽限随 par 增长", () => {
  const par = 5;
  const t0 = targetSeconds(par);
  assert.equal(timeScore(t0 * 1000, par), 250);
  assert.equal(timeScore((t0 + 10) * 1000, par), 244);
  assert.equal(timeScore(999999 * 1000, par), 60);
  assert.ok(targetSeconds(20) > targetSeconds(5));
});

test("score: total 永不超过 PERFECT，非负", () => {
  const fast = scoreRun({ pushes: 1, timeMs: 0, par: 1 });
  assert.equal(fast.total, PERFECT);
  const slow = scoreRun({ pushes: 999, timeMs: 99999999, par: 1 });
  assert.ok(slow.total >= 400 + 70 + 60);
  assert.ok(slow.total <= PERFECT);
});

test("stars: ≥90% 三星、≥70% 二星、其余一星", () => {
  assert.equal(starsFor(PERFECT), 3);
  assert.equal(starsFor(Math.floor(PERFECT * 0.9)), 3);
  assert.equal(starsFor(Math.floor(PERFECT * 0.89)), 2);
  assert.equal(starsFor(Math.floor(PERFECT * 0.7)), 2);
  assert.equal(starsFor(Math.floor(PERFECT * 0.69)), 1);
  assert.equal(starsFor(0), 1);
  assert.equal(starsFor(NaN), 1);
});

test("formatTime: mm:ss、钳制 99 分钟、0 清零", () => {
  assert.equal(formatTime(0), "00:00");
  assert.equal(formatTime(1000), "00:01");
  assert.equal(formatTime(61 * 1000), "01:01");
  assert.equal(formatTime(100 * 60 * 1000), "99:00");
  assert.equal(formatTime(-5), "00:00");
  assert.equal(formatTime(NaN), "00:00");
});
