import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  synthesizeGlyphs,
  disassembleGlyph,
  sliceSceneObstacle,
  applyGlyphToObstacle,
  undo,
  findSynthesisResult
} from '../js/engine.mjs';
import { GLYPH_TYPES, OBSTACLE_TYPES } from '../js/data.mjs';
import { getLevelById } from '../js/levels.mjs';

test('engine: synthesis of glyphs creates compound', () => {
  assert.equal(findSynthesisResult(GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD), GLYPH_TYPES.LIN);
  assert.equal(findSynthesisResult(GLYPH_TYPES.SUN, GLYPH_TYPES.MOON), GLYPH_TYPES.MING);
  assert.equal(findSynthesisResult(GLYPH_TYPES.WOOD, GLYPH_TYPES.FIRE), GLYPH_TYPES.FEN);

  const level = getLevelById(2); // Initial glyphs: [WOOD, WOOD]
  const state = createInitialState(level);

  assert.equal(state.trayGlyphs.length, 2);
  const uidA = state.trayGlyphs[0].uid;
  const uidB = state.trayGlyphs[1].uid;

  const res = synthesizeGlyphs(state, uidA, uidB);
  assert.equal(res.success, true);
  assert.equal(state.trayGlyphs.length, 1);
  assert.equal(state.trayGlyphs[0].id, GLYPH_TYPES.LIN);
  assert.equal(state.steps, 1);
});

test('engine: disassembly of compound glyph', () => {
  const level = getLevelById(8); // Initial glyphs: [LEI_THUNDER]
  const state = createInitialState(level);

  assert.equal(state.trayGlyphs.length, 1);
  const uid = state.trayGlyphs[0].uid;

  const res = disassembleGlyph(state, uid);
  assert.equal(res.success, true);
  assert.equal(state.trayGlyphs.length, 2);
  const ids = state.trayGlyphs.map(g => g.id).sort();
  assert.deepEqual(ids, [GLYPH_TYPES.FIELD, GLYPH_TYPES.RAIN].sort());
  assert.equal(state.steps, 1);
});

test('engine: slice obstacle extracts components', () => {
  const level = getLevelById(3); // Has FOREST_BLOCK
  const state = createInitialState(level);

  const forestObs = state.obstacles.find(o => o.type === OBSTACLE_TYPES.FOREST_BLOCK);
  assert.ok(forestObs);

  const res = sliceSceneObstacle(state, forestObs.id);
  assert.equal(res.success, true);
  assert.equal(forestObs.resolved, true);
  // Yielded 3 woods + initial 1 fire = 4 tray glyphs
  assert.equal(state.trayGlyphs.length, 4);
});

test('engine: physical reaction on obstacle resolves and checks victory', () => {
  const level = getLevelById(1); // 1 obstacle: WOOD_BARRIER, 1 glyph: FIRE
  const state = createInitialState(level);

  assert.equal(state.won, false);
  const glyphUid = state.trayGlyphs[0].uid;
  const obsId = state.obstacles[0].id;

  const res = applyGlyphToObstacle(state, glyphUid, obsId);
  assert.equal(res.success, true);
  assert.equal(state.obstacles[0].resolved, true);
  assert.equal(state.won, true);
  assert.equal(state.hero.hasReached, true);
});

test('engine: infinite undo restores exact state', () => {
  const level = getLevelById(1);
  const state = createInitialState(level);

  const glyphUid = state.trayGlyphs[0].uid;
  const obsId = state.obstacles[0].id;

  applyGlyphToObstacle(state, glyphUid, obsId);
  assert.equal(state.won, true);
  assert.equal(state.steps, 1);
  assert.equal(state.trayGlyphs.length, 0);

  const undoRes = undo(state);
  assert.equal(undoRes.success, true);
  assert.equal(state.won, false);
  assert.equal(state.steps, 0);
  assert.equal(state.trayGlyphs.length, 1);
  assert.equal(state.obstacles[0].resolved, false);
});

test('engine: >= 1000 steps random walk invariant test', () => {
  const level = getLevelById(4);
  const state = createInitialState(level);

  for (let i = 0; i < 1000; i++) {
    const actionChoice = Math.floor(Math.random() * 5);

    if (actionChoice === 0 && state.trayGlyphs.length >= 2) {
      // Try synthesize
      const i1 = Math.floor(Math.random() * state.trayGlyphs.length);
      let i2 = Math.floor(Math.random() * state.trayGlyphs.length);
      if (i1 !== i2) {
        synthesizeGlyphs(state, state.trayGlyphs[i1].uid, state.trayGlyphs[i2].uid);
      }
    } else if (actionChoice === 1 && state.trayGlyphs.length >= 1) {
      // Try disassemble
      const idx = Math.floor(Math.random() * state.trayGlyphs.length);
      disassembleGlyph(state, state.trayGlyphs[idx].uid);
    } else if (actionChoice === 2 && state.trayGlyphs.length >= 1 && state.obstacles.length >= 1) {
      // Try apply to obstacle
      const gIdx = Math.floor(Math.random() * state.trayGlyphs.length);
      const oIdx = Math.floor(Math.random() * state.obstacles.length);
      applyGlyphToObstacle(state, state.trayGlyphs[gIdx].uid, state.obstacles[oIdx].id);
    } else if (actionChoice === 3 && state.obstacles.length >= 1) {
      // Try slice obstacle
      const oIdx = Math.floor(Math.random() * state.obstacles.length);
      sliceSceneObstacle(state, state.obstacles[oIdx].id);
    } else {
      // Try undo
      undo(state);
    }

    // Invariant checks
    assert.ok(Array.isArray(state.trayGlyphs));
    assert.ok(Array.isArray(state.obstacles));
    assert.ok(state.steps >= 0);
    assert.ok(typeof state.won === 'boolean');
  }
});
