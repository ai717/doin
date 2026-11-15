import test from "node:test";
import assert from "node:assert/strict";

import { arcadeScore, bestOf, levelScore, performance, starsFor } from "../js/score.mjs";

test("表现分随时用下降、随剩余体力提升", () => {
  const fast = performance({ hpRatio: 1, time: 40, par: 80 });
  const slow = performance({ hpRatio: 1, time: 120, par: 80 });
  const hurt = performance({ hpRatio: 0.2, time: 40, par: 80 });
  assert.ok(fast > slow);
  assert.ok(fast > hurt);
  assert.equal(fast, 100);
  assert.ok(performance({ hpRatio: 0, time: 0, par: 0 }) >= 0);
  assert.ok(Number.isFinite(performance({ hpRatio: NaN, time: NaN, par: NaN })));
});

test("评星阈值：80 分三星、55 分二星、其余一星", () => {
  assert.equal(starsFor({ hpRatio: 1, time: 60, par: 80 }), 3);
  assert.equal(starsFor({ hpRatio: 0.2, time: 80, par: 80 }), 2);
  assert.equal(starsFor({ hpRatio: 0, time: 400, par: 80 }), 1);
  for (let i = 0; i < 100; i += 1) {
    const stars = starsFor({ hpRatio: i / 100, time: 30 + i * 3, par: 80 });
    assert.ok(stars >= 1 && stars <= 3);
  }
});

test("关卡得分包含击飞、时间、体力与首领奖励，并扣续关分", () => {
  const base = levelScore({ ko: 0, hpRatio: 0, time: 999, par: 60, continuesUsed: 0, bossDown: false });
  const full = levelScore({ ko: 20, hpRatio: 1, time: 10, par: 60, continuesUsed: 0, bossDown: true });
  const penalized = levelScore({ ko: 20, hpRatio: 1, time: 10, par: 60, continuesUsed: 2, bossDown: true });
  assert.ok(full > base);
  assert.equal(penalized, full - 160);
  assert.ok(penalized >= 0);
  assert.equal(levelScore({ ko: -3, hpRatio: -1, time: 0, par: 0, continuesUsed: -2, bossDown: false }), 900);
  assert.equal(levelScore({ ko: 0, hpRatio: 0, time: 0, par: 60, continuesUsed: 99 }), 0);
});

test("街机得分按击飞、首领与剩余时间计算", () => {
  const score = arcadeScore({ ko: 12, bossKills: 1, timeLeft: 30 });
  assert.equal(score, 12 * 100 + 300 + 60);
  assert.equal(arcadeScore({ ko: 0, bossKills: 0, timeLeft: 0 }), 0);
  assert.equal(arcadeScore({ ko: -1, bossKills: -2, timeLeft: -3 }), 0);
});

test("bestOf 只升不降", () => {
  assert.equal(bestOf(10, 12), 12);
  assert.equal(bestOf(12, 3), 12);
  assert.equal(bestOf(undefined, 5), 5);
  assert.equal(bestOf(-5, NaN), 0);
});
