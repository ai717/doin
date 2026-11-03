import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  handlePullAction,
  stepFrame,
  WIN_DISTANCE,
  createRng,
} from '../js/engine.mjs';

test('engine: initial state creation', () => {
  const state = createInitialState({ mode: '1p' });
  assert.equal(state.mode, '1p');
  assert.equal(state.status, 'countdown');
  assert.equal(state.ropeX, 0);
  assert.equal(state.ropeV, 0);
  assert.equal(state.round, 1);
  assert.equal(state.scores.red, 0);
  assert.equal(state.scores.blue, 0);
});

test('engine: pull action moves rope in correct direction', () => {
  let state = createInitialState({ mode: '2p' });
  state.status = 'pulling';

  // 红方向左拉
  const resRed = handlePullAction(state, 'red');
  state = resRed.state;
  assert.ok(resRed.actionResult);
  assert.ok(state.ropeV < 0, 'Red pull should generate negative velocity (pulling left)');
  assert.equal(state.stats.redTaps, 1);

  // 蓝方向右拉
  const resBlue = handlePullAction(state, 'blue');
  state = resBlue.state;
  assert.ok(resBlue.actionResult);
  assert.equal(state.stats.blueTaps, 1);
});

test('engine: round win triggers at WIN_DISTANCE', () => {
  let state = createInitialState({ mode: '1p' });
  state.status = 'pulling';
  state.ropeX = -WIN_DISTANCE + 1;
  state.ropeV = -20;

  // 演进几帧跨过胜负线
  state = stepFrame(state, 0.1);
  assert.equal(state.status, 'round_end');
  assert.equal(state.roundWinner, 'red');
  assert.equal(state.scores.red, 1);
});

test('engine: >= 1000 steps random walk invariant test', () => {
  let state = createInitialState({ mode: '2p', seed: 987654321 });
  const rng = createRng(5555555);

  for (let step = 0; step < 1200; step++) {
    const dt = 0.016; // 60 FPS
    state = stepFrame(state, dt);

    // 随机敲击输入
    if (rng() < 0.25) {
      const side = rng() < 0.5 ? 'red' : 'blue';
      const { state: nextState } = handlePullAction(state, side);
      state = nextState;
    }

    // 断言不变量
    assert.ok(!Number.isNaN(state.ropeX), `ropeX is NaN at step ${step}`);
    assert.ok(!Number.isNaN(state.ropeV), `ropeV is NaN at step ${step}`);
    assert.ok(Number.isFinite(state.ropeX), `ropeX not finite at step ${step}`);
    assert.ok(Math.abs(state.ropeX) <= WIN_DISTANCE + 1, `ropeX exceeded boundary: ${state.ropeX}`);
    assert.ok(state.round >= 1 && state.round <= 3, `round out of bounds: ${state.round}`);
    assert.ok(state.scores.red >= 0 && state.scores.red <= 2);
    assert.ok(state.scores.blue >= 0 && state.scores.blue <= 2);
  }
});
