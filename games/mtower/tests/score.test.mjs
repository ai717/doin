import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, formatTime } from '../js/score.mjs';

test('score: calculateScore gives title tiers and stars', () => {
  const wonState = {
    status: 'won',
    currentFloor: 50,
    steps: 820,
    hero: {
      hp: 18000,
      atk: 450,
      def: 420,
      gold: 1500,
      keys: { y: 2, b: 1, r: 1 },
    },
  };

  const res = calculateScore(wonState);
  assert.ok(res.score > 25000, 'Score should exceed 25000');
  assert.equal(res.titleKey, 'title_god_slayer');
  assert.equal(res.stars, 3);

  const formatRes = formatTime(125);
  assert.equal(formatRes, '02:05');
});
