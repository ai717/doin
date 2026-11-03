import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../js/game.mjs';

test('game: controller initialization', () => {
  const game = new GameController({ levelId: 1 });
  assert.equal(game.currentLevelId, 1);
  assert.equal(game.isPaused(), false);
  const state = game.getState();
  assert.equal(state.status, 'playing');
  assert.equal(state.items.length, 3);
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

test('game: restart and loadLevel', () => {
  const game = new GameController({ levelId: 1 });
  game.pickUp('pencil', 100, 100);
  game.restart();

  assert.equal(game.getState().heldItemId, null);
  assert.equal(game.getState().moves, 0);

  game.loadLevel(2);
  assert.equal(game.currentLevelId, 2);
  assert.equal(game.getState().items.length, 4);
});
