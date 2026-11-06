import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  stepFrame,
  setInput,
  triggerDash,
  resetRound,
  createRng,
  LEFT_WALL,
  RIGHT_WALL,
  TOP_WALL,
  BOTTOM_WALL,
  CENTER_X,
  PUCK_RADIUS,
  STRIKER_RADIUS,
} from '../js/engine.mjs';
import { getLevelById } from '../js/levels.mjs';

test('engine: initial state structure and constraints', () => {
  const state = createInitialState();
  assert.equal(state.status, 'playing');
  assert.equal(state.scoreP1, 0);
  assert.equal(state.scoreP2, 0);
  assert.equal(state.targetScore, 5);

  // P1 in left half-court, P2 in right half-court
  assert.ok(state.p1.x < CENTER_X);
  assert.ok(state.p2.x > CENTER_X);
  assert.ok(state.puck.x === CENTER_X);
});

test('engine: striker-puck 2D collision gives impulse and velocity', () => {
  let state = createInitialState();
  // Place puck directly in front of P1
  state.puck.x = 220;
  state.puck.y = 240;
  state.puck.vx = 0;
  state.puck.vy = 0;

  state.p1.x = 180;
  state.p1.y = 240;
  state.p1.inputX = 1; // P1 driving forward towards puck

  // Step a few frames to let P1 hit the puck
  let hitEvent = null;
  for (let i = 0; i < 10; i++) {
    state = stepFrame(state, 0.02);
    const ev = state.events.find((e) => e.type === 'puck_hit');
    if (ev) {
      hitEvent = ev;
      break;
    }
  }

  assert.ok(hitEvent, 'P1 should hit the puck');
  assert.equal(hitEvent.side, 'p1');
  assert.ok(state.puck.vx > 0, 'Puck must gain positive X velocity towards opponent');
  assert.ok(state.puck.x > state.p1.x + STRIKER_RADIUS + PUCK_RADIUS - 1, 'Puck must not overlap striker');
});

test('engine: dash smash gives explosive velocity boost', () => {
  let normalState = createInitialState();
  normalState.puck.x = 220;
  normalState.puck.y = 240;
  normalState.p1.x = 180;
  normalState.p1.y = 240;
  normalState.p1.inputX = 1;

  for (let i = 0; i < 10; i++) {
    normalState = stepFrame(normalState, 0.02);
    if (normalState.events.some((e) => e.type === 'puck_hit')) break;
  }
  const normalSpeed = Math.hypot(normalState.puck.vx, normalState.puck.vy);

  let dashState = createInitialState();
  dashState.puck.x = 220;
  dashState.puck.y = 240;
  dashState.p1.x = 180;
  dashState.p1.y = 240;
  dashState.p1.inputX = 1;
  dashState = triggerDash(dashState, 'p1');
  assert.ok(dashState.p1.isDashing);

  for (let i = 0; i < 10; i++) {
    dashState = stepFrame(dashState, 0.02);
    if (dashState.events.some((e) => e.type === 'puck_hit')) break;
  }
  const dashSpeed = Math.hypot(dashState.puck.vx, dashState.puck.vy);

  assert.ok(dashSpeed > normalSpeed, `Dash speed (${dashSpeed}) must exceed normal speed (${normalSpeed})`);
});

test('engine: striker cannot cross half-court center line', () => {
  let state = createInitialState();
  state.p1.x = CENTER_X - STRIKER_RADIUS - 5;
  state.p1.inputX = 1; // trying to push across center line

  for (let i = 0; i < 20; i++) {
    state = stepFrame(state, 0.02);
  }

  assert.ok(
    state.p1.x <= CENTER_X - STRIKER_RADIUS,
    `P1 striker (${state.p1.x}) must remain in left half-court (<= ${CENTER_X - STRIKER_RADIUS})`
  );
});

test('engine: goal scoring and BO5 match victory', () => {
  let state = createInitialState({ targetScore: 2 });
  // Place puck moving fast into P2's goal
  state.puck.x = RIGHT_WALL - 10;
  state.puck.y = 240;
  state.puck.vx = 800;
  state.puck.vy = 0;

  state = stepFrame(state, 0.03);
  assert.equal(state.scoreP1, 1, 'P1 should score a goal');
  assert.equal(state.status, 'round_reset', 'Game enters round reset state after goal');

  // Fast forward reset
  state.roundResetTimer = 0.01;
  state = stepFrame(state, 0.02);
  assert.equal(state.status, 'playing', 'New round starts');

  // Score 2nd goal
  state.puck.x = RIGHT_WALL - 10;
  state.puck.y = 240;
  state.puck.vx = 800;
  state.puck.vy = 0;
  state = stepFrame(state, 0.03);

  assert.equal(state.scoreP1, 2);
  assert.equal(state.status, 'won');
  assert.equal(state.winner, 'p1');
});

test('engine: table booster accelerates puck', () => {
  const levelWithBooster = getLevelById(10);
  let state = createInitialState({ level: levelWithBooster });
  // Place puck heading towards booster at (420, 240)
  state.puck.x = 390;
  state.puck.y = 240;
  state.puck.vx = 300;
  state.puck.vy = 0;

  let boosterTriggered = false;
  for (let i = 0; i < 10; i++) {
    state = stepFrame(state, 0.02);
    if (state.events.some((e) => e.type === 'booster_trigger')) {
      boosterTriggered = true;
      break;
    }
  }

  assert.ok(boosterTriggered, 'Puck should trigger the booster');
  assert.ok(state.puck.vx > 350, 'Booster must increase puck velocity');
});

test('engine: >= 1000 steps random walk invariant test', () => {
  const rng = createRng(42);
  let state = createInitialState();

  for (let step = 0; step < 1200; step++) {
    // Random inputs for P1 and P2
    const p1x = (rng() - 0.5) * 2;
    const p1y = (rng() - 0.5) * 2;
    const p2x = (rng() - 0.5) * 2;
    const p2y = (rng() - 0.5) * 2;

    state = setInput(state, 'p1', p1x, p1y);
    state = setInput(state, 'p2', p2x, p2y);

    if (rng() < 0.05) state = triggerDash(state, 'p1');
    if (rng() < 0.05) state = triggerDash(state, 'p2');

    state = stepFrame(state, 0.02);

    // If game ended, reset so simulation keeps walking
    if (state.status === 'won') {
      state = resetRound(state);
      state.scoreP1 = 0;
      state.scoreP2 = 0;
      state.status = 'playing';
    }

    // Invariant assertions
    assert.ok(!Number.isNaN(state.puck.x) && Number.isFinite(state.puck.x), `Puck X must be finite at step ${step}`);
    assert.ok(!Number.isNaN(state.puck.y) && Number.isFinite(state.puck.y), `Puck Y must be finite at step ${step}`);
    assert.ok(!Number.isNaN(state.p1.x) && Number.isFinite(state.p1.x), `P1 X must be finite at step ${step}`);
    assert.ok(!Number.isNaN(state.p2.x) && Number.isFinite(state.p2.x), `P2 X must be finite at step ${step}`);

    // Half-court boundary invariant
    assert.ok(state.p1.x <= CENTER_X - STRIKER_RADIUS + 0.1, `P1 must stay on left side at step ${step}`);
    assert.ok(state.p2.x >= CENTER_X + STRIKER_RADIUS - 0.1, `P2 must stay on right side at step ${step}`);

    // Arena vertical bounds invariant
    assert.ok(state.p1.y >= TOP_WALL + STRIKER_RADIUS - 0.1 && state.p1.y <= BOTTOM_WALL - STRIKER_RADIUS + 0.1);
    assert.ok(state.p2.y >= TOP_WALL + STRIKER_RADIUS - 0.1 && state.p2.y <= BOTTOM_WALL - STRIKER_RADIUS + 0.1);
  }
});
