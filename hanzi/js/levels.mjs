/**
 * Glyph Craft (字灵拆拆乐) - 22 Levels across 5 Chapters (4/5/5/4/4)
 * Pure definitions, zero DOM, zero hardcoded Chinese.
 */

import { GLYPH_TYPES, OBSTACLE_TYPES } from './data.mjs';

export const CHAPTERS = [
  { id: 1, nameKey: 'chap_1_title', range: [1, 4] },
  { id: 2, nameKey: 'chap_2_title', range: [5, 9] },
  { id: 3, nameKey: 'chap_3_title', range: [10, 14] },
  { id: 4, nameKey: 'chap_4_title', range: [15, 18] },
  { id: 5, nameKey: 'chap_5_title', range: [19, 22] },
];

export const LEVELS = [
  // Chapter 1: 草木初萌 (Levels 1 - 4)
  {
    id: 1,
    chapterId: 1,
    nameKey: 'lvl_1_name',
    initialGlyphs: [GLYPH_TYPES.FIRE],
    obstacles: [
      { id: 'obs_1_1', type: OBSTACLE_TYPES.WOOD_BARRIER, x: 260, y: 140, nameKey: 'obs_wood_barrier' }
    ],
    hero: { startX: 100, startY: 140, endX: 420, endY: 140 },
    optimalSteps: 1,
    eggGlyph: GLYPH_TYPES.FIRE,
    poemKey: 'poem_1'
  },
  {
    id: 2,
    chapterId: 1,
    nameKey: 'lvl_2_name',
    initialGlyphs: [GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD],
    obstacles: [
      { id: 'obs_2_1', type: OBSTACLE_TYPES.DEEP_RAVINE, x: 260, y: 140, nameKey: 'obs_deep_ravine' }
    ],
    hero: { startX: 100, startY: 140, endX: 420, endY: 140 },
    optimalSteps: 2, // 1 synth Lin, 1 apply Lin
    eggGlyph: GLYPH_TYPES.LIN,
    poemKey: 'poem_2'
  },
  {
    id: 3,
    chapterId: 1,
    nameKey: 'lvl_3_name',
    initialGlyphs: [GLYPH_TYPES.FIRE],
    obstacles: [
      { id: 'obs_3_1', type: OBSTACLE_TYPES.FOREST_BLOCK, x: 220, y: 140, nameKey: 'obs_forest_block' },
      { id: 'obs_3_2', type: OBSTACLE_TYPES.WOOD_BARRIER, x: 330, y: 140, nameKey: 'obs_wood_barrier' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 3, // Slice Forest -> 3 Woods, 1 synth Fen (Wood+Fire), 1 apply Fen/Fire
    eggGlyph: GLYPH_TYPES.SEN,
    poemKey: 'poem_3'
  },
  {
    id: 4,
    chapterId: 1,
    nameKey: 'lvl_4_name',
    initialGlyphs: [GLYPH_TYPES.FIRE, GLYPH_TYPES.FIRE, GLYPH_TYPES.FIRE, GLYPH_TYPES.WOOD],
    obstacles: [
      { id: 'obs_4_1', type: OBSTACLE_TYPES.WOOD_BARRIER, x: 230, y: 140, nameKey: 'obs_wood_barrier' },
      { id: 'obs_4_2', type: OBSTACLE_TYPES.FOREST_BLOCK, x: 340, y: 140, nameKey: 'obs_forest_block' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 3, // Synth Yan (Fire+Fire), apply to Forest; Synth Fen (Wood+Fire), apply to Barrier
    eggGlyph: GLYPH_TYPES.YAN,
    poemKey: 'poem_4'
  },

  // Chapter 2: 江河汇流 (Levels 5 - 9)
  {
    id: 5,
    chapterId: 2,
    nameKey: 'lvl_5_name',
    initialGlyphs: [GLYPH_TYPES.WATER],
    obstacles: [
      { id: 'obs_5_1', type: OBSTACLE_TYPES.DRY_CANAL, x: 260, y: 140, nameKey: 'obs_dry_canal' }
    ],
    hero: { startX: 100, startY: 140, endX: 420, endY: 140 },
    optimalSteps: 1,
    eggGlyph: GLYPH_TYPES.WATER,
    poemKey: 'poem_5'
  },
  {
    id: 6,
    chapterId: 2,
    nameKey: 'lvl_6_name',
    initialGlyphs: [GLYPH_TYPES.WATER, GLYPH_TYPES.WATER],
    obstacles: [
      { id: 'obs_6_1', type: OBSTACLE_TYPES.DRY_CANAL, x: 260, y: 140, nameKey: 'obs_dry_canal' }
    ],
    hero: { startX: 100, startY: 140, endX: 420, endY: 140 },
    optimalSteps: 2, // Synth Miao, apply Miao
    eggGlyph: GLYPH_TYPES.MIAO,
    poemKey: 'poem_6'
  },
  {
    id: 7,
    chapterId: 2,
    nameKey: 'lvl_7_name',
    initialGlyphs: [GLYPH_TYPES.WATER, GLYPH_TYPES.ICE],
    obstacles: [
      { id: 'obs_7_1', type: OBSTACLE_TYPES.RUSHING_RIVER, x: 260, y: 140, nameKey: 'obs_rushing_river' }
    ],
    hero: { startX: 100, startY: 140, endX: 420, endY: 140 },
    optimalSteps: 2, // Synth Bing (Water+Ice), apply Bing
    eggGlyph: GLYPH_TYPES.BING,
    poemKey: 'poem_7'
  },
  {
    id: 8,
    chapterId: 2,
    nameKey: 'lvl_8_name',
    initialGlyphs: [GLYPH_TYPES.LEI_THUNDER],
    obstacles: [
      { id: 'obs_8_1', type: OBSTACLE_TYPES.RAGING_FIRE, x: 220, y: 140, nameKey: 'obs_raging_fire' },
      { id: 'obs_8_2', type: OBSTACLE_TYPES.MUD_SWAMP, x: 330, y: 140, nameKey: 'obs_mud_swamp' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 3, // Disassemble Lei -> Rain + Field; apply Rain to fire, Field to swamp
    eggGlyph: GLYPH_TYPES.LEI_THUNDER,
    poemKey: 'poem_8'
  },
  {
    id: 9,
    chapterId: 2,
    nameKey: 'lvl_9_name',
    initialGlyphs: [GLYPH_TYPES.WOOD, GLYPH_TYPES.FIRE, GLYPH_TYPES.WATER],
    obstacles: [
      { id: 'obs_9_1', type: OBSTACLE_TYPES.WOOD_BARRIER, x: 210, y: 140, nameKey: 'obs_wood_barrier' },
      { id: 'obs_9_2', type: OBSTACLE_TYPES.DRY_CANAL, x: 320, y: 140, nameKey: 'obs_dry_canal' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 3, // Synth Fen or apply Fire; apply Water to Canal
    eggGlyph: GLYPH_TYPES.FEN,
    poemKey: 'poem_9'
  },

  // Chapter 3: 日月同辉 (Levels 10 - 14)
  {
    id: 10,
    chapterId: 3,
    nameKey: 'lvl_10_name',
    initialGlyphs: [GLYPH_TYPES.SUN, GLYPH_TYPES.MOON],
    obstacles: [
      { id: 'obs_10_1', type: OBSTACLE_TYPES.DARK_CAVERN, x: 260, y: 140, nameKey: 'obs_dark_cavern' }
    ],
    hero: { startX: 100, startY: 140, endX: 420, endY: 140 },
    optimalSteps: 2, // Synth Ming, apply Ming
    eggGlyph: GLYPH_TYPES.MING,
    poemKey: 'poem_10'
  },
  {
    id: 11,
    chapterId: 3,
    nameKey: 'lvl_11_name',
    initialGlyphs: [GLYPH_TYPES.MING],
    obstacles: [
      { id: 'obs_11_1', type: OBSTACLE_TYPES.THICK_FROST, x: 260, y: 140, nameKey: 'obs_thick_frost' }
    ],
    hero: { startX: 100, startY: 140, endX: 420, endY: 140 },
    optimalSteps: 2, // Disassemble Ming -> Sun + Moon; apply Sun to Frost
    eggGlyph: GLYPH_TYPES.SUN,
    poemKey: 'poem_11'
  },
  {
    id: 12,
    chapterId: 3,
    nameKey: 'lvl_12_name',
    initialGlyphs: [GLYPH_TYPES.MING, GLYPH_TYPES.WATER],
    obstacles: [
      { id: 'obs_12_1', type: OBSTACLE_TYPES.THICK_FROST, x: 210, y: 140, nameKey: 'obs_thick_frost' },
      { id: 'obs_12_2', type: OBSTACLE_TYPES.DRY_CANAL, x: 320, y: 140, nameKey: 'obs_dry_canal' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 3, // Disassemble Ming, Sun melts frost, Water floods canal
    eggGlyph: GLYPH_TYPES.MOON,
    poemKey: 'poem_12'
  },
  {
    id: 13,
    chapterId: 3,
    nameKey: 'lvl_13_name',
    initialGlyphs: [GLYPH_TYPES.SUN, GLYPH_TYPES.MOON, GLYPH_TYPES.WOOD],
    obstacles: [
      { id: 'obs_13_1', type: OBSTACLE_TYPES.DARK_CAVERN, x: 210, y: 140, nameKey: 'obs_dark_cavern' },
      { id: 'obs_13_2', type: OBSTACLE_TYPES.DEEP_RAVINE, x: 320, y: 140, nameKey: 'obs_deep_ravine' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 3, // Synth Ming to illuminate cavern, use Wood to cross ravine
    eggGlyph: GLYPH_TYPES.MING,
    poemKey: 'poem_13'
  },
  {
    id: 14,
    chapterId: 3,
    nameKey: 'lvl_14_name',
    initialGlyphs: [GLYPH_TYPES.MING, GLYPH_TYPES.WATER, GLYPH_TYPES.ICE],
    obstacles: [
      { id: 'obs_14_1', type: OBSTACLE_TYPES.DARK_CAVERN, x: 200, y: 140, nameKey: 'obs_dark_cavern' },
      { id: 'obs_14_2', type: OBSTACLE_TYPES.RUSHING_RIVER, x: 320, y: 140, nameKey: 'obs_rushing_river' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 4, // Apply Ming to cavern, Synth Bing (Water+Ice), apply Bing to freeze river
    eggGlyph: GLYPH_TYPES.BING,
    poemKey: 'poem_14'
  },

  // Chapter 4: 移山辟地 (Levels 15 - 18)
  {
    id: 15,
    chapterId: 4,
    nameKey: 'lvl_15_name',
    initialGlyphs: [GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.MOUNTAIN],
    obstacles: [
      { id: 'obs_15_1', type: OBSTACLE_TYPES.MOUNTAIN_PASS, x: 260, y: 140, nameKey: 'obs_mountain_pass' }
    ],
    hero: { startX: 100, startY: 140, endX: 420, endY: 140 },
    optimalSteps: 2, // Synth Chu (Mountain+Mountain), apply Chu
    eggGlyph: GLYPH_TYPES.CHU,
    poemKey: 'poem_15'
  },
  {
    id: 16,
    chapterId: 4,
    nameKey: 'lvl_16_name',
    initialGlyphs: [GLYPH_TYPES.STONE, GLYPH_TYPES.STONE],
    obstacles: [
      { id: 'obs_16_1', type: OBSTACLE_TYPES.ABYSS_PIT, x: 260, y: 140, nameKey: 'obs_abyss_pit' }
    ],
    hero: { startX: 100, startY: 140, endX: 420, endY: 140 },
    optimalSteps: 2, // Synth Lei_Stone, apply Lei_Stone
    eggGlyph: GLYPH_TYPES.LEI_STONE,
    poemKey: 'poem_16'
  },
  {
    id: 17,
    chapterId: 4,
    nameKey: 'lvl_17_name',
    initialGlyphs: [GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.STONE],
    obstacles: [
      { id: 'obs_17_1', type: OBSTACLE_TYPES.ABYSS_PIT, x: 210, y: 140, nameKey: 'obs_abyss_pit' },
      { id: 'obs_17_2', type: OBSTACLE_TYPES.MOUNTAIN_PASS, x: 330, y: 140, nameKey: 'obs_mountain_pass' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 4, // Synth Yan_Rock (Mountain+Stone) -> fill pit; Synth Chu (Mountain+Mountain) -> pass
    eggGlyph: GLYPH_TYPES.YAN_ROCK,
    poemKey: 'poem_17'
  },
  {
    id: 18,
    chapterId: 4,
    nameKey: 'lvl_18_name',
    initialGlyphs: [GLYPH_TYPES.CHU, GLYPH_TYPES.STONE, GLYPH_TYPES.WATER],
    obstacles: [
      { id: 'obs_18_1', type: OBSTACLE_TYPES.ABYSS_PIT, x: 200, y: 140, nameKey: 'obs_abyss_pit' },
      { id: 'obs_18_2', type: OBSTACLE_TYPES.DRY_CANAL, x: 320, y: 140, nameKey: 'obs_dry_canal' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 4, // Disassemble Chu -> 2 Mountains, Synth Yan_Rock (Mountain+Stone) -> pit, Water -> canal
    eggGlyph: GLYPH_TYPES.CHU,
    poemKey: 'poem_18'
  },

  // Chapter 5: 五行天人 (Levels 19 - 22)
  {
    id: 19,
    chapterId: 5,
    nameKey: 'lvl_19_name',
    initialGlyphs: [GLYPH_TYPES.LEI_THUNDER, GLYPH_TYPES.WATER],
    obstacles: [
      { id: 'obs_19_1', type: OBSTACLE_TYPES.IRON_GATE, x: 210, y: 140, nameKey: 'obs_iron_gate' },
      { id: 'obs_19_2', type: OBSTACLE_TYPES.DRY_CANAL, x: 320, y: 140, nameKey: 'obs_dry_canal' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 2, // Apply Lei_Thunder to Iron Gate, apply Water to canal
    eggGlyph: GLYPH_TYPES.LEI_THUNDER,
    poemKey: 'poem_19'
  },
  {
    id: 20,
    chapterId: 5,
    nameKey: 'lvl_20_name',
    initialGlyphs: [GLYPH_TYPES.FEN, GLYPH_TYPES.WATER, GLYPH_TYPES.ICE],
    obstacles: [
      { id: 'obs_20_1', type: OBSTACLE_TYPES.WOOD_BARRIER, x: 200, y: 140, nameKey: 'obs_wood_barrier' },
      { id: 'obs_20_2', type: OBSTACLE_TYPES.RUSHING_RIVER, x: 320, y: 140, nameKey: 'obs_rushing_river' }
    ],
    hero: { startX: 80, startY: 140, endX: 440, endY: 140 },
    optimalSteps: 4, // Apply Fen to Wood; Synth Bing (Water+Ice) -> freeze river
    eggGlyph: GLYPH_TYPES.FEN,
    poemKey: 'poem_20'
  },
  {
    id: 21,
    chapterId: 5,
    nameKey: 'lvl_21_name',
    initialGlyphs: [GLYPH_TYPES.LEI_THUNDER, GLYPH_TYPES.SEN, GLYPH_TYPES.FIRE],
    obstacles: [
      { id: 'obs_21_1', type: OBSTACLE_TYPES.RAGING_FIRE, x: 190, y: 140, nameKey: 'obs_raging_fire' },
      { id: 'obs_21_2', type: OBSTACLE_TYPES.MUD_SWAMP, x: 280, y: 140, nameKey: 'obs_mud_swamp' },
      { id: 'obs_21_3', type: OBSTACLE_TYPES.DEEP_RAVINE, x: 370, y: 140, nameKey: 'obs_deep_ravine' }
    ],
    hero: { startX: 70, startY: 140, endX: 460, endY: 140 },
    optimalSteps: 5, // Disassemble Lei (Rain+Field); Disassemble Sen (3 Woods); Rain->fire, Field->swamp, Wood->bridge
    eggGlyph: GLYPH_TYPES.SEN,
    poemKey: 'poem_21'
  },
  {
    id: 22,
    chapterId: 5,
    nameKey: 'lvl_22_name',
    initialGlyphs: [GLYPH_TYPES.MING, GLYPH_TYPES.LEI_THUNDER, GLYPH_TYPES.WOOD],
    obstacles: [
      { id: 'obs_22_1', type: OBSTACLE_TYPES.DARK_CAVERN, x: 180, y: 140, nameKey: 'obs_dark_cavern' },
      { id: 'obs_22_2', type: OBSTACLE_TYPES.IRON_GATE, x: 270, y: 140, nameKey: 'obs_iron_gate' },
      { id: 'obs_22_3', type: OBSTACLE_TYPES.DEEP_RAVINE, x: 360, y: 140, nameKey: 'obs_deep_ravine' }
    ],
    hero: { startX: 70, startY: 140, endX: 460, endY: 140 },
    optimalSteps: 3, // Ming -> Cavern; Lei -> Iron Gate; Wood -> Ravine
    eggGlyph: GLYPH_TYPES.MING,
    poemKey: 'poem_22'
  }
];

export function getLevelById(id) {
  return LEVELS.find(l => l.id === id) || LEVELS[0];
}

export function getTotalLevels() {
  return LEVELS.length;
}
