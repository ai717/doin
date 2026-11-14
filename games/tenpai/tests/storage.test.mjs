import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadSaveData,
  saveData,
  recordQuestionResult,
  setSoundPreference,
  setRuleModePreference
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
  localStorage.removeItem('doin.tenpai.v1');
  const data = loadSaveData();
  assert.equal(data.version, 1);
  assert.equal(data.currentLevel, 1);
  assert.equal(data.unlockedLevel, 1);
  assert.equal(data.totalScore, 0);
  assert.equal(data.soundEnabled, true);
});

test('saveData persists and normalizes data', () => {
  const updated = saveData({
    currentLevel: 10,
    unlockedLevel: 12,
    totalScore: 1500,
    soundEnabled: false,
    ruleMode: 'riichi'
  });

  assert.equal(updated.currentLevel, 10);
  assert.equal(updated.unlockedLevel, 12);
  assert.equal(updated.totalScore, 1500);
  assert.equal(updated.soundEnabled, false);
  assert.equal(updated.ruleMode, 'riichi');

  const reloaded = loadSaveData();
  assert.equal(reloaded.totalScore, 1500);
  assert.equal(reloaded.currentLevel, 10);
});

test('recordQuestionResult unlocks next level and manages wrong book', () => {
  // Failed question goes to wrong book
  recordQuestionResult(1, 0, false);
  let data = loadSaveData();
  assert.ok(data.wrongBook.includes(1));

  // Passed question removes from wrong book and unlocks next level
  recordQuestionResult(1, 120, true);
  data = loadSaveData();
  assert.equal(data.wrongBook.includes(1), false);
  assert.ok(data.unlockedLevel >= 2);
  assert.ok(data.totalScore >= 120);
});

test('setSoundPreference and setRuleModePreference update preferences', () => {
  setSoundPreference(false);
  assert.equal(loadSaveData().soundEnabled, false);

  setRuleModePreference('riichi');
  assert.equal(loadSaveData().ruleMode, 'riichi');
});
