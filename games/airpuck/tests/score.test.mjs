import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStars, calculateTotalSummary, formatTime } from '../js/score.mjs';
import { LEVELS } from '../js/levels.mjs';

test('score: calculateStars on dominant fast win gives 3 stars', () => {
  const mockState = {
    winner: 'p1',
    scoreP1: 5,
    scoreP2: 0, // shutout
    elapsedTime: 40,
  };
  const mockLevel = { targetSeconds: 60 };

  const res = calculateStars(mockState, mockLevel);
  assert.equal(res.stars, 3);
  assert.equal(res.won, true);
  assert.equal(res.shutoutPassed, true);
  assert.equal(res.timePassed, true);
});

test('score: calculateStars on slow win with concessions gives 1 star', () => {
  const mockState = {
    winner: 'p1',
    scoreP1: 5,
    scoreP2: 3, // conceded 3 goals
    elapsedTime: 85, // slower than 60s
  };
  const mockLevel = { targetSeconds: 60 };

  const res = calculateStars(mockState, mockLevel);
  assert.equal(res.stars, 1);
  assert.equal(res.won, true);
  assert.equal(res.shutoutPassed, false);
  assert.equal(res.timePassed, false);
});

test('score: calculateStars on loss gives 0 stars', () => {
  const mockState = {
    winner: 'p2',
    scoreP1: 3,
    scoreP2: 5,
    elapsedTime: 50,
  };
  const mockLevel = { targetSeconds: 60 };

  const res = calculateStars(mockState, mockLevel);
  assert.equal(res.stars, 0);
  assert.equal(res.won, false);
});

test('score: calculateTotalSummary aggregates all 22 levels correctly', () => {
  const records = {
    1: { won: true, stars: 3 },
    2: { won: true, stars: 2 },
    3: { won: true, stars: 3 },
  };

  const summary = calculateTotalSummary(records, LEVELS);
  assert.equal(summary.totalStars, 8);
  assert.equal(summary.maxStars, 66);
  assert.equal(summary.clearedCount, 3);
  assert.equal(summary.totalLevels, 22);
});

test('score: formatTime formats mm:ss accurately', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(5), '00:05');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(3599), '59:59');
});
