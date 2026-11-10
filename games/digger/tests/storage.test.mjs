import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_LEVEL, SCHEMA_VERSION, STORAGE_KEY, applyLevelResult, bestScoreFor,
  clearProgress, defaultState, load, normalize, resetBackendForTests, save,
  starsFor, totalStars,
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
  eq(STORAGE_KEY, "doin.digger.v1");
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
      d01: { stars: 9, bestScore: -30, cleared: 1 },
      bad: { stars: 3, bestScore: 100 },
      d02: null,
    },
    stats: { clears: -2, fails: "x", bestScore: 123.9 },
  });
  eq(junk.version, SCHEMA_VERSION);
  eq(junk.prefs.muted, true);
  eq(junk.prefs.lastLevel, DEFAULT_LEVEL);
  eq(junk.progress.d01.stars, 3);
  eq(junk.progress.d01.bestScore, 0);
  eq(junk.progress.d01.cleared, true);
  eq(junk.progress.bad, undefined);
  eq(junk.stats.clears, 0);
  eq(junk.stats.fails, 0);
  eq(junk.stats.bestScore, 123);
});

test("save / load 往返并忽略损坏 JSON", () => {
  const map = installStorage();
  resetBackendForTests();
  const state = defaultState();
  state.prefs.muted = true;
  state.prefs.lastLevel = "d05";
  state.progress.d05 = { stars: 2, bestScore: 900, cleared: true };
  eq(save(state), true);
  const loaded = load();
  eq(loaded.prefs.muted, true);
  eq(loaded.prefs.lastLevel, "d05");
  eq(loaded.progress.d05.stars, 2);

  map.set(STORAGE_KEY, "{broken");
  resetBackendForTests();
  const fallback = load();
  eq(fallback.prefs.lastLevel, DEFAULT_LEVEL);
  eq(fallback.progress.d01, undefined);
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

test("关卡成绩只进不退，并累计通关/失败次数", () => {
  restoreStorage();
  let store = defaultState();
  store = applyLevelResult(store, "d01", { outcome: "clear", stars: 2, score: 800 });
  eq(starsFor(store, "d01"), 2);
  eq(bestScoreFor(store, "d01"), 800);
  eq(store.stats.clears, 1);
  eq(store.prefs.lastLevel, "d01");

  store = applyLevelResult(store, "d01", { outcome: "fail", stars: 0, score: 500 });
  eq(starsFor(store, "d01"), 2, "失败不得覆盖已有星数");
  eq(bestScoreFor(store, "d01"), 800, "低分不得覆盖最高分");
  eq(store.stats.fails, 1);

  store = applyLevelResult(store, "d01", { outcome: "clear", stars: 3, score: 1500 });
  eq(starsFor(store, "d01"), 3);
  eq(bestScoreFor(store, "d01"), 1500);
  eq(store.stats.clears, 2);
  eq(store.stats.bestScore, 1500);

  eq(applyLevelResult(store, "nope", { outcome: "clear", stars: 3 }), store);
  eq(applyLevelResult(store, "d02", null), store);
});

test("总星数与清空进度", () => {
  restoreStorage();
  let store = defaultState();
  store = applyLevelResult(store, "d01", { outcome: "clear", stars: 3, score: 100 });
  store = applyLevelResult(store, "d02", { outcome: "clear", stars: 1, score: 200 });
  eq(totalStars(store), 4);
  const cleared = clearProgress(store);
  eq(totalStars(cleared), 0);
  eq(cleared.stats.bestScore, 0);
  eq(cleared.prefs.lastLevel, "d02");
});
