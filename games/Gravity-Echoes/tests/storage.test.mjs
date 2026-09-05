import test from "node:test";
import assert from "node:assert/strict";

import { loadSaveData, saveGameRecord, saveSoundSetting } from "../js/storage.mjs";

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test("storage normalizes corrupt values and preserves the best record", () => {
  const original = globalThis.localStorage;
  const storage = createStorage();
  globalThis.localStorage = storage;

  storage.setItem("doin.Gravity-Echoes.v1", JSON.stringify({ highScore: -4, highestSector: 0, totalGamesPlayed: -1 }));
  assert.deepEqual(loadSaveData(), {
    highScore: 0,
    highestSector: 1,
    totalGamesPlayed: 0,
    soundEnabled: true,
    updatedAt: 0,
  });

  assert.equal(saveGameRecord({ score: 250, sector: 3 }).highScore, 250);
  assert.equal(saveGameRecord({ score: 40, sector: 1 }).highScore, 250);
  assert.equal(loadSaveData().totalGamesPlayed, 2);

  globalThis.localStorage = original;
});

test("storage writes sound preferences and stays safe when storage is unavailable", () => {
  const original = globalThis.localStorage;
  const storage = createStorage();
  globalThis.localStorage = storage;

  saveSoundSetting(false);
  assert.equal(loadSaveData().soundEnabled, false);

  delete globalThis.localStorage;
  assert.doesNotThrow(() => saveSoundSetting(true));
  assert.equal(saveGameRecord({ score: 12, sector: 2 }).highScore, 12);

  globalThis.localStorage = original;
});
