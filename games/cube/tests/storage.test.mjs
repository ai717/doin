import test from "node:test";
import assert from "node:assert/strict";

import {
  SCHEMA_VERSION,
  STORAGE_KEY,
  bestMsFor,
  clearProgress,
  defaultState,
  levelRecord,
  load,
  normalize,
  recordSolve,
  rememberMode,
  resetBackendForTests,
  save,
  totalStars,
} from "../js/storage.mjs";

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("defaults cover prefs, progress and stats", () => {
  const state = defaultState();
  assert.equal(state.version, SCHEMA_VERSION);
  assert.equal(state.prefs.size, 2);
  assert.equal(state.prefs.mode, "free");
  assert.equal(state.prefs.lastLevel, "c01");
  assert.deepEqual(state.stats.best, { "2": 0, "3": 0 });
  assert.equal(STORAGE_KEY, "doin.cube.v1");
});

test("normalize repairs corrupted and hostile payloads", () => {
  const repaired = normalize({
    prefs: { muted: "yes", size: 99, mode: "chaos", lastLevel: "nope" },
    progress: {
      c03: { cleared: true, stars: 9, bestMoves: -4, bestMs: 1200, bestScore: 200 },
      ghost: { cleared: true },
    },
    stats: { solves: -2, best: { "2": 9000, "3": "x" }, ao5: { "2": [0, 1200, "bad", 1500] } },
  });
  assert.equal(repaired.prefs.muted, true);
  assert.equal(repaired.prefs.size, 2);
  assert.equal(repaired.prefs.mode, "free");
  assert.equal(repaired.prefs.lastLevel, "c01");
  assert.deepEqual(repaired.progress.c03, {
    cleared: true,
    stars: 3,
    bestMoves: 0,
    bestMs: 1200,
    bestScore: 200,
  });
  assert.equal(repaired.progress.ghost, undefined);
  assert.equal(repaired.stats.solves, 0);
  assert.equal(repaired.stats.best["2"], 9000);
  assert.equal(repaired.stats.best["3"], 0);
  assert.deepEqual(repaired.stats.ao5["2"], [1200, 1500]);
  assert.deepEqual(normalize(null), defaultState());
});

test("save and load survive a JSON round-trip", () => {
  globalThis.localStorage = fakeStorage();
  resetBackendForTests();
  const state = rememberMode(defaultState(), { size: 3, mode: "academy", levelId: "c09" });
  assert.equal(save(state), true);
  const loaded = load();
  assert.equal(loaded.prefs.size, 3);
  assert.equal(loaded.prefs.mode, "academy");
  assert.equal(loaded.prefs.lastLevel, "c09");
});

test("load falls back to defaults on corrupt JSON", () => {
  globalThis.localStorage = fakeStorage({ [STORAGE_KEY]: "{not json" });
  resetBackendForTests();
  assert.deepEqual(load(), defaultState());
});

test("storage fallback keeps working when localStorage throws", () => {
  globalThis.localStorage = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  resetBackendForTests();
  assert.deepEqual(load(), defaultState());
  const state = rememberMode(defaultState(), { size: 2, mode: "free", levelId: "c01" });
  assert.equal(save(state), true);
  assert.equal(load().prefs.size, 2);
});

test("free solves update personal best and ao5 only", () => {
  let store = defaultState();
  store = recordSolve(store, { outcome: "clear", size: 3, mode: "free", ms: 52000, moves: 60, score: 900, dailyKey: "20261110" });
  store = recordSolve(store, { outcome: "clear", size: 3, mode: "free", ms: 42000, moves: 55, score: 1200, dailyKey: "20261110" });
  store = recordSolve(store, { outcome: "clear", size: 3, mode: "free", ms: 48000, moves: 58, score: 1100 });
  assert.equal(store.stats.best["3"], 42000);
  assert.deepEqual(store.stats.ao5["3"], [52000, 42000, 48000]);
  assert.equal(store.stats.solves, 3);
  assert.equal(store.stats.daily.key, "20261110");
  assert.equal(store.stats.daily.bestMs, 42000);
  assert.equal(store.stats.best["2"], 0);
});

test("academy solves update stars and level records without touching 3x3 best", () => {
  let store = defaultState();
  store = recordSolve(store, {
    outcome: "clear", size: 3, mode: "academy", levelId: "c05", ms: 30000, moves: 9, score: 2000, stars: 2,
  });
  assert.equal(store.stats.best["3"], 0);
  assert.equal(store.prefs.mode, "academy");
  assert.equal(store.prefs.lastLevel, "c05");
  assert.deepEqual(levelRecord(store, "c05"), {
    cleared: true,
    stars: 2,
    bestMoves: 9,
    bestMs: 30000,
    bestScore: 2000,
  });

  store = recordSolve(store, {
    outcome: "clear", size: 3, mode: "academy", levelId: "c05", ms: 26000, moves: 12, score: 1800, stars: 3,
  });
  assert.equal(levelRecord(store, "c05").stars, 3);
  assert.equal(levelRecord(store, "c05").bestMs, 26000);
  assert.equal(levelRecord(store, "c05").bestMoves, 9);
  assert.equal(totalStars(store), 3);

  const cleared = clearProgress(store);
  assert.deepEqual(cleared.progress, {});
  assert.equal(bestMsFor(cleared, 3), 0);
});

test("non-clear results are ignored", () => {
  const store = defaultState();
  assert.equal(recordSolve(store, { outcome: "quit", ms: 1000 }), store);
  assert.equal(recordSolve(store, null), store);
});
