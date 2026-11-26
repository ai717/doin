/**
 * @file games/mtower/js/data.mjs
 * 纯静态魔塔 50 层元数据中心：魔物全景属性、法宝图谱、经典 11x11 地牢常量。
 */

export const GRID = 11;

export const CH = Object.freeze({
  WALL: '#',
  FLOOR: '.',
  UP: '^',
  DOWN: 'v',
  DOOR_Y: 'Y',
  DOOR_B: 'B',
  DOOR_R: 'R',
  DOOR_M: 'M', // 铁门 / 机关栅栏
  CRACK_WALL: 'X', // 可凿穿暗墙
});

export const START_STATS = Object.freeze({
  hp: 1000,
  atk: 10,
  def: 10,
  gold: 0,
  exp: 0,
  keys: { y: 1, b: 0, r: 0 },
  relics: {
    wings: false,
    holyWater: 0,
    holyCross: false,
    dragonSlayer: false,
    earthquake: 0,
    pickaxe: 0,
  },
  floor: 1,
});

export const ITEMS = Object.freeze({
  y: { id: 'key_y', type: 'key', color: '#ffa502', keyType: 'y', count: 1, nameKey: 'item_key_y' },
  b: { id: 'key_b', type: 'key', color: '#2ed573', keyType: 'b', count: 1, nameKey: 'item_key_b' },
  r: { id: 'key_r', type: 'key', color: '#ff4757', keyType: 'r', count: 1, nameKey: 'item_key_r' },

  A: { id: 'gem_atk', type: 'gem', stat: 'atk', val: 3, color: '#ff4757', nameKey: 'item_gem_atk' },
  D: { id: 'gem_def', type: 'gem', stat: 'def', val: 3, color: '#1e90ff', nameKey: 'item_gem_def' },

  p: { id: 'pot_s', type: 'potion', stat: 'hp', val: 200, color: '#ff6b8b', nameKey: 'item_pot_s' },
  P: { id: 'pot_b', type: 'potion', stat: 'hp', val: 500, color: '#ff4757', nameKey: 'item_pot_b' },
  g: { id: 'gold', type: 'gold', stat: 'gold', val: 50, color: '#ffd54f', nameKey: 'item_gold' },

  // 神兵利刃与重盾
  W1: { id: 'sword_iron', type: 'equip', stat: 'atk', val: 10, color: '#dfe6e9', nameKey: 'equip_sword_iron' },
  S1: { id: 'shield_iron', type: 'equip', stat: 'def', val: 10, color: '#b2bec3', nameKey: 'equip_shield_iron' },
  W2: { id: 'sword_silver', type: 'equip', stat: 'atk', val: 20, color: '#74b9ff', nameKey: 'equip_sword_silver' },
  S2: { id: 'shield_silver', type: 'equip', stat: 'def', val: 20, color: '#0984e3', nameKey: 'equip_shield_silver' },
  W3: { id: 'sword_knight', type: 'equip', stat: 'atk', val: 40, color: '#fdcb6e', nameKey: 'equip_sword_knight' },
  S3: { id: 'shield_knight', type: 'equip', stat: 'def', val: 40, color: '#e17055', nameKey: 'equip_shield_knight' },
  W4: { id: 'sword_holy', type: 'equip', stat: 'atk', val: 80, color: '#ffd54f', nameKey: 'equip_sword_holy' },
  S4: { id: 'shield_holy', type: 'equip', stat: 'def', val: 80, color: '#d63031', nameKey: 'equip_shield_holy' },
  W5: { id: 'sword_sacred', type: 'equip', stat: 'atk', val: 150, color: '#a29bfe', nameKey: 'equip_sword_sacred' },
  S5: { id: 'shield_sacred', type: 'equip', stat: 'def', val: 150, color: '#6c5ce7', nameKey: 'equip_shield_sacred' },

  // 特殊法宝
  w: { id: 'relic_water', type: 'relic', relicKey: 'holyWater', color: '#70a1ff', nameKey: 'relic_holy_water' },
  c: { id: 'relic_cross', type: 'relic', relicKey: 'holyCross', color: '#ffd700', nameKey: 'relic_holy_cross' },
  s: { id: 'relic_slayer', type: 'relic', relicKey: 'dragonSlayer', color: '#ff7675', nameKey: 'relic_dragon_slayer' },
  q: { id: 'relic_quake', type: 'relic', relicKey: 'earthquake', color: '#e67e22', nameKey: 'relic_earthquake' },
  k: { id: 'relic_pickaxe', type: 'relic', relicKey: 'pickaxe', color: '#95a5a6', nameKey: 'relic_pickaxe' },
  f: { id: 'relic_wings', type: 'relic', relicKey: 'wings', color: '#55efc4', nameKey: 'relic_wings' },
});

export const MONSTERS = Object.freeze({
  // 第一区 (1~10F) 幽暗地牢
  green_slime: { id: 'green_slime', nameKey: 'mon_green_slime', hp: 50, atk: 20, def: 1, gold: 1, color: '#2ed573', icon: 'slime' },
  red_slime: { id: 'red_slime', nameKey: 'mon_red_slime', hp: 70, atk: 24, def: 2, gold: 2, color: '#ff4757', icon: 'slime' },
  black_slime: { id: 'black_slime', nameKey: 'mon_black_slime', hp: 130, atk: 60, def: 3, gold: 5, color: '#2f3542', icon: 'slime' },
  bat_small: { id: 'bat_small', nameKey: 'mon_bat_small', hp: 100, atk: 35, def: 5, gold: 3, color: '#57606f', icon: 'bat' },
  skeleton_c: { id: 'skeleton_c', nameKey: 'mon_skeleton_c', hp: 110, atk: 45, def: 8, gold: 5, color: '#dfe4ea', icon: 'skeleton' },
  skeleton_b: { id: 'skeleton_b', nameKey: 'mon_skeleton_b', hp: 150, atk: 65, def: 15, gold: 8, color: '#ced6e0', icon: 'skeleton' },
  boss_skeleton_a: { id: 'boss_skeleton_a', nameKey: 'mon_skeleton_a', hp: 400, atk: 90, def: 25, gold: 30, color: '#ffa502', icon: 'boss', isBoss: true },

  // 第二区 (11~20F) 坚石回廊
  orc_warrior: { id: 'orc_warrior', nameKey: 'mon_orc_warrior', hp: 200, atk: 85, def: 20, gold: 10, color: '#7bed9f', icon: 'orc' },
  orc_guard: { id: 'orc_guard', nameKey: 'mon_orc_guard', hp: 260, atk: 110, def: 30, gold: 15, color: '#2ed573', icon: 'orc' },
  bat_big: { id: 'bat_big', nameKey: 'mon_bat_big', hp: 180, atk: 95, def: 25, gold: 12, color: '#747d8c', icon: 'bat' },
  wizard_junior: { id: 'wizard_junior', nameKey: 'mon_wizard_junior', hp: 125, atk: 120, def: 10, gold: 18, color: '#70a1ff', icon: 'mage' },
  guard_gold: { id: 'guard_gold', nameKey: 'mon_guard_gold', hp: 320, atk: 140, def: 40, gold: 22, color: '#ffd54f', icon: 'warrior' },
  boss_vampire: { id: 'boss_vampire', nameKey: 'mon_vampire', hp: 850, atk: 190, def: 50, gold: 60, color: '#e84118', icon: 'boss', isBoss: true, ability: 'drain' },

  // 第三区 (21~30F) 钢铁要塞
  knight_junior: { id: 'knight_junior', nameKey: 'mon_knight_junior', hp: 450, atk: 210, def: 60, gold: 28, color: '#00d2d3', icon: 'knight' },
  knight_senior: { id: 'knight_senior', nameKey: 'mon_knight_senior', hp: 550, atk: 260, def: 85, gold: 35, color: '#54a0ff', icon: 'knight' },
  swordsman_double: { id: 'swordsman_double', nameKey: 'mon_swordsman_double', hp: 400, atk: 310, def: 55, gold: 40, color: '#ff6b81', icon: 'warrior', ability: 'double' },
  wizard_senior: { id: 'wizard_senior', nameKey: 'mon_wizard_senior', hp: 260, atk: 330, def: 40, gold: 45, color: '#9c88ff', icon: 'mage' },
  boss_knight_gold: { id: 'boss_knight_gold', nameKey: 'mon_knight_gold', hp: 1600, atk: 380, def: 120, gold: 120, color: '#ffd54f', icon: 'boss', isBoss: true },

  // 第四区 (31~40F) 熔岩深渊
  mage_crimson: { id: 'mage_crimson', nameKey: 'mon_mage_crimson', hp: 500, atk: 480, def: 110, gold: 60, color: '#ff4757', icon: 'mage' },
  knight_ghost: { id: 'knight_ghost', nameKey: 'mon_knight_ghost', hp: 700, atk: 450, def: 160, gold: 65, color: '#a4b0be', icon: 'knight' },
  demon_flame: { id: 'demon_flame', nameKey: 'mon_demon_flame', hp: 900, atk: 550, def: 140, gold: 75, color: '#ff6348', icon: 'demon' },
  boss_archmage: { id: 'boss_archmage', nameKey: 'mon_archmage', hp: 3200, atk: 620, def: 200, gold: 200, color: '#ff3838', icon: 'boss', isBoss: true },

  // 第五区 (41~50F) 魔塔之巅
  knight_dark: { id: 'knight_dark', nameKey: 'mon_knight_dark', hp: 1200, atk: 680, def: 240, gold: 90, color: '#2f3542', icon: 'knight' },
  boss_dragon: { id: 'boss_dragon', nameKey: 'mon_dragon', hp: 4500, atk: 780, def: 280, gold: 300, color: '#0984e3', icon: 'dragon', isBoss: true, isDragon: true },
  boss_false_demon: { id: 'boss_false_demon', nameKey: 'mon_false_demon', hp: 6000, atk: 880, def: 320, gold: 400, color: '#6c5ce7', icon: 'boss', isBoss: true },
  boss_true_demon: { id: 'boss_true_demon', nameKey: 'mon_true_demon', hp: 12000, atk: 1100, def: 450, gold: 999, color: '#d63031', icon: 'boss', isBoss: true },
});

export const SHOP_LEVELS = [
  { cost: 20, hp: 800, atk: 4, def: 4 },
  { cost: 40, hp: 1600, atk: 8, def: 8 },
  { cost: 80, hp: 3200, atk: 16, def: 16 },
  { cost: 160, hp: 6400, atk: 32, def: 32 },
];
