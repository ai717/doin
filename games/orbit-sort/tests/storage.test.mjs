import assert from "node:assert/strict";
import test from "node:test";

import { isValidStoredState, loadProgress, recordCompletion, recordDailyCompletion, saveCurrentGame, saveSoundPreference } from "../js/storage.mjs";
import { createLevelState, levelById } from "../levels.mjs";

function installStorage(value = null) {
  let stored = value;
  globalThis.localStorage = {
    getItem() { return stored; },
    setItem(_key, next) { stored = next; },
  };
  return () => stored;
}

test("sound preference defaults on and keeps legacy progress playable", () => {
  installStorage(JSON.stringify({ version: 1, unlockedLevel: 4, bestByLevel: {}, currentGame: null }));
  assert.equal(loadProgress().settings.soundOn, true);

  installStorage(null);
  assert.equal(loadProgress().settings.soundOn, true);
});

test("sound preference persists through progress updates and completion", () => {
  const readStored = installStorage();
  let progress = saveSoundPreference(loadProgress(), false);
  assert.equal(JSON.parse(readStored()).settings.soundOn, false);

  ({ progress } = recordCompletion(progress, { id: 1, par: 5 }, 5));
  assert.equal(progress.settings.soundOn, false);
  assert.equal(JSON.parse(readStored()).settings.soundOn, false);
});

test("daily completion preserves the same-day best and increments only once", () => {
  installStorage();
  let progress = loadProgress();
  ({ progress } = recordDailyCompletion(progress, "2026-09-01", 12));
  ({ progress } = recordDailyCompletion(progress, "2026-09-01", 10));
  assert.equal(progress.daily.streak, 1);
  assert.equal(progress.daily.bestMoves, 10);
  assert.equal(progress.daily.lastCompletedDate, "2026-09-01");
});

test("daily streak continues only on consecutive local dates and stores its game separately", () => {
  installStorage();
  let progress = loadProgress();
  ({ progress } = recordDailyCompletion(progress, "2026-09-01", 8));
  ({ progress } = recordDailyCompletion(progress, "2026-09-02", 9));
  assert.equal(progress.daily.streak, 2);
  progress = saveCurrentGame(progress, { levelId: "daily", dateKey: "2026-09-03", moves: 2 });
  assert.equal(progress.currentGame, null);
  assert.equal(progress.daily.currentGame.moves, 2);
});

test("stored game validation rejects duplicate orbs, bad colors, and structural mismatches", () => {
  const level = levelById(1);
  const valid = createLevelState(level);
  assert.equal(isValidStoredState(valid, level), true);

  const duplicate = structuredClone(valid);
  duplicate.tracks[0].orbs[1].id = duplicate.tracks[0].orbs[0].id;
  assert.equal(isValidStoredState(duplicate, level), false);

  const badColor = structuredClone(valid);
  badColor.tracks[0].orbs[0].color = 99;
  assert.equal(isValidStoredState(badColor, level), false);

  const missingDock = structuredClone(valid);
  missingDock.docks.pop();
  assert.equal(isValidStoredState(missingDock, level), false);
});
