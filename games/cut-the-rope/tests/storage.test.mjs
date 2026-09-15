import test from "node:test";
import assert from "node:assert/strict";
import { loadSaveData, saveSaveData, recordLevelClear } from "../js/storage.mjs";

test("storage: initial load returns clean defaults without throwing", () => {
  const data = loadSaveData();
  assert.ok(data && typeof data === "object");
  assert.equal(data.version, 1);
  assert.equal(typeof data.currentLevel, "number");
  assert.equal(typeof data.soundEnabled, "boolean");
  assert.equal(typeof data.levels, "object");
});

test("storage: recordLevelClear updates stars and bestTime correctly", () => {
  const updated = recordLevelClear(1, 3, 2.45);
  assert.ok(updated.levels[1]);
  assert.equal(updated.levels[1].stars, 3);
  assert.equal(updated.levels[1].bestTime, 2.45);

  // 再次通关但星数更低，应保留更高星数
  const updated2 = recordLevelClear(1, 2, 3.10);
  assert.equal(updated2.levels[1].stars, 3);
});

test("storage: corrupted data fallback normalization", () => {
  const corrupted = {
    version: "bad",
    currentLevel: -999,
    soundEnabled: "maybe",
    levels: "invalid"
  };
  const saved = saveSaveData(corrupted);
  assert.equal(saved.currentLevel, 1);
  assert.equal(typeof saved.soundEnabled, "boolean");
  assert.deepEqual(saved.levels, {});
});
