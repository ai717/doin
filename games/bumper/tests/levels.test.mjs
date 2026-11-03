import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getLevelById } from '../js/levels.mjs';
import {
  createInitialState,
  setCarThrust,
  stepFrame,
  normalizeAngle,
  ARENA_CX,
  ARENA_CY,
} from '../js/engine.mjs';

test('levels: metadata integrity for all 23 levels', () => {
  assert.equal(LEVELS.length, 23);

  const seenIds = new Set();
  LEVELS.forEach((level, idx) => {
    assert.equal(level.id, idx + 1);
    assert.ok(level.act >= 1 && level.act <= 5);
    assert.ok(level.aiAimTolerance >= 0.15 && level.aiAimTolerance <= 0.6);
    assert.ok(level.aiReactionTime >= 0.05 && level.aiReactionTime <= 0.3);
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

test('levels: mathematical solvability of levels 1 to 23 by skilled player', () => {
  for (const level of LEVELS) {
    let state = createInitialState({
      mode: '1p',
      targetScore: 1, // 验证单局胜场可达性与机制闭环
      levelConfig: level,
      seed: 888 + level.id,
    });

    let simulatedSec = 0;
    const maxSec = 60;
    const dt = 0.02;

    while (simulatedSec < maxSec && state.status !== 'match_won' && state.status !== 'match_lost') {
      state = stepFrame(state, dt);
      simulatedSec += dt;

      if (state.status === 'playing') {
        const red = state.cars.red;
        const blue = state.cars.blue;

        // 熟练玩家模拟：具备悬崖警觉、回中寻路、急刹防冲与精准顶撞
        const distFromCenter = Math.hypot(red.x - ARENA_CX, red.y - ARENA_CY);
        const lookAhead = 70;
        const futureX = red.x + Math.cos(red.angle) * lookAhead;
        const futureY = red.y + Math.sin(red.angle) * lookAhead;
        const futureDist = Math.hypot(futureX - ARENA_CX, futureY - ARENA_CY);
        const headingToCliff = futureDist > state.arenaRadius - 15;

        // 惯性坠崖预警与双击急刹防冲
        const inertiaFutureX = red.x + red.vx * 0.32;
        const inertiaFutureY = red.y + red.vy * 0.32;
        const inertiaDist = Math.hypot(inertiaFutureX - ARENA_CX, inertiaFutureY - ARENA_CY);
        const inertiaCliffDanger = inertiaDist > state.arenaRadius - 12 && Math.hypot(red.vx, red.vy) > 100;

        if (inertiaCliffDanger) {
          state = setCarThrust(state, 'red', false);
          state.cars.red.lastReleaseTime = state.roundTime - 0.05;
          state.cars.red.lastPressDuration = 0.05;
          state = setCarThrust(state, 'red', true);
          state = setCarThrust(state, 'red', false);
        }

        // 目标：若靠近边缘且面向悬崖，则寻找回中方向；否则瞄准蓝车
        let targetX = blue.x;
        let targetY = blue.y;
        if (headingToCliff && distFromCenter > state.arenaRadius - 40) {
          targetX = ARENA_CX;
          targetY = ARENA_CY;
        }

        const dx = targetX - red.x;
        const dy = targetY - red.y;
        const desiredAngle = Math.atan2(dy, dx);
        const diff = Math.abs(normalizeAngle(desiredAngle - red.angle));

        const distToBlue = Math.hypot(blue.x - red.x, blue.y - red.y);
        const canFinishBlue = distToBlue < 55 && diff < 0.45;
        const shouldThrust = (diff < 0.32 && !headingToCliff && !inertiaCliffDanger) || canFinishBlue;

        if (red.thrusting !== shouldThrust) {
          state = setCarThrust(state, 'red', shouldThrust);
        }
      }
    }

    assert.equal(state.status, 'match_won', `Level ${level.id} (${level.key}) should be won by skilled player within ${maxSec}s`);
  }
});
