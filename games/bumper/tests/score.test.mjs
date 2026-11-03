import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStars, calculateTotalSummary } from '../js/score.mjs';

test('score: calculateStars on 5-0 clean sweep with brakes', () => {
  const state = {
    status: 'match_won',
    matchWinner: 'red',
    targetScore: 5,
    scores: { red: 5, blue: 0 },
    stats: { redBrakes: 2, collisions: 10 },
  };

  const res = calculateStars(state);
  assert.equal(res.star1, true);
  assert.equal(res.star2, true);
  assert.equal(res.star3, true);
  assert.equal(res.totalStars, 3);
});

test('score: calculateStars on 5-3 tight win', () => {
  const state = {
    status: 'match_won',
    matchWinner: 'red',
    targetScore: 5,
    scores: { red: 5, blue: 3 },
    stats: { redBrakes: 0, collisions: 4 },
  };

  const res = calculateStars(state);
  assert.equal(res.star1, true);
  assert.equal(res.star2, false);
  assert.equal(res.star3, false);
  assert.equal(res.totalStars, 1);
});

test('score: calculateStars on match loss', () => {
  const state = {
    status: 'match_lost',
    matchWinner: 'blue',
    targetScore: 5,
    scores: { red: 2, blue: 5 },
    stats: { redBrakes: 3, collisions: 12 },
  };

  const res = calculateStars(state);
  assert.equal(res.totalStars, 0);
});

test('score: calculateTotalSummary', () => {
  const storage = {
    stars: {
      1: 3,
      2: 3,
      3: 2,
    },
  };
  const summary = calculateTotalSummary(storage);
  assert.equal(summary.totalStars, 8);
  assert.equal(summary.maxStars, 69);
  assert.equal(summary.percent, 12);
});
