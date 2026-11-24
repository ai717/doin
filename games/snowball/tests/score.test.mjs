import test from "node:test";
import assert from "node:assert/strict";
import { starsFor, killScore, timeBonus, formatTime, levelRecord } from "../js/score.mjs";

test("计分：闯关三星按时间与无伤判定", () => {
  assert.equal(starsFor({ time: 20, par: 40, damaged: false }), 3);
  assert.equal(starsFor({ time: 50, par: 40, damaged: false }), 2);
  assert.equal(starsFor({ time: 20, par: 40, damaged: true }), 2);
  assert.equal(starsFor({ time: 50, par: 40, damaged: true }), 1);
});

test("计分：冲刺星级按撞倒数量分档", () => {
  assert.equal(starsFor({ mode: "rush", kills: 0 }), 1);
  assert.equal(starsFor({ mode: "rush", kills: 10 }), 2);
  assert.equal(starsFor({ mode: "rush", kills: 18 }), 3);
});

test("计分：连击倍率封顶五倍", () => {
  assert.equal(killScore(1), 100);
  assert.equal(killScore(3), 300);
  assert.equal(killScore(9), 500);
  assert.equal(killScore(0), 100);
});

test("计分：时间奖励只增不减", () => {
  assert.equal(timeBonus({ time: 30, par: 60 }), 600);
  assert.equal(timeBonus({ time: 80, par: 60 }), 0);
});

test("计分：时间格式化与时长为零", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(61000), "1:01");
  assert.equal(formatTime(-500), "0:00");
});

test("计分：关卡记录夹取范围", () => {
  assert.deepEqual(levelRecord(5, 1200, 9), { stars: 3, score: 1200, chain: 9 });
  assert.deepEqual(levelRecord(-2, -10, -1), { stars: 0, score: 0, chain: 0 });
});
