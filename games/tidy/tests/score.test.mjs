import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStars, calculateTotalSummary, formatTime, MAX_POSSIBLE_STARS } from '../js/score.mjs';

test('score: calculateStars on perfect run', () => {
  const stars = calculateStars({
    cleared: true,
    failedAttempts: 0,
    elapsedTime: 22,
    targetSeconds: 45,
  });
  assert.equal(stars, 3);
});

test('score: calculateStars on high errors but fast time', () => {
  const stars = calculateStars({
    cleared: true,
    failedAttempts: 4,
    elapsedTime: 25,
    targetSeconds: 45,
  });
  assert.equal(stars, 2);
});

test('score: calculateStars on slow time and high errors', () => {
  const stars = calculateStars({
    cleared: true,
    failedAttempts: 5,
    elapsedTime: 70,
    targetSeconds: 45,
  });
  assert.equal(stars, 1);
});

test('score: calculateStars on incomplete level', () => {
  const stars = calculateStars({ cleared: false });
  assert.equal(stars, 0);
});

test('score: calculateTotalSummary', () => {
  const records = {
    1: { stars: 3, bestTime: 18 },
    2: { stars: 2, bestTime: 32 },
  };
  const summary = calculateTotalSummary(records);
  assert.equal(summary.clearedCount, 2);
  assert.equal(summary.totalStars, 5);
  assert.equal(summary.maxStars, MAX_POSSIBLE_STARS);
  assert.equal(summary.totalBestTime, 50);
});

test('score: formatTime formatting', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(65), '01:05');
  assert.equal(formatTime(600), '10:00');
});
