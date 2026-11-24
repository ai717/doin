import test from "node:test";
import assert from "node:assert/strict";
import { load, save, normalize, recordMatch, resetBackendForTests } from "../js/storage.mjs";

const KEY = "doin.penalty.v1";

function fakeStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    raw: map,
  };
}

function install(store) {
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true });
  resetBackendForTests();
  return () => {
    Object.defineProperty(globalThis, "localStorage", { value: original, configurable: true });
    resetBackendForTests();
  };
}

test("bad data normalizes to the documented defaults", () => {
  assert.deepEqual(normalize(null).mode, "mode_solo");
  assert.deepEqual(normalize("garbage").difficulty, "ai_novice");
  assert.equal(normalize({ mode: "wrong", difficulty: "wrong", muted: "yes", record: { played: -9 } }).mode, "mode_solo");
  const fixed = normalize({ mode: "mode_duo", difficulty: "ai_master", record: { played: -9, goals: 4 } });
  assert.equal(fixed.mode, "mode_duo");
  assert.equal(fixed.difficulty, "ai_novice", "duo keeps a neutral difficulty");
  assert.equal(fixed.record.played, 0);
  assert.equal(fixed.record.goals, 4);
});

test("round-trip write and read keeps preferences", () => {
  const restore = install(fakeStorage());
  try {
    const next = save({ mode: "mode_solo", difficulty: "ai_master", firstShooter: "side_b", muted: true });
    assert.equal(next, true);
    const loaded = load();
    assert.equal(loaded.difficulty, "ai_master");
    assert.equal(loaded.firstShooter, "side_b");
    assert.equal(loaded.muted, true);
  } finally {
    restore();
  }
});

test("corrupt stored JSON falls back without throwing", () => {
  const restore = install(fakeStorage({ [KEY]: "{not json" }));
  try {
    assert.equal(load().mode, "mode_solo");
    assert.equal(load().record.played, 0);
  } finally {
    restore();
  }
});

test("recordMatch updates wins, goals and per-side best", () => {
  const restore = install(fakeStorage());
  try {
    let state = load();
    state = recordMatch(state, { score: { side_a: 3, side_b: 2 }, winner: "side_a" });
    state = recordMatch(state, { score: { side_a: 1, side_b: 4 }, winner: "side_b" });
    assert.equal(state.record.played, 2);
    assert.equal(state.record.side_a_wins, 1);
    assert.equal(state.record.side_b_wins, 1);
    assert.equal(state.record.goals, 10);
    assert.equal(state.best.side_a, 3);
    assert.equal(state.best.side_b, 4);
    assert.equal(load().record.played, 2);
  } finally {
    restore();
  }
});

test("restricted storage degrades to memory", () => {
  const restore = install({
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
    removeItem() { throw new Error("blocked"); },
  });
  try {
    assert.doesNotThrow(() => {
      const loaded = load();
      loaded.mode = "mode_duo";
      save(loaded);
      assert.equal(load().mode, "mode_duo", "memory backend keeps state in-process");
    });
  } finally {
    restore();
  }
});
