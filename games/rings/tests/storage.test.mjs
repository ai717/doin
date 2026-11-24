import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY, defaultState, normalize, load, save, resetBackendForTests, recordClear, recordMeta,
} from "../js/storage.mjs";
import { LEVEL_IDS } from "../js/levels.mjs";

test.beforeEach(() => resetBackendForTests());

test("key namespacing and defaults", () => {
  const s = defaultState();
  assert.equal(STORAGE_KEY, "doin.rings.v1");
  assert.equal(s.progress.lastLevel, LEVEL_IDS[0]);
  assert.equal(s.prefs.hint, true);
  assert.equal(s.prefs.mode, "unlink");
});

test("normalize replaces corrupt and hostile payloads with defaults", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize("bad"), defaultState());
  const weird = normalize({
    prefs: { mode: "explode", hint: "no", muted: 1 },
    progress: { lastLevel: "L999", cleared: ["L999", "L1", "L1"], bestMoves: { L1: -4, L2: 7 }, bestStars: { L1: 99 } },
  });
  assert.equal(weird.prefs.mode, "unlink");
  assert.equal(weird.prefs.hint, true);
  assert.equal(weird.prefs.muted, true);
  assert.equal(weird.progress.lastLevel, LEVEL_IDS[0]);
  assert.deepEqual(weird.progress.cleared, ["L1"]);
  assert.deepEqual(weird.progress.bestMoves, { L2: 7 });
  assert.deepEqual(weird.progress.bestStars, { L1: 3 });
});

test("round-trip through the guarded backend preserves normalized state", () => {
  const s = defaultState();
  s.progress.lastLevel = "L10";
  s.progress.cleared = ["L1", "L10"];
  s.progress.bestMoves = { L1: 5, L10: 341 };
  s.progress.bestStars = { L1: 3 };
  s.prefs.hint = false;
  assert.equal(save(s), true);
  const back = load();
  assert.equal(back.progress.lastLevel, "L10");
  assert.deepEqual(back.progress.cleared, ["L1", "L10"]);
  assert.equal(back.progress.bestMoves.L10, 341);
  assert.equal(back.prefs.hint, false);
});

test("recordClear keeps best moves and stars, detects new records", () => {
  const base = defaultState();
  const first = recordClear(base, "L1", 9, 2);
  assert.equal(first.isBestMoves, true);
  assert.equal(first.isBestStars, true);
  assert.equal(first.state.progress.bestMoves.L1, 9);
  const worse = recordClear(first.state, "L1", 12, 1);
  assert.equal(worse.isBestMoves, false);
  assert.equal(worse.state.progress.bestMoves.L1, 9);
  assert.equal(worse.state.progress.bestStars.L1, 2);
  const best = recordClear(worse.state, "L1", 5, 3);
  assert.equal(best.isBestMoves, true);
  assert.equal(best.state.progress.bestMoves.L1, 5);
  assert.equal(best.state.progress.bestStars.L1, 3);
  assert.deepEqual(best.state.progress.cleared, ["L1"]);
  assert.deepEqual(base.progress.cleared, [], "input never mutated");
});

test("recordMeta updates shared recent list and star total", () => {
  const s = defaultState();
  recordMeta({ slug: "rings", stars: 3 });
  const r = recordMeta({ slug: "rings", stars: 2 });
  assert.equal(r, true);
  const raw = globalThis.localStorage?.getItem("doin.meta.v1");
  if (raw) {
    const meta = JSON.parse(raw);
    assert.equal(meta.recentlyPlayed[0], "rings");
    assert.equal(meta.totalStars, 5);
  }
});
