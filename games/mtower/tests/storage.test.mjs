import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStorage, getDefaultStorage, STORAGE_KEY } from '../js/storage.mjs';

test('storage: normalizeStorage with null, empty, or corrupted data', () => {
  const normNull = normalizeStorage(null);
  assert.equal(normNull.version, 1);
  assert.equal(normNull.bestScore, 0);
  assert.equal(normNull.bestFloor, 1);

  const normCorrupted = normalizeStorage({
    bestScore: 'invalid',
    bestFloor: -10,
    classicWon: 'yes',
  });
  assert.equal(normCorrupted.bestScore, 0);
  assert.equal(normCorrupted.bestFloor, 1);
  assert.equal(normCorrupted.classicWon, true);

  assert.equal(STORAGE_KEY, 'doin.mtower.v1');
});
