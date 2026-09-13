import test from "node:test";
import assert from "node:assert/strict";

import {
  defaults,
  normalize,
  load,
  save,
  recordResult,
  setSound,
  resetAll,
} from "../js/storage.mjs?v=dev";

test("storage: defaults provide valid initial shape", () => {
  const d = defaults();
  assert.equal(typeof d.sound, "boolean");
  assert.equal(d.endless.best, 0);
  assert.equal(d.endless.maxLevel, 1);
  assert.equal(d.endless.rainbows, 0);
  assert.equal(d.daily.best, 0);
  assert.equal(d.daily.date, null);
});

test("storage: normalize handles corrupted or garbage input", () => {
  assert.deepEqual(normalize(null), defaults());
  assert.deepEqual(normalize("invalid"), defaults());
  assert.deepEqual(normalize([]), defaults());

  const partial = {
    sound: false,
    endless: { best: -50, maxLevel: 999, rainbows: 10 },
    daily: { date: "bad-date", best: "NaN" },
  };
  const normalized = normalize(partial);
  assert.equal(normalized.sound, false);
  assert.equal(normalized.endless.best, 0);
  assert.equal(normalized.endless.maxLevel, 10); // clamped to MAX_LEVEL
  assert.equal(normalized.endless.rainbows, 10);
  assert.equal(normalized.daily.date, null); // rejected invalid date
  assert.equal(normalized.daily.best, 0);
});

test("storage: save and load roundtrip", () => {
  resetAll();
  const sample = {
    sound: false,
    endless: { best: 1500, maxLevel: 8, maxChain: 4, rainbows: 2 },
    daily: { date: "2026-09-14", best: 800, maxLevel: 6, rainbows: 1 },
  };
  save(sample);
  const loaded = load();
  assert.equal(loaded.sound, false);
  assert.equal(loaded.endless.best, 1500);
  assert.equal(loaded.endless.maxLevel, 8);
  assert.equal(loaded.endless.rainbows, 2);
  assert.equal(loaded.daily.best, 800);
  assert.equal(loaded.daily.date, "2026-09-14");
});

test("storage: recordResult updates endless best and triggers isNewBest", () => {
  resetAll();
  const d1 = defaults();

  const r1 = recordResult(d1, { kind: "endless", score: 500, maxLevel: 5, maxChain: 2, rainbows: 0 });
  assert.equal(r1.isNewBest, true);
  assert.equal(r1.data.endless.best, 500);

  const r2 = recordResult(r1.data, { kind: "endless", score: 300, maxLevel: 4, maxChain: 1, rainbows: 0 });
  assert.equal(r2.isNewBest, false);
  assert.equal(r2.data.endless.best, 500);

  const r3 = recordResult(r2.data, { kind: "endless", score: 900, maxLevel: 7, maxChain: 3, rainbows: 1 });
  assert.equal(r3.isNewBest, true);
  assert.equal(r3.data.endless.best, 900);
  assert.equal(r3.data.endless.rainbows, 1);
});

test("storage: recordResult daily accumulates on same day, resets on new day", () => {
  resetAll();
  const d1 = defaults();

  const r1 = recordResult(d1, { kind: "daily", score: 600, maxLevel: 6, rainbows: 1, date: "2026-09-14" });
  assert.equal(r1.data.daily.best, 600);
  assert.equal(r1.data.daily.date, "2026-09-14");

  // 当日更高分
  const r2 = recordResult(r1.data, { kind: "daily", score: 850, maxLevel: 7, rainbows: 2, date: "2026-09-14" });
  assert.equal(r2.isNewBest, true);
  assert.equal(r2.data.daily.best, 850);

  // 隔天新纪录重置
  const r3 = recordResult(r2.data, { kind: "daily", score: 400, maxLevel: 5, rainbows: 0, date: "2026-09-15" });
  assert.equal(r3.data.daily.best, 400);
  assert.equal(r3.data.daily.date, "2026-09-15");
});

test("storage: setSound toggles preference and persists", () => {
  resetAll();
  setSound(false);
  assert.equal(load().sound, false);
  setSound(true);
  assert.equal(load().sound, true);
});
