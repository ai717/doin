import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  calculateAngularVelocity,
  launchPin,
  stepFrame,
  normalizeAngle,
  angleDiff,
  degToRad,
  createRng,
} from '../js/engine.mjs';
import { getLevelById } from '../js/levels.mjs';

test('engine: angle normalization and angleDiff', () => {
  assert.equal(normalizeAngle(0), 0);
  assert.ok(Math.abs(normalizeAngle(Math.PI * 2.5) - Math.PI * 0.5) < 0.0001);
  assert.ok(Math.abs(normalizeAngle(-Math.PI * 0.5) - Math.PI * 1.5) < 0.0001);

  // 最小绝对夹角
  assert.ok(Math.abs(angleDiff(0, Math.PI * 0.5) - Math.PI * 0.5) < 0.0001);
  assert.ok(Math.abs(angleDiff(0.1, 6.2) - (0.1 + (Math.PI * 2 - 6.2))) < 0.0001);
});

test('engine: calculateAngularVelocity for multiple rotation dynamics', () => {
  const lvlConstant = { rotationType: 'constant', baseSpeed: 1.5 };
  assert.equal(calculateAngularVelocity(lvlConstant, 0), 1.5);
  assert.equal(calculateAngularVelocity(lvlConstant, 5.0), 1.5);

  const lvlPendulum = { rotationType: 'pendulum', baseSpeed: 2.0, speedFreq: 1.0 };
  assert.ok(Math.abs(calculateAngularVelocity(lvlPendulum, 0) - 2.0) < 0.0001);
  assert.ok(Math.abs(calculateAngularVelocity(lvlPendulum, Math.PI / 2)) < 0.0001);

  const lvlPulse = { rotationType: 'pulse', baseSpeed: 1.5, speedAmp: 1.0, speedFreq: 1.0 };
  assert.ok(calculateAngularVelocity(lvlPulse, 1.0) !== 0);

  const lvlStutter = { rotationType: 'stutter', baseSpeed: 2.0, stutterInterval: 2.0 };
  assert.ok(calculateAngularVelocity(lvlStutter, 0.1) < 1.0); // 骤停
  assert.ok(calculateAngularVelocity(lvlStutter, 1.0) > 2.0); // 暴冲
});

test('engine: initial state creation', () => {
  const level1 = getLevelById(1);
  const state = createInitialState({ level: level1 });

  assert.equal(state.status, 'playing');
  assert.equal(state.wheelPins.length, 2);
  assert.equal(state.pendingCount, 6);
  assert.equal(state.flyingPins.length, 0);
  assert.equal(state.combo, 0);
});

test('engine: launchPin creates airborne flying pin', () => {
  const level1 = getLevelById(1);
  let state = createInitialState({ level: level1 });

  state = launchPin(state);
  assert.equal(state.pendingCount, 5);
  assert.equal(state.flyingPins.length, 1);
  assert.equal(state.totalLaunched, 1);
  assert.ok(state.events.some((ev) => ev.type === 'pin_launch'));
});

test('engine: flying pin advances and hits wheel safely', () => {
  const level1 = getLevelById(1);
  let state = createInitialState({ level: level1 });
  // 确保底部安全无预设针 (初始针在 0 和 PI，而底部是 PI/2)
  state.wheelAngle = 0; // 此时底部绝对角度为 PI/2，针在 0 与 PI，夹角为 PI/2 (90°) >> 10°

  state = launchPin(state);

  const allEvents = [...state.events];
  // 步进直至飞行的针扎入圆盘
  while (state.flyingPins.length > 0 && state.status === 'playing') {
    state = stepFrame(state, 0.02);
    allEvents.push(...state.events);
  }

  assert.equal(state.flyingPins.length, 0);
  assert.equal(state.wheelPins.length, 3);
  assert.equal(state.combo, 1);
  assert.equal(state.status, 'playing');
  assert.ok(allEvents.some((ev) => ev.type === 'pin_hit'));
});

test('engine: collision fails when needle angles clash', () => {
  const level1 = getLevelById(1);
  let state = createInitialState({ level: level1 });

  // 故意调整圆盘角度，使得已有针旋转到正下方 PI/2 处
  state.wheelAngle = Math.PI / 2;
  state.level.baseSpeed = 0; // 冻结自转以便精准测试碰撞

  state = launchPin(state);

  const allEvents = [...state.events];
  while (state.flyingPins.length > 0 && state.status === 'playing') {
    state = stepFrame(state, 0.02);
    allEvents.push(...state.events);
  }

  assert.equal(state.status, 'failed');
  assert.ok(state.collisionInfo);
  assert.ok(allEvents.some((ev) => ev.type === 'pin_collision'));
});

test('engine: >= 1000 steps random walk invariant test', () => {
  const level1 = getLevelById(1);
  let state = createInitialState({ level: level1, seed: 7777 });
  const rng = createRng(7777);

  for (let step = 0; step < 1000; step++) {
    const action = Math.floor(rng() * 4);

    if (action === 0) {
      state = launchPin(state);
    } else {
      state = stepFrame(state, 0.03);
    }

    // 不变量断言
    assert.ok(typeof state.wheelAngle === 'number' && !isNaN(state.wheelAngle));
    assert.ok(typeof state.elapsedTime === 'number' && !isNaN(state.elapsedTime));
    assert.ok(state.wheelPins.length >= 2);

    if (state.status === 'failed' || state.status === 'won') {
      // 快速重置以继续游走
      state = createInitialState({ level: level1, seed: 7777 + step });
    }
  }
});
