import test from "node:test";
import assert from "node:assert/strict";

import {
  defaults,
  normalize,
  recordEndless,
  recordLevel,
  recordSniper,
  setSound,
  setMode,
  totalStars,
  resetAll,
  LEVEL_COUNT,
} from "../js/storage.mjs";

test("normalize falls back to defaults for every kind of corrupt payload", () => {
  const d = defaults();
  assert.deepEqual(normalize(null), d);
  assert.deepEqual(normalize(undefined), d);
  assert.deepEqual(normalize("boom"), d);
  assert.deepEqual(normalize(42), d);
  assert.deepEqual(normalize([1, 2, 3]), d);
  assert.deepEqual(normalize({ sound: "yes" }).sound, true, "非布尔音效值回默认");
  assert.equal(normalize({ mode: "nope" }).mode, "odyssey", "非法模式回默认");
});

test("numeric fields are clamped into sane ranges", () => {
  const out = normalize({
    endless: { best: -50, bestCombo: 1e12, maxDistance: "abc" },
    odyssey: { unlocked: 999, stars: { 1: 9, 2: -3, 99: 3, x: 2 }, clears: -1 },
    sniper: { best: 1e15, rank: "SSSSS" },
  });
  assert.equal(out.endless.best, 0);
  assert.ok(out.endless.bestCombo <= 9999);
  assert.equal(out.endless.maxDistance, 0);
  assert.equal(out.odyssey.unlocked, LEVEL_COUNT, "解锁上限应夹到总关数");
  assert.equal(out.odyssey.stars["1"], 3, "星级夹到 0..3");
  assert.equal(out.odyssey.stars["2"], 0);
  assert.equal(out.odyssey.stars["99"], undefined, "越界关卡星记录应丢弃");
  assert.equal(out.odyssey.clears, 0);
  assert.ok(out.sniper.best <= 10_000_000);
  assert.ok(out.sniper.rank.length <= 4);
});

test("setSound / setMode persist valid values only", () => {
  assert.equal(setSound(false).sound, false);
  assert.equal(setSound(true).sound, true);
  assert.equal(setMode("sniper").mode, "sniper");
  assert.equal(setMode("bogus").mode, "sniper", "非法模式不应覆盖既有值");
});

test("recordLevel writes stars, unlocks the next stage and never regresses", () => {
  let data = defaults();
  let rec = recordLevel(data, 1, 2);
  data = rec.data;
  assert.equal(data.odyssey.stars["1"], 2);
  assert.equal(data.odyssey.unlocked, 2);
  assert.equal(rec.improved, true);
  assert.equal(data.odyssey.clears, 1);

  rec = recordLevel(data, 1, 1);
  data = rec.data;
  assert.equal(data.odyssey.stars["1"], 2, "低星不得覆盖高星");
  assert.equal(rec.improved, false);
  assert.equal(data.odyssey.clears, 1, "重复通关不应重复计入");

  rec = recordLevel(data, 1, 3);
  data = rec.data;
  assert.equal(data.odyssey.stars["1"], 3);
  assert.equal(rec.improved, true);

  assert.equal(recordLevel(data, LEVEL_COUNT, 3).data.odyssey.unlocked, 2, "通关末关不得把解锁数推到越界");
  assert.equal(recordLevel(data, 3, 3).data.odyssey.unlocked, 4, "通关第 3 关应解锁第 4 关");
  assert.equal(recordLevel(data, 5, 0).data.odyssey.stars["5"], undefined, "零星不记录也不解锁");
});

test("recordEndless keeps the best of each metric", () => {
  let data = defaults();
  let rec = recordEndless(data, { score: 120, bestCombo: 4, maxDistance: 300 });
  data = rec.data;
  assert.equal(data.endless.best, 120);
  assert.equal(data.endless.bestCombo, 4);
  assert.equal(data.endless.maxDistance, 300);
  assert.equal(rec.isNewBest, true);

  rec = recordEndless(data, { score: 80, bestCombo: 2, maxDistance: 260 });
  data = rec.data;
  assert.equal(data.endless.best, 120, "低分不得覆盖最高分");
  assert.equal(data.endless.bestCombo, 4);
  assert.equal(data.endless.maxDistance, 300);
  assert.equal(rec.isNewBest, false);

  assert.equal(recordEndless(data, {}).data.endless.best, 120, "缺失字段按 0 处理且不破坏存档");
});

test("recordSniper tracks best score and rank", () => {
  let data = defaults();
  let rec = recordSniper(data, 640, "A");
  data = rec.data;
  assert.equal(data.sniper.best, 640);
  assert.equal(data.sniper.rank, "A");
  assert.equal(rec.isNewBest, true);

  rec = recordSniper(data, 500, "B");
  assert.equal(rec.isNewBest, false);
  assert.equal(rec.data.sniper.rank, "A", "未破纪录时保留历史评级");
});

test("totalStars sums the star table and resetAll wipes everything", () => {
  let data = recordLevel(defaults(), 1, 3).data;
  data = recordLevel(data, 2, 2).data;
  assert.equal(totalStars(data), 5);
  assert.deepEqual(resetAll(), defaults());
  assert.equal(totalStars(resetAll()), 0);
});
