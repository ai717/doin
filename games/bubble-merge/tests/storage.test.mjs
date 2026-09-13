import test from "node:test";
import assert from "node:assert/strict";

import * as storage from "../js/storage.mjs";

// 注意：node 环境无 localStorage，storage 自动降级到内存 Map；
// 模块级 backend 在本文件内共享，涉及读写的用例先 resetAll() 清场。

test("defaults: documented shape and zeroed records", () => {
  const d = storage.defaults();
  assert.equal(d.sound, true);
  assert.deepEqual(d.endless, { best: 0, maxLevel: 0, maxChain: 0 });
  assert.deepEqual(d.daily, { date: null, best: 0, maxLevel: 0 });
});

test("normalize: garbage and out-of-range values are clamped", () => {
  assert.deepEqual(storage.normalize(null), storage.defaults());
  assert.deepEqual(storage.normalize("nope"), storage.defaults());
  assert.deepEqual(storage.normalize([]), storage.defaults());

  const n = storage.normalize({
    sound: "yes", // 非布尔 → 回默认 true
    endless: { best: -50, maxLevel: 99, maxChain: NaN },
    daily: { date: "yesterday", best: 1e12, maxLevel: 3 },
  });
  assert.equal(n.sound, true);
  assert.equal(n.endless.best, 0); // 负分钳到 0
  assert.equal(n.endless.maxLevel, 10); // 上限 10
  assert.equal(n.endless.maxChain, 0); // NaN → 0
  assert.equal(n.daily.date, null); // 非法日期串 → null
  assert.equal(n.daily.maxLevel, 3);
});

test("normalize: accepts a valid payload", () => {
  const n = storage.normalize({
    sound: false,
    endless: { best: 1200, maxLevel: 7, maxChain: 4 },
    daily: { date: "2026-09-14", best: 300, maxLevel: 5 },
  });
  assert.equal(n.sound, false);
  assert.deepEqual(n.endless, { best: 1200, maxLevel: 7, maxChain: 4 });
  assert.deepEqual(n.daily, { date: "2026-09-14", best: 300, maxLevel: 5 });
});

test("save / load roundtrip persists through the backend", () => {
  storage.resetAll();
  const data = storage.defaults();
  data.endless.best = 888;
  data.sound = false;
  storage.save(data);
  const loaded = storage.load();
  assert.equal(loaded.endless.best, 888);
  assert.equal(loaded.sound, false);
});

test("recordResult (endless): best only increases, isNewBest flags correctly", () => {
  let data = storage.defaults();
  let r = storage.recordResult(data, { kind: "endless", score: 500, maxLevel: 6, maxChain: 3 });
  assert.equal(r.isNewBest, true);
  assert.equal(r.data.endless.best, 500);
  assert.equal(r.data.endless.maxLevel, 6);
  assert.equal(r.data.endless.maxChain, 3);

  // 更低分：纪录不减，isNewBest=false
  r = storage.recordResult(r.data, { kind: "endless", score: 200, maxLevel: 4, maxChain: 9 });
  assert.equal(r.isNewBest, false);
  assert.equal(r.data.endless.best, 500);
  assert.equal(r.data.endless.maxLevel, 6); // 取较大
  assert.equal(r.data.endless.maxChain, 9);

  // 更高分：刷新
  r = storage.recordResult(r.data, { kind: "endless", score: 900, maxLevel: 8, maxChain: 2 });
  assert.equal(r.isNewBest, true);
  assert.equal(r.data.endless.best, 900);
});

test("recordResult (daily): same day accumulates, new day resets", () => {
  let data = storage.defaults();
  let r = storage.recordResult(data, { kind: "daily", score: 300, maxLevel: 5, date: "2026-09-14" });
  assert.equal(r.isNewBest, false); // 当天首局：建立基线
  assert.equal(r.data.daily.best, 300);
  assert.equal(r.data.daily.date, "2026-09-14");

  r = storage.recordResult(r.data, { kind: "daily", score: 450, maxLevel: 6, date: "2026-09-14" });
  assert.equal(r.isNewBest, true);
  assert.equal(r.data.daily.best, 450);

  r = storage.recordResult(r.data, { kind: "daily", score: 100, maxLevel: 3, date: "2026-09-14" });
  assert.equal(r.isNewBest, false);
  assert.equal(r.data.daily.best, 450); // 当天仍取最高

  // 跨日：重置为当天成绩
  r = storage.recordResult(r.data, { kind: "daily", score: 50, maxLevel: 2, date: "2026-09-15" });
  assert.equal(r.isNewBest, false);
  assert.equal(r.data.daily.date, "2026-09-15");
  assert.equal(r.data.daily.best, 50);
});

test("recordResult ignores a malformed daily date", () => {
  const r = storage.recordResult(storage.defaults(), {
    kind: "daily",
    score: 10,
    maxLevel: 1,
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
  storage.save({ ...storage.defaults(), endless: { best: 1, maxLevel: 1, maxChain: 1 } });
  const data = storage.resetAll();
  assert.deepEqual(data, storage.defaults());
  assert.deepEqual(storage.load(), storage.defaults());
});
