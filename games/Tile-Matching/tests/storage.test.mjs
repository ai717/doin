import test from 'node:test';
import assert from 'node:assert/strict';

import { StorageManager } from '../js/storage.mjs';

test('storage: unavailable localStorage falls back without throwing', () => {
  const state = StorageManager.load();
  assert.deepEqual(state.highScores, {});
  assert.equal(state.unlockedLevel, 1);
  assert.equal(StorageManager.save({ unlockedLevel: 2 }), false);
});
