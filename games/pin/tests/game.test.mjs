import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../js/game.mjs';

test('game: controller initialization', () => {
  const game = new GameController({ levelId: 1 });
  assert.equal(game.currentLevelId, 1);
  assert.equal(game.isPaused(), false);
  assert.equal(game.mode, 'level');
  const state = game.getState();
  assert.equal(state.status, 'playing');
  assert.equal(state.pendingCount, 6);
});

test('game: mode toggle and endless init', () => {
  const game = new GameController({ levelId: 1 });
  game.setMode('endless');
  assert.equal(game.mode, 'endless');
  assert.equal(game.getState().mode, 'endless');

  game.setMode('level');
  assert.equal(game.mode, 'level');
  assert.equal(game.getState().mode, 'level');
});

test('game: pause and resume toggle', () => {
  const game = new GameController({ levelId: 1 });
  game.pause();
  assert.equal(game.isPaused(), true);

  game.resume();
  assert.equal(game.isPaused(), false);

  game.togglePause();
  assert.equal(game.isPaused(), true);
});

test('game: launch and restart', () => {
  const game = new GameController({ levelId: 1 });
  game.launch();
  assert.equal(game.getState().flyingPins.length, 1);
  assert.equal(game.getState().pendingCount, 5);

  game.restart();
  assert.equal(game.getState().flyingPins.length, 0);
  assert.equal(game.getState().pendingCount, 6);
});
