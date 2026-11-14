import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../js/levels.mjs';
import { CHAPTERS } from '../js/data.mjs';

test('levels array contains exactly 40 levels', () => {
  assert.equal(LEVELS.length, 40);
});

test('chapters definitions are valid and span 40 levels', () => {
  assert.equal(CHAPTERS.length, 5);
  assert.deepEqual(CHAPTERS[0].levelRange, [1, 8]);
  assert.deepEqual(CHAPTERS[4].levelRange, [33, 40]);
});

test('every level has tile count strictly divisible by 3', () => {
  LEVELS.forEach(level => {
    assert.ok(level.slots.length >= 24, `Level ${level.id} should have >= 24 tiles`);
    assert.equal(level.slots.length % 3, 0, `Level ${level.id} count ${level.slots.length} must be multiple of 3`);
    assert.ok(level.nameZh, `Level ${level.id} missing nameZh`);
    assert.ok(level.nameEn, `Level ${level.id} missing nameEn`);
    assert.ok(level.seed, `Level ${level.id} missing seed`);
  });
});
