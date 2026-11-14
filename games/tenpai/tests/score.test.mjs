import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAnswer, getDanRank } from '../js/score.mjs';

test('evaluateAnswer computes 100 base score for perfect waits and best fan', () => {
  const levelConfig = {
    waits: ['1s', '4s'],
    waitDetails: [
      { tileId: '1s', fan: 1 },
      { tileId: '4s', fan: 2 }
    ],
    maxFan: 2,
    bestWait: '4s'
  };

  const res = evaluateAnswer(['1s', '4s'], '4s', levelConfig, 10, 2);
  assert.equal(res.isPerfect, true);
  assert.equal(res.waitScore, 60);
  assert.equal(res.fanScore, 40);
  assert.equal(res.speedBonus, 15); // 10 * 1.5
  assert.ok(res.totalScore > 100);
});

test('evaluateAnswer penalizes wrongly chosen tiles', () => {
  const levelConfig = {
    waits: ['1s', '4s'],
    waitDetails: [
      { tileId: '1s', fan: 1 },
      { tileId: '4s', fan: 1 }
    ],
    maxFan: 1,
    bestWait: '1s'
  };

  const res = evaluateAnswer(['1s', '9p'], '1s', levelConfig, 0, 0);
  assert.equal(res.wrongCount, 1);
  assert.ok(res.waitScore < 60);
});

test('getDanRank calculates correct Dan tier', () => {
  assert.equal(getDanRank(0).id, 'novice');
  assert.equal(getDanRank(1500).id, 'adept');
  assert.equal(getDanRank(3000).id, 'expert');
  assert.equal(getDanRank(5500).id, 'master');
});
