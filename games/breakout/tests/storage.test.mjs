import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  defaultState,
  normalize,
  load,
  save,
  setMuted,
  applyResult,
  resetAll,
  resetBackendForTests,
} from "../js/storage.mjs";

test("storage: key and schema version", () => {
  assert.equal(STORAGE_KEY, "doin.breakout.v1");
  assert.equal(SCHEMA_VERSION, 1);
});

test("storage: default state shape", () => {
  const d = defaultState();
  assert.equal(d.version, 1);
  assert.equal(typeof d.prefs.muted, "boolean");
  assert.equal(typeof d.progress.bestScore, "number");
  assert.equal(typeof d.progress.bestLayer, "number");
});

test("storage: normalize returns defaults for garbage input", () => {
  const d = normalize(null);
  assert.deepEqual(d, defaultState());
  const d2 = normalize("not an object");
  assert.deepEqual(d2, defaultState());
  const d3 = normalize({ prefs: "bad", progress: 42 });
  assert.equal(d3.prefs.muted, false);
  assert.equal(d3.progress.bestScore, 0);
});

test("storage: normalize clamps and coerces values", () => {
  const d = normalize({
    prefs: { muted: "true" },
    progress: { bestScore: -5, bestLayer: 0, totalRuns: "3", wins: 2.7 },
  });
  assert.equal(d.prefs.muted, true);
  assert.equal(d.progress.bestScore, 0);
  assert.equal(d.progress.bestLayer, 1);
  assert.equal(d.progress.totalRuns, 3);
  assert.equal(d.progress.wins, 2);
});

test("storage: save/load roundtrip via memory fallback", () => {
  resetBackendForTests();
  const state = defaultState();
  state.progress.bestScore = 12345;
  state.progress.bestLayer = 8;
  const saved = save(state);
  const loaded = load();
  assert.equal(loaded.progress.bestScore, 12345);
  assert.equal(loaded.progress.bestLayer, 8);
  assert.deepEqual(loaded, saved);
  resetBackendForTests();
});

test("storage: setMuted persists", () => {
  resetBackendForTests();
  const s = setMuted(defaultState(), true);
  assert.equal(s.prefs.muted, true);
  const loaded = load();
  assert.equal(loaded.prefs.muted, true);
  resetBackendForTests();
});

test("storage: applyResult updates bests and totalRuns", () => {
  resetBackendForTests();
  const base = defaultState();
  const { state: s1 } = applyResult(base, { score: 5000, layer: 6, won: false });
  assert.equal(s1.progress.bestScore, 5000);
  assert.equal(s1.progress.bestLayer, 6);
  assert.equal(s1.progress.totalRuns, 1);
  // 不超过之前的不更新
  const { state: s2 } = applyResult(s1, { score: 3000, layer: 4, won: false });
  assert.equal(s2.progress.bestScore, 5000);
  assert.equal(s2.progress.totalRuns, 2);
  resetBackendForTests();
});

test("storage: resetAll clears back to defaults", () => {
  resetBackendForTests();
  save({ ...defaultState(), progress: { ...defaultState().progress, bestScore: 999 } });
  const cleared = resetAll();
  assert.equal(cleared.progress.bestScore, 0);
  resetBackendForTests();
});
