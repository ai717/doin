// filepath: games/klotski/tests/storage.test.mjs
// 存档层测试：node --test games/klotski/tests/
import test from "node:test";
import assert from "node:assert/strict";

import * as storage from "../js/storage.mjs";
import { LEVELS, LEVEL_COUNT } from "../js/levels.mjs";
import { PERFECT } from "../js/score.mjs";

function fresh() {
  storage.reset();
  return storage.current();
}

test("STORAGE_KEY 遵循 doin.<slug>.v1 命名", () => {
  assert.equal(storage.STORAGE_KEY, "doin.klotski.v1");
});

test("normalize：垃圾输入回落到默认值", () => {
  const cases = [null, undefined, 0, "x", [], { levels: "nope" }];
  for (const input of cases) {
    const out = storage.normalize(input);
    assert.equal(out.unlocked, 1);
    assert.equal(out.current, 0);
    assert.equal(out.muted, false);
    assert.deepEqual(out.levels, {});
  }
});

test("normalize：数值越界被钳制，非法类型回落", () => {
  let out = storage.normalize({ unlocked: 9999, current: -5 });
  assert.equal(out.unlocked, LEVEL_COUNT);
  assert.equal(out.current, 0);

  out = storage.normalize({ unlocked: 3, current: 9999 });
  assert.ok(out.current <= out.unlocked - 1);

  out = storage.normalize({ levels: { l1: { cleared: true, bestScore: PERFECT * 10 } } });
  assert.equal(out.levels.l1.bestScore, PERFECT, "分数必须钳制在满分以内");

  out = storage.normalize({ levels: { l1: { cleared: true, bestScore: -50, bestMoves: -3 } } });
  assert.equal(out.levels.l1.bestScore, 0, "负分必须归零");
  assert.equal(out.levels.l1.bestMoves, 0, "负步数必须归零");
});

test("normalize：未知关卡 id 被丢弃", () => {
  const out = storage.normalize({
    levels: { l1: { cleared: true, bestScore: 100 }, "not-a-level": { cleared: true, bestScore: 700 } },
  });
  assert.ok(out.levels.l1);
  assert.equal(out.levels["not-a-level"], undefined);
});

test("normalize：解锁进度由已通关关卡推导，且不小于 current+1", () => {
  const out = storage.normalize({
    unlocked: 1,
    current: 0,
    levels: { l1: { cleared: true }, l2: { cleared: true }, l3: { cleared: true } },
  });
  assert.equal(out.unlocked, 4, "前三关通关应解锁到第 4 关");
  assert.ok(out.current <= out.unlocked - 1);
});

test("normalize：未通关的条目不保留分数", () => {
  const out = storage.normalize({ levels: { l1: { cleared: false, bestScore: 500, stars: 3 } } });
  assert.equal(out.levels.l1, undefined);
});

test("save / load 在无 localStorage 环境下安全降级为内存态", () => {
  fresh();
  const ok = storage.save({ unlocked: 2, current: 1, muted: true, levels: {} });
  assert.equal(typeof ok, "boolean");
  const data = storage.load();
  assert.equal(data.current, 1);
  assert.equal(data.muted, true);
  assert.equal(typeof storage.isPersistent(), "boolean");
});

test("recordResult：只在更优时刷新，并解锁下一关", () => {
  fresh();
  const first = storage.recordResult("l1", { score: 500, moves: 20, timeMs: 30000, stars: 2 });
  assert.equal(first.isNewBest, true);
  assert.equal(storage.current().levels.l1.bestScore, 500);
  assert.equal(storage.current().unlocked, 2, "通关第 1 关后解锁第 2 关");

  const worse = storage.recordResult("l1", { score: 300, moves: 40, timeMs: 90000, stars: 1 });
  assert.equal(worse.isNewBest, false);
  assert.equal(storage.current().levels.l1.bestScore, 500, "低分不得覆盖高分");
  assert.equal(storage.current().levels.l1.bestMoves, 20, "步数取最小值");

  const better = storage.recordResult("l1", { score: 700, moves: 8, timeMs: 12000, stars: 3 });
  assert.equal(better.isNewBest, true);
  assert.equal(storage.current().levels.l1.bestScore, 700);
  assert.equal(storage.current().levels.l1.bestMoves, 8);
  assert.equal(storage.current().levels.l1.stars, 3);
});

test("recordResult：未知关卡 id 被忽略", () => {
  fresh();
  const out = storage.recordResult("nope", { score: 700, moves: 1, timeMs: 1, stars: 3 });
  assert.equal(out.isNewBest, false);
  assert.deepEqual(storage.current().levels, {});
});

test("recordResult：分数被钳制在满分以内，星级在 1..3", () => {
  fresh();
  storage.recordResult("l2", { score: 99999, moves: 1, timeMs: 1, stars: 99 });
  assert.equal(storage.current().levels.l2.bestScore, PERFECT);
  assert.equal(storage.current().levels.l2.stars, 3);
});

test("setMuted / setCurrent 持久化并受边界约束", () => {
  fresh();
  storage.setMuted(true);
  assert.equal(storage.current().muted, true);
  storage.setMuted(false);
  assert.equal(storage.current().muted, false);

  assert.equal(storage.current().unlocked, 1);
  storage.setCurrent(9);
  assert.equal(storage.current().current, 0, "未解锁的关卡不能成为当前关");

  storage.recordResult("l1", { score: 400, moves: 10, timeMs: 1000, stars: 1 });
  storage.setCurrent(1);
  assert.equal(storage.current().current, 1);
});

test("isUnlocked 与 unlocked 一致", () => {
  fresh();
  assert.equal(storage.isUnlocked(0), true);
  assert.equal(storage.isUnlocked(1), false);
  storage.recordResult("l1", { score: 400, moves: 10, timeMs: 1000, stars: 1 });
  assert.equal(storage.isUnlocked(1), true);
  assert.equal(storage.isUnlocked(LEVEL_COUNT), false, "越界索引永不可选");
});

test("reset 清空一切", () => {
  storage.recordResult("l1", { score: 700, moves: 8, timeMs: 1000, stars: 3 });
  storage.reset();
  const data = storage.current();
  assert.equal(data.unlocked, 1);
  assert.equal(data.current, 0);
  assert.deepEqual(data.levels, {});
});

test("所有关卡 id 都在存档白名单内", () => {
  const data = fresh();
  for (const level of LEVELS) {
    storage.recordResult(level.id, { score: 10, moves: 1, timeMs: 1, stars: 1 });
    assert.ok(storage.current().levels[level.id], `${level.id} 应可写入存档`);
  }
  assert.ok(data);
});
