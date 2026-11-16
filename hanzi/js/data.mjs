/**
 * Glyph Craft (字灵拆拆乐) - Data Definitions
 * Radicals, compound glyphs, alchemy recipes, obstacles and codex entries.
 * Strictly DOM-free and clean.
 */

export const GLYPH_TYPES = {
  // Primal Radicals / Elements
  WOOD: 'wood',
  FIRE: 'fire',
  WATER: 'water',
  SUN: 'sun',
  MOON: 'moon',
  MOUNTAIN: 'mountain',
  STONE: 'stone',
  FIELD: 'field',
  RAIN: 'rain',
  ICE: 'ice',
  BLADE: 'blade',
  SOIL: 'soil',
  METAL: 'metal',

  // Compound Glyphs
  LIN: 'lin',         // 林 (Twin Woods / Grove)
  SEN: 'sen',         // 森 (Tri-Wood / Forest)
  YAN: 'yan',         // 炎 (Twin Flame / Blaze)
  MIAO: 'miao',       // 淼 (Tri-Water / Great Flood)
  MING: 'ming',       // 明 (Sun + Moon / Bright)
  CHU: 'chu',         // 出 (Mountain + Mountain / Exit)
  LEI_STONE: 'lei_s', // 磊 (Tri-Stone / Boulders)
  LEI_THUNDER: 'lei_t', // 雷 (Rain + Field / Thunder)
  FEN: 'fen',         // 焚 (Fire + Wood / Incinerate)
  YAN_ROCK: 'yan_r',  // 岩 (Mountain + Stone / Crag)
  BING: 'bing',       // 冰 (Water + Ice Radical / Glacier)
  MIAO_SPROUT: 'miao_sp', // 苗 (Grass + Field / Sprout)
};

export const GLYPH_CATALOG = {
  [GLYPH_TYPES.WOOD]: {
    id: GLYPH_TYPES.WOOD,
    char: '木',
    nameZh: '木',
    icon: '🌲',
    enName: 'Wood',
    element: 'wood',
    color: '#2ed573',
    descriptionKey: 'glyph_wood_desc'
  },
  [GLYPH_TYPES.FIRE]: {
    id: GLYPH_TYPES.FIRE,
    char: '火',
    icon: '🔥',
    enName: 'Fire',
    element: 'fire',
    color: '#ff4757',
    descriptionKey: 'glyph_fire_desc'
  },
  [GLYPH_TYPES.WATER]: {
    id: GLYPH_TYPES.WATER,
    char: '水',
    icon: '💧',
    enName: 'Water',
    element: 'water',
    color: '#1e90ff',
    descriptionKey: 'glyph_water_desc'
  },
  [GLYPH_TYPES.SUN]: {
    id: GLYPH_TYPES.SUN,
    char: '日',
    icon: '☀️',
    enName: 'Sun',
    element: 'light',
    color: '#ffa502',
    descriptionKey: 'glyph_sun_desc'
  },
  [GLYPH_TYPES.MOON]: {
    id: GLYPH_TYPES.MOON,
    char: '月',
    icon: '🌙',
    enName: 'Moon',
    element: 'tide',
    color: '#ced6e0',
    descriptionKey: 'glyph_moon_desc'
  },
  [GLYPH_TYPES.MOUNTAIN]: {
    id: GLYPH_TYPES.MOUNTAIN,
    char: '山',
    icon: '⛰️',
    enName: 'Mountain',
    element: 'earth',
    color: '#70a1ff',
    descriptionKey: 'glyph_mountain_desc'
  },
  [GLYPH_TYPES.STONE]: {
    id: GLYPH_TYPES.STONE,
    char: '石',
    icon: '🪨',
    enName: 'Stone',
    element: 'earth',
    color: '#a4b0be',
    descriptionKey: 'glyph_stone_desc'
  },
  [GLYPH_TYPES.FIELD]: {
    id: GLYPH_TYPES.FIELD,
    char: '田',
    icon: '🟩',
    enName: 'Field',
    element: 'earth',
    color: '#7bed9f',
    descriptionKey: 'glyph_field_desc'
  },
  [GLYPH_TYPES.RAIN]: {
    id: GLYPH_TYPES.RAIN,
    char: '雨',
    icon: '🌧️',
    enName: 'Rain',
    element: 'water',
    color: '#70a1ff',
    descriptionKey: 'glyph_rain_desc'
  },
  [GLYPH_TYPES.ICE]: {
    id: GLYPH_TYPES.ICE,
    char: '冫',
    icon: '❄️',
    enName: 'Frost',
    element: 'ice',
    color: '#70a1ff',
    descriptionKey: 'glyph_frost_desc'
  },
  [GLYPH_TYPES.BLADE]: {
    id: GLYPH_TYPES.BLADE,
    char: '刀',
    icon: '🗡️',
    enName: 'Blade',
    element: 'metal',
    color: '#dfe4ea',
    descriptionKey: 'glyph_blade_desc'
  },
  [GLYPH_TYPES.SOIL]: {
    id: GLYPH_TYPES.SOIL,
    char: '土',
    icon: '🧱',
    enName: 'Soil',
    element: 'earth',
    color: '#eccc68',
    descriptionKey: 'glyph_soil_desc'
  },
  [GLYPH_TYPES.METAL]: {
    id: GLYPH_TYPES.METAL,
    char: '金',
    icon: '🪙',
    enName: 'Metal',
    element: 'metal',
    color: '#eccc68',
    descriptionKey: 'glyph_metal_desc'
  },

  // Compound Glyphs
  [GLYPH_TYPES.LIN]: {
    id: GLYPH_TYPES.LIN,
    char: '林',
    icon: '🌲🌲',
    enName: 'Grove',
    element: 'wood',
    color: '#2ed573',
    components: [GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD],
    descriptionKey: 'glyph_lin_desc'
  },
  [GLYPH_TYPES.SEN]: {
    id: GLYPH_TYPES.SEN,
    char: '森',
    icon: '🌳🌲',
    enName: 'Forest',
    element: 'wood',
    color: '#2ed573',
    components: [GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD],
    descriptionKey: 'glyph_sen_desc'
  },
  [GLYPH_TYPES.YAN]: {
    id: GLYPH_TYPES.YAN,
    char: '炎',
    icon: '🔥🔥',
    enName: 'Blaze',
    element: 'fire',
    color: '#ff4757',
    components: [GLYPH_TYPES.FIRE, GLYPH_TYPES.FIRE],
    descriptionKey: 'glyph_yan_desc'
  },
  [GLYPH_TYPES.MIAO]: {
    id: GLYPH_TYPES.MIAO,
    char: '淼',
    icon: '🌊',
    enName: 'Torrent',
    element: 'water',
    color: '#1e90ff',
    components: [GLYPH_TYPES.WATER, GLYPH_TYPES.WATER, GLYPH_TYPES.WATER],
    descriptionKey: 'glyph_miao_desc'
  },
  [GLYPH_TYPES.MING]: {
    id: GLYPH_TYPES.MING,
    char: '明',
    icon: '✨',
    enName: 'Bright',
    element: 'light',
    color: '#ffa502',
    components: [GLYPH_TYPES.SUN, GLYPH_TYPES.MOON],
    descriptionKey: 'glyph_ming_desc'
  },
  [GLYPH_TYPES.CHU]: {
    id: GLYPH_TYPES.CHU,
    char: '出',
    icon: '🚪',
    enName: 'Exit',
    element: 'earth',
    color: '#a4b0be',
    components: [GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.MOUNTAIN],
    descriptionKey: 'glyph_chu_desc'
  },
  [GLYPH_TYPES.LEI_STONE]: {
    id: GLYPH_TYPES.LEI_STONE,
    char: '磊',
    icon: '🪨🪨',
    enName: 'Boulders',
    element: 'earth',
    color: '#a4b0be',
    components: [GLYPH_TYPES.STONE, GLYPH_TYPES.STONE, GLYPH_TYPES.STONE],
    descriptionKey: 'glyph_lei_stone_desc'
  },
  [GLYPH_TYPES.LEI_THUNDER]: {
    id: GLYPH_TYPES.LEI_THUNDER,
    char: '雷',
    icon: '⚡',
    enName: 'Thunder',
    element: 'thunder',
    color: '#9b59b6',
    components: [GLYPH_TYPES.RAIN, GLYPH_TYPES.FIELD],
    descriptionKey: 'glyph_lei_thunder_desc'
  },
  [GLYPH_TYPES.FEN]: {
    id: GLYPH_TYPES.FEN,
    char: '焚',
    icon: '🔥🌲',
    enName: 'Incinerate',
    element: 'fire',
    color: '#ff4757',
    components: [GLYPH_TYPES.WOOD, GLYPH_TYPES.FIRE],
    descriptionKey: 'glyph_fen_desc'
  },
  [GLYPH_TYPES.YAN_ROCK]: {
    id: GLYPH_TYPES.YAN_ROCK,
    char: '岩',
    icon: '🏔️',
    enName: 'Crag',
    element: 'earth',
    color: '#747d8c',
    components: [GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.STONE],
    descriptionKey: 'glyph_yan_rock_desc'
  },
  [GLYPH_TYPES.BING]: {
    id: GLYPH_TYPES.BING,
    char: '冰',
    icon: '🧊',
    enName: 'Glacier',
    element: 'ice',
    color: '#70a1ff',
    components: [GLYPH_TYPES.WATER, GLYPH_TYPES.ICE],
    descriptionKey: 'glyph_bing_desc'
  }
};

/**
 * Synthesis Recipes (A + B -> Result)
 * Symmetric pair mapping
 */
export const SYNTHESIS_RECIPES = [
  // 木 + 木 = 林
  { inputs: [GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD], result: GLYPH_TYPES.LIN },
  // 林 + 木 = 森
  { inputs: [GLYPH_TYPES.LIN, GLYPH_TYPES.WOOD], result: GLYPH_TYPES.SEN },
  // 火 + 火 = 炎
  { inputs: [GLYPH_TYPES.FIRE, GLYPH_TYPES.FIRE], result: GLYPH_TYPES.YAN },
  // 水 + 水 = 淼 (or triple water)
  { inputs: [GLYPH_TYPES.WATER, GLYPH_TYPES.WATER], result: GLYPH_TYPES.MIAO },
  // 日 + 月 = 明
  { inputs: [GLYPH_TYPES.SUN, GLYPH_TYPES.MOON], result: GLYPH_TYPES.MING },
  // 山 + 山 = 出
  { inputs: [GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.MOUNTAIN], result: GLYPH_TYPES.CHU },
  // 石 + 石 = 磊
  { inputs: [GLYPH_TYPES.STONE, GLYPH_TYPES.STONE], result: GLYPH_TYPES.LEI_STONE },
  // 雨 + 田 = 雷
  { inputs: [GLYPH_TYPES.RAIN, GLYPH_TYPES.FIELD], result: GLYPH_TYPES.LEI_THUNDER },
  // 木 + 火 = 焚
  { inputs: [GLYPH_TYPES.WOOD, GLYPH_TYPES.FIRE], result: GLYPH_TYPES.FEN },
  // 林 + 火 = 焚
  { inputs: [GLYPH_TYPES.LIN, GLYPH_TYPES.FIRE], result: GLYPH_TYPES.FEN },
  // 山 + 石 = 岩
  { inputs: [GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.STONE], result: GLYPH_TYPES.YAN_ROCK },
  // 水 + 冫 = 冰
  { inputs: [GLYPH_TYPES.WATER, GLYPH_TYPES.ICE], result: GLYPH_TYPES.BING },
];

/**
 * Disassembly Table (Compound -> Array of primitives)
 */
export const DISASSEMBLY_RULES = {
  [GLYPH_TYPES.LIN]: [GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD],
  [GLYPH_TYPES.SEN]: [GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD],
  [GLYPH_TYPES.YAN]: [GLYPH_TYPES.FIRE, GLYPH_TYPES.FIRE],
  [GLYPH_TYPES.MIAO]: [GLYPH_TYPES.WATER, GLYPH_TYPES.WATER, GLYPH_TYPES.WATER],
  [GLYPH_TYPES.MING]: [GLYPH_TYPES.SUN, GLYPH_TYPES.MOON],
  [GLYPH_TYPES.CHU]: [GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.MOUNTAIN],
  [GLYPH_TYPES.LEI_STONE]: [GLYPH_TYPES.STONE, GLYPH_TYPES.STONE, GLYPH_TYPES.STONE],
  [GLYPH_TYPES.LEI_THUNDER]: [GLYPH_TYPES.RAIN, GLYPH_TYPES.FIELD],
  [GLYPH_TYPES.FEN]: [GLYPH_TYPES.WOOD, GLYPH_TYPES.FIRE],
  [GLYPH_TYPES.YAN_ROCK]: [GLYPH_TYPES.MOUNTAIN, GLYPH_TYPES.STONE],
  [GLYPH_TYPES.BING]: [GLYPH_TYPES.WATER, GLYPH_TYPES.ICE],
};

/**
 * Obstacle Types and their required physical reaction triggers
 */
export const OBSTACLE_TYPES = {
  WOOD_BARRIER: 'wood_barrier',     // 枯木阻路 (Requires Fire / Blaze / Fen)
  FOREST_BLOCK: 'forest_block',     // 密林横亘 (Requires Blaze / Fen, or Can be Disassembled into 3 Woods)
  DRY_CANAL: 'dry_canal',           // 干涸水渠 (Requires Water / Miao)
  DEEP_RAVINE: 'deep_ravine',       // 深谷阻隔 (Requires Lin as Bridge or Miao to flood)
  RUSHING_RIVER: 'rushing_river',   // 激流奔腾 (Requires Bing to freeze)
  DARK_CAVERN: 'dark_cavern',       // 幽暗洞穴 (Requires Ming to illuminate)
  THICK_FROST: 'thick_frost',       // 厚重坚霜 (Requires Sun / Fire to melt)
  MOUNTAIN_PASS: 'mountain_pass',   // 双山夹道 (Requires Chu to split mountains)
  ABYSS_PIT: 'abyss_pit',           // 万丈深坑 (Requires Lei_Stone / Yan_Rock to fill)
  RAGING_FIRE: 'raging_fire',       // 熊熊烈火 (Requires Rain / Water to extinguish)
  IRON_GATE: 'iron_gate',           // 机关铁锁 (Requires Lei_Thunder to blast open)
  MUD_SWAMP: 'mud_swamp',           // 泥泞沼泽 (Requires Field to pave path)
};

/**
 * Reaction mapping: which glyph ids resolve which obstacle types
 */
export const OBSTACLE_REACTIONS = {
  [OBSTACLE_TYPES.WOOD_BARRIER]: {
    triggers: [GLYPH_TYPES.FIRE, GLYPH_TYPES.YAN, GLYPH_TYPES.FEN],
    resultState: 'burned_cleared',
    effectSound: 'fire_burn',
    messageKey: 'react_wood_burned'
  },
  [OBSTACLE_TYPES.FOREST_BLOCK]: {
    triggers: [GLYPH_TYPES.YAN, GLYPH_TYPES.FEN],
    canDisassemble: true,
    disassembleYield: [GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD, GLYPH_TYPES.WOOD],
    resultState: 'forest_cleared',
    effectSound: 'fire_burn',
    messageKey: 'react_forest_cleared'
  },
  [OBSTACLE_TYPES.DRY_CANAL]: {
    triggers: [GLYPH_TYPES.WATER, GLYPH_TYPES.MIAO],
    resultState: 'water_flooded',
    effectSound: 'water_flow',
    messageKey: 'react_canal_flooded'
  },
  [OBSTACLE_TYPES.DEEP_RAVINE]: {
    triggers: [GLYPH_TYPES.LIN, GLYPH_TYPES.WOOD],
    resultState: 'bridge_built',
    effectSound: 'stone_thud',
    messageKey: 'react_bridge_built'
  },
  [OBSTACLE_TYPES.RUSHING_RIVER]: {
    triggers: [GLYPH_TYPES.BING, GLYPH_TYPES.ICE],
    resultState: 'river_frozen',
    effectSound: 'ice_freeze',
    messageKey: 'react_river_frozen'
  },
  [OBSTACLE_TYPES.DARK_CAVERN]: {
    triggers: [GLYPH_TYPES.MING, GLYPH_TYPES.SUN],
    resultState: 'cavern_lit',
    effectSound: 'zither_bright',
    messageKey: 'react_cavern_lit'
  },
  [OBSTACLE_TYPES.THICK_FROST]: {
    triggers: [GLYPH_TYPES.SUN, GLYPH_TYPES.FIRE, GLYPH_TYPES.YAN],
    resultState: 'frost_melted',
    effectSound: 'water_flow',
    messageKey: 'react_frost_melted'
  },
  [OBSTACLE_TYPES.MOUNTAIN_PASS]: {
    triggers: [GLYPH_TYPES.CHU],
    resultState: 'mountains_parted',
    effectSound: 'mountain_rumble',
    messageKey: 'react_mountains_parted'
  },
  [OBSTACLE_TYPES.ABYSS_PIT]: {
    triggers: [GLYPH_TYPES.LEI_STONE, GLYPH_TYPES.YAN_ROCK],
    resultState: 'pit_filled',
    effectSound: 'stone_thud',
    messageKey: 'react_pit_filled'
  },
  [OBSTACLE_TYPES.RAGING_FIRE]: {
    triggers: [GLYPH_TYPES.RAIN, GLYPH_TYPES.MIAO, GLYPH_TYPES.WATER],
    resultState: 'fire_extinguished',
    effectSound: 'water_splash',
    messageKey: 'react_fire_extinguished'
  },
  [OBSTACLE_TYPES.IRON_GATE]: {
    triggers: [GLYPH_TYPES.LEI_THUNDER],
    resultState: 'gate_blasted',
    effectSound: 'thunder_blast',
    messageKey: 'react_gate_blasted'
  },
  [OBSTACLE_TYPES.MUD_SWAMP]: {
    triggers: [GLYPH_TYPES.FIELD],
    resultState: 'field_paved',
    effectSound: 'stone_thud',
    messageKey: 'react_field_paved'
  }
};
