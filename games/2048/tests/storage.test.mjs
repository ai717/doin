import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { createState } from "../js/engine.mjs";
import {
  BEST_KEY,
  DEFAULT_PREFS,
  EMPTY_STATS,
  SAVE_KEY,
  SAVE_VERSION,
  clearSave,
  loadBest,
  loadPrefs,
  loadSave,
  loadStats,
  noteBestTile,
  noteGame,
  noteWin,
  savePrefs,
  writeSave,
} from "../js/storage.mjs";

const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installStorage(options = {}) {
  const map = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key) => (map.has(key) ? map.get(key) : null),
      setItem: (key, value) => {
        if (options.throwOnWrite) throw new Error("QuotaExceededError");
        map.set(key, String(value));
      },
      removeItem: (key) => void map.delete(key),
    },
  });
  return map;
}

function stateWith(tiles, patch = {}) {
  return {
    ...createState(0),
    tiles: tiles.map((tile, index) => ({ id: index + 1, kind: "idle", ...tile })),
    nextId: tiles.length + 1,
    ...patch,
  };
}

beforeEach(() => installStorage());
afterEach(() => {
  if (original) Object.defineProperty(globalThis, "localStorage", original);
  else delete globalThis.localStorage;
});

describe("empty storage", () => {
  it("falls back to defaults everywhere", () => {
    assert.equal(loadSave(), null);
    assert.equal(loadBest(), 0);
    assert.deepEqual(loadStats(), { ...EMPTY_STATS });
    assert.deepEqual(loadPrefs(), { ...DEFAULT_PREFS });
  });
});

describe("save round trip", () => {
  it("restores the board, the score, and the undo snapshot", () => {
    const live = stateWith(
      [
        { value: 2, row: 0, col: 0, kind: "merged" },
        { value: 8, row: 1, col: 2, kind: "new" },
      ],
      { score: 12, best: 40, won: false, over: false, nextId: 9 },
    );
    const undo = stateWith([{ value: 4, row: 0, col: 1 }], { score: 4, nextId: 7 });

    writeSave(live, undo);
    const restored = loadSave();

    assert.deepEqual(restored.state.tiles, [
      { id: 1, value: 2, row: 0, col: 0, kind: "idle" },
      { id: 2, value: 8, row: 1, col: 2, kind: "idle" },
    ]);
    assert.equal(restored.state.score, 12);
    assert.equal(restored.state.best, 40);
    assert.equal(restored.state.nextId, 9);
    assert.equal(restored.undo.score, 4);
    assert.equal(restored.undo.best, 40);
    assert.equal(JSON.parse(globalThis.localStorage.getItem(SAVE_KEY)).version, SAVE_VERSION);
  });

  it("never lets best drop below the stored record", () => {
    globalThis.localStorage.setItem(BEST_KEY, "5120");
    const live = stateWith([{ value: 2, row: 0, col: 0 }], { best: 12 });
    writeSave(live, null);
    assert.equal(loadSave().state.best, 5120);
    assert.equal(loadBest(), 5120);
  });

  it("keeps best after the board is cleared", () => {
    writeSave(stateWith([{ value: 2, row: 0, col: 0 }], { best: 900 }), null);
    clearSave();
    assert.equal(loadSave(), null);
    assert.equal(loadBest(), 900);
  });
});

describe("corrupted payloads", () => {
  it("rejects junk instead of throwing", () => {
    for (const junk of ["", "not json", "[]", "null", '{"tiles":{}}', '{"tiles":[]}']) {
      globalThis.localStorage.setItem(SAVE_KEY, junk);
      assert.equal(loadSave(), null);
    }
  });

  it("drops tiles that cannot exist", () => {
    globalThis.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        tiles: [
          { id: 1, value: 2, row: 0, col: 0 },
          { id: 2, value: 0, row: 1, col: 1 },
          { id: 3, value: 8, row: 9, col: 0 },
          { id: 4, value: 8, row: 0, col: -1 },
          { id: 5, value: 4.5, row: 2, col: 2 },
          { value: 4, row: 3, col: 3 },
          null,
        ],
        score: 4,
        nextId: 7,
      }),
    );
    const restored = loadSave();
    assert.deepEqual(restored.state.tiles, [{ id: 1, value: 2, row: 0, col: 0, kind: "idle" }]);
  });

  it("keeps only the first tile on a shared cell", () => {
    globalThis.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        tiles: [
          { id: 1, value: 2, row: 2, col: 2 },
          { id: 2, value: 4, row: 2, col: 2 },
          { id: 3, value: 8, row: 0, col: 1 },
        ],
        nextId: 4,
      }),
    );
    assert.deepEqual(loadSave().state.tiles, [
      { id: 1, value: 2, row: 2, col: 2, kind: "idle" },
      { id: 3, value: 8, row: 0, col: 1, kind: "idle" },
    ]);
  });

  it("repairs broken numbers and flags", () => {
    globalThis.localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        tiles: [{ id: 1, value: 2, row: 0, col: 0 }],
        score: "oops",
        best: -5,
        won: "yes",
        over: 1,
        nextId: 0,
      }),
    );
    const state = loadSave().state;
    assert.equal(state.score, 0);
    assert.equal(state.best, 0);
    assert.equal(state.won, false);
    assert.equal(state.over, false);
    assert.equal(state.nextId, 1);
  });
});

describe("stats", () => {
  it("counts games and wins independently", () => {
    let stats = loadStats();
    stats = noteGame(stats);
    stats = noteGame(stats);
    stats = noteWin(stats);
    assert.deepEqual(loadStats(), { games: 2, wins: 1, bestTile: 0 });
  });

  it("only raises the best tile record", () => {
    let stats = noteBestTile(loadStats(), 128);
    stats = noteBestTile(stats, 64);
    assert.equal(stats.bestTile, 128);
    stats = noteBestTile(stats, 256);
    assert.equal(loadStats().bestTile, 256);
  });

  it("survives corrupted counters", () => {
    globalThis.localStorage.setItem("doin.2048.stats", '{"games":"x","wins":null,"bestTile":-3}');
    assert.deepEqual(loadStats(), { games: 0, wins: 0, bestTile: 0 });
  });
});

describe("preferences", () => {
  it("stores and merges patches", () => {
    const next = savePrefs({ theme: "dark" });
    assert.deepEqual(next, { locale: "zh", theme: "dark", muted: false });
    assert.deepEqual(loadPrefs(), next);
    assert.deepEqual(savePrefs({ muted: true }), { locale: "zh", theme: "dark", muted: true });
  });

  it("replaces unknown values with the defaults", () => {
    savePrefs({ locale: "fr", theme: "neon", muted: "yes" });
    assert.deepEqual(loadPrefs(), { locale: "zh", theme: "light", muted: false });
  });
});

describe("when web storage refuses to write", () => {
  it("keeps the session working from memory", async () => {
    installStorage({ throwOnWrite: true });
    const offline = await import("../js/storage.mjs?offline=1");
    const live = offline.loadSave();
    assert.equal(live, null);

    offline.writeSave({ ...createState(0), tiles: [{ id: 1, value: 2, row: 0, col: 0, kind: "idle" }], score: 8, best: 8, nextId: 2 }, null);
    const restored = offline.loadSave();
    assert.equal(restored.state.score, 8);
    assert.equal(restored.state.tiles.length, 1);
    assert.equal(offline.loadBest(), 8);
  });
});
