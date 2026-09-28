import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loadGameData,
  saveGameData,
  recordLevelCompletion,
  getCompletedLevel,
  saveCustomLevel,
  getCustomLevels,
  setSoundEnabled,
  isSoundEnabled,
  resetAllProgress,
} from "../js/storage.mjs";

describe("Picross Storage Tests", () => {
  it("loads default game data safely", () => {
    resetAllProgress();
    const data = loadGameData();
    assert.ok(data);
    assert.equal(data.version, 1);
    assert.equal(data.currentLevelId, "p1");
    assert.deepEqual(data.completedLevels, {});
    assert.equal(data.soundEnabled, true);
  });

  it("records and updates level completion", () => {
    resetAllProgress();
    recordLevelCompletion("p1", 2, 45000);
    let record = getCompletedLevel("p1");
    assert.equal(record.stars, 2);
    assert.equal(record.bestTimeMs, 45000);

    // Better run: 3 stars and faster time
    recordLevelCompletion("p1", 3, 32000);
    record = getCompletedLevel("p1");
    assert.equal(record.stars, 3);
    assert.equal(record.bestTimeMs, 32000);

    // Worse run: 1 star and slower time should not overwrite best
    recordLevelCompletion("p1", 1, 60000);
    record = getCompletedLevel("p1");
    assert.equal(record.stars, 3);
    assert.equal(record.bestTimeMs, 32000);
  });

  it("saves and retrieves custom levels", () => {
    resetAllProgress();
    const custom = {
      id: "custom_test_1",
      chapterKey: "chapter_custom",
      titleKey: "chapter_custom",
      rows: 5,
      cols: 5,
      target: [[1, 0], [0, 1]],
    };
    saveCustomLevel(custom);
    const list = getCustomLevels();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, "custom_test_1");
  });

  it("manages sound toggle", () => {
    setSoundEnabled(false);
    assert.equal(isSoundEnabled(), false);
    setSoundEnabled(true);
    assert.equal(isSoundEnabled(), true);
  });
});
