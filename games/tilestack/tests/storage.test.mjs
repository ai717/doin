import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSaveData,
  saveData,
  recordLevelCompletion,
  setSoundPreference
} from '../js/storage.mjs';

// Setup mock localStorage if running in pure Node.js
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear()
  };
}

test('loadSaveData returns default schema on fresh load', () => {
  localStorage.removeItem('doin.tilestack.v1');
  const data = loadSaveData();
  assert.equal(data.version, 1);
  assert.equal(data.currentLevel, 1);
  assert.equal(data.unlockedLevel, 1);
  assert.equal(data.soundEnabled, true);
  assert.deepEqual(data.levelStars, {});
});

test('saveData persists and normalizes data', () => {
  const updated = saveData({
    currentLevel: 5,
    unlockedLevel: 5,
    levelStars: { 1: 3, 2: 2 },
    soundEnabled: false
  });

  assert.equal(updated.currentLevel, 5);
  assert.equal(updated.unlockedLevel, 5);
  assert.equal(updated.soundEnabled, false);

  const reloaded = loadSaveData();
  assert.equal(reloaded.currentLevel, 5);
  assert.equal(reloaded.unlockedLevel, 5);
  assert.equal(reloaded.soundEnabled, false);
});

test('recordLevelCompletion unlocks next level and saves high scores', () => {
  const data = recordLevelCompletion(1, 3, 2500);
  assert.equal(data.levelStars[1], 3);
  assert.equal(data.highScores[1], 2500);
  assert.ok(data.unlockedLevel >= 2);
});

test('setSoundPreference updates sound flag', () => {
  setSoundPreference(false);
  assert.equal(loadSaveData().soundEnabled, false);
  setSoundPreference(true);
  assert.equal(loadSaveData().soundEnabled, true);
});
