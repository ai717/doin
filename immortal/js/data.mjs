/**
 * Immortal Box (摸鱼开箱修仙传) - Data Definitions
 * 8 Equipment Slots, 6 Affixes, 6 Qualities, 21 Realms, 15 Cauldron Tiers.
 * Pure definitions, DOM-free.
 */

export const SLOTS = {
  SWORD: 'sword',     // 飞剑 (Main Attack / Crit)
  ROBE: 'robe',       // 法袍 (Main Defense / Anti-Crit)
  HAT: 'hat',         // 道冠 (Main HP / Counter)
  BOOTS: 'boots',     // 法履 (Main Agility / Dodge)
  PENDANT: 'pendant', // 灵佩 (Lifesteal / Crit DMG)
  WHISK: 'whisk',     // 拂尘 (Stun / Accuracy)
  BAG: 'bag',         // 乾坤袋 (All Stats / Combo)
  MIRROR: 'mirror',   // 八卦镜 (DMG Amplification / Synergy)
};

export const SLOT_INFO = {
  [SLOTS.SWORD]: { id: SLOTS.SWORD, nameZh: '飞剑', enName: 'Flying Sword', icon: '🗡️', primaryStat: 'atk' },
  [SLOTS.ROBE]: { id: SLOTS.ROBE, nameZh: '法袍', enName: 'Daoist Robe', icon: '🥋', primaryStat: 'def' },
  [SLOTS.HAT]: { id: SLOTS.HAT, nameZh: '道冠', enName: 'Crown', icon: '👑', primaryStat: 'hp' },
  [SLOTS.BOOTS]: { id: SLOTS.BOOTS, nameZh: '法履', enName: 'Cloud Boots', icon: '🥾', primaryStat: 'spd' },
  [SLOTS.PENDANT]: { id: SLOTS.PENDANT, nameZh: '灵佩', enName: 'Jade Pendant', icon: '📿', primaryStat: 'hp' },
  [SLOTS.WHISK]: { id: SLOTS.WHISK, nameZh: '拂尘', enName: 'Horsetail Whisk', icon: '🪶', primaryStat: 'atk' },
  [SLOTS.BAG]: { id: SLOTS.BAG, nameZh: '乾坤袋', enName: 'Universe Bag', icon: '🎒', primaryStat: 'def' },
  [SLOTS.MIRROR]: { id: SLOTS.MIRROR, nameZh: '八卦镜', enName: 'Bagua Mirror', icon: '🪞', primaryStat: 'atk' },
};

export const QUALITIES = {
  COMMON: 'common',       // 凡品 (White)
  FINE: 'fine',           // 灵品 (Green)
  RARE: 'rare',           // 宝品 (Blue)
  EPIC: 'epic',           // 仙品 (Purple)
  LEGENDARY: 'legendary', // 神品 (Gold)
  MYTHIC: 'mythic',       // 先天至宝 (Crimson)
};

export const QUALITY_INFO = {
  [QUALITIES.COMMON]: { id: QUALITIES.COMMON, tier: 1, nameZh: '凡品', enName: 'Common', color: '#dfe6e9', statMult: 1.0, affixCount: 0 },
  [QUALITIES.FINE]: { id: QUALITIES.FINE, tier: 2, nameZh: '灵品', enName: 'Fine', color: '#55efc4', statMult: 1.5, affixCount: 1 },
  [QUALITIES.RARE]: { id: QUALITIES.RARE, tier: 3, nameZh: '宝品', enName: 'Rare', color: '#74b9ff', statMult: 2.2, affixCount: 1 },
  [QUALITIES.EPIC]: { id: QUALITIES.EPIC, tier: 4, nameZh: '仙品', enName: 'Epic', color: '#a29bfe', statMult: 3.2, affixCount: 2 },
  [QUALITIES.LEGENDARY]: { id: QUALITIES.LEGENDARY, tier: 5, nameZh: '神品', enName: 'Legendary', color: '#ffeaa7', statMult: 4.8, affixCount: 2 },
  [QUALITIES.MYTHIC]: { id: QUALITIES.MYTHIC, tier: 6, nameZh: '先天至宝', enName: 'Mythic', color: '#ff7675', statMult: 7.0, affixCount: 3 },
};

export const AFFIXES = {
  CRIT: 'crit',           // 暴击率
  DODGE: 'dodge',         // 闪避率
  COUNTER: 'counter',     // 反击率
  COMBO: 'combo',         // 连击率
  STUN: 'stun',           // 眩晕率
  LIFESTEAL: 'lifesteal', // 吸血率
};

export const AFFIX_INFO = {
  [AFFIXES.CRIT]: { id: AFFIXES.CRIT, nameZh: '暴击', enName: 'Critical', icon: '💥', descKey: 'affix_crit_desc' },
  [AFFIXES.DODGE]: { id: AFFIXES.DODGE, nameZh: '闪避', enName: 'Dodge', icon: '💨', descKey: 'affix_dodge_desc' },
  [AFFIXES.COUNTER]: { id: AFFIXES.COUNTER, nameZh: '反击', enName: 'Counter', icon: '🛡️', descKey: 'affix_counter_desc' },
  [AFFIXES.COMBO]: { id: AFFIXES.COMBO, nameZh: '连击', enName: 'Combo', icon: '⚡', descKey: 'affix_combo_desc' },
  [AFFIXES.STUN]: { id: AFFIXES.STUN, nameZh: '眩晕', enName: 'Stun', icon: '💫', descKey: 'affix_stun_desc' },
  [AFFIXES.LIFESTEAL]: { id: AFFIXES.LIFESTEAL, nameZh: '吸血', enName: 'Lifesteal', icon: '🩸', descKey: 'affix_lifesteal_desc' },
};

export const CAULDRON_TIERS = [
  // level, upgradeCost (Spirit Stones), probabilities: [Common, Fine, Rare, Epic, Legendary, Mythic]
  { level: 1, cost: 100, rates: [0.70, 0.25, 0.05, 0.00, 0.00, 0.00] },
  { level: 2, cost: 250, rates: [0.60, 0.30, 0.10, 0.00, 0.00, 0.00] },
  { level: 3, cost: 600, rates: [0.50, 0.32, 0.16, 0.02, 0.00, 0.00] },
  { level: 4, cost: 1200, rates: [0.40, 0.34, 0.22, 0.04, 0.00, 0.00] },
  { level: 5, cost: 2500, rates: [0.30, 0.35, 0.28, 0.07, 0.00, 0.00] },
  { level: 6, cost: 5000, rates: [0.22, 0.34, 0.32, 0.11, 0.01, 0.00] },
  { level: 7, cost: 10000, rates: [0.15, 0.32, 0.36, 0.15, 0.02, 0.00] },
  { level: 8, cost: 20000, rates: [0.10, 0.28, 0.40, 0.19, 0.03, 0.00] },
  { level: 9, cost: 40000, rates: [0.06, 0.24, 0.42, 0.23, 0.05, 0.00] },
  { level: 10, cost: 80000, rates: [0.03, 0.19, 0.43, 0.28, 0.07, 0.00] },
  { level: 11, cost: 150000, rates: [0.01, 0.14, 0.42, 0.33, 0.09, 0.01] },
  { level: 12, cost: 300000, rates: [0.00, 0.10, 0.40, 0.37, 0.11, 0.02] },
  { level: 13, cost: 600000, rates: [0.00, 0.06, 0.36, 0.42, 0.13, 0.03] },
  { level: 14, cost: 1200000, rates: [0.00, 0.03, 0.30, 0.47, 0.16, 0.04] },
  { level: 15, cost: 0, rates: [0.00, 0.01, 0.24, 0.50, 0.20, 0.05] },
];

export const REALMS = [
  // 1..4: 炼气期 (Qi Condensation)
  { id: 1, nameZh: '炼气一层', enName: 'Qi Condensation I', maxExp: 100, bonusHp: 100, bonusAtk: 15, bonusDef: 8 },
  { id: 2, nameZh: '炼气二层', enName: 'Qi Condensation II', maxExp: 220, bonusHp: 220, bonusAtk: 32, bonusDef: 18 },
  { id: 3, nameZh: '炼气三层', enName: 'Qi Condensation III', maxExp: 380, bonusHp: 380, bonusAtk: 55, bonusDef: 30 },
  { id: 4, nameZh: '炼气大圆满', enName: 'Qi Peak', maxExp: 600, bonusHp: 580, bonusAtk: 85, bonusDef: 45 },

  // 5..9: 筑基期 (Foundation)
  { id: 5, nameZh: '筑基一重', enName: 'Foundation I', maxExp: 1000, bonusHp: 900, bonusAtk: 130, bonusDef: 70 },
  { id: 6, nameZh: '筑基二重', enName: 'Foundation II', maxExp: 1600, bonusHp: 1350, bonusAtk: 195, bonusDef: 105 },
  { id: 7, nameZh: '筑基三重', enName: 'Foundation III', maxExp: 2500, bonusHp: 1950, bonusAtk: 280, bonusDef: 150 },
  { id: 8, nameZh: '筑基四重', enName: 'Foundation IV', maxExp: 3800, bonusHp: 2750, bonusAtk: 395, bonusDef: 210 },
  { id: 9, nameZh: '筑基大圆满', enName: 'Foundation Peak', maxExp: 5500, bonusHp: 3800, bonusAtk: 545, bonusDef: 290 },

  // 10..13: 金丹期 (Golden Core)
  { id: 10, nameZh: '金丹初期', enName: 'Golden Core Early', maxExp: 8500, bonusHp: 5200, bonusAtk: 750, bonusDef: 400 },
  { id: 11, nameZh: '金丹中期', enName: 'Golden Core Mid', maxExp: 13000, bonusHp: 7100, bonusAtk: 1020, bonusDef: 550 },
  { id: 12, nameZh: '金丹后期', enName: 'Golden Core Late', maxExp: 19000, bonusHp: 9600, bonusAtk: 1380, bonusDef: 740 },
  { id: 13, nameZh: '金丹大圆满', enName: 'Golden Core Peak', maxExp: 28000, bonusHp: 13000, bonusAtk: 1870, bonusDef: 1000 },

  // 14..18: 元婴期 (Nascent Soul)
  { id: 14, nameZh: '元婴一劫', enName: 'Nascent Soul I', maxExp: 42000, bonusHp: 1750, bonusAtk: 2520, bonusDef: 1350 },
  { id: 15, nameZh: '元婴二劫', enName: 'Nascent Soul II', maxExp: 60000, bonusHp: 23500, bonusAtk: 3380, bonusDef: 1800 },
  { id: 16, nameZh: '元婴三劫', enName: 'Nascent Soul III', maxExp: 85000, bonusHp: 31500, bonusAtk: 4520, bonusDef: 2420 },
  { id: 17, nameZh: '元婴四劫', enName: 'Nascent Soul IV', maxExp: 120000, bonusHp: 42000, bonusAtk: 6050, bonusDef: 3250 },
  { id: 18, nameZh: '元婴大圆满', enName: 'Nascent Soul Peak', maxExp: 170000, bonusHp: 56000, bonusAtk: 8050, bonusDef: 4320 },

  // 19..21: 化神合体与大乘飞升 (Ascension)
  { id: 19, nameZh: '化神始境', enName: 'Soul Formation', maxExp: 250000, bonusHp: 75000, bonusAtk: 10800, bonusDef: 5800 },
  { id: 20, nameZh: '合体通幽', enName: 'Integration', maxExp: 380000, bonusHp: 102000, bonusAtk: 14700, bonusDef: 7900 },
  { id: 21, nameZh: '大乘飞升', enName: 'Mahayana Ascension', maxExp: 600000, bonusHp: 145000, bonusAtk: 21000, bonusDef: 11200 },
];

export const TRIBULATION_BOSSES = [
  // 1..4: 炼气天劫
  { id: 1, realmId: 1, nameZh: '护洞灵猿', enName: 'Spirit Ape', hp: 350, atk: 45, def: 15, spd: 10, affixes: {} },
  { id: 2, realmId: 2, nameZh: '青环蛇妖', enName: 'Emerald Serpent', hp: 750, atk: 95, def: 35, spd: 14, affixes: { dodge: 5 } },
  { id: 3, realmId: 3, nameZh: '黑水煞鬼', enName: 'Blackwater Wraith', hp: 1350, atk: 165, def: 65, spd: 18, affixes: { crit: 8 } },
  { id: 4, realmId: 4, nameZh: '初劫雷云兽', enName: 'Cloud Beast', hp: 2200, atk: 260, def: 110, spd: 22, affixes: { combo: 10 } },

  // 5..9: 筑基天劫
  { id: 5, realmId: 5, nameZh: '金背穿山甲', enName: 'Golden Pangolin', hp: 3400, atk: 390, def: 175, spd: 25, affixes: { counter: 12 } },
  { id: 6, realmId: 6, nameZh: '赤焰火鸦尊', enName: 'Flame Raven', hp: 5200, atk: 580, def: 260, spd: 30, affixes: { crit: 15 } },
  { id: 7, realmId: 7, nameZh: '碧眼幽狼王', enName: 'Ghost Wolf King', hp: 7800, atk: 850, def: 380, spd: 36, affixes: { combo: 16 } },
  { id: 8, realmId: 8, nameZh: '千足地蜈蚣', enName: 'Earth Centipede', hp: 11500, atk: 1220, def: 550, spd: 42, affixes: { stun: 14 } },
  { id: 9, realmId: 9, nameZh: '筑基天雷灵尊', enName: 'Thunder Lord', hp: 16500, atk: 1720, def: 780, spd: 50, affixes: { counter: 18, crit: 12 } },

  // 10..13: 金丹天劫
  { id: 10, realmId: 10, nameZh: '天风幻蝶仙', enName: 'Mirage Butterfly', hp: 23500, atk: 2400, def: 1100, spd: 60, affixes: { dodge: 25 } },
  { id: 11, realmId: 11, nameZh: '玄冥冰晶蟒', enName: 'Frost Python', hp: 33000, atk: 3350, def: 1550, spd: 68, affixes: { counter: 22, lifesteal: 15 } },
  { id: 12, realmId: 12, nameZh: '九幽噬魂蝠', enName: 'Soul Bat', hp: 46000, atk: 4650, def: 2150, spd: 78, affixes: { lifesteal: 25, crit: 18 } },
  { id: 13, realmId: 13, nameZh: '金丹九霄劫主', enName: 'Celestial Core Master', hp: 63000, atk: 6400, def: 2950, spd: 88, affixes: { crit: 25, combo: 20 } },

  // 14..18: 元婴天劫
  { id: 14, realmId: 14, nameZh: '撼地伏魔猿', enName: 'Earth-Shaker Ape', hp: 86000, atk: 8700, def: 4050, spd: 98, affixes: { stun: 24, counter: 20 } },
  { id: 15, realmId: 15, nameZh: '七杀天刑剑灵', enName: 'Sword Sovereign', hp: 118000, atk: 11800, def: 5500, spd: 110, affixes: { crit: 32, combo: 25 } },
  { id: 16, realmId: 16, nameZh: '八荒吞天饕餮', enName: 'Ancient Taotie', hp: 160000, atk: 15800, def: 7400, spd: 122, affixes: { lifesteal: 30, counter: 26 } },
  { id: 17, realmId: 17, nameZh: '紫极太虚幻狐', enName: 'Void Fox', hp: 215000, atk: 21000, def: 9800, spd: 138, affixes: { dodge: 38, crit: 22 } },
  { id: 18, realmId: 18, nameZh: '元婴万古天雷神将', enName: 'Nascent Thunder General', hp: 285000, atk: 28000, def: 13000, spd: 150, affixes: { combo: 30, stun: 26 } },

  // 19..21: 化神大乘终极大劫
  { id: 19, realmId: 19, nameZh: '太虚混元古龙', enName: 'Primordial Dragon', hp: 385000, atk: 37500, def: 17500, spd: 170, affixes: { counter: 35, lifesteal: 28 } },
  { id: 20, realmId: 20, nameZh: '九狱万魔之主', enName: 'Abyssal Demon King', hp: 520000, atk: 50000, def: 23500, spd: 195, affixes: { crit: 40, combo: 35 } },
  { id: 21, realmId: 21, nameZh: '太玄终焉天道真仙', enName: 'Immortal of Heavenly Dao', hp: 700000, atk: 68000, def: 32000, spd: 220, affixes: { dodge: 42, lifesteal: 32, stun: 28 } },
];
