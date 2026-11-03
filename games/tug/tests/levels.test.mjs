import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getLevelById } from '../js/levels.mjs';
import { createInitialState, handlePullAction, stepFrame } from '../js/engine.mjs';

test('levels: metadata integrity for all 22 levels', () => {
  assert.equal(LEVELS.length, 22);

  const seenIds = new Set();
  LEVELS.forEach((level, idx) => {
    assert.equal(level.id, idx + 1);
    assert.ok(level.act >= 1 && level.act <= 5);
    assert.ok(level.aiCps >= 2.0 && level.aiCps <= 8.5);
    assert.ok(level.aiPerfectRate >= 0.1 && level.aiPerfectRate <= 0.8);
    assert.ok(typeof level.key === 'string' && level.key.length > 0);
    assert.ok(typeof level.aiNameKey === 'string' && level.aiNameKey.length > 0);
    assert.ok(!seenIds.has(level.id));
    seenIds.add(level.id);
  });
});

test('levels: getLevelById fallback', () => {
  const l1 = getLevelById(1);
  assert.equal(l1.id, 1);
  const fallback = getLevelById(999);
  assert.equal(fallback.id, 1);
});

test('levels: mathematical solvability of levels 1 to 22 by skilled player', () => {
  for (const level of LEVELS) {
    let state = createInitialState({
      mode: '1p',
      levelConfig: level,
      seed: 100 + level.id,
    });

    // 熟练玩家模拟：手速 5.2 ~ 8.0 CPS 并且在节拍收缩时击键
    const baseCps = Math.min(8.0, Math.max(5.2, level.aiCps + 1.2));
    const tapInterval = 1 / baseCps;
    let playerTimer = 0;

    let simulatedSec = 0;
    const maxSec = 60;
    const dt = 0.02;

    while (simulatedSec < maxSec && state.status !== 'match_won' && state.status !== 'match_lost') {
      state = stepFrame(state, dt);
      simulatedSec += dt;

      if (state.status === 'pulling') {
        playerTimer += dt;
        if (playerTimer >= tapInterval || (state.beat.isNearBeat && playerTimer >= 0.08)) {
          playerTimer = 0;
          const { state: nextState } = handlePullAction(state, 'red');
          state = nextState;
        }
      }
    }

    assert.equal(state.status, 'match_won', `Level ${level.id} (${level.key}) should be won by skilled player within ${maxSec}s`);
  }
});
