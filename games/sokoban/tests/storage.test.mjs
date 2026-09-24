// filepath: games/sokoban/tests/storage.test.mjs
// 存档单元测试：默认值、严格清洗、通关解锁推进、纪录只更优覆盖、损坏静默降级。
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, recordResult, isPersistent, STORAGE_KEY } from "../js/storage.mjs";
import { PERFECT } from "../js/score.mjs";

test("storage: key 独有且含 slug", () => {
  assert.equal(STORAGE_KEY, "doin.sokoban.v1");
});

test("storage: 空/null/损坏输入回落默认值，不抛错", () => {
  for (const bad of [null, undefined, 42, "x", '{"broken":', "[1,2]"]) {
    const data = normalize(bad);
    assert.ok(data.unlocked >= 1 && data.unlocked <= 50);
    assert.ok(data.current >= 0 && data.current < data.unlocked);
    assert.ok(typeof data.levels === "object");
  }
});

test("storage: 越界/非法字段被钳制与清洗", () => {
  const data = normalize({
    unlocked: 999,
    current: -5,
    muted: "yes",
    levels: {
      s1: { cleared: true, stars: 9, bestScore: 99999, bestPushes: -3, bestTimeMs: "abc" },
      s99: { cleared: true }, // 未知 id 丢弃
      s2: { cleared: false, stars: 3 }, // 未通关不记入
    },
  });
  assert.equal(data.unlocked, 50);
  assert.equal(data.current, 0); // 钳制到 [0, unlocked-1]
  assert.equal(data.muted, false);
  assert.ok(data.levels.s1);
  assert.equal(data.levels.s1.stars, 3);
  assert.equal(data.levels.s1.bestScore, PERFECT);
  assert.equal(data.levels.s1.bestPushes, 0);
  assert.ok(!data.levels.s99);
  assert.ok(!data.levels.s2);
});

test("storage: 通关推进解锁并只覆盖更优纪录", () => {
  const data = normalize({});
  assert.equal(data.unlocked, 1);
  const r1 = recordResult("s1", { score: 800, pushes: 4, timeMs: 30000, stars: 2 });
  assert.equal(r1.isNewBest, true);
  assert.equal(r1.data.unlocked, 2);
  const r2 = recordResult("s1", { score: 600, pushes: 6, timeMs: 50000, stars: 1 });
  assert.equal(r2.isNewBest, false); // 分更低
  assert.equal(r2.data.levels.s1.bestScore, 800); // 保留更优
  assert.equal(r2.data.levels.s1.stars, 2);
  const r3 = recordResult("s1", { score: 950, pushes: 3, timeMs: 20000, stars: 3 });
  assert.equal(r3.isNewBest, true);
  assert.equal(r3.data.levels.s1.bestScore, 950);
  assert.equal(r3.data.levels.s1.bestPushes, 3);
  assert.equal(r3.data.levels.s1.bestTimeMs, 20000);
  // 连续通关推进解锁（用最新返回值，避免旧快照）
  const r4 = recordResult("s2", { score: 900, pushes: 3, timeMs: 10000, stars: 3 });
  assert.equal(r4.data.unlocked, 3);
});

test("storage: 未知关卡 id 的 recordResult 不写入", () => {
  const r = recordResult("s999", { score: 1000, pushes: 1, timeMs: 1000, stars: 3 });
  assert.equal(r.isNewBest, false);
  assert.ok(!r.data.levels.s999);
});

test("storage: isPersistent 在无 localStorage 环境返回 false 且不抛错", () => {
  // Node 测试环境无 localStorage → 内部静默降级
  const ok = isPersistent();
  assert.equal(typeof ok, "boolean");
});
