import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LEVEL, SCHEMA_VERSION, STORAGE_KEY, applyLevelResult, bestScoreFor,
  bestStepsFor, clearProgress, defaultState, load, normalize, resetBackendForTests,
  save, starsFor, totalStars,
} from "../js/storage.mjs";
import { LEVELS } from "../js/levels.mjs";

const eq = assert.strictEqual;

function installStorage(entries = []) {
  const map = new Map(entries);
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  return map;
}

function restoreStorage() {
  delete globalThis.localStorage;
  resetBackendForTests();
}

test("存储 key、默认状态与默认关卡", () => {
  restoreStorage();
  eq(STORAGE_KEY, "doin.portalbox.v1");
  eq(SCHEMA_VERSION, 1);
  eq(DEFAULT_LEVEL, LEVELS[0].id);
  const base = defaultState();
  eq(base.prefs.lastLevel, DEFAULT_LEVEL);
  eq(base.prefs.muted, false);
  eq(base.stats.bestScore, 0);
  assert.deepEqual(base.progress, {});
});

test("normalize 清洗脏数据并回落默认值", () => {
  restoreStorage();
  assert.deepEqual(normalize(null), defaultState());
  const junk = normalize({
    prefs: { muted: 1, lastLevel: "nope" },
    progress: {
      p01: { stars: 9, bestSteps: -4, bestScore: -30, cleared: 1 },
      bad: { stars: 3, bestSteps: 5 },
      p02: null,
    },
    stats: { clears: -2, bestScore: 123.9 },
  });
  eq(junk.version, SCHEMA_VERSION);
  eq(junk.prefs.muted, true);
  eq(junk.prefs.lastLevel, DEFAULT_LEVEL);
  eq(junk.progress.p01.stars, 3);
  eq(junk.progress.p01.bestSteps, 0);
  eq(junk.progress.p01.bestScore, 0);
  eq(junk.progress.p01.cleared, true);
  eq(junk.progress.bad, undefined);
  eq(junk.stats.clears, 0);
  eq(junk.stats.bestScore, 123);
});

test("save / load 往返并忽略损坏 JSON", () => {
  const map = installStorage();
  resetBackendForTests();
  const state = defaultState();
  state.prefs.muted = true;
  state.prefs.lastLevel = "p05";
  state.progress.p05 = { stars: 2, bestSteps: 18, bestScore: 1500, cleared: true };
  eq(save(state), true);
  const loaded = load();
  eq(loaded.prefs.muted, true);
  eq(loaded.prefs.lastLevel, "p05");
  eq(loaded.progress.p05.stars, 2);
  eq(loaded.progress.p05.bestSteps, 18);

  map.set(STORAGE_KEY, "{broken");
  resetBackendForTests();
  const fallback = load();
  eq(fallback.prefs.lastLevel, DEFAULT_LEVEL);
  eq(fallback.progress.p01, undefined);
  restoreStorage();
});

test("localStorage 抛错时静默降级内存", () => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: () => {},
  };
  resetBackendForTests();
  const fallback = load();
  eq(fallback.prefs.lastLevel, DEFAULT_LEVEL);
  eq(save(fallback), true);
  eq(load().prefs.lastLevel, DEFAULT_LEVEL);
  restoreStorage();
});

test("关卡成绩只进不退，最少步数取历史最小", () => {
  restoreStorage();
  let store = defaultState();
  store = applyLevelResult(store, "p01", { outcome: "clear", steps: 8, stars: 3, score: 2000 });
  eq(starsFor(store, "p01"), 3);
  eq(bestStepsFor(store, "p01"), 8);
  eq(bestScoreFor(store, "p01"), 2000);
  eq(store.stats.clears, 1);
  eq(store.prefs.lastLevel, "p01");

  store = applyLevelResult(store, "p01", { outcome: "clear", steps: 6, stars: 3, score: 1800 });
  eq(bestStepsFor(store, "p01"), 6, "更少步数应覆盖");
  eq(bestScoreFor(store, "p01"), 2000, "低分不得覆盖最高分");

  store = applyLevelResult(store, "p01", { outcome: "clear", steps: 12, stars: 2, score: 2100 });
  eq(bestStepsFor(store, "p01"), 6, "更多步数不得覆盖");
  eq(starsFor(store, "p01"), 3);
  eq(bestScoreFor(store, "p01"), 2100);

  eq(applyLevelResult(store, "nope", { outcome: "clear", stars: 3 }), store);
  eq(applyLevelResult(store, "p02", null), store);
});

test("总星数与清空进度", () => {
  restoreStorage();
  let store = defaultState();
  store = applyLevelResult(store, "p01", { outcome: "clear", steps: 5, stars: 3, score: 100 });
  store = applyLevelResult(store, "p02", { outcome: "clear", steps: 12, stars: 1, score: 200 });
  eq(totalStars(store), 4);
  const cleared = clearProgress(store);
  eq(totalStars(cleared), 0);
  eq(cleared.stats.bestScore, 0);
  eq(cleared.prefs.lastLevel, "p02");
});
