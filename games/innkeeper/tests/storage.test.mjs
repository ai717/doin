import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRecord,
  saveRecord,
  loadRecord,
  recordShiftResult,
  buyUpgrade,
} from "../js/storage.mjs";

describe("storage.mjs persistence and normalization", () => {
  it("normalizeRecord returns safe defaults on junk", () => {
    const empty = normalizeRecord(null);
    assert.equal(empty.version, 1);
    assert.equal(empty.totalSilver, 0);
    assert.deepEqual(empty.unlockedShifts, ["shift_lunch"]);
    assert.equal(empty.upgrades.tray, false);

    const corrupt = normalizeRecord({
      totalSilver: -500,
      unlockedShifts: ["invalid_shift"],
      upgrades: "junk",
    });
    assert.equal(corrupt.totalSilver, 0);
    assert.deepEqual(corrupt.unlockedShifts, ["shift_lunch"]);
    assert.equal(corrupt.upgrades.tray, false);
  });

  it("save and load roundtrip", () => {
    saveRecord({
      totalSilver: 350,
      upgrades: { tray: true, kettle: false, helper: false },
    });
    const loaded = loadRecord();
    assert.equal(loaded.totalSilver, 350);
    assert.equal(loaded.upgrades.tray, true);
  });

  it("recordShiftResult unlocks subsequent shifts", () => {
    recordShiftResult("shift_lunch", 220, 2);
    const loaded = loadRecord();
    assert.ok(loaded.unlockedShifts.includes("shift_dinner"));
  });

  it("buyUpgrade checks silver and updates record", () => {
    saveRecord({ totalSilver: 500, upgrades: { tray: false, kettle: false, helper: false } });
    const success = buyUpgrade("tray", 200);
    assert.equal(success, true);
    assert.equal(loadRecord().totalSilver, 300);
    assert.equal(loadRecord().upgrades.tray, true);

    // Cannot buy again
    const secondBuy = buyUpgrade("tray", 200);
    assert.equal(secondBuy, false);

    // Cannot buy if not enough silver
    const tooExpensive = buyUpgrade("helper", 500);
    assert.equal(tooExpensive, false);
  });
});
