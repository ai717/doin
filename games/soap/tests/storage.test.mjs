import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY, defaultState, normalize, load, save, resetBackendForTests,
  recordFinish, recordMeta,
} from "../js/storage.mjs";
import { SOAP_IDS, TOOL_IDS } from "../js/soaps.mjs";

// Provide a controllable localStorage stub for these tests.
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
};

test.beforeEach(() => {
  memory.clear();
  resetBackendForTests();
});

test("storage key is namespaced and schema versioned", () => {
  assert.equal(STORAGE_KEY, "doin.soap.v1");
  assert.equal(defaultState().version, 1);
});

test("corrupt or partial data normalizes to defaults", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize(undefined), defaultState());
  assert.deepEqual(normalize("bad"), defaultState());
  const partial = normalize({ prefs: { tool: "nope", muted: "yes", lastSoap: "ghost" } });
  assert.equal(partial.prefs.tool, "tool_knife");
  assert.equal(partial.prefs.muted, true);
  assert.equal(partial.prefs.lastSoap, SOAP_IDS[0]);
});

test("normalize filters unknown completed soaps and clamps evenness", () => {
  const state = normalize({
    prefs: { tool: "tool_peeler", muted: false, lastSoap: "soap_jelly_berry" },
    progress: {
      completed: ["soap_classic_white", "fake", "soap_classic_white", 3],
      bestEvenness: { soap_classic_white: 5, soap_classic_pink: -2 },
      soapsCut: -9,
    },
  });
  assert.deepEqual(state.progress.completed, ["soap_classic_white"]);
  assert.equal(state.progress.bestEvenness.soap_classic_white, 1);
  assert.equal(state.progress.bestEvenness.soap_classic_pink, 0);
  assert.equal(state.progress.soapsCut, 0);
  assert.equal(state.prefs.tool, "tool_peeler");
});

test("round trip read/write preserves valid state", () => {
  const state = defaultState();
  state.prefs.tool = "tool_scraper";
  state.prefs.muted = true;
  state.prefs.lastSoap = "soap_shape_star";
  assert.equal(save(state), true);
  const loaded = load();
  assert.deepEqual(loaded.prefs, state.prefs);
  assert.equal(loaded.version, 1);
});

test("load falls back when stored JSON is broken", () => {
  memory.set(STORAGE_KEY, "{not json");
  assert.deepEqual(load(), defaultState());
});

test("memory fallback keeps working when localStorage throws", () => {
  globalThis.localStorage = {
    getItem() { throw new Error("denied"); },
    setItem() { throw new Error("denied"); },
    removeItem() { throw new Error("denied"); },
  };
  resetBackendForTests();
  const state = defaultState();
  state.prefs.tool = "tool_peeler";
  assert.equal(save(state), true);
  assert.equal(load().prefs.tool, "tool_peeler");
  globalThis.localStorage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
});

test("recordFinish is pure and keeps the best finesse", () => {
  const state = defaultState();
  const first = recordFinish(state, "soap_classic_white", 0.5);
  assert.equal(first.isBest, true);
  assert.deepEqual(state.progress.completed, []);
  const second = recordFinish(first.state, "soap_classic_white", 0.3);
  assert.equal(second.isBest, false);
  assert.equal(second.state.progress.bestEvenness.soap_classic_white, 0.5);
  assert.equal(second.state.progress.soapsCut, 2);
  assert.deepEqual(second.state.progress.completed, ["soap_classic_white"]);
});

test("recordMeta updates shared recentlyPlayed and totalStars without throwing", () => {
  assert.equal(recordMeta({ slug: "soap", stars: 3, score: 88 }), true);
  const meta = JSON.parse(memory.get("doin.meta.v1"));
  assert.deepEqual(meta.recentlyPlayed.slice(0, 1), ["soap"]);
  assert.equal(meta.totalStars, 3);
  assert.equal(recordMeta({ slug: "soap", stars: 2 }), true);
  assert.equal(JSON.parse(memory.get("doin.meta.v1")).totalStars, 5);
});

test("tool ids are exactly the three catalogued tools", () => {
  assert.deepEqual(TOOL_IDS, ["tool_knife", "tool_scraper", "tool_peeler"]);
});
