import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStars, calculateTotalSummary } from '../js/score.mjs';

test('score: calculateStars on 2-0 match win with high perfects', () => {
  const state = {
    status: 'match_won',
    matchWinner: 'red',
    scores: { red: 2, blue: 0 },
    stats: { redPerfects: 6, redMaxCps: 6.5 },
  };

  const res = calculateStars(state);
  assert.equal(res.star1, true);
  assert.equal(res.star2, true);
  assert.equal(res.star3, true);
  assert.equal(res.totalStars, 3);
});

test('score: calculateStars on 2-1 match win with low perfects', () => {
  const state = {
    status: 'match_won',
    matchWinner: 'red',
    scores: { red: 2, blue: 1 },
    stats: { redPerfects: 2, redMaxCps: 4.8 },
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
    scores: { red: 1, blue: 2 },
    stats: { redPerfects: 5, redMaxCps: 7.0 },
  };

  const res = calculateStars(state);
  assert.equal(res.totalStars, 0);
});

test('score: calculateTotalSummary', () => {
  const storage = {
    stars: {
      1: 3,
      2: 2,
      3: 1,
    },
  };
  const summary = calculateTotalSummary(storage);
  assert.equal(summary.totalStars, 6);
  assert.equal(summary.maxStars, 66);
  assert.equal(summary.percent, 9);
});
