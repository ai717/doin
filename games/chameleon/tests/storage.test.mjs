// storage.test.mjs —— 存档归一化 / 损坏降级 / 只在抓获时记录战绩 / 解锁口径

import test from "node:test";
import assert from "node:assert/strict";

import * as store from "../js/storage.mjs";
import { LEVEL_COUNT } from "../js/levels.mjs";
import { STAR_MAX } from "../js/score.mjs";

test("存档 key 遵循 doin.<slug>.v1 命名且版本号一致", () => {
  assert.equal(store.KEY, "doin.chameleon.v1");
  assert.equal(store.VERSION, 1);
});

test("默认存档合法：未静音、无关卡记录", () => {
  const d = store.defaults();
  assert.equal(d.v, 1);
  assert.equal(d.muted, false);
  assert.deepEqual(d.levels, {});
  assert.equal(d.records.stars, 0);
  assert.equal(d.records.cleared, 0);
});

test("任意垃圾输入都被归一化，绝不抛错", () => {
  for (const junk of [null, undefined, 0, "x", [], { levels: "no" }, { levels: { 1: null, 2: 7, 999: { stars: 9 } } }]) {
    const out = store.normalize(junk);
    assert.equal(out.v, 1);
    assert.equal(typeof out.levels, "object");
    assert.ok(out.last >= 1 && out.last <= LEVEL_COUNT, `last 越界 ${out.last}`);
    assert.ok(out.records.stars >= 0 && out.records.stars <= LEVEL_COUNT * STAR_MAX);
  }
});

test("星级被钳在 0–3，越界关卡号丢弃，records 随 levels 重新统计", () => {
  const out = store.normalize({
    levels: {
      1: { stars: 99, cleared: "yes" },
      4: { stars: 2, cleared: true },
      999: { stars: 3, cleared: true },
    },
  });
  assert.equal(out.levels[1].stars, STAR_MAX, "星级不得超上限");
  assert.equal(out.levels[1].cleared, true);
  assert.equal(out.levels[4].stars, 2);
  assert.equal(out.levels[999], undefined, "越界关卡必须丢弃");
  assert.equal(out.records.stars, STAR_MAX + 2);
  assert.equal(out.records.cleared, 2);
});

test("战绩只取高且只在抓获时记录，未抓获不记成绩", () => {
  let data = store.defaults();
  data = store.recordLevel(data, 1, { stars: 2, caught: true }).data;
  assert.equal(store.levelRecord(data, 1).stars, 2);
  assert.equal(store.levelRecord(data, 1).cleared, true);

  data = store.recordLevel(data, 1, { stars: 3, caught: true }).data;
  assert.equal(store.levelRecord(data, 1).stars, 3);

  // 星级不得被拉低
  data = store.recordLevel(data, 1, { stars: 1, caught: true }).data;
  assert.equal(store.levelRecord(data, 1).stars, 3);

  // 未抓获不记成绩
  data = store.recordLevel(data, 2, { stars: 3, caught: false }).data;
  assert.equal(store.levelRecord(data, 2).stars, 0);
  assert.equal(store.levelRecord(data, 2).cleared, false);
});

test("解锁口径：过关才开下一关，第一关始终解锁", () => {
  let data = store.defaults();
  assert.equal(store.isUnlocked(data, 1), true);
  assert.equal(store.isUnlocked(data, 2), false);
  data = store.recordLevel(data, 1, { stars: 1, caught: true }).data;
  assert.equal(store.isUnlocked(data, 2), true);
  assert.equal(store.isUnlocked(data, 3), false);
});

test("统计口径：总星数与通关数随 records 同步", () => {
  let data = store.defaults();
  data = store.recordLevel(data, 1, { stars: 3, caught: true }).data;
  data = store.recordLevel(data, 2, { stars: 2, caught: true }).data;
  data = store.recordLevel(data, 5, { stars: 1, caught: true }).data;
  assert.equal(store.totalStars(data), 6);
  assert.equal(store.clearedCount(data), 3);
});

test("偏好写入：静音开关与 last 钳制在 1..LEVEL_COUNT", () => {
  let data = store.defaults();
  data = store.setMuted(data, true);
  assert.equal(data.muted, true);
  data = store.setMuted(data, false);
  assert.equal(data.muted, false);
  data = store.setLast(data, 12);
  assert.equal(data.last, LEVEL_COUNT, "越界 last 被钳到上限");
  data = store.setLast(data, 4);
  assert.equal(data.last, 4);
});

test("localStorage 可用时 save/load 往返一致，异常时静默降级", () => {
  const mem = new Map();
  const stub = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
  const original = globalThis.localStorage;
  globalThis.localStorage = stub;

  try {
    let data = store.defaults();
    data = store.recordLevel(data, 3, { stars: 3, caught: true }).data;
    store.save(data);
    const loaded = store.load();
    assert.equal(loaded.levels[3].stars, 3);
    assert.equal(loaded.records.stars, 3);
    store.clear();
    assert.deepEqual(store.load().levels, {});
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});