// storage.test.mjs - normalisation / engine replay / records / preferences
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY, MAX_SAVED_PLIES,
  emptyMeta, loadMeta, loadRun, loadSound, loadLocale, normalizeMeta, normalizeRun,
  recordResult, resetBackendForTests, saveLocale, saveMeta, saveRun, saveSound, clearRun,
} from "../js/storage.mjs";
import { EMPTY, createInitialState, applyMove, legalMoves } from "../js/engine.mjs";
import { MODES, OUTCOME } from "../js/game.mjs";
import { DIFFICULTY_MASTER, DIFFICULTY_INTERMEDIATE } from "../js/ai.mjs";

function sampleMoves(count = 6) {
  let state = createInitialState();
  const moves = [];
  for (let i = 0; i < count; i += 1) {
    const move = legalMoves(state)[0];
    moves.push({ from: move.from, to: move.to });
    state = applyMove(state, move);
  }
  return moves;
}

const session = (moves, extra = {}) => ({
  mode: MODES.PVE,
  difficulty: DIFFICULTY_MASTER,
  humanSide: 1,
  moves,
  ...extra,
});

beforeEach(() => {
  resetBackendForTests();
});

describe("storage: normalisation", () => {
  it("garbage meta falls back to safe defaults", () => {
    const base = emptyMeta();
    assert.deepEqual(normalizeMeta(null), base);
    assert.deepEqual(normalizeMeta("nope"), base);
    assert.deepEqual(normalizeMeta({ best: "x", save: "bad" }), base);
    const cleaned = normalizeMeta({
      sound: "yes",
      best: { wins: -3, losses: "abc", fewestPlies: 0, maxHops: 4.7 },
      save: { moves: [] },
    });
    assert.equal(cleaned.sound, true);
    assert.deepEqual(cleaned.best, { wins: 0, losses: 0, fewestPlies: null, maxHops: 0 });
    assert.deepEqual(cleaned.save, { moves: [] });
  });

  it("uses the game-specific versioned key", () => {
    assert.equal(STORAGE_KEY, "doin.checkers.v1");
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
      assert.equal(loadRun(), null);
      assert.equal(loadSound(), true);
      assert.equal(loadLocale(), "zh");
    } finally {
      if (previous === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = previous;
      resetBackendForTests();
    }
  });
});

describe("storage: run persistence", () => {
  it("round-trips a live position and keeps only from/to", () => {
    const moves = sampleMoves();
    assert.ok(saveRun(session(moves)));
    const restored = loadRun();
    assert.deepEqual(restored, session(moves));
    assert.deepEqual(Object.keys(restored.moves[0]), ["from", "to"]);
  });

  it("empty move list means a fresh game, not a null save", () => {
    assert.ok(saveRun(session([])));
    assert.deepEqual(loadRun(), session([]));
  });

  it("normalises bad mode / difficulty / side", () => {
    const cleaned = normalizeRun(session([], {
      mode: "???",
      difficulty: "???",
      humanSide: 99,
    }));
    assert.equal(cleaned.mode, MODES.PVE);
    assert.equal(cleaned.difficulty, DIFFICULTY_INTERMEDIATE);
    assert.equal(cleaned.humanSide, 1);
    assert.equal(normalizeRun(session([], { mode: MODES.PVP })).mode, MODES.PVP);
  });

  it("rejects malformed move lists without touching the existing save", () => {
    assert.ok(saveRun(session(sampleMoves())));
    const empty = createInitialState().board.findIndex((v) => v === EMPTY);
    const bad = [
      null,
      7,
      { moves: "x" },
      { moves: [{ from: -1, to: 1 }] },
      { moves: [{ from: 1, to: 1 }] },
      { moves: [{ from: 999, to: 1 }] },
      { moves: [{ from: 1, to: "2" }] },
      { moves: [{ from: empty, to: empty + 1 }] },
      { moves: new Array(MAX_SAVED_PLIES + 1).fill({ from: 0, to: 1 }) },
    ];
    for (const raw of bad) {
      assert.equal(normalizeRun(raw), null, `should reject ${JSON.stringify(raw)?.slice(0, 40)}`);
      assert.equal(saveRun(raw), false);
    }
    assert.ok(loadRun(), "a failed save must not erase a good one");
    // replay() also guards against a finished game: a tampered payload that
    // cannot be replayed to a live position is dropped on read.
    saveMeta({ ...emptyMeta(), save: { moves: [{ from: empty, to: empty + 1 }] } });
    assert.equal(loadRun(), null);
  });

  it("clearRun removes only the in-progress game", () => {
    saveSound(false);
    assert.ok(saveRun(session(sampleMoves())));
    assert.ok(clearRun());
    assert.equal(loadRun(), null);
    assert.equal(loadSound(), false);
  });
});

describe("storage: records and preferences", () => {
  it("records improve only on a faster win or a longer chain", () => {
    const first = recordResult({
      mode: MODES.PVE, humanOutcome: OUTCOME.WIN, plies: 42, maxHops: 5,
    });
    assert.equal(first.improved, true);
    assert.deepEqual(first.best, { wins: 1, losses: 0, fewestPlies: 42, maxHops: 5 });

    const slower = recordResult({
      mode: MODES.PVE, humanOutcome: OUTCOME.WIN, plies: 50, maxHops: 3,
    });
    assert.equal(slower.improved, false);
    assert.deepEqual(slower.best, { wins: 2, losses: 0, fewestPlies: 42, maxHops: 5 });

    recordResult({ mode: MODES.PVE, humanOutcome: OUTCOME.LOSS, plies: 60, maxHops: 1 });
    const pvp = recordResult({ mode: MODES.PVP, humanOutcome: null, plies: 70, maxHops: 9 });
    assert.equal(pvp.improved, true);
    assert.deepEqual(pvp.best, { wins: 2, losses: 1, fewestPlies: 42, maxHops: 9 });

    assert.equal(recordResult(null).improved, false);
    assert.equal(loadMeta().best.wins, 2);
  });

  it("sound and locale are independent and share the portal-wide locale key", () => {
    assert.equal(loadSound(), true);
    assert.equal(loadLocale(), "zh");
    saveSound(false);
    saveLocale("en");
    assert.equal(loadSound(), false);
    assert.equal(loadLocale(), "en");
    assert.equal(loadMeta().sound, false);
    assert.deepEqual(loadMeta().best, emptyMeta().best);
    saveLocale("fr");
    assert.equal(loadLocale(), "zh");
  });
});
