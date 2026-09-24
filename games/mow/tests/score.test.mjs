// score.test.mjs — 计分唯一口径：钳制、连击倍率、星级边界。
import { test } from "node:test";
import assert from "node:assert/strict";
import { clampScore, killScore, starsFor, bestOf, SCORE_CAP } from "../js/score.mjs";

test("clampScore 上限钳制且单调", () => {
  assert.equal(clampScore(0), 0);
  assert.equal(clampScore(SCORE_CAP), SCORE_CAP);
  assert.equal(clampScore(SCORE_CAP + 50000), SCORE_CAP);
  assert.equal(clampScore(123), 123);
  assert.equal(clampScore(-5), 0, "负分钳到 0");
});

test("killScore：按敌种计分且随连击增长、封顶", () => {
  assert.equal(killScore("caterpillar", 1), 8);
  assert.equal(killScore("elite", 1), Math.round(160 * 1.03), "精英基础分更高");
  assert.equal(killScore("unknown-type", 1), 8, "未知类型回退基础分");
  const a = killScore("beetle", 1);
  const b = killScore("beetle", 20);
  const c = killScore("beetle", 80);
  assert.ok(b > a, "连击更高得分更高");
  assert.equal(c, killScore("beetle", 200), "连击倍率封顶");
  assert.equal(c, Math.round(12 * 2.5), "12 × 2.5 = 30");
});

test("starsFor：胜负星级边界", () => {
  assert.equal(starsFor({ won: true, kills: 600, maxCombo: 40 }), 3);
  assert.equal(starsFor({ won: true, kills: 600, maxCombo: 39 }), 2, "连击不够不给三星");
  assert.equal(starsFor({ won: true, kills: 350, maxCombo: 99 }), 2, "击杀不够不给三星");
  assert.equal(starsFor({ won: true, kills: 349, maxCombo: 99 }), 1, "击杀低于 350 仅一星");
  assert.equal(starsFor({ won: false, time: 300 }), 1, "存活 300s 得一星");
  assert.equal(starsFor({ won: false, time: 299 }), 0);
  assert.equal(starsFor({ won: false, time: 301 }), 1);
});

test("bestOf：通关/星级/得分优先替换", () => {
  const oldBest = { won: true, score: 5000, stars: 2, kills: 400, maxCombo: 20, burstCount: 3, time: 480, character: "mower" };
  const better = { won: true, score: 6000, stars: 3, kills: 700, maxCombo: 45, burstCount: 4, time: 500, character: "ladybug" };
  const worse = { won: true, score: 4000, stars: 2, kills: 300, maxCombo: 10, burstCount: 2, time: 460, character: "mower" };
  const b1 = bestOf(oldBest, better);
  assert.equal(b1.score, 6000);
  const b2 = bestOf(oldBest, worse);
  assert.equal(b2.score, 5000, "低分不覆盖");
  const b3 = bestOf(null, worse);
  assert.equal(b3.score, 4000);
  // 未通关记录不进入最佳
  const b4 = bestOf(oldBest, { won: false, time: 400 });
  assert.equal(b4.score, 5000);
});
