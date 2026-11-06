import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, CHAPTERS, getLevelById, getTotalLevels } from '../js/levels.mjs';
import {
  createInitialState,
  synthesizeGlyphs,
  disassembleGlyph,
  sliceSceneObstacle,
  applyGlyphToObstacle
} from '../js/engine.mjs';
import { GLYPH_TYPES, OBSTACLE_TYPES } from '../js/data.mjs';

test('levels: chapter and level structure verification', () => {
  assert.equal(getTotalLevels(), 22);
  assert.equal(LEVELS.length, 22);
  assert.equal(CHAPTERS.length, 5);

  const chapCounts = [0, 0, 0, 0, 0, 0];
  LEVELS.forEach((lvl, idx) => {
    assert.equal(lvl.id, idx + 1);
    assert.ok(lvl.chapterId >= 1 && lvl.chapterId <= 5);
    chapCounts[lvl.chapterId]++;
    assert.ok(lvl.optimalSteps >= 1);
    assert.ok(lvl.initialGlyphs.length >= 1);
    assert.ok(lvl.obstacles.length >= 1);
    assert.ok(lvl.hero.startX < lvl.hero.endX);
    assert.ok(lvl.eggGlyph);
    assert.ok(lvl.poemKey);
  });

  // Verify 4/5/5/4/4 chapter structure
  assert.deepEqual(chapCounts.slice(1), [4, 5, 5, 4, 4]);
});

test('levels: all 22 levels have valid solutions to victory', () => {
  for (let id = 1; id <= 22; id++) {
    const level = getLevelById(id);
    const state = createInitialState(level);

    if (id === 1) {
      applyGlyphToObstacle(state, state.trayGlyphs[0].uid, state.obstacles[0].id);
    } else if (id === 2) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid);
      applyGlyphToObstacle(state, state.trayGlyphs[0].uid, state.obstacles[0].id);
    } else if (id === 3) {
      sliceSceneObstacle(state, state.obstacles[0].id);
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid);
      applyGlyphToObstacle(state, state.trayGlyphs[state.trayGlyphs.length - 1].uid, state.obstacles[1].id);
    } else if (id === 4) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid); // Fire + Fire -> Yan
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid); // Fire + Wood -> Fen
      const yanGlyph = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.YAN);
      const fenGlyph = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.FEN);
      applyGlyphToObstacle(state, yanGlyph.uid, state.obstacles[1].id);
      applyGlyphToObstacle(state, fenGlyph.uid, state.obstacles[0].id);
    } else if (id === 5) {
      applyGlyphToObstacle(state, state.trayGlyphs[0].uid, state.obstacles[0].id);
    } else if (id === 6) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid);
      applyGlyphToObstacle(state, state.trayGlyphs[0].uid, state.obstacles[0].id);
    } else if (id === 7) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid);
      applyGlyphToObstacle(state, state.trayGlyphs[0].uid, state.obstacles[0].id);
    } else if (id === 8) {
      disassembleGlyph(state, state.trayGlyphs[0].uid);
      const rain = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.RAIN);
      const field = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.FIELD);
      applyGlyphToObstacle(state, rain.uid, state.obstacles[0].id);
      applyGlyphToObstacle(state, field.uid, state.obstacles[1].id);
    } else if (id === 9) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid);
      const fen = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.FEN);
      const water = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.WATER);
      applyGlyphToObstacle(state, fen.uid, state.obstacles[0].id);
      applyGlyphToObstacle(state, water.uid, state.obstacles[1].id);
    } else if (id === 10) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid);
      applyGlyphToObstacle(state, state.trayGlyphs[0].uid, state.obstacles[0].id);
    } else if (id === 11) {
      disassembleGlyph(state, state.trayGlyphs[0].uid);
      const sun = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.SUN);
      applyGlyphToObstacle(state, sun.uid, state.obstacles[0].id);
    } else if (id === 12) {
      disassembleGlyph(state, state.trayGlyphs[0].uid);
      const sun = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.SUN);
      const water = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.WATER);
      applyGlyphToObstacle(state, sun.uid, state.obstacles[0].id);
      applyGlyphToObstacle(state, water.uid, state.obstacles[1].id);
    } else if (id === 13) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid);
      const ming = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.MING);
      const wood = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.WOOD);
      applyGlyphToObstacle(state, ming.uid, state.obstacles[0].id);
      applyGlyphToObstacle(state, wood.uid, state.obstacles[1].id);
    } else if (id === 14) {
      const ming = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.MING);
      applyGlyphToObstacle(state, ming.uid, state.obstacles[0].id);
      const water = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.WATER);
      const ice = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.ICE);
      synthesizeGlyphs(state, water.uid, ice.uid);
      const bing = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.BING);
      applyGlyphToObstacle(state, bing.uid, state.obstacles[1].id);
    } else if (id === 15) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid);
      applyGlyphToObstacle(state, state.trayGlyphs[0].uid, state.obstacles[0].id);
    } else if (id === 16) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid);
      applyGlyphToObstacle(state, state.trayGlyphs[0].uid, state.obstacles[0].id);
    } else if (id === 17) {
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid); // Mountain + Mountain -> Chu
      synthesizeGlyphs(state, state.trayGlyphs[0].uid, state.trayGlyphs[1].uid); // Mountain + Stone -> Yan_Rock
      const chu = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.CHU);
      const yanRock = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.YAN_ROCK);
      applyGlyphToObstacle(state, yanRock.uid, state.obstacles[0].id);
      applyGlyphToObstacle(state, chu.uid, state.obstacles[1].id);
    } else if (id === 18) {
      disassembleGlyph(state, state.trayGlyphs[0].uid);
      const mountains = state.trayGlyphs.filter(g => g.id === GLYPH_TYPES.MOUNTAIN);
      const stone = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.STONE);
      synthesizeGlyphs(state, mountains[0].uid, stone.uid);
      const yanRock = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.YAN_ROCK);
      applyGlyphToObstacle(state, yanRock.uid, state.obstacles[0].id);
      const water = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.WATER);
      applyGlyphToObstacle(state, water.uid, state.obstacles[1].id);
    } else if (id === 19) {
      const thunder = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.LEI_THUNDER);
      const water = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.WATER);
      applyGlyphToObstacle(state, thunder.uid, state.obstacles[0].id);
      applyGlyphToObstacle(state, water.uid, state.obstacles[1].id);
    } else if (id === 20) {
      const fen = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.FEN);
      applyGlyphToObstacle(state, fen.uid, state.obstacles[0].id);
      const water = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.WATER);
      const ice = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.ICE);
      synthesizeGlyphs(state, water.uid, ice.uid);
      const bing = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.BING);
      applyGlyphToObstacle(state, bing.uid, state.obstacles[1].id);
    } else if (id === 21) {
      const lei = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.LEI_THUNDER);
      disassembleGlyph(state, lei.uid);
      const sen = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.SEN);
      disassembleGlyph(state, sen.uid);
      const rain = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.RAIN);
      const field = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.FIELD);
      const wood = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.WOOD);
      applyGlyphToObstacle(state, rain.uid, state.obstacles[0].id);
      applyGlyphToObstacle(state, field.uid, state.obstacles[1].id);
      applyGlyphToObstacle(state, wood.uid, state.obstacles[2].id);
    } else if (id === 22) {
      const ming = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.MING);
      const lei = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.LEI_THUNDER);
      const wood = state.trayGlyphs.find(g => g.id === GLYPH_TYPES.WOOD);
      applyGlyphToObstacle(state, ming.uid, state.obstacles[0].id);
      applyGlyphToObstacle(state, lei.uid, state.obstacles[1].id);
      applyGlyphToObstacle(state, wood.uid, state.obstacles[2].id);
    }

    assert.equal(state.won, true, `Level ${id} should be won with valid solution`);
  }
});
