// storage.test.mjs —— 存档归一化 / 损坏降级 / 解锁口径

import test from "node:test";
import assert from "node:assert/strict";

import * as store from "../js/storage.mjs";
import { LEVEL_COUNT, MAIN_COUNT, levelById } from "../js/levels.mjs";

test("默认存档合法", () => {
  const d = store.defaults();
  assert.equal(d.v, 1);
  assert.equal(d.muted, false);
  assert.deepEqual(d.levels, {});
});

test("任意垃圾输入都被归一化，绝不抛错", () => {
  for (const junk of [null, undefined, 0, "x", [], { levels: "no" }, { levels: { 1: null, 2: 7, 99: { stars: 9 } } }]) {
    const out = store.normalize(junk);
    assert.equal(out.v, 1);
    assert.equal(typeof out.levels, "object");
    assert.ok(out.last >= 1 && out.last <= LEVEL_COUNT);
  }
});

test("星级与投数被钳制在合法区间，坏值回默认", () => {
  const out = store.normalize({ levels: { 1: { stars: 99, fewest: -5, cleared: "yes" }, 4: { stars: 2, fewest: 3 } } });
  assert.equal(out.levels[1].stars, 3);
  assert.equal(out.levels[1].fewest, 0);
  assert.equal(out.levels[1].cleared, true);
  assert.equal(out.levels[4].stars, 2);
  assert.equal(out.levels[4].fewest, 3);
  assert.equal(out.levels[99], undefined, "越界关卡号必须丢弃");
});

test("战绩只进不退：星级取高、投数取少", () => {
  let data = store.defaults();
  data = store.recordLevel(data, 1, { stars: 1, used: 8, cleared: true }).data;
  assert.equal(store.levelRecord(data, 1).stars, 1);
  assert.equal(store.levelRecord(data, 1).fewest, 8);
  data = store.recordLevel(data, 1, { stars: 3, used: 6, cleared: true }).data;
  assert.equal(store.levelRecord(data, 1).stars, 3);
  assert.equal(store.levelRecord(data, 1).fewest, 6);
  data = store.recordLevel(data, 1, { stars: 1, used: 9, cleared: true }).data;
  assert.equal(store.levelRecord(data, 1).stars, 3, "星级不得被拉低");
  assert.equal(store.levelRecord(data, 1).fewest, 6, "最好成绩不得被拉高");
});

test("未命中不记成绩", () => {
  let data = store.defaults();
  data = store.recordLevel(data, 2, { stars: 0, used: 5, cleared: false }).data;
  assert.equal(store.levelRecord(data, 2).stars, 0);
  assert.equal(store.levelRecord(data, 2).cleared, false);
});

test("解锁口径：过关才开下一关，盲猎需主线全通", () => {
  let data = store.defaults();
  assert.equal(store.isUnlocked(data, 1), true);
  assert.equal(store.isUnlocked(data, 2), false);
  assert.equal(store.isUnlocked(data, MAIN_COUNT + 1), false);
  data = store.recordLevel(data, 1, { stars: 1, used: 7, cleared: true }).data;
  assert.equal(store.isUnlocked(data, 2), true);

  let full = store.defaults();
  for (let id = 1; id <= MAIN_COUNT; id += 1) {
    full = store.recordLevel(full, id, { stars: 1, used: levelById(id).budget, cleared: true }).data;
  }
  assert.equal(store.mainCleared(full), true);
  assert.equal(store.isUnlocked(full, MAIN_COUNT + 1), true);
});

test("统计口径：总星数与单关最少投掷", () => {
  let data = store.defaults();
  data = store.recordLevel(data, 1, { stars: 3, used: 4, cleared: true }).data;
  data = store.recordLevel(data, 2, { stars: 2, used: 5, cleared: true }).data;
  assert.equal(store.totalStars(data), 5);
  assert.equal(data.records.fewest, 4);
  assert.equal(store.chapterStars(data, 1), 5);
});

test("偏好写入与静音开关", () => {
  let data = store.defaults();
  data = store.setMuted(data, true);
  assert.equal(data.muted, true);
  data = store.setLast(data, 12);
  assert.equal(data.last, 12);
  data = store.setLast(data, 9999);
  assert.ok(data.last <= LEVEL_COUNT);
});

test("存档 key 遵循 doin.<slug>.v1 命名", () => {
  assert.equal(store.KEY, "doin.guess.v1");
});
