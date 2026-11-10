// storage.test.mjs - normalisation / progress / drafts / preferences
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_LINES, STORAGE_KEY,
  clearDraft, emptyMeta, loadDraft, loadLastLevel, loadLocale, loadMeta, loadProgress,
  loadSound, normalizeMeta, recordLevel, resetBackendForTests, saveDraft, saveLastLevel,
  saveLocale, saveMeta, saveSound,
} from "../js/storage.mjs";
import { getLevel, LEVEL_COUNT, LEVELS, starsFor } from "../js/levels.mjs";

const PAR = LEVELS[0].par;

beforeEach(() => {
  resetBackendForTests();
});

describe("storage: normalisation", () => {
  it("garbage meta falls back to safe defaults", () => {
    const base = emptyMeta();
    assert.deepEqual(normalizeMeta(null), base);
    assert.deepEqual(normalizeMeta("nope"), base);
    assert.deepEqual(normalizeMeta({ progress: "x", drafts: 7 }), base);
    const cleaned = normalizeMeta({ sound: "yes", last: 999, progress: { 1: "x" }, drafts: [] });
    assert.equal(cleaned.sound, true);
    assert.equal(cleaned.last, 1);
    assert.deepEqual(cleaned.progress, {});
    assert.deepEqual(cleaned.drafts, {});
  });

  it("uses the game-specific versioned key", () => {
    assert.equal(STORAGE_KEY, "doin.robot.v1");
  });

  it("drops unknown level ids and clamps impossible line counts", () => {
    const l2 = getLevel(2);
    const meta = normalizeMeta({
      last: LEVEL_COUNT + 5,
      progress: { 1: PAR - 2, 2: l2.par + 1, [LEVEL_COUNT + 1]: 3, 3: 0, 4: MAX_LINES + 1 },
    });
    assert.equal(meta.last, 1);
    assert.equal(meta.progress[1], PAR, "a clear can never beat the proven par");
    assert.equal(meta.progress[2], l2.par + 1);
    assert.ok(!(LEVEL_COUNT + 1 in meta.progress));
    assert.ok(!(3 in meta.progress));
  });

  it("a corrupt JSON payload never throws", () => {
    const previous = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: () => "{not json",
      setItem: () => {},
      removeItem: () => {},
    };
    try {
      assert.deepEqual(loadMeta(), emptyMeta());
      assert.equal(loadSound(), true);
      assert.equal(loadLocale(), "zh");
      assert.equal(loadDraft(1), null);
      assert.equal(loadProgress().clearedCount, 0);
    } finally {
      if (previous === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previous;
      resetBackendForTests();
    }
  });
});

describe("storage: progress", () => {
  it("records the best line count and derives stars from par", () => {
    assert.equal(starsFor(getLevel(1), PAR), 3);
    const first = recordLevel(1, PAR + 3);
    assert.deepEqual(first, { improved: true, stars: 1, best: PAR + 3 });
    assert.equal(loadProgress().clearedCount, 1);
    assert.equal(loadProgress().totalStars, 1);

    const better = recordLevel(1, PAR);
    assert.deepEqual(better, { improved: true, stars: 3, best: PAR });
    assert.equal(loadProgress().totalStars, 3);

    const worse = recordLevel(1, PAR + 1);
    assert.equal(worse.improved, false);
    assert.equal(worse.stars, 3);
    assert.equal(loadProgress().bestLines[1], PAR);
  });

  it("rejects unknown levels and impossible counts without writing", () => {
    assert.deepEqual(recordLevel(0, PAR), { improved: false, stars: 0, best: null });
    assert.deepEqual(recordLevel(LEVEL_COUNT + 1, PAR), { improved: false, stars: 0, best: null });
    assert.deepEqual(recordLevel(1, 0), { improved: false, stars: 0, best: null });
    assert.deepEqual(recordLevel(1, 2.5), { improved: false, stars: 0, best: null });
    assert.equal(loadProgress().clearedCount, 0);
  });

  it("progress survives a reload and reports the star ceiling", () => {
    const [l1, l2, l3] = [getLevel(1), getLevel(2), getLevel(3)];
    recordLevel(1, l1.par);
    recordLevel(2, l2.par);
    recordLevel(3, l3.par + 1);
    const progress = loadProgress();
    assert.equal(progress.clearedCount, 3);
    assert.equal(progress.maxStars, LEVEL_COUNT * 3);
    assert.deepEqual(progress.bestLines, { 1: l1.par, 2: l2.par, 3: l3.par + 1 });
    assert.equal(progress.cleared[1], 3);
    assert.equal(progress.cleared[2], 3);
    assert.equal(progress.cleared[3], 2);
    assert.equal(loadMeta().progress[2], l2.par);
  });
});

describe("storage: drafts", () => {
  it("round-trips a program through the engine codec", () => {
    const entry = getLevel(1);
    const program = { main: ["F", "A", ""], proc1: [] };
    assert.ok(saveDraft(1, program));
    const loaded = loadDraft(1);
    assert.deepEqual(loaded.main.slice(0, 3), ["F", "A", ""]);
    assert.equal(loaded.main.length, entry.spec.slots.main);
    assert.equal(loaded.proc1.length, entry.spec.slots.proc1);
  });

  it("invalid tile codes degrade to empty slots instead of throwing", () => {
    saveDraft(1, { main: ["F", "Q", "f:z", "A:r", 42, null] });
    const loaded = loadDraft(1);
    assert.deepEqual(loaded.main.slice(0, 6), ["F", "", "", "A:r", "", ""]);
  });

  it("an empty program removes the draft entry", () => {
    saveDraft(1, { main: ["F"] });
    assert.ok(loadDraft(1));
    saveDraft(1, { main: ["", ""] });
    assert.equal(loadDraft(1), null);
    assert.ok(!("1" in loadMeta().drafts));
  });

  it("clearDraft is idempotent and ignores unknown ids", () => {
    saveDraft(2, { main: ["F"] });
    assert.ok(clearDraft(2));
    assert.equal(loadDraft(2), null);
    assert.ok(clearDraft(2));
    assert.equal(clearDraft(LEVEL_COUNT + 3), false);
    assert.equal(saveDraft(0, { main: ["F"] }), false);
  });
});

describe("storage: preferences", () => {
  it("remembers the last stage within bounds", () => {
    assert.equal(loadLastLevel(), 1);
    assert.ok(saveLastLevel(7));
    assert.equal(loadLastLevel(), 7);
    assert.equal(saveLastLevel(999), false);
    assert.equal(loadLastLevel(), 7);
  });

  it("sound and locale are independent and share the portal-wide locale key", () => {
    assert.equal(loadSound(), true);
    assert.equal(loadLocale(), "zh");
    saveSound(false);
    saveLocale("en");
    assert.equal(loadSound(), false);
    assert.equal(loadLocale(), "en");
    assert.equal(loadMeta().sound, false);
    saveLocale("fr");
    assert.equal(loadLocale(), "zh");
  });

  it("a throwing localStorage degrades to memory instead of throwing", () => {
    const previous = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => { throw new Error("quota"); },
      removeItem: () => {},
    };
    try {
      resetBackendForTests();
      assert.ok(saveLastLevel(6));
      assert.equal(loadLastLevel(), 6, "the memory fallback keeps the write");
      assert.ok(saveSound(false));
      assert.equal(loadSound(), false);
    } finally {
      if (previous === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previous;
      resetBackendForTests();
    }
  });
});
