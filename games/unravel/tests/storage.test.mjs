import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadProgress,
  normalizeProgress,
  patchProgress,
  resetBackendForTests,
  saveProgress,
} from "../js/storage.mjs";

function withLocalStorage(impl) {
  globalThis.localStorage = impl;
}

function removeLocalStorage() {
  delete globalThis.localStorage;
}

test("normalizeProgress repairs corrupt data", () => {
  const progress = normalizeProgress({
    maxLevel: 999,
    stars: { "1": 3, "2": 9, bad: "x", "3": -2 },
    mode: "chaos",
    sound: "no",
    relaxCount: -5,
  });
  assert.equal(progress.maxLevel, 40);
  assert.deepEqual(progress.stars, { "1": 3 });
  assert.equal(progress.mode, "level");
  assert.equal(progress.sound, true);
  assert.equal(progress.relaxCount, 0);
});

test("normalizeProgress defaults on garbage input", () => {
  for (const raw of [null, undefined, 42, "junk", {}]) {
    const progress = normalizeProgress(raw);
    assert.equal(progress.maxLevel, 1);
    assert.deepEqual(progress.stars, {});
    assert.equal(progress.mode, "level");
    assert.equal(progress.sound, true);
  }
});

test("round trip save and load", () => {
  removeLocalStorage();
  resetBackendForTests();
  saveProgress({ maxLevel: 12, stars: { "1": 3, "11": 2 }, mode: "relax", sound: false, relaxCount: 4 });
  const loaded = loadProgress();
  assert.equal(loaded.maxLevel, 12);
  assert.deepEqual(loaded.stars, { "1": 3, "11": 2 });
  assert.equal(loaded.mode, "relax");
  assert.equal(loaded.sound, false);
  assert.equal(loaded.relaxCount, 4);
});

test("corrupt JSON payload falls back to defaults", () => {
  withLocalStorage({
    getItem: () => "{not json",
    setItem: () => {},
    removeItem: () => {},
  });
  resetBackendForTests();
  const progress = loadProgress();
  assert.equal(progress.maxLevel, 1);
  removeLocalStorage();
  resetBackendForTests();
});

test("storage unavailable degrades to memory silently", () => {
  withLocalStorage({
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  });
  resetBackendForTests();
  const before = loadProgress();
  assert.equal(before.maxLevel, 1);
  const patched = patchProgress({ maxLevel: 5 });
  assert.equal(patched.maxLevel, 5);
  assert.equal(loadProgress().maxLevel, 5, "memory backend keeps data in-session");
  removeLocalStorage();
  resetBackendForTests();
});

test("patchProgress merges onto current data", () => {
  removeLocalStorage();
  resetBackendForTests();
  patchProgress({ maxLevel: 3 });
  const next = patchProgress({ sound: false });
  assert.equal(next.maxLevel, 3);
  assert.equal(next.sound, false);
  removeLocalStorage();
  resetBackendForTests();
});
