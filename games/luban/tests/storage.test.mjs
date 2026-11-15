import test from 'node:test';
import assert from 'node:assert/strict';

import {
  loadSaveData,
  saveData,
  recordLevelCompletion,
  setSoundPreference
} from '../js/storage.mjs';

test('loadSaveData returns valid default data and handles storage gracefully', () => {
  const data = loadSaveData();
  assert.ok(data);
  assert.equal(data.version, 1);
  assert.ok(data.unlockedLevel >= 1);
  assert.ok(typeof data.levelRatings === 'object');
});

test('saveData normalizes corrupted or empty payload', () => {
  const norm = saveData(null);
  assert.equal(norm.version, 1);
  assert.equal(norm.unlockedLevel, 1);

  const custom = saveData({ unlockedLevel: 5, currentLevel: 3, soundEnabled: false });
  assert.equal(custom.unlockedLevel, 5);
  assert.equal(custom.currentLevel, 3);
  assert.equal(custom.soundEnabled, false);
});

test('recordLevelCompletion updates rating, best steps, and unlocks next level', () => {
  saveData({ unlockedLevel: 1, currentLevel: 1, levelRatings: {}, levelBestSteps: {} });

  recordLevelCompletion(1, 'gold', 6);
  const after = loadSaveData();

  assert.equal(after.levelRatings[1], 'gold');
  assert.equal(after.levelBestSteps[1], 6);
  assert.equal(after.unlockedLevel, 2);
  assert.equal(after.currentLevel, 2);
});

test('setSoundPreference updates sound status', () => {
  setSoundPreference(false);
  assert.equal(loadSaveData().soundEnabled, false);
  setSoundPreference(true);
  assert.equal(loadSaveData().soundEnabled, true);
});
