/**
 * @file games/mtower/js/i18n.mjs
 * 中英双语中心，统一读写全站共享偏好 localStorage["doin.lang"]。
 * 严格红线：strings.en 绝无汉字，切语言毫秒级原地热更新，严禁页面重载刷新。
 */

export const SHARED_LANG_KEY = 'doin.lang';

export const DICTIONARIES = {
  zh: {
    langName: '中文',
    title: '魔塔 50 层',
    tagline: '零随机经典固定数值算步 RPG：严密规划每一把钥匙、每一颗宝石与攻防临界值，无伤清怪、收集神装、直抵 50 层击破魔王！',
    backHome: '首页',
    pause: '暂停',
    resume: '继续探险',
    restart: '瞬时重开',
    undo: '↺ 撤销(Z)',
    fly: '🕊️ 罗盘(F)',
    manual: '📜 图鉴(M)',
    rules: '📖 玩法',
    soundOn: '音效: 开',
    soundOff: '音效: 关',

    modeClassic: '50层全量',
    modeFast: '25层速通',

    // 属性面板
    floorBadge: '层',
    hp: '生命',
    atk: '攻击',
    def: '防御',
    gold: '金币',
    keys: '钥匙',
    key_y: '黄钥匙',
    key_b: '蓝钥匙',
    key_r: '红钥匙',
    steps: '步数',
    time: '耗时',
    relics: '法宝',

    // 道具名称
    item_key_y: '黄钥匙',
    item_key_b: '蓝钥匙',
    item_key_r: '红钥匙',
    item_gem_atk: '红宝石 (+3 攻)',
    item_gem_def: '蓝宝石 (+3 防)',
    item_pot_s: '小血瓶 (+200 HP)',
    item_pot_b: '大血瓶 (+500 HP)',
    item_gold: '金币袋 (+50 金)',

    // 神装
    equip_sword_iron: '铁剑 (+10 攻)',
    equip_shield_iron: '铁盾 (+10 防)',
    equip_sword_silver: '银剑 (+20 攻)',
    equip_shield_silver: '银盾 (+20 防)',
    equip_sword_knight: '骑士剑 (+40 攻)',
    equip_shield_knight: '骑士盾 (+40 防)',
    equip_sword_holy: '圣剑 (+80 攻)',
    equip_shield_holy: '圣盾 (+80 防)',
    equip_sword_sacred: '神圣剑 (+150 攻)',
    equip_shield_sacred: '神圣盾 (+150 防)',

    // 特殊法宝
    relic_holy_water: '圣水 (生命翻倍)',
    relic_holy_cross: '神圣十字架 (全属性+33%)',
    relic_dragon_slayer: '屠龙匕首 (魔龙伤害翻倍)',
    relic_earthquake: '地震卷轴 (震碎全层石墙)',
    relic_pickaxe: '破墙镐',
    relic_wings: '飞行羽毛 (楼层任意穿梭)',

    // 魔物名称
    mon_green_slime: '绿史莱姆',
    mon_red_slime: '红史莱姆',
    mon_black_slime: '黑史莱姆',
    mon_bat_small: '小蝙蝠',
    mon_skeleton_c: '骷髅士兵',
    mon_skeleton_b: '骷髅队长',
    mon_skeleton_a: '骷髅王',
    mon_orc_warrior: '兽人',
    mon_orc_guard: '兽人武士',
    mon_bat_big: '大蝙蝠',
    mon_wizard_junior: '初级巫师',
    mon_guard_gold: '金卫士',
    mon_vampire: '吸血魔王',
    mon_knight_junior: '近卫骑士',
    mon_knight_senior: '重装骑士',
    mon_swordsman_double: '双手剑士',
    mon_wizard_senior: '高级巫师',
    mon_knight_gold: '黄金战神',
    mon_mage_crimson: '红衣法师',
    mon_knight_ghost: '幽灵战将',
    mon_demon_flame: '炎魔狂怪',
    mon_archmage: '红衣魔导师',
    mon_knight_dark: '暗黑魔骑',
    mon_dragon: '远古苍穹魔龙',
    mon_false_demon: '假·魔王',
    mon_true_demon: '真·终极魔王',

    // 临界值悬停算盘
    damage: '战损',
    zeroDamage: '无伤秒杀',
    cannotPierce: '无法破防',
    turns: '回合',
    needAtk: '攻 +{atk} 少 1 回合，省 {hp} HP',
    needDef: '防 +{def} 即可无伤秒杀',
    pierceNeeded: '需攻击 +{atk} 方可破防',

    // 玩法指南弹窗
    rulesTitle: '📖 玩法指南 & 数值秘籍',
    ruleCalcTitle: '纯确定性零随机战斗',
    ruleCalcDesc: '绝无随机闪避或暴击！勇者每次攻击扣除 (攻击-怪物防御) 点血，无法破防则禁止战斗；怪物每次反击扣除 (怪物攻击-勇者防御) 点血。一击秒杀则 0 战损！',
    ruleThresholdTitle: '临界值悬停算盘',
    ruleThresholdDesc: '光标悬停或长按魔物，即可直接查阅确切战损与下一攻防质变点（如“攻+4少打1回合省160血”），告别实体计算器繁琐计算。',
    ruleRelicsTitle: '神装与神圣法宝',
    ruleRelicsDesc: '圣水令当前生命翻倍（越晚喝收益越高！）；神圣十字架永久提升 1/3 全属性；屠龙匕首对魔龙造成双倍致命打击；地震卷轴震碎当前楼层所有普通石墙！',
    knowRules: '我知道了，开启攀登！',

    // 胜利与段位
    wonTitle: '破封弑魔 · 救世登顶',
    wonDesc: '您已击溃真·终极魔王，解开魔塔千年诅咒，拯救了整座王国！',
    finalScore: '最终战力总分',
    rankTitle: '魔塔封号段位',
    title_novice: '地牢卫兵',
    title_vanguard: '探索先锋',
    title_iron_champion: '钢铁勇者',
    title_holy_paladin: '圣域骑士',
    title_god_slayer: '封神剑圣',
    playAgain: '再战一局',
    closeBtn: '关闭',

    // 楼层传送与手册
    flyTitle: '🕊️ 楼层传送罗盘',
    flyDesc: '选择已踏足探索过的楼层瞬间穿梭：',
    manualTitle: '📜 当前楼层魔物图鉴与临界值',
    noMonsters: '当前楼层魔物已被肃清！',
  },

  en: {
    langName: 'English',
    title: '50-Floor Magic Tower',
    tagline: 'Deterministic retro RPG puzzle! Plan every key, gem, and combat threshold to conquer 50 floors!',
    backHome: 'Home',
    pause: 'Pause',
    resume: 'Resume Quest',
    restart: 'Instant Retry',
    undo: '↺ Undo(Z)',
    fly: '🕊️ Fly(F)',
    manual: '📜 Codex(M)',
    rules: '📖 Rules',
    soundOn: 'Sound: On',
    soundOff: 'Sound: Off',

    modeClassic: '50 Floors',
    modeFast: '25 Floors',

    // Stats
    floorBadge: 'F',
    hp: 'HP',
    atk: 'ATK',
    def: 'DEF',
    gold: 'Gold',
    keys: 'Keys',
    key_y: 'Yellow Key',
    key_b: 'Blue Key',
    key_r: 'Red Key',
    steps: 'Steps',
    time: 'Time',
    relics: 'Relics',

    // Items
    item_key_y: 'Yellow Key',
    item_key_b: 'Blue Key',
    item_key_r: 'Red Key',
    item_gem_atk: 'Red Gem (+3 Atk)',
    item_gem_def: 'Blue Gem (+3 Def)',
    item_pot_s: 'Small Potion (+200 HP)',
    item_pot_b: 'Large Potion (+500 HP)',
    item_gold: 'Gold Pouch (+50 Gold)',

    // Equipment
    equip_sword_iron: 'Iron Sword (+10 Atk)',
    equip_shield_iron: 'Iron Shield (+10 Def)',
    equip_sword_silver: 'Silver Sword (+20 Atk)',
    equip_shield_silver: 'Silver Shield (+20 Def)',
    equip_sword_knight: 'Knight Sword (+40 Atk)',
    equip_shield_knight: 'Knight Shield (+40 Def)',
    equip_sword_holy: 'Holy Sword (+80 Atk)',
    equip_shield_holy: 'Holy Shield (+80 Def)',
    equip_sword_sacred: 'Sacred Blade (+150 Atk)',
    equip_shield_sacred: 'Sacred Shield (+150 Def)',

    // Relics
    relic_holy_water: 'Holy Water (Doubles HP)',
    relic_holy_cross: 'Holy Cross (+33% All Stats)',
    relic_dragon_slayer: 'Dragon Slayer (2x Dragon Dmg)',
    relic_earthquake: 'Earthquake Scroll (Clears Walls)',
    relic_pickaxe: 'Pickaxe (Break 1 Wall)',
    relic_wings: 'Teleport Wings (Floor Warp)',

    // Monsters
    mon_green_slime: 'Green Slime',
    mon_red_slime: 'Red Slime',
    mon_black_slime: 'Black Slime',
    mon_bat_small: 'Small Bat',
    mon_skeleton_c: 'Skeleton Scout',
    mon_skeleton_b: 'Skeleton Captain',
    mon_skeleton_a: 'Skeleton King',
    mon_orc_warrior: 'Orc Warrior',
    mon_orc_guard: 'Orc Guard',
    mon_bat_big: 'Large Bat',
    mon_wizard_junior: 'Junior Magician',
    mon_guard_gold: 'Gold Guardian',
    mon_vampire: 'Vampire Lord',
    mon_knight_junior: 'Junior Knight',
    mon_knight_senior: 'Senior Knight',
    mon_swordsman_double: 'Dual Swordsman',
    mon_wizard_senior: 'Senior Warlock',
    mon_knight_gold: 'Golden Champion',
    mon_mage_crimson: 'Crimson Mage',
    mon_knight_ghost: 'Phantom Knight',
    mon_demon_flame: 'Flame Fiend',
    mon_archmage: 'Crimson Archmage',
    mon_knight_dark: 'Dark Rider',
    mon_dragon: 'Ancient Sky Dragon',
    mon_false_demon: 'False Demon Lord',
    mon_true_demon: 'True Demon Emperor',

    // Thresholds
    damage: 'Damage',
    zeroDamage: 'Zero Damage Kill',
    cannotPierce: 'Cannot Pierce',
    turns: 'Turns',
    needAtk: 'Atk +{atk} saves 1 turn & {hp} HP',
    needDef: 'Def +{def} for zero damage',
    pierceNeeded: 'Need Atk +{atk} to pierce',

    // Rules
    rulesTitle: '📖 Rules & Combat Mastery Guide',
    ruleCalcTitle: 'Deterministic Zero-RNG Combat',
    ruleCalcDesc: 'No random criticals or dodges! Hero deals (HeroAtk - MonDef) damage; monsters counter with (MonAtk - HeroDef). If hero kills in 1 turn, damage taken is 0!',
    ruleThresholdTitle: 'Smart Threshold Calculator',
    ruleThresholdDesc: 'Hover over any monster to see exact combat loss and next breakthrough thresholds (e.g. Atk +4 to reduce 1 turn and save 160 HP).',
    ruleRelicsTitle: 'Relics & Sacred Treasures',
    ruleRelicsDesc: 'Holy Water doubles your current HP (drink later for greater gains!); Holy Cross boosts all stats by 33%; Dragon Slayer doubles dragon damage; Earthquake Scroll crushes all regular walls on the floor!',
    knowRules: 'Got it, ascend the tower!',

    // Victory
    wonTitle: 'Tower Conquered! Realm Saved',
    wonDesc: 'You defeated the True Demon Emperor, broke the ancient seal, and saved the entire kingdom!',
    finalScore: 'Total Power Score',
    rankTitle: 'Hero Rank',
    title_novice: 'Dungeon Novice',
    title_vanguard: 'Dungeon Vanguard',
    title_iron_champion: 'Iron Champion',
    title_holy_paladin: 'Holy Paladin',
    title_god_slayer: 'God Slayer',
    playAgain: 'Play Again',
    closeBtn: 'Close',

    // Fly & Manual
    flyTitle: '🕊️ Floor Teleport Compass',
    flyDesc: 'Select an explored floor to teleport instantly:',
    manualTitle: '📜 Floor Monster Codex & Thresholds',
    noMonsters: 'All monsters on this floor have been vanquished!',
  },
};

export function getCurrentLanguage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(SHARED_LANG_KEY);
      if (stored === 'zh' || stored === 'en') {
        return stored;
      }
    }
  } catch (err) {}

  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }
  return 'zh';
}

export function setLanguage(lang) {
  const target = lang === 'en' ? 'en' : 'zh';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SHARED_LANG_KEY, target);
    }
  } catch (err) {}
  return target;
}

export function t(key, lang = null) {
  const current = lang || getCurrentLanguage();
  const dict = DICTIONARIES[current] || DICTIONARIES.zh;
  return dict[key] || DICTIONARIES.zh[key] || key;
}
