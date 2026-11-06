import test from 'node:test';
import assert from 'node:assert/strict';
import { getCultivationTitle, formatNumber } from '../js/score.mjs';

test('score: getCultivationTitle returns correct titles per realm', () => {
  assert.equal(getCultivationTitle(1).id, 'novice');
  assert.equal(getCultivationTitle(5).id, 'master');
  assert.equal(getCultivationTitle(10).id, 'paragon');
  assert.equal(getCultivationTitle(14).id, 'patriarch');
  assert.equal(getCultivationTitle(19).id, 'sovereign');
  assert.equal(getCultivationTitle(21).id, 'immortal');
});

test('score: formatNumber handles k and M formats', () => {
  assert.equal(formatNumber(150), '150');
  assert.equal(formatNumber(15400), '15.4k');
  assert.equal(formatNumber(1250000), '1.25M');
});
