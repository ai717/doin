import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStorage,
  createDefaultStorage,
  recordLevelClear,
  recordEndlessScore,
  loadStorage,
  saveStorage,
} from '../js/storage.mjs';

test('storage: normalizeStorage with empty or corrupt input', () => {
  const normEmpty = normalizeStorage(null);
  assert.equal(normEmpty.unlockedLevel, 1);
  assert.equal(normEmpty.currentLevel, 1);
  assert.equal(normEmpty.endlessHighScore, 0);
  assert.equal(normEmpty.soundEnabled, true);
  assert.deepEqual(normEmpty.records, {});

  const normCorrupt = normalizeStorage({
    unlockedLevel: 999,
    currentLevel: -5,
    records: 'invalid',
  });
  assert.equal(normCorrupt.unlockedLevel, 23);
  assert.equal(normCorrupt.currentLevel, 1);
  assert.deepEqual(normCorrupt.records, {});
});

test('storage: recordLevelClear updates unlocked level and stars', () => {
  const res1 = recordLevelClear(1, { stars: 3, time: 14, maxCombo: 4 });
  assert.equal(res1.records[1].stars, 3);
  assert.equal(res1.unlockedLevel, 2);

  const res2 = recordLevelClear(2, { stars: 2, time: 24, maxCombo: 2 });
  assert.equal(res2.records[2].stars, 2);
  assert.equal(res2.unlockedLevel, 3);
});

test('storage: recordEndlessScore updates high score', () => {
  const score1 = recordEndlessScore(280);
  assert.equal(score1, 280);

  const score2 = recordEndlessScore(150); // Lower score does not overwrite
  assert.equal(score2, 280);

  const score3 = recordEndlessScore(450);
  assert.equal(score3, 450);
});

test('storage: memory fallback save and load', () => {
  saveStorage({ unlockedLevel: 5, currentLevel: 4, soundEnabled: false, records: {} });
  const loaded = loadStorage();
  assert.equal(loaded.unlockedLevel, 5);
  assert.equal(loaded.currentLevel, 4);
  assert.equal(loaded.soundEnabled, false);
});
