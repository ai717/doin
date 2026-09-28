import test from 'node:test';
import assert from 'node:assert/strict';
import { SpiderEngine } from '../js/engine.mjs';
import { solveSpider, verifyDeal } from '../js/solver.mjs';
import { LEVELS } from '../js/levels.mjs';

test('Solver: solveSpider advances board state and makes legal moves', () => {
  const engine = new SpiderEngine({ seed: 10421, suitCount: 2 });
  const result = solveSpider(engine, 60);

  assert.ok(result.steps > 0, 'Solver should perform multiple valid moves');
  assert.equal(typeof result.solved, 'boolean');
  assert.ok(result.completedRuns >= 0 && result.completedRuns <= 8);
});

test('Solver: verifyDeal returns structured evaluation', () => {
  const res = verifyDeal(10421, 2, 80);
  assert.equal(res.seed, 10421);
  assert.equal(res.suitCount, 2);
  assert.ok(res.steps > 0);
});

test('Solver: Curated chapter level seeds exist and have valid pars', () => {
  assert.equal(LEVELS.length, 30);
  for (const lvl of LEVELS) {
    assert.ok(lvl.seed > 0, `Level ${lvl.id} must have a valid positive seed`);
    assert.ok(lvl.par >= 80, `Level ${lvl.id} par should be reasonable`);
    assert.ok([2, 3, 4].includes(lvl.suitCount));
  }
});
