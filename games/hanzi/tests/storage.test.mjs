import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStorage, loadGameData, saveGameData, recordLevelSuccess } from '../js/storage.mjs';

test('storage: normalizeStorage with null, empty, or corrupted data', () => {
  const normEmpty = normalizeStorage(null);
  assert.equal(normEmpty.highestLevel, 1);
  assert.deepEqual(normEmpty.levelStars, {});
  assert.deepEqual(normEmpty.unlockedCodex, []);
  assert.equal(normEmpty.soundEnabled, true);

  const normCorrupted = normalizeStorage({
    highestLevel: 999,
    levelStars: { 'bad': 5, '3': 2, '25': 3 },
    unlockedCodex: [123, 'wood', null],
    soundEnabled: false
  });
  assert.equal(normCorrupted.highestLevel, 22);
  assert.equal(normCorrupted.levelStars[3], 2);
  assert.equal(normCorrupted.levelStars[25], undefined);
  assert.deepEqual(normCorrupted.unlockedCodex, ['wood']);
  assert.equal(normCorrupted.soundEnabled, false);
});

test('storage: load, save and recordLevelSuccess memory fallback', () => {
  const data = loadGameData();
  assert.ok(data.highestLevel >= 1);

  const saved = recordLevelSuccess(1, 3, ['wood', 'fire']);
  assert.equal(saved.levelStars[1], 3);
  assert.ok(saved.highestLevel >= 2);
  assert.ok(saved.unlockedCodex.includes('wood'));
});
