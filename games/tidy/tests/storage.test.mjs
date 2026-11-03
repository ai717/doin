import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStorage,
  createDefaultStorage,
  recordLevelClear,
  loadStorage,
  saveStorage,
  STORAGE_KEY,
} from '../js/storage.mjs';

test('storage: normalizeStorage with empty or corrupt input', () => {
  const normEmpty = normalizeStorage(null);
  assert.equal(normEmpty.unlockedLevel, 1);
  assert.equal(normEmpty.currentLevel, 1);
  assert.equal(normEmpty.soundEnabled, true);
  assert.deepEqual(normEmpty.records, {});

  const normCorrupt = normalizeStorage({
    unlockedLevel: 999,
    currentLevel: -5,
    records: 'invalid',
  });
  assert.equal(normCorrupt.unlockedLevel, 24);
  assert.equal(normCorrupt.currentLevel, 1);
  assert.deepEqual(normCorrupt.records, {});
});

test('storage: recordLevelClear updates unlocked level and stars', () => {
  const res1 = recordLevelClear(1, { stars: 3, time: 20, moves: 8 });
  assert.equal(res1.records[1].stars, 3);
  assert.equal(res1.unlockedLevel, 2);

  const res2 = recordLevelClear(2, { stars: 2, time: 35, moves: 12 });
  assert.equal(res2.records[2].stars, 2);
  assert.equal(res2.unlockedLevel, 3);
});

test('storage: memory fallback save and load', () => {
  saveStorage({ unlockedLevel: 4, currentLevel: 3, soundEnabled: false, records: {} });
  const loaded = loadStorage();
  assert.equal(loaded.unlockedLevel, 4);
  assert.equal(loaded.currentLevel, 3);
  assert.equal(loaded.soundEnabled, false);
});
