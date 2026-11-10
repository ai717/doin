import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEY, applyLevelResult, bestScoreFor, clearProgress, defaultState, load, normalize,
  resetBackendForTests, save, starsFor, totalStars,
} from "../js/storage.mjs";
import { LEVELS } from "../js/levels.mjs";

const eq = assert.strictEqual;

function installStorage(entries = []) {
  const store = new Map(entries);
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  resetBackendForTests();
  return store;
}

test("默认存档与共享 key", () => {
  eq(STORAGE_KEY, "doin.pegfall.v1");
  const state = defaultState();
  eq(state.prefs.muted, false);
  eq(state.prefs.lastLevel, LEVELS[0].id);
  assert.deepEqual(state.progress, {});
  eq(state.stats.clears, 0);
});

test("往返读写与坏数据归一化", () => {
  installStorage();
  const state = defaultState();
  state.prefs.muted = true;
  state.prefs.lastLevel = "p07";
  state.progress = { p01: { stars: 3, bestScore: 9000 } };
  state.stats = { clears: 4, fails: 1, bestScore: 9000 };
  eq(save(state), true);

  const loaded = load();
  eq(loaded.prefs.muted, true);
  eq(loaded.prefs.lastLevel, "p07");
  eq(loaded.progress.p01.stars, 3);
  eq(loaded.stats.clears, 4);

  const broken = normalize({
    prefs: { muted: "yes", lastLevel: "nope" },
    progress: { p01: { stars: 9, bestScore: -4 }, nope: { stars: 3 } },
    stats: { clears: -1, fails: "x", bestScore: Infinity },
  });
  eq(broken.prefs.muted, true);
  eq(broken.prefs.lastLevel, LEVELS[0].id);
  eq(broken.progress.p01.stars, 3);
  eq(broken.progress.p01.bestScore, 0);
  eq(broken.progress.nope, undefined);
  eq(broken.stats.clears, 0);
  eq(broken.stats.fails, 0);
  eq(broken.stats.bestScore, 0);
});

test("关卡记录只进不退：星数与最高分取历史最大值", () => {
  let store = defaultState();
  store = applyLevelResult(store, "p02", { outcome: "clear", stars: 2, score: 5000 });
  eq(starsFor(store, "p02"), 2);
  eq(bestScoreFor(store, "p02"), 5000);
  eq(store.stats.clears, 1);

  store = applyLevelResult(store, "p02", { outcome: "fail", stars: 0, score: 9000 });
  eq(starsFor(store, "p02"), 2);
  eq(bestScoreFor(store, "p02"), 9000);
  eq(store.stats.fails, 1);

  store = applyLevelResult(store, "p02", { outcome: "clear", stars: 1, score: 4000 });
  eq(starsFor(store, "p02"), 2);
  eq(bestScoreFor(store, "p02"), 9000);
  eq(store.stats.clears, 2);
  eq(store.prefs.lastLevel, "p02");

  eq(applyLevelResult(store, "nope", { stars: 3 }), store);
  eq(totalStars(store), 2);
});

test("清空进度保留偏好", () => {
  let store = defaultState();
  store.prefs.muted = true;
  store = applyLevelResult(store, "p01", { outcome: "clear", stars: 3, score: 100 });
  const cleared = clearProgress(store);
  assert.deepEqual(cleared.progress, {});
  eq(cleared.stats.clears, 0);
  eq(cleared.prefs.muted, true);
});

test("localStorage 抛错时静默降级内存", () => {
  globalThis.localStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  resetBackendForTests();
  eq(load().prefs.lastLevel, LEVELS[0].id);
  eq(save(defaultState()), true);
  eq(load().stats.clears, 0);
  resetBackendForTests();
});

test("损坏 JSON 回落默认存档", () => {
  installStorage([[STORAGE_KEY, "{oops"]]);
  eq(load().prefs.lastLevel, LEVELS[0].id);
});
