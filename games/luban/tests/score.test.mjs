import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateTenonRating, buildSettlementSummary } from '../js/score.mjs';
import { RATINGS } from '../js/data.mjs';

test('calculateTenonRating grades gold, silver, bronze accurately', () => {
  const optimal = 6;

  // Gold: <= optimal * 1.2 and hints = 0
  const gold = calculateTenonRating({ status: 'won', hintsUsed: 0, steps: 6 }, optimal);
  assert.equal(gold.id, RATINGS.gold.id);
  assert.equal(gold.stars, 3);

  // Silver: <= 1 hint
  const silver = calculateTenonRating({ status: 'won', hintsUsed: 1, steps: 12 }, optimal);
  assert.equal(silver.id, RATINGS.silver.id);
  assert.equal(silver.stars, 2);

  // Bronze: > 1 hint
  const bronze = calculateTenonRating({ status: 'won', hintsUsed: 3, steps: 20 }, optimal);
  assert.equal(bronze.id, RATINGS.bronze.id);
  assert.equal(bronze.stars, 1);
});

test('buildSettlementSummary constructs complete victory payload', () => {
  const fakeState = { status: 'won', hintsUsed: 0, steps: 6 };
  const fakeConfig = { id: 1, optimalMoves: 6, triviaZh: '测试', triviaEn: 'Test' };

  const summary = buildSettlementSummary(fakeState, fakeConfig);
  assert.equal(summary.levelId, 1);
  assert.equal(summary.steps, 6);
  assert.equal(summary.optimalMoves, 6);
  assert.equal(summary.stars, 3);
  assert.ok(summary.rating);
  assert.ok(summary.triviaZh);
  assert.ok(summary.triviaEn);
});
