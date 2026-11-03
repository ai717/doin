/**
 * @file games/sleepwalker/tests/solver.test.mjs
 * 验证全 22 关数学可解性与 3 颗金泡泡全收集。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../js/levels.mjs';
import { verifyGoldenSolution } from '../js/solver.mjs';

test('solver: all 22 levels are mathematically solvable with 3 stars', () => {
  assert.equal(LEVELS.length, 22, 'Must have exactly 22 levels');

  for (const lvl of LEVELS) {
    const res = verifyGoldenSolution(lvl);
    assert.equal(
      res.success,
      true,
      `Level ${lvl.id} (${lvl.key}) failed to reach bed: ${JSON.stringify(res)}`
    );
    assert.equal(
      res.bubbles,
      3,
      `Level ${lvl.id} (${lvl.key}) collected ${res.bubbles}/3 bubbles`
    );
    assert.equal(
      res.scares,
      0,
      `Level ${lvl.id} (${lvl.key}) had ${res.scares} scares`
    );
  }
});
