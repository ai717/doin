import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStars, calculateSettlement } from '../js/score.mjs';

test('calculateStars awards 3 stars for <=2 undos and 0 hints', () => {
  const wonState = {
    status: 'won',
    hintsUsed: 0,
    undosCount: 1,
    score: 1200
  };
  assert.equal(calculateStars(wonState), 3);
});

test('calculateStars awards 2 stars for <=5 undos and <=1 hint', () => {
  const state = {
    status: 'won',
    hintsUsed: 1,
    undosCount: 4,
    score: 1000
  };
  assert.equal(calculateStars(state), 2);
});

test('calculateStars awards 1 star for completed level exceeding 2-star limits', () => {
  const state = {
    status: 'won',
    hintsUsed: 3,
    undosCount: 8,
    score: 800
  };
  assert.equal(calculateStars(state), 1);
});

test('calculateStars returns 0 for non-won state', () => {
  assert.equal(calculateStars({ status: 'lost', hintsUsed: 0, undosCount: 0 }), 0);
  assert.equal(calculateStars({ status: 'playing', hintsUsed: 0, undosCount: 0 }), 0);
});

test('calculateSettlement computes bonuses correctly', () => {
  const state = {
    status: 'won',
    score: 2000,
    hintsUsed: 1,
    undosCount: 1,
    steps: 24,
    timeElapsed: 45,
    isTimed: true,
    timeRemaining: 25
  };
  const levelConfig = { starCriteria: { maxUndos: 2, maxHints: 0 } };

  const settlement = calculateSettlement(state, levelConfig);
  assert.equal(settlement.baseScore, 2000);
  assert.equal(settlement.hintBonus, (3 - 1) * 150); // 300
  assert.equal(settlement.timeBonus, 250); // 25 * 10
  assert.equal(settlement.totalScore, 2550);
});
