import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStorage,
  getDefaultStorage,
  loadStorage,
  saveStorage,
  recordLevelClear,
  STORAGE_KEY,
} from '../js/storage.mjs';

test('storage: normalizeStorage with empty or corrupt input', () => {
  const normEmpty = normalizeStorage(null);
  assert.equal(normEmpty.version, 1);
  assert.equal(normEmpty.unlockedLevel, 1);
  assert.deepEqual(normEmpty.stars, {});

  const normCorrupt = normalizeStorage({
    unlockedLevel: -10,
    stars: { 1: 5, 'xyz': 2 },
    bestKills: 'invalid',
  });
  assert.equal(normCorrupt.unlockedLevel, 1);
  assert.deepEqual(normCorrupt.stars, {});
  assert.equal(normCorrupt.bestKills, 0);
});

test('storage: recordLevelClear updates unlocked level and stars', () => {
  const s1 = recordLevelClear(1, 3, 5);
  assert.equal(s1.unlockedLevel, 2);
  assert.equal(s1.stars[1], 3);
  assert.equal(s1.bestKills, 5);

  // 重玩更低星不覆盖高星
  const s2 = recordLevelClear(1, 1, 5);
  assert.equal(s2.stars[1], 3);
});

test('storage: memory fallback save and load', () => {
  const saved = saveStorage({
    unlockedLevel: 7,
    stars: { 1: 3, 2: 3 },
  });
  assert.equal(saved.unlockedLevel, 7);
  const loaded = loadStorage();
  assert.equal(loaded.unlockedLevel, 7);
});
