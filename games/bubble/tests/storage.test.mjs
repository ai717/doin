import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRecord,
  saveRecord,
  loadRecord,
  recordMatchResult,
} from "../js/storage.mjs";

describe("storage.mjs persistence and normalization", () => {
  it("normalizeRecord returns safe defaults on junk", () => {
    const empty = normalizeRecord(null);
    assert.equal(empty.version, 1);
    assert.equal(empty.wins, 0);
    assert.deepEqual(empty.unlockedMaps, ["map_pool"]);

    const corrupt = normalizeRecord({
      wins: -10,
      unlockedMaps: ["non_existent_map"],
      mapStars: "bad",
    });
    assert.equal(corrupt.wins, 0);
    assert.deepEqual(corrupt.unlockedMaps, ["map_pool"]);
  });

  it("save and load roundtrip", () => {
    saveRecord({
      wins: 8,
      losses: 2,
      totalPopped: 14,
    });
    const loaded = loadRecord();
    assert.equal(loaded.wins, 8);
    assert.equal(loaded.losses, 2);
    assert.equal(loaded.totalPopped, 14);
  });

  it("recordMatchResult unlocks next map on win", () => {
    recordMatchResult("map_pool", true, 3, 2);
    const loaded = loadRecord();
    assert.ok(loaded.unlockedMaps.includes("map_isles"));
    assert.equal(loaded.mapStars.map_pool, 3);
  });
});
