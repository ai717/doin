/**
 * @file games/sleepwalker/tests/storage.test.mjs
 * 存档归一化、容错降级与持久化契约测试。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeState,
  loadGameData,
  saveGameData,
  recordLevelClear,
  resetGameData,
} from '../js/storage.mjs';

test('storage: normalizeState with empty or corrupted input', () => {
  const norm1 = normalizeState(null);
  assert.equal(norm1.unlockedLevel, 1);
  assert.equal(norm1.currentLevel, 1);
  assert.deepEqual(norm1.stars, {});
  assert.equal(norm1.sound, true);

  const norm2 = normalizeState({
    unlockedLevel: 'invalid',
    currentLevel: -5,
    stars: { '1': '3', 'abc': 5 },
    sound: false,
  });
  assert.equal(norm2.unlockedLevel, 1);
  assert.equal(norm2.currentLevel, 1);
  assert.equal(norm2.stars[1], 3);
  assert.equal(norm2.stars['abc'], undefined);
  assert.equal(norm2.sound, false);
});

test('storage: recordLevelClear updates unlocked level and best stars', () => {
  resetGameData();
  const res1 = recordLevelClear(1, 3, 3);
  assert.equal(res1.unlockedLevel, 2);
  assert.equal(res1.stars[1], 3);

  // 再次通关但星级较低时，不覆盖更高星级
  const res2 = recordLevelClear(1, 1, 1);
  assert.equal(res2.stars[1], 3);
});

test('storage: save and load in memory fallback without crashing', () => {
  const data = loadGameData();
  data.currentLevel = 5;
  saveGameData(data);

  const loaded = loadGameData();
  assert.equal(loaded.currentLevel, 5);
});
