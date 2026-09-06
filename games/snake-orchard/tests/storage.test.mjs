import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStorageData, VALID_DIFFICULTIES, VALID_THEMES } from '../js/storage.mjs';

test('Storage - 纯净默认值回退', () => {
  const defaults = normalizeStorageData(null);
  assert.equal(defaults.bestScore, 0);
  assert.equal(defaults.gamesPlayed, 0);
  assert.equal(defaults.applesTotal, 0);
  assert.equal(defaults.soundEnabled, true);
  assert.equal(defaults.theme, 'light');
  assert.equal(defaults.difficulty, 'normal');

  const arrFallback = normalizeStorageData(['invalid', 'structure']);
  assert.equal(arrFallback.bestScore, 0);
});

test('Storage - 脏字段清洗、负数修正与非法枚举降级', () => {
  const dirty = {
    bestScore: -300,
    gamesPlayed: 'two',
    applesTotal: 12.8,
    soundEnabled: 'false', // 非 boolean 原始类型
    theme: 'matrix-green', // 非法主题
    difficulty: 'impossible' // 非法难度
  };

  const cleaned = normalizeStorageData(dirty);
  assert.equal(cleaned.bestScore, 0); // 负数矫正为 0
  assert.equal(cleaned.gamesPlayed, 0); // 字符串非数值归零
  assert.equal(cleaned.applesTotal, 12); // 浮点数向下取整
  assert.equal(cleaned.soundEnabled, true); // 回退至默认 true
  assert.equal(cleaned.theme, 'light'); // 回退至合法默认主题
  assert.equal(cleaned.difficulty, 'normal'); // 回退至合法默认难度
});

test('Storage - 合法有效数据完整保留', () => {
  const valid = {
    bestScore: 2450,
    gamesPlayed: 32,
    applesTotal: 180,
    soundEnabled: false,
    theme: 'dark',
    difficulty: 'hard'
  };

  const cleaned = normalizeStorageData(valid);
  assert.deepEqual(cleaned, valid);
});

test('Storage - 枚举列表定义完备性', () => {
  assert.deepEqual(VALID_DIFFICULTIES, ['easy', 'normal', 'hard']);
  assert.deepEqual(VALID_THEMES, ['light', 'dark']);
});
