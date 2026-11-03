import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getLevelById } from '../js/levels.mjs';
import {
  createInitialState,
  launchPin,
  stepFrame,
  normalizeAngle,
  angleDiff,
  degToRad,
} from '../js/engine.mjs';

test('levels: metadata integrity for all 23 levels', () => {
  assert.equal(LEVELS.length, 23);

  const seenIds = new Set();
  LEVELS.forEach((level, idx) => {
    assert.equal(level.id, idx + 1);
    assert.ok(level.act >= 1 && level.act <= 5);
    assert.ok(level.pendingCount >= 6 && level.pendingCount <= 22);
    assert.ok(level.initialPins.length >= 2 && level.initialPins.length <= 8);
    assert.ok(level.safeAngleDeg >= 7.0 && level.safeAngleDeg <= 11.0);
    assert.ok(level.targetSeconds >= 20 && level.targetSeconds <= 70);
    assert.ok(typeof level.key === 'string' && level.key.length > 0);
    assert.ok(!seenIds.has(level.id));
    seenIds.add(level.id);

    // 100% 数学可解性与安全空间冗余保证：
    // 所有针所占用的总安全角度区间必须严格 <= 360° 的 75%，确保预留 >= 25% 的安全空隙
    const totalPins = level.initialPins.length + level.pendingCount;
    const totalSafeCoverage = totalPins * level.safeAngleDeg;
    assert.ok(
      totalSafeCoverage <= 360 * 0.75,
      `Level ${level.id} (${level.key}) exceeds 75% coverage limit: ${totalSafeCoverage.toFixed(1)}° > 270°`
    );
  });
});

test('levels: getLevelById fallback', () => {
  const l1 = getLevelById(1);
  assert.equal(l1.id, 1);
  const fallback = getLevelById(999);
  assert.equal(fallback.id, 1);
});

test('levels: mathematical solvability of all 23 levels by timing simulation', () => {
  for (const level of LEVELS) {
    let state = createInitialState({ level, seed: 1000 + level.id });
    let simTime = 0;
    const maxSimTime = 40;
    const dt = 0.02;

    while (simTime < maxSimTime && state.status === 'playing') {
      // 预判 4 步后若发射是否能够安全扎入且间隙留有安全冗余
      let testState = { ...state, wheelPins: [...state.wheelPins], flyingPins: [] };
      testState = launchPin(testState);
      for (let f = 0; f < 4; f++) {
        testState = stepFrame(testState, dt);
      }

      if (testState.status === 'playing' || testState.status === 'won') {
        if (state.flyingPins.length === 0 && state.pendingCount > 0) {
          state = launchPin(state);
        }
      }
      state = stepFrame(state, dt);
      simTime += dt;
    }

    assert.equal(state.status, 'won', `Level ${level.id} (${level.key}) should be won within ${maxSimTime}s without collision`);
  }
});
