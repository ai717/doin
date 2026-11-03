import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  setCarThrust,
  stepFrame,
  ARENA_CX,
  ARENA_CY,
  MAX_SPEED,
  createRng,
} from '../js/engine.mjs';

test('engine: initial state creation', () => {
  const state = createInitialState({ mode: '1p' });
  assert.equal(state.mode, '1p');
  assert.equal(state.status, 'countdown');
  assert.equal(state.targetScore, 5);
  assert.ok(state.cars.red);
  assert.ok(state.cars.blue);
  assert.equal(state.scores.red, 0);
  assert.equal(state.scores.blue, 0);
});

test('engine: thrust accelerates car forward and clamps to MAX_SPEED', () => {
  let state = createInitialState({ mode: '2p' });
  state.status = 'playing';
  // 将蓝车置于竞技场上方安全区域以避免早期碰撞或掉出悬崖
  state.cars.blue.y = ARENA_CY - 120;

  // 红车朝向为 0 (向右)
  state.cars.red.angle = 0;
  state = setCarThrust(state, 'red', true);

  // 步进 8 帧加速
  for (let i = 0; i < 8; i++) {
    state = stepFrame(state, 0.05);
  }

  assert.ok(state.cars.red.vx > 100, 'Car should have accelerated forward');

  // 人为设置高速度，测试极速截断逻辑
  state.cars.red.vx = 450;
  state = stepFrame(state, 0.05);
  const speed = Math.hypot(state.cars.red.vx, state.cars.red.vy);
  assert.ok(speed <= MAX_SPEED + 0.1, `Speed ${speed} should not exceed MAX_SPEED ${MAX_SPEED}`);
});

test('engine: release alternates spin direction', () => {
  let state = createInitialState({ mode: '2p' });
  state.status = 'playing';

  state = setCarThrust(state, 'red', true);
  const initialSpinDir = state.cars.red.spinDir;

  state = setCarThrust(state, 'red', false);
  assert.equal(state.cars.red.spinDir, -initialSpinDir, 'Spin direction should invert on release');
});

test('engine: double-tap triggers emergency brake', () => {
  let state = createInitialState({ mode: '2p' });
  state.status = 'playing';
  state.cars.red.vx = 200;
  state.cars.red.vy = 0;

  // 第一次释放
  state = setCarThrust(state, 'red', false);
  state.roundTime = 1.0;
  state.cars.red.lastReleaseTime = 1.0;

  // 快速在 0.1s 内再次按下
  state.roundTime = 1.08;
  state = setCarThrust(state, 'red', true);

  assert.ok(state.cars.red.vx < 50, 'Velocity should drop sharply upon double-tap brake');
  assert.ok(state.stats.redBrakes >= 1);
});

test('engine: rigid-body collision impulse pushes cars apart', () => {
  let state = createInitialState({ mode: '2p' });
  state.status = 'playing';

  // 两车近距离相对对撞
  state.cars.red.x = 385;
  state.cars.red.y = 240;
  state.cars.red.vx = 150;

  state.cars.blue.x = 415;
  state.cars.blue.y = 240;
  state.cars.blue.vx = -150;

  state = stepFrame(state, 0.02);

  // 对撞后红车应被弹回左方 (vx < 0)，蓝车被弹回右方 (vx > 0)
  assert.ok(state.cars.red.vx < 0, 'Red car should bounce backward');
  assert.ok(state.cars.blue.vx > 0, 'Blue car should bounce backward');
  assert.ok(state.stats.collisions >= 1);
});

test('engine: fall-off triggers round win for opponent', () => {
  let state = createInitialState({ mode: '1p' });
  state.status = 'playing';

  // 强行将蓝车移动至擂台外深渊
  state.cars.blue.x = ARENA_CX + 350;
  state.cars.blue.y = ARENA_CY;

  state = stepFrame(state, 0.02);

  assert.equal(state.cars.blue.fallen, true);
  assert.equal(state.status, 'round_end');
  assert.equal(state.roundWinner, 'red');
  assert.equal(state.scores.red, 1);
});

test('engine: >= 1000 steps random walk invariant test', () => {
  let state = createInitialState({ mode: '2p', seed: 444333 });
  const rng = createRng(777777);

  for (let step = 0; step < 1200; step++) {
    const dt = 0.016;
    state = stepFrame(state, dt);

    // 随机敲击/释放
    if (rng() < 0.2) {
      const carId = rng() < 0.5 ? 'red' : 'blue';
      const isThrust = rng() < 0.6;
      state = setCarThrust(state, carId, isThrust);
    }

    // 断言不变量
    for (const id of ['red', 'blue']) {
      const car = state.cars[id];
      assert.ok(!Number.isNaN(car.x), `car ${id} x is NaN at step ${step}`);
      assert.ok(!Number.isNaN(car.y), `car ${id} y is NaN at step ${step}`);
      assert.ok(!Number.isNaN(car.vx), `car ${id} vx is NaN at step ${step}`);
      assert.ok(!Number.isNaN(car.vy), `car ${id} vy is NaN at step ${step}`);
      assert.ok(Number.isFinite(car.angle), `car ${id} angle not finite at step ${step}`);
    }

    assert.ok(state.scores.red >= 0 && state.scores.red <= 5);
    assert.ok(state.scores.blue >= 0 && state.scores.blue <= 5);
    assert.ok(state.round >= 1);
  }
});
