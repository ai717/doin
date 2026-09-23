// tests/storage.test.mjs — 存档模块测试
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  defaultState, defaultPrefs, normalize, load, save, resetAll,
  setMuted, savePuzzleProgress, saveCanvas, removeCanvas,
  STORAGE_KEY, SCHEMA_VERSION, MAX_CANVAS_SLOTS, resetBackendForTests,
} from "../js/storage.mjs";

describe("storage defaults", () => {
  beforeEach(() => resetAll());

  it("defaultState has correct structure", () => {
    const d = defaultState();
    assert.equal(d.version, SCHEMA_VERSION);
    assert.equal(typeof d.prefs, "object");
    assert.equal(d.prefs.muted, false);
    assert.ok(Array.isArray(d.canvases));
    assert.equal(typeof d.puzzleProgress, "object");
  });

  it("defaultPrefs", () => {
    const p = defaultPrefs();
    assert.equal(p.muted, false);
    assert.equal(p.locale, null);
  });
});

describe("normalize", () => {
  it("returns default for null input", () => {
    const n = normalize(null);
    assert.equal(n.version, SCHEMA_VERSION);
  });

  it("returns default for non-object input", () => {
    assert.equal(normalize("string").version, SCHEMA_VERSION);
    assert.equal(normalize(123).version, SCHEMA_VERSION);
  });

  it("preserves valid prefs", () => {
    const n = normalize({ version: 1, prefs: { muted: true }, puzzleProgress: {}, canvases: [] });
    assert.equal(n.prefs.muted, true);
  });

  it("coerces invalid muted to boolean", () => {
    const n = normalize({ version: 1, prefs: { muted: "true" }, puzzleProgress: {}, canvases: [] });
    assert.equal(n.prefs.muted, true);
  });

  it("limits canvas array to MAX_CANVAS_SLOTS", () => {
    const tooMany = { version: 1, prefs: {}, puzzleProgress: {}, canvases: new Array(10).fill("data") };
    const n = normalize(tooMany);
    assert.ok(n.canvases.length <= MAX_CANVAS_SLOTS);
  });
});

describe("save/load round-trip", () => {
  beforeEach(() => resetAll());

  it("saves and loads state", () => {
    const state = defaultState();
    state.prefs.muted = true;
    const saved = save(state);
    assert.equal(saved.prefs.muted, true);
    const loaded = load();
    assert.equal(loaded.prefs.muted, true);
  });

  it("load returns default when storage empty", () => {
    const loaded = load();
    assert.equal(loaded.version, SCHEMA_VERSION);
  });
});

describe("mutations", () => {
  beforeEach(() => resetAll());

  it("setMuted toggles preference", () => {
    const state = defaultState();
    const next = setMuted(state, true);
    assert.equal(next.prefs.muted, true);
    assert.equal(state.prefs.muted, false); // original unchanged
  });

  it("savePuzzleProgress records stars", () => {
    const state = defaultState();
    const next = savePuzzleProgress(state, 5, 2);
    assert.equal(next.puzzleProgress[5].stars, 2);
  });

  it("savePuzzleProgress only increases stars", () => {
    const state = savePuzzleProgress(defaultState(), 3, 3);
    const next = savePuzzleProgress(state, 3, 1);
    assert.equal(next.puzzleProgress[3].stars, 3);
  });

  it("saveCanvas stores data at slot", () => {
    const state = defaultState();
    const next = saveCanvas(state, 0, "canvas-json");
    assert.equal(next.canvases[0], "canvas-json");
  });

  it("saveCanvas rejects out-of-range slots", () => {
    const state = defaultState();
    const next = saveCanvas(state, MAX_CANVAS_SLOTS, "data");
    assert.equal(next, state); // unchanged
  });

  it("removeCanvas clears slot", () => {
    const state = saveCanvas(defaultState(), 1, "data");
    const next = removeCanvas(state, 1);
    assert.equal(next.canvases[1], null);
  });

  it("resetAll clears all data", () => {
    save(setMuted(defaultState(), true));
    const cleared = resetAll();
    assert.equal(cleared.prefs.muted, false);
    const loaded = load();
    assert.equal(loaded.prefs.muted, false);
  });
});