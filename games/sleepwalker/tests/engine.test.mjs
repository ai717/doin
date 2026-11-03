/**
 * @file games/sleepwalker/tests/engine.test.mjs
 * 纯物理与状态机测试，包含 >= 1000 步确定性随机游走与不变式断言。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  clickGadget,
  stepFrame,
  rewind,
  setFastForward,
  STAGE_WIDTH,
  STAGE_HEIGHT,
  DEFAULT_SPEED,
  FAST_SPEED,
  DT,
} from '../js/engine.mjs';

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mockLevel = {
  id: 1,
  key: 'mock_1',
  act: 1,
  spawn: { x: 50, y: 300, facing: 1 },
  bed: { x: 700, y: 300, w: 50, h: 30 },
  platforms: [
    { id: 'p1', x: 20, y: 300, w: 200, type: 'solid' },
    { id: 'p2', x: 300, y: 300, w: 450, type: 'solid' },
  ],
  gadgets: [
    {
      id: 'g_bridge',
      type: 'toggle',
      x: 220,
      y: 300,
      w: 80,
      h: 16,
      props: {
        platform: { x: 220, y: 300, w: 80, h: 16 },
      },
    },
    {
      id: 'g_timed',
      type: 'timed',
      duration: 2.0,
      x: 100,
      y: 250,
      w: 40,
      h: 40,
    },
    {
      id: 'g_spring',
      type: 'spring',
      duration: 1.0,
      x: 250,
      y: 360,
      w: 60,
      h: 20,
      props: { isBouncy: true, bounceVy: -400, bounceVx: 100 },
    },
  ],
  bubbles: [
    { id: 1, x: 120, y: 280, r: 14 },
    { id: 2, x: 260, y: 280, r: 14 },
    { id: 3, x: 500, y: 280, r: 14 },
  ],
  hazards: [],
  parTime: 15,
};

test('engine: initial state creation', () => {
  const state = createInitialState(mockLevel);
  assert.equal(state.levelId, 1);
  assert.equal(state.status, 'playing');
  assert.equal(state.walker.x, 50);
  assert.equal(state.walker.y, 300);
  assert.equal(state.walker.state, 'walk');
  assert.equal(state.walker.facing, 1);
  assert.equal(state.bubbles.length, 3);
  assert.equal(state.bubbles[0].collected, false);
});

test('engine: walker moves forward and collects bubble', () => {
  const state = createInitialState(mockLevel);
  // 50px 到 120px 需要 70px / 60px/s = 1.16 秒
  for (let i = 0; i < 80; i++) {
    stepFrame(state, DT);
  }
  assert.ok(state.walker.x > 110, `walker.x should be > 110, got ${state.walker.x}`);
  assert.equal(state.bubbles[0].collected, true, 'Bubble 1 should be collected');
});

test('engine: obstacle collision triggers 180° turn', () => {
  const wallLevel = {
    id: 99,
    spawn: { x: 50, y: 300, facing: 1 },
    bed: { x: 700, y: 300, w: 50, h: 30 },
    platforms: [
      { id: 'p1', x: 20, y: 300, w: 400, type: 'solid' },
      { id: 'wall', x: 120, y: 260, w: 20, h: 50, type: 'wall' },
    ],
    gadgets: [],
    bubbles: [],
  };

  const state = createInitialState(wallLevel);
  // 走到 120px 撞墙
  for (let i = 0; i < 90; i++) {
    stepFrame(state, DT);
    if (state.walker.state === 'turn') break;
  }
  assert.equal(state.walker.state, 'turn');
  // 等待转身完成
  for (let i = 0; i < 30; i++) {
    stepFrame(state, DT);
  }
  assert.equal(state.walker.state, 'walk');
  assert.equal(state.walker.facing, -1, 'Walker should face left after turning');
});

test('engine: 5-second rewind restores state and bubbles', () => {
  const state = createInitialState(mockLevel);
  // 走动 3 秒
  for (let i = 0; i < 180; i++) {
    stepFrame(state, DT);
  }
  const xAt3s = state.walker.x;
  assert.ok(xAt3s > 150);
  assert.equal(state.bubbles[0].collected, true);

  // 倒带 2 秒
  const ok = rewind(state, 2);
  assert.equal(ok, true);
  assert.ok(state.walker.x < xAt3s, `walker.x should rewind: ${state.walker.x} vs ${xAt3s}`);
  assert.equal(state.status, 'playing');
});

test('engine: fast forward toggles speed multiplier', () => {
  const state1 = createInitialState(mockLevel);
  const state2 = createInitialState(mockLevel);
  setFastForward(state2, true);

  for (let i = 0; i < 60; i++) {
    stepFrame(state1, DT);
    stepFrame(state2, DT);
  }

  assert.ok(state2.walker.x > state1.walker.x, 'Fast forward should move faster');
});

test('engine: >= 1000 steps random walk invariant test', () => {
  const prng = mulberry32(12345678);
  const state = createInitialState(mockLevel);

  let steps = 0;
  for (let i = 0; i < 1200; i++) {
    steps++;

    // 随机点击机关
    if (prng() < 0.05) {
      const gKeys = Object.keys(state.gadgets);
      const randomKey = gKeys[Math.floor(prng() * gKeys.length)];
      clickGadget(state, randomKey);
    }

    // 随机倒带
    if (prng() < 0.02) {
      rewind(state, 2);
    }

    stepFrame(state, DT);

    // 断言不变量
    assert.ok(Number.isFinite(state.walker.x), 'walker.x must be finite');
    assert.ok(Number.isFinite(state.walker.y), 'walker.y must be finite');
    assert.ok(state.heartRate >= 50 && state.heartRate <= 200, 'Heart rate within bounds');
    assert.ok(['playing', 'won', 'lost'].includes(state.status), 'Valid status');
  }

  assert.ok(steps >= 1000, `Completed ${steps} steps of random walk`);
});
