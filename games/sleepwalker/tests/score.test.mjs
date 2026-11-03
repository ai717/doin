/**
 * @file games/sleepwalker/tests/score.test.mjs
 * 计分口径与星级算法测试。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStars, calculateTotalSummary } from '../js/score.mjs';

test('score: calculateStars on won with 3 bubbles and 0 scares', () => {
  const engineState = {
    status: 'won',
    scareCount: 0,
    bubbles: [
      { id: 1, collected: true },
      { id: 2, collected: true },
      { id: 3, collected: true },
    ],
  };

  const res = calculateStars(engineState);
  assert.equal(res.stars, 3);
  assert.equal(res.star1, true);
  assert.equal(res.star2, true);
  assert.equal(res.star3, true);
  assert.equal(res.bubblesCount, 3);
});

test('score: calculateStars on won with scares and missing bubbles', () => {
  const engineState = {
    status: 'won',
    scareCount: 1,
    bubbles: [
      { id: 1, collected: true },
      { id: 2, collected: false },
      { id: 3, collected: false },
    ],
  };

  const res = calculateStars(engineState);
  assert.equal(res.stars, 1);
  assert.equal(res.star1, true);
  assert.equal(res.star2, false);
  assert.equal(res.star3, false);
  assert.equal(res.bubblesCount, 1);
});

test('score: calculateStars on lost state', () => {
  const engineState = {
    status: 'lost',
    scareCount: 2,
    bubbles: [{ id: 1, collected: true }],
  };

  const res = calculateStars(engineState);
  assert.equal(res.stars, 0);
  assert.equal(res.star1, false);
});

test('score: calculateTotalSummary', () => {
  const storageData = {
    stars: { 1: 3, 2: 2, 3: 3 },
    bubbles: { 1: 3, 2: 2, 3: 3 },
  };

  const summary = calculateTotalSummary(storageData);
  assert.equal(summary.clearedCount, 3);
  assert.equal(summary.totalStars, 8);
  assert.equal(summary.maxStars, 66);
  assert.equal(summary.isMaster, false);

  // 全满星
  const fullStars = {};
  for (let i = 1; i <= 22; i++) fullStars[i] = 3;
  const masterSummary = calculateTotalSummary({ stars: fullStars });
  assert.equal(masterSummary.isMaster, true);
});
