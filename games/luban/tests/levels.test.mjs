import test from 'node:test';
import assert from 'node:assert/strict';

import { LEVELS } from '../js/levels.mjs';
import { CHAPTERS } from '../js/data.mjs';
import { canBlockMove } from '../js/engine.mjs';

test('level repository has exactly 36 levels and 6 chapters', () => {
  assert.equal(LEVELS.length, 36);
  assert.equal(CHAPTERS.length, 6);

  for (let i = 0; i < 36; i++) {
    assert.equal(LEVELS[i].id, i + 1);
    assert.ok(LEVELS[i].nameZh);
    assert.ok(LEVELS[i].nameEn);
    assert.ok(LEVELS[i].optimalMoves >= 4);
    assert.ok(LEVELS[i].blocks.length >= 4);
  }
});

test('every single level is 100% mathematically solvable', () => {
  LEVELS.forEach(level => {
    let remaining = [...level.blocks];
    const extractedOrder = [];

    while (remaining.length > 0) {
      const freeBlock = remaining.find(b => canBlockMove(b, remaining).canMove);
      assert.ok(
        freeBlock,
        `Level ${level.id} (${level.nameEn}) encountered dead end! Extracted: [${extractedOrder.join(', ')}], Remaining: [${remaining.map(b => b.id).join(', ')}]`
      );

      extractedOrder.push(freeBlock.id);
      remaining = remaining.filter(b => b.id !== freeBlock.id);
    }

    assert.equal(remaining.length, 0);
    assert.equal(extractedOrder.length, level.blocks.length);
  });
});
