import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLevelStars, getRankTitle } from '../js/score.mjs';
import { GLYPH_TYPES } from '../js/data.mjs';

test('score: calculateLevelStars assesses 1, 2, and 3 stars', () => {
  const level = { optimalSteps: 2, eggGlyph: GLYPH_TYPES.LIN };

  // Not won
  const res0 = calculateLevelStars(level, { won: false, steps: 1 });
  assert.equal(res0.stars, 0);

  // Won with suboptimal steps and no egg
  const res1 = calculateLevelStars(level, { won: true, steps: 5, discoveredGlyphs: new Set() });
  assert.equal(res1.stars, 1);
  assert.equal(res1.star1, true);
  assert.equal(res1.star2, false);
  assert.equal(res1.star3, false);

  // Won with optimal steps
  const res2 = calculateLevelStars(level, { won: true, steps: 2, discoveredGlyphs: new Set() });
  assert.equal(res2.stars, 2);
  assert.equal(res2.star1, true);
  assert.equal(res2.star2, true);
  assert.equal(res2.star3, false);

  // Won with optimal steps and egg glyph
  const res3 = calculateLevelStars(level, {
    won: true,
    steps: 1,
    discoveredGlyphs: new Set([GLYPH_TYPES.LIN])
  });
  assert.equal(res3.stars, 3);
  assert.equal(res3.star1, true);
  assert.equal(res3.star2, true);
  assert.equal(res3.star3, true);
});

test('score: getRankTitle gives correct title tiers', () => {
  assert.equal(getRankTitle(5).id, 'apprentice');
  assert.equal(getRankTitle(15).id, 'scholar');
  assert.equal(getRankTitle(30).id, 'master');
  assert.equal(getRankTitle(45).id, 'sage');
  assert.equal(getRankTitle(60).id, 'cangjie');
});
