import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getDailyDrillPuzzles } from '../js/levels.mjs';
import { CHAPTERS } from '../js/data.mjs';

test('levels array contains exactly 60 curated levels', () => {
  assert.equal(LEVELS.length, 60);
});

test('chapters span all 60 levels across 3 chapters', () => {
  assert.equal(CHAPTERS.length, 3);
  assert.deepEqual(CHAPTERS[0].levelRange, [1, 20]);
  assert.deepEqual(CHAPTERS[1].levelRange, [21, 40]);
  assert.deepEqual(CHAPTERS[2].levelRange, [41, 60]);
});

test('every level has valid 13-tile hand with at least one winning wait', () => {
  LEVELS.forEach(level => {
    assert.equal(level.hand.length, 13, `Level ${level.id} hand should have 13 tiles`);
    assert.ok(level.waits.length >= 1, `Level ${level.id} must have >= 1 wait`);
    assert.ok(level.maxFan >= 1, `Level ${level.id} must have maxFan >= 1`);
    assert.ok(level.nameZh, `Level ${level.id} missing nameZh`);
    assert.ok(level.nameEn, `Level ${level.id} missing nameEn`);
  });
});

test('getDailyDrillPuzzles yields 5 deterministic puzzles', () => {
  const drill1 = getDailyDrillPuzzles('2026-11-14');
  const drill2 = getDailyDrillPuzzles('2026-11-14');
  assert.equal(drill1.length, 5);
  assert.deepEqual(drill1.map(l => l.id), drill2.map(l => l.id));
});
