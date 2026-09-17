import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  getDefaultState,
  normalizeState,
  loadSavedState,
  saveState,
} from "../js/storage.mjs";

test("storage: key conforms to doin.number-klotski.v1", () => {
  assert.equal(STORAGE_KEY, "doin.number-klotski.v1");
});

test("storage: getDefaultState returns expected initial data shape", () => {
  const def = getDefaultState();
  assert.equal(def.soundEnabled, true);
  assert.equal(def.keyMode, "push-tile");
  assert.equal(def.ladderMaxStage, 1);
  assert.deepEqual(def.bestTimes, { 3: null, 4: null, 5: null });
  assert.deepEqual(def.bestMoves, { 3: null, 4: null, 5: null });
});

test("storage: normalizeState heals damaged or corrupted values safely", () => {
  const corrupt = {
    bestTimes: { 3: "invalid", 4: -5, 5: 32.5 },
    bestMoves: { 3: 40.2, 4: null },
    ladderMaxStage: -9,
    soundEnabled: "yes", // should be boolean
    keyMode: "bad-mode",
  };

  const norm = normalizeState(corrupt);
  assert.equal(norm.bestTimes[3], null);
  assert.equal(norm.bestTimes[4], null);
  assert.equal(norm.bestTimes[5], 32.5);
  assert.equal(norm.bestMoves[3], 40); // floored
  assert.equal(norm.ladderMaxStage, 1); // fallback
  assert.equal(norm.soundEnabled, true); // fallback
  assert.equal(norm.keyMode, "push-tile"); // fallback
});

test("storage: saveState and loadSavedState work with memory fallback", () => {
  const initial = loadSavedState();
  assert.ok(initial);

  const updated = {
    ...initial,
    soundEnabled: false,
    ladderMaxStage: 5,
    bestTimes: { ...initial.bestTimes, 4: 18.2 },
  };

  saveState(updated);
  const loaded = loadSavedState();
  assert.equal(loaded.soundEnabled, false);
  assert.equal(loaded.ladderMaxStage, 5);
  assert.equal(loaded.bestTimes[4], 18.2);
});
