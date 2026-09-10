import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeState, unlockedLevelFor } from '../js/storage.mjs';

test('Storage: 空值与异常结构清洗为默认状态', () => {
  const resNull = normalizeState(null);
  assert.deepEqual(resNull.unlocked, {});
  assert.equal(resNull.audioMuted, false);
  assert.deepEqual(resNull.levelStats, {});

  const resString = normalizeState('corrupted_string');
  assert.deepEqual(resString.unlocked, {});

  const resArray = normalizeState([1, 2, 3]);
  assert.deepEqual(resArray.unlocked, {});
  assert.equal(unlockedLevelFor(resArray, 8), 1);
});

test('Storage: 负数、浮点数与脏数据纠偏 (Normalize)', () => {
  const dirty = {
    unlocked: { 4: 99, 8: 2.7, 6: -3, x: 5, 2: 4 },
    audioMuted: 'yes',
    levelStats: {
      '8_1': { stars: 5, bestTime: -10 },
      invalid_key: { stars: 2, bestTime: 12 },
      '8_2': { stars: '3', bestTime: 'fast' },
      '8_3': null,
      '4_1': { stars: 2, bestTime: 33.8 }
    }
  };

  const clean = normalizeState(dirty);
  assert.equal(clean.audioMuted, true);

  // 解锁进度按关卡上限截断，非法值与过小规格过滤
  assert.equal(clean.unlocked['4'], 20);
  assert.equal(clean.unlocked['8'], 2);
  assert.equal(clean.unlocked['6'], undefined);
  assert.equal(clean.unlocked['x'], undefined);
  assert.equal(clean.unlocked['2'], undefined);

  // 复合键必须原样保留，不能被退化成单个数字
  assert.equal(clean.levelStats['8_1'].stars, 3); // 5 截断至上限 3
  assert.equal(clean.levelStats['8_1'].bestTime, 0); // 负数修正为 0
  assert.equal(clean.levelStats['8_2'].stars, 0);
  assert.equal(clean.levelStats['8_2'].bestTime, 0);
  assert.equal(clean.levelStats.invalid_key, undefined);
  assert.equal(clean.levelStats['8_3'], undefined);
  assert.equal(clean.levelStats['4_1'].bestTime, 33);
});

test('Storage: 解锁查询在无存档时只开放第 1 关', () => {
  assert.equal(unlockedLevelFor(null, 10), 1);
  assert.equal(unlockedLevelFor({ unlocked: {} }, 10), 1);
  assert.equal(unlockedLevelFor({ unlocked: { 10: 3 } }, 10), 3);
  assert.equal(unlockedLevelFor({ unlocked: { 10: 3 } }, 12), 1);
});
