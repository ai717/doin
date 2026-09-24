import test from "node:test";
import assert from "node:assert/strict";

import * as storage from "../js/storage.mjs";

// 注意：node 环境无 localStorage，storage 自动降级到内存 Map；
// 模块级 backend 在本文件内共享，涉及读写的用例先 resetAll() 清场。

test("defaults: documented shape and zeroed records", () => {
  const d = storage.defaults();
  assert.equal(d.sound, true);
  assert.deepEqual(d.endless, { best: 0, maxLevel: 0, maxChain: 0, bestTime: 0 });
  assert.deepEqual(d.daily, { date: null, best: 0, maxLevel: 0, bestTime: 0 });
});

test("normalize: garbage and out-of-range values are clamped", () => {
  assert.deepEqual(storage.normalize(null), storage.defaults());
  assert.deepEqual(storage.normalize("nope"), storage.defaults());
  assert.deepEqual(storage.normalize([]), storage.defaults());

  const n = storage.normalize({
    sound: "yes", // 非布尔 → 回默认 true
    endless: { best: -50, maxLevel: 99, maxChain: NaN, bestTime: -3 },
    daily: { date: "yesterday", best: 1e12, maxLevel: 3, bestTime: 2e6 },
  });
  assert.equal(n.sound, true);
  assert.equal(n.endless.best, 0); // 负分钳到 0
  assert.equal(n.endless.maxLevel, 11); // 上限 11
  assert.equal(n.endless.maxChain, 0); // NaN → 0
  assert.equal(n.endless.bestTime, 0); // 负用时钳到 0
  assert.equal(n.daily.date, null); // 非法日期串 → null
  assert.equal(n.daily.maxLevel, 3);
  assert.equal(n.daily.bestTime, 99999); // 超大用时钳到上限
});

test("normalize: accepts a valid payload", () => {
  const n = storage.normalize({
    sound: false,
    endless: { best: 1200, maxLevel: 9, maxChain: 4, bestTime: 55 },
    daily: { date: "2026-09-14", best: 300, maxLevel: 7, bestTime: 88 },
  });
  assert.equal(n.sound, false);
  assert.deepEqual(n.endless, { best: 1200, maxLevel: 9, maxChain: 4, bestTime: 55 });
  assert.deepEqual(n.daily, { date: "2026-09-14", best: 300, maxLevel: 7, bestTime: 88 });
});

test("save / load roundtrip persists through the backend", () => {
  storage.resetAll();
  const data = storage.defaults();
  data.endless.best = 888;
  data.endless.bestTime = 42;
  data.sound = false;
  storage.save(data);
  const loaded = storage.load();
  assert.equal(loaded.endless.best, 888);
  assert.equal(loaded.endless.bestTime, 42);
  assert.equal(loaded.sound, false);
});

test("recordResult (endless): best only increases, bestTime keeps the fastest", () => {
  let data = storage.defaults();
  let r = storage.recordResult(data, { kind: "endless", score: 500, maxLevel: 8, maxChain: 3, time: 0 });
  assert.equal(r.isNewBest, true);
  assert.equal(r.data.endless.best, 500);
  assert.equal(r.data.endless.maxLevel, 8);
  assert.equal(r.data.endless.bestTime, 0); // 未达成 2048 → 不记录用时

  // 更低分但达成 2048：纪录不减分，但记录最快用时
  r = storage.recordResult(r.data, { kind: "endless", score: 200, maxLevel: 11, maxChain: 9, time: 60 });
  assert.equal(r.isNewBest, false);
  assert.equal(r.data.endless.best, 500);
  assert.equal(r.data.endless.maxLevel, 11); // 取较大
  assert.equal(r.data.endless.maxChain, 9);
  assert.equal(r.data.endless.bestTime, 60);

  // 更高分且更快 → 双刷新
  r = storage.recordResult(r.data, { kind: "endless", score: 900, maxLevel: 11, maxChain: 2, time: 45 });
  assert.equal(r.isNewBest, true);
  assert.equal(r.data.endless.best, 900);
  assert.equal(r.data.endless.bestTime, 45);

  // 更慢的一局不覆盖最快用时
  r = storage.recordResult(r.data, { kind: "endless", score: 1200, maxLevel: 11, maxChain: 4, time: 70 });
  assert.equal(r.isNewBest, true);
  assert.equal(r.data.endless.bestTime, 45);
});

test("recordResult (daily): same day accumulates, new day resets", () => {
  let data = storage.defaults();
  let r = storage.recordResult(data, { kind: "daily", score: 300, maxLevel: 7, time: 0, date: "2026-09-14" });
  assert.equal(r.isNewBest, false); // 当天首局：建立基线
  assert.equal(r.data.daily.best, 300);
  assert.equal(r.data.daily.date, "2026-09-14");
  assert.equal(r.data.daily.bestTime, 0);

  r = storage.recordResult(r.data, { kind: "daily", score: 450, maxLevel: 11, time: 50, date: "2026-09-14" });
  assert.equal(r.isNewBest, true);
  assert.equal(r.data.daily.best, 450);
  assert.equal(r.data.daily.bestTime, 50);

  r = storage.recordResult(r.data, { kind: "daily", score: 100, maxLevel: 11, time: 30, date: "2026-09-14" });
  assert.equal(r.isNewBest, false);
  assert.equal(r.data.daily.best, 450); // 当天仍取最高
  assert.equal(r.data.daily.bestTime, 30); // 用时取最快

  // 跨日：重置为当天成绩
  r = storage.recordResult(r.data, { kind: "daily", score: 50, maxLevel: 2, time: 0, date: "2026-09-15" });
  assert.equal(r.isNewBest, false);
  assert.equal(r.data.daily.date, "2026-09-15");
  assert.equal(r.data.daily.best, 50);
  assert.equal(r.data.daily.bestTime, 0);
});

test("recordResult ignores a malformed daily date", () => {
  const r = storage.recordResult(storage.defaults(), {
    kind: "daily",
    score: 10,
    maxLevel: 1,
    time: 0,
    date: "not-a-date",
  });
  assert.equal(r.data.daily.date, null);
});

test("setSound flips the preference and persists", () => {
  storage.resetAll();
  let data = storage.setSound(false);
  assert.equal(data.sound, false);
  assert.equal(storage.load().sound, false);
  data = storage.setSound(true);
  assert.equal(data.sound, true);
});

test("resetAll restores defaults", () => {
  storage.save({ ...storage.defaults(), endless: { best: 1, maxLevel: 1, maxChain: 1, bestTime: 9 } });
  const data = storage.resetAll();
  assert.deepEqual(data, storage.defaults());
  assert.deepEqual(storage.load(), storage.defaults());
});
