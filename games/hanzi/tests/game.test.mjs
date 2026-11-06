import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../js/game.mjs';

test('game: controller lifecycle, level change, pause and reset', () => {
  const ctrl = new GameController();
  ctrl.init(1);

  const s1 = ctrl.getState();
  assert.equal(s1.levelId, 1);
  assert.equal(s1.paused, false);
  assert.equal(s1.engine.won, false);
  assert.equal(s1.engine.trayGlyphs.length, 1);

  // Pause
  const p1 = ctrl.togglePause();
  assert.equal(p1, true);
  assert.equal(ctrl.getState().paused, true);

  // Resume
  const p2 = ctrl.togglePause(false);
  assert.equal(p2, false);
  assert.equal(ctrl.getState().paused, false);

  // Apply glyph
  const glyphUid = s1.engine.trayGlyphs[0].uid;
  const obsId = s1.engine.obstacles[0].id;
  const res = ctrl.applyGlyph(glyphUid, obsId);
  assert.equal(res.success, true);
  assert.equal(ctrl.getState().engine.won, true);

  // Reset
  ctrl.resetLevel();
  assert.equal(ctrl.getState().engine.won, false);
  assert.equal(ctrl.getState().engine.steps, 0);

  // Switch level
  ctrl.startLevel(5);
  assert.equal(ctrl.getState().levelId, 5);
});
