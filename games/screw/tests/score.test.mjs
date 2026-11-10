import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, parTimeMs, calculateStars, isNewBest } from '../js/score.mjs';
import { levelById } from '../js/levels.mjs';

test('score: time formatting is stable', () => {
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(999), '00:00');
  assert.equal(formatTime(1000), '00:01');
  assert.equal(formatTime(65000), '01:05');
  assert.equal(formatTime(-500), '00:00');
});

test('score: stars reward speed and no-undo clears', () => {
  const level = levelById(1);
  const par = parTimeMs(level);
  assert.equal(calculateStars({ status: 'playing', elapsedMs: 1000, undos: 0, level }), 0);
  assert.equal(calculateStars({ status: 'won', elapsedMs: par - 1000, undos: 0, level }), 3);
  assert.equal(calculateStars({ status: 'won', elapsedMs: par - 1000, undos: 1, level }), 2);
  assert.equal(calculateStars({ status: 'won', elapsedMs: par + 1000, undos: 0, level }), 2);
  assert.equal(calculateStars({ status: 'won', elapsedMs: par + 1000, undos: 3, level }), 1);
});

test('score: par time scales with screw count and new-best comparison', () => {
  const level = levelById(1);
  assert.equal(parTimeMs(level), (20 + 6 * 7) * 1000);
  assert.equal(isNewBest(null, { stars: 1, timeMs: 99999 }), true);
  assert.equal(isNewBest({ cleared: true, stars: 2, bestTimeMs: 50000 }, { stars: 2, timeMs: 40000 }), true);
  assert.equal(isNewBest({ cleared: true, stars: 2, bestTimeMs: 50000 }, { stars: 1, timeMs: 40000 }), false);
});
