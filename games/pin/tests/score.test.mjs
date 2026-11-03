import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStars, calculateTotalSummary, formatTime, MAX_POSSIBLE_STARS } from '../js/score.mjs';

test('score: calculateStars on perfect run', () => {
  const stars = calculateStars({
    cleared: true,
    maxCombo: 5,
    elapsedTime: 18,
    targetSeconds: 30,
  });
  assert.equal(stars, 3);
});

test('score: calculateStars on moderate run (low combo but fast)', () => {
  const stars = calculateStars({
    cleared: true,
    maxCombo: 2,
    elapsedTime: 20,
    targetSeconds: 30,
  });
  assert.equal(stars, 2);
});

test('score: calculateStars on slow clear without combo', () => {
  const stars = calculateStars({
    cleared: true,
    maxCombo: 1,
    elapsedTime: 55,
    targetSeconds: 30,
  });
  assert.equal(stars, 1);
});

test('score: calculateStars on level fail', () => {
  const stars = calculateStars({ cleared: false });
  assert.equal(stars, 0);
});

test('score: calculateTotalSummary', () => {
  const records = {
    1: { stars: 3, bestTime: 15 },
    2: { stars: 2, bestTime: 22 },
  };
  const summary = calculateTotalSummary(records);
  assert.equal(summary.clearedCount, 2);
  assert.equal(summary.totalStars, 5);
  assert.equal(summary.maxStars, MAX_POSSIBLE_STARS);
  assert.equal(summary.totalBestTime, 37);
});

test('score: formatTime formatting', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(45), '00:45');
  assert.equal(formatTime(125), '02:05');
});
