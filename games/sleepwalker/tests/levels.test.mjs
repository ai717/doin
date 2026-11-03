/**
 * @file games/sleepwalker/tests/levels.test.mjs
 * 关卡完整性与数据契约测试。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getLevelById, getTotalLevels } from '../js/levels.mjs';

test('levels: metadata and structure integrity', () => {
  assert.equal(getTotalLevels(), 22);

  const ids = new Set();
  const keys = new Set();

  for (const lvl of LEVELS) {
    assert.ok(lvl.id >= 1 && lvl.id <= 22, `Invalid level id: ${lvl.id}`);
    assert.ok(!ids.has(lvl.id), `Duplicate level id: ${lvl.id}`);
    ids.add(lvl.id);

    assert.ok(typeof lvl.key === 'string' && lvl.key.startsWith('level_'));
    assert.ok(!keys.has(lvl.key), `Duplicate level key: ${lvl.key}`);
    keys.add(lvl.key);

    assert.ok(lvl.act >= 1 && lvl.act <= 5, `Invalid act: ${lvl.act}`);
    assert.ok(lvl.spawn && typeof lvl.spawn.x === 'number' && typeof lvl.spawn.y === 'number');
    assert.ok(lvl.bed && typeof lvl.bed.x === 'number' && typeof lvl.bed.y === 'number');
    assert.ok(Array.isArray(lvl.platforms) && lvl.platforms.length >= 1);
    assert.ok(Array.isArray(lvl.bubbles) && lvl.bubbles.length === 3, 'Must have 3 bubbles');
    assert.ok(Array.isArray(lvl.goldenSolution));
  }
});

test('levels: getLevelById retrieval and fallback', () => {
  const lvl1 = getLevelById(1);
  assert.equal(lvl1.id, 1);

  const lvl22 = getLevelById(22);
  assert.equal(lvl22.id, 22);

  const fallback = getLevelById(999);
  assert.equal(fallback.id, 1);
});
