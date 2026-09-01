import assert from "node:assert/strict";
import test from "node:test";

import { createDailyLevel, todayKey } from "../js/daily.mjs";
import { canExtract, extractOrb, undo } from "../engine.mjs";
import { LEVELS, levelById } from "../levels.mjs";
import { createLevelState } from "../levels.mjs";

function counts(tracks) {
  return tracks.flat().reduce((result, color) => ({ ...result, [color]: (result[color] ?? 0) + 1 }), {});
}

test("daily challenge is deterministic for a local calendar day", () => {
  const dateKey = todayKey(new Date(2026, 8, 1));
  assert.equal(dateKey, "2026-09-01");
  assert.deepEqual(createDailyLevel(dateKey), createDailyLevel(dateKey));
});

test("one hundred daily seeds remain color-isomorphic to verified source levels", () => {
  const start = new Date(2026, 0, 1);
  for (let offset = 0; offset < 100; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const daily = createDailyLevel(todayKey(date));
    const source = levelById(daily.sourceLevelId);
    assert.ok(LEVELS.includes(source));
    assert.equal(daily.par, source.par);
    assert.deepEqual(Object.values(counts(daily.tracks)).sort(), Object.values(counts(source.tracks)).sort());
    assert.equal(daily.tracks.flat().length, source.tracks.flat().length);
  }
});

test("daily date identity survives state transitions and undo", () => {
  const level = createDailyLevel("2026-09-01");
  const state = createLevelState(level);
  const track = state.tracks.find((item) => canExtract(state, item.id));
  const extracted = extractOrb(state, track.id);
  assert.equal(extracted.dateKey, level.dateKey);
  assert.equal(undo(extracted).dateKey, level.dateKey);
});
