import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../js/game.mjs';

test('game: controller initialization', () => {
  const ctrl = new GameController();
  const state = ctrl.getState();

  assert.equal(ctrl.mode, 'ai');
  assert.equal(state.status, 'playing');
  assert.equal(state.scoreP1, 0);
  assert.equal(state.scoreP2, 0);
  assert.equal(ctrl.isPaused(), false);
});

test('game: mode toggle and level loading', () => {
  const ctrl = new GameController();
  ctrl.setMode('2p');
  assert.equal(ctrl.mode, '2p');
  assert.equal(ctrl.getState().mode, '2p');

  ctrl.loadLevel(5);
  assert.equal(ctrl.mode, 'ai');
  assert.equal(ctrl.currentLevelId, 5);
  assert.equal(ctrl.getState().level.id, 5);
});

test('game: pause and resume toggle', () => {
  const ctrl = new GameController();
  assert.equal(ctrl.isPaused(), false);

  ctrl.togglePause();
  assert.equal(ctrl.isPaused(), true);

  ctrl.resume();
  assert.equal(ctrl.isPaused(), false);

  ctrl.pause();
  assert.equal(ctrl.isPaused(), true);
});

test('game: step advances simulation when not paused', () => {
  const ctrl = new GameController();
  const initialTime = ctrl.getState().elapsedTime;

  ctrl.step(0.05);
  assert.ok(ctrl.getState().elapsedTime > initialTime);

  ctrl.pause();
  const pausedTime = ctrl.getState().elapsedTime;
  ctrl.step(0.05);
  assert.equal(ctrl.getState().elapsedTime, pausedTime, 'Paused controller should not advance simulation');
});
