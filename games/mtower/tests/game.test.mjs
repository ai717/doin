import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../js/game.mjs';

test('game: controller lifecycle, mode switch, and pause', () => {
  const ctrl = new GameController({ mode: 'classic50' });
  const s0 = ctrl.getState();
  assert.equal(s0.mode, 'classic50');
  assert.equal(s0.currentFloor, 1);
  assert.equal(ctrl.isPaused(), false);

  // Pause toggle
  ctrl.togglePause();
  assert.equal(ctrl.isPaused(), true);
  ctrl.move(0, -1);
  // When paused, hero does not move
  assert.equal(ctrl.getState().hero.y, s0.hero.y);

  ctrl.resume();
  assert.equal(ctrl.isPaused(), false);

  // Mode switch
  ctrl.setMode('fast25');
  assert.equal(ctrl.mode, 'fast25');
  assert.equal(ctrl.getState().floors.length, 25);
});
