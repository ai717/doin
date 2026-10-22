// data.mjs — 背包竞技场：物品 / 配方 / 职业 / 对手 / 残局关卡 数据（纯数据，DOM-free）

export const GEM_MAX = 3;

// 通用类型标签（用于相邻联动判定）
// tags: weapon/melee/ranged/fire/magic/shield/armor/food/trinket/gem/dark

export const ITEMS = {
  // ---------------- 武器（通用） ----------------
  wooden_sword: {
    id: "wooden_sword", name: { zh: "木剑", en: "Wooden Sword" }, icon: "🗡️",
    w: 1, h: 2, type: "weapon", rarity: 0, cost: 3, tags: ["weapon", "melee"],
    weapon: { dmg: [3, 5], cd: 1.4, resource: 1, hit: 90, crit: 5, range: "melee" },
  },
  dagger: {
    id: "dagger", name: { zh: "匕首", en: "Dagger" }, icon: "🔪",
    w: 1, h: 1, type: "weapon", rarity: 0, cost: 2, tags: ["weapon", "melee"],
    weapon: { dmg: [2, 3], cd: 1.0, resource: 1, hit: 95, crit: 15, range: "melee" },
  },
  short_bow: {
    id: "short_bow", name: { zh: "短弓", en: "Short Bow" }, icon: "🏹",
    w: 2, h: 1, type: "weapon", rarity: 0, cost: 4, tags: ["weapon", "ranged"],
    weapon: { dmg: [3, 4], cd: 1.2, resource: 1, hit: 85, crit: 10, range: "ranged" },
    openBonus: { stat: "dmg", per: 1, max: 3 },
  },
  iron_sword: {
    id: "iron_sword", name: { zh: "铁剑", en: "Iron Sword" }, icon: "⚔️",
    w: 1, h: 2, type: "weapon", rarity: 1, cost: 6, tags: ["weapon", "melee"],
    weapon: { dmg: [5, 8], cd: 1.5, resource: 2, hit: 90, crit: 8, range: "melee" },
  },
  long_sword: {
    id: "long_sword", name: { zh: "英雄长剑", en: "Hero Longsword" }, icon: "🔱",
    w: 1, h: 3, type: "weapon", rarity: 2, cost: 0, tags: ["weapon", "melee"],
    weapon: { dmg: [8, 12], cd: 1.6, resource: 2, hit: 92, crit: 10, range: "melee" },
    aura: { to: "weapon", stat: "dmg", value: 1 },
  },
  big_axe: {
    id: "big_axe", name: { zh: "双手巨斧", en: "Big Axe" }, icon: "🪓",
    w: 2, h: 2, type: "weapon", rarity: 2, cost: 10, tags: ["weapon", "melee"],
    weapon: { dmg: [10, 16], cd: 2.2, resource: 3, hit: 85, crit: 12, range: "melee" },
  },
  war_hammer: {
    id: "war_hammer", name: { zh: "战锤", en: "War Hammer" }, icon: "🔨",
    w: 2, h: 1, type: "weapon", rarity: 1, cost: 7, tags: ["weapon", "melee"],
    weapon: { dmg: [6, 9], cd: 2.0, resource: 2, hit: 80, crit: 15, range: "melee", onHit: { stun: 0.2 } },
  },
  lucky_sword: {
    id: "lucky_sword", name: { zh: "幸运短剑", en: "Lucky Sword" }, icon: "✨",
    w: 2, h: 1, type: "weapon", rarity: 2, cost: 0, tags: ["weapon", "melee"],
    weapon: { dmg: [5, 7], cd: 1.3, resource: 1, hit: 98, crit: 18, range: "melee" },
  },

  // ---------------- 防具 / 盾 ----------------
  leather_armor: {
    id: "leather_armor", name: { zh: "皮甲", en: "Leather Armor" }, icon: "🧥",
    w: 2, h: 1, type: "armor", rarity: 0, cost: 3, tags: ["armor"],
    armor: { armor: 2 },
  },
  iron_armor: {
    id: "iron_armor", name: { zh: "铁甲", en: "Iron Armor" }, icon: "🪖",
    w: 2, h: 1, type: "armor", rarity: 1, cost: 7, tags: ["armor"],
    armor: { armor: 4 },
  },
  chain_armor: {
    id: "chain_armor", name: { zh: "锁子甲", en: "Chain Mail" }, icon: "⛓️",
    w: 2, h: 1, type: "armor", rarity: 2, cost: 0, tags: ["armor"],
    armor: { armor: 5, dodge: 5 },
  },
  wooden_shield: {
    id: "wooden_shield", name: { zh: "木盾", en: "Wooden Shield" }, icon: "🛡️",
    w: 1, h: 1, type: "shield", rarity: 0, cost: 4, tags: ["shield", "armor"],
    armor: { armor: 2, block: 15, enemyStaminaReduction: 0.1 },
  },
  iron_shield: {
    id: "iron_shield", name: { zh: "铁盾", en: "Iron Shield" }, icon: "🛡️",
    w: 1, h: 2, type: "shield", rarity: 1, cost: 8, tags: ["shield", "armor"],
    armor: { armor: 4, block: 20, enemyStaminaReduction: 0.2 },
  },

  // ---------------- 食物 / 消耗品 ----------------
  banana: {
    id: "banana", name: { zh: "香蕉", en: "Banana" }, icon: "🍌",
    w: 1, h: 1, type: "food", rarity: 0, cost: 3, tags: ["food"],
    food: { interval: 2.5, stamina: 1.2 },
  },
  roast: {
    id: "roast", name: { zh: "烤肉", en: "Roast Meat" }, icon: "🍖",
    w: 1, h: 1, type: "food", rarity: 0, cost: 3, tags: ["food"],
    food: { interval: 3.0, heal: 4 },
  },
  apple: {
    id: "apple", name: { zh: "苹果", en: "Apple" }, icon: "🍎",
    w: 1, h: 1, type: "food", rarity: 0, cost: 2, tags: ["food"],
    food: { interval: 3.0, heal: 2, stamina: 0.5 },
  },
  chili_oil: {
    id: "chili_oil", name: { zh: "辣椒油", en: "Chili Oil" }, icon: "🌶️",
    w: 1, h: 1, type: "food", rarity: 1, cost: 5, tags: ["food"],
    food: { interval: 5.0, buff: { stat: "dmgFlat", value: 1, dur: 4 } },
  },
  feast: {
    id: "feast", name: { zh: "盛宴拼盘", en: "Feast Platter" }, icon: "🍗",
    w: 1, h: 2, type: "food", rarity: 2, cost: 0, tags: ["food"],
    food: { interval: 3.0, heal: 8 },
  },

  // ---------------- 奇物 / 饰品 ----------------
  whetstone: {
    id: "whetstone", name: { zh: "磨刀石", en: "Whetstone" }, icon: "🪨",
    w: 1, h: 1, type: "trinket", rarity: 0, cost: 4, tags: ["trinket"],
    aura: { to: "weapon", stat: "dmg", value: 1 },
  },
  clover: {
    id: "clover", name: { zh: "幸运草", en: "Lucky Clover" }, icon: "🍀",
    w: 1, h: 1, type: "trinket", rarity: 0, cost: 4, tags: ["trinket"],
    trinket: { crit: 8, hit: 5 },
  },
  boots: {
    id: "boots", name: { zh: "疾风皮靴", en: "Swift Boots" }, icon: "👢",
    w: 1, h: 1, type: "trinket", rarity: 0, cost: 5, tags: ["trinket"],
    trinket: { attackSpeed: 0.1 },
  },
  amulet: {
    id: "amulet", name: { zh: "守护护符", en: "Warding Amulet" }, icon: "📿",
    w: 1, h: 1, type: "trinket", rarity: 0, cost: 5, tags: ["trinket"],
    trinket: { armor: 2, staminaRegen: 0.2 },
  },
  dragon_scale: {
    id: "dragon_scale", name: { zh: "龙鳞挂坠", en: "Dragon Scale" }, icon: "🐉",
    w: 1, h: 1, type: "trinket", rarity: 1, cost: 6, tags: ["trinket"],
    trinket: { lifesteal: 0.08 },
  },
  mana_potion: {
    id: "mana_potion", name: { zh: "魔力药水", en: "Mana Potion" }, icon: "🧪",
    w: 1, h: 1, type: "trinket", rarity: 0, cost: 4, tags: ["trinket"],
    trinket: { manaRegen: 0.5 },
  },
  anvil: {
    id: "anvil", name: { zh: "铁砧", en: "Anvil" }, icon: "⚒️",
    w: 1, h: 1, type: "trinket", rarity: 1, cost: 5, tags: ["trinket", "heavy"],
    colBelowBonus: { stat: "armor", value: 2 },
  },
  feather_talisman: {
    id: "feather_talisman", name: { zh: "轻羽符", en: "Feather Charm" }, icon: "🪶",
    w: 1, h: 1, type: "trinket", rarity: 1, cost: 5, tags: ["trinket", "light"],
    colAboveBonus: { stat: "attackSpeed", value: 0.08 },
  },

  // ---------------- 宝石 ----------------
  gem_red_1: { id: "gem_red_1", name: { zh: "红宝石", en: "Ruby" }, icon: "🔴", w: 1, h: 1, type: "gem", rarity: 1, cost: 4, tags: ["gem"], gem: { color: "red", level: 1, stat: "dmg", value: 1 } },
  gem_red_2: { id: "gem_red_2", name: { zh: "精雕红宝石", en: "Carved Ruby" }, icon: "🔴", w: 1, h: 1, type: "gem", rarity: 2, cost: 0, tags: ["gem"], gem: { color: "red", level: 2, stat: "dmg", value: 2 } },
  gem_red_3: { id: "gem_red_3", name: { zh: "红宝石王冠", en: "Ruby Crown" }, icon: "🔴", w: 1, h: 1, type: "gem", rarity: 3, cost: 0, tags: ["gem"], gem: { color: "red", level: 3, stat: "dmg", value: 4 } },
  gem_blue_1: { id: "gem_blue_1", name: { zh: "蓝宝石", en: "Sapphire" }, icon: "🔵", w: 1, h: 1, type: "gem", rarity: 1, cost: 4, tags: ["gem"], gem: { color: "blue", level: 1, stat: "staminaRegen", value: 0.2 } },
  gem_blue_2: { id: "gem_blue_2", name: { zh: "精雕蓝宝石", en: "Carved Sapphire" }, icon: "🔵", w: 1, h: 1, type: "gem", rarity: 2, cost: 0, tags: ["gem"], gem: { color: "blue", level: 2, stat: "staminaRegen", value: 0.4 } },
  gem_blue_3: { id: "gem_blue_3", name: { zh: "蓝宝石王冠", en: "Sapphire Crown" }, icon: "🔵", w: 1, h: 1, type: "gem", rarity: 3, cost: 0, tags: ["gem"], gem: { color: "blue", level: 3, stat: "staminaRegen", value: 0.8 } },
  gem_green_1: { id: "gem_green_1", name: { zh: "绿宝石", en: "Emerald" }, icon: "🟢", w: 1, h: 1, type: "gem", rarity: 1, cost: 4, tags: ["gem"], gem: { color: "green", level: 1, stat: "hpRegen", value: 0.5 } },
  gem_green_2: { id: "gem_green_2", name: { zh: "精雕绿宝石", en: "Carved Emerald" }, icon: "🟢", w: 1, h: 1, type: "gem", rarity: 2, cost: 0, tags: ["gem"], gem: { color: "green", level: 2, stat: "hpRegen", value: 1 } },
  gem_green_3: { id: "gem_green_3", name: { zh: "绿宝石王冠", en: "Emerald Crown" }, icon: "🟢", w: 1, h: 1, type: "gem", rarity: 3, cost: 0, tags: ["gem"], gem: { color: "green", level: 3, stat: "hpRegen", value: 2 } },

  // ---------------- 狂战士专属 ----------------
  battle_axe: {
    id: "battle_axe", name: { zh: "战斧", en: "Battle Axe" }, icon: "🪓",
    w: 2, h: 1, type: "weapon", rarity: 1, cost: 7, class: "berserker", tags: ["weapon", "melee"],
    weapon: { dmg: [7, 11], cd: 1.6, resource: 2, hit: 88, crit: 10, range: "melee" },
  },
  war_mace: {
    id: "war_mace", name: { zh: "巨锤", en: "War Mace" }, icon: "🔨",
    w: 2, h: 2, type: "weapon", rarity: 2, cost: 11, class: "berserker", tags: ["weapon", "melee"],
    weapon: { dmg: [12, 18], cd: 2.4, resource: 3, hit: 82, crit: 12, range: "melee", onHit: { stun: 0.25 } },
  },
  dragon_axe: {
    id: "dragon_axe", name: { zh: "屠龙斧", en: "Dragonslayer Axe" }, icon: "🪓",
    w: 2, h: 2, type: "weapon", rarity: 3, cost: 0, class: "berserker", tags: ["weapon", "melee"],
    weapon: { dmg: [10, 15], cd: 1.5, resource: 2, hit: 88, crit: 12, range: "melee" },
  },
  war_drum: {
    id: "war_drum", name: { zh: "战吼鼓", en: "War Drum" }, icon: "🥁",
    w: 1, h: 1, type: "trinket", rarity: 1, cost: 6, class: "berserker", tags: ["trinket"],
    trinket: { rageGain: 1.0 },
  },
  iron_gauntlets: {
    id: "iron_gauntlets", name: { zh: "铁腕甲", en: "Iron Gauntlets" }, icon: "🧤",
    w: 1, h: 1, type: "armor", rarity: 1, cost: 6, class: "berserker", tags: ["armor"],
    armor: { armor: 3, block: 5 },
  },
  rage_potion: {
    id: "rage_potion", name: { zh: "狂暴药水", en: "Rage Potion" }, icon: "🥤",
    w: 1, h: 1, type: "food", rarity: 1, cost: 6, class: "berserker", tags: ["food"],
    food: { interval: 4.0, buff: { stat: "attackSpeed", value: 0.5, dur: 3 } },
  },

  // ---------------- 游侠专属 ----------------
  hunt_bow: {
    id: "hunt_bow", name: { zh: "猎弓", en: "Hunt Bow" }, icon: "🏹",
    w: 2, h: 1, type: "weapon", rarity: 1, cost: 5, class: "ranger", tags: ["weapon", "ranged"],
    weapon: { dmg: [4, 6], cd: 1.1, resource: 1, hit: 88, crit: 12, range: "ranged" },
    openBonus: { stat: "dmg", per: 1, max: 4 },
  },
  triple_crossbow: {
    id: "triple_crossbow", name: { zh: "三连弩", en: "Triple Crossbow" }, icon: "🎯",
    w: 2, h: 2, type: "weapon", rarity: 2, cost: 9, class: "ranger", tags: ["weapon", "ranged"],
    weapon: { dmg: [3, 4], cd: 2.0, resource: 2, hit: 82, crit: 15, range: "ranged", shots: 3 },
  },
  sharpshooter_bow: {
    id: "sharpshooter_bow", name: { zh: "神射手弓", en: "Sharpshooter Bow" }, icon: "🏹",
    w: 2, h: 1, type: "weapon", rarity: 2, cost: 0, class: "ranger", tags: ["weapon", "ranged"],
    weapon: { dmg: [5, 8], cd: 1.0, resource: 1, hit: 95, crit: 20, range: "ranged" },
    openBonus: { stat: "dmg", per: 1, max: 4 },
  },
  scope: {
    id: "scope", name: { zh: "瞄准镜", en: "Scope" }, icon: "🔭",
    w: 1, h: 1, type: "trinket", rarity: 1, cost: 5, class: "ranger", tags: ["trinket"],
    rowBonus: { row: "top", stat: "critDmg", value: 0.3 },
  },
  bear_trap: {
    id: "bear_trap", name: { zh: "陷阱夹", en: "Bear Trap" }, icon: "🪤",
    w: 1, h: 1, type: "trinket", rarity: 1, cost: 5, class: "ranger", tags: ["trinket"],
    battleStart: { dmg: 6, slow: 0.3, dur: 3 },
  },
  venom_arrow: {
    id: "venom_arrow", name: { zh: "毒箭", en: "Venom Arrow" }, icon: "☠️",
    w: 1, h: 1, type: "trinket", rarity: 1, cost: 6, class: "ranger", tags: ["trinket", "dark"],
    adjBonus: { needs: ["ranged"], poison: 1.5 },
  },

  // ---------------- 火法师专属 ----------------
  fire_staff: {
    id: "fire_staff", name: { zh: "火杖", en: "Fire Staff" }, icon: "🪄",
    w: 1, h: 2, type: "weapon", rarity: 1, cost: 6, class: "pyromancer", tags: ["weapon", "magic", "fire"],
    weapon: { dmg: [4, 7], cd: 1.3, resource: 2, hit: 90, crit: 8, range: "ranged", onHit: { burn: 1 } },
  },
  flame_staff: {
    id: "flame_staff", name: { zh: "烈焰杖", en: "Flame Staff" }, icon: "🔥",
    w: 2, h: 2, type: "weapon", rarity: 3, cost: 0, class: "pyromancer", tags: ["weapon", "magic", "fire"],
    weapon: { dmg: [8, 12], cd: 1.4, resource: 2, hit: 92, crit: 10, range: "ranged", onHit: { burn: 2, burnDmg: 1 } },
  },
  oil_flask: {
    id: "oil_flask", name: { zh: "油瓶", en: "Oil Flask" }, icon: "🛢️",
    w: 1, h: 1, type: "trinket", rarity: 1, cost: 5, class: "pyromancer", tags: ["trinket", "fire"],
    adjBonus: { needs: ["fire"], burn: 1, burnDmg: 1 },
  },
  fireball_scroll: {
    id: "fireball_scroll", name: { zh: "火球卷轴", en: "Fireball Scroll" }, icon: "📜",
    w: 2, h: 1, type: "weapon", rarity: 2, cost: 10, class: "pyromancer", tags: ["weapon", "magic", "fire"],
    weapon: { dmg: [8, 12], cd: 2.5, resource: 3, hit: 100, crit: 5, range: "ranged", onHit: { burn: 3 } },
  },
  mana_elixir: {
    id: "mana_elixir", name: { zh: "法力药水", en: "Mana Elixir" }, icon: "💧",
    w: 1, h: 1, type: "food", rarity: 1, cost: 4, class: "pyromancer", tags: ["food"],
    food: { interval: 3.0, mana: 1.5 },
  },
};

// ---------------- 合成配方 ----------------
// 结算时：相邻且满足 recipe.sources 的物品 → recipe.into，占据两物包围盒
// sources 为 { id, qty } 列表（qty 为 1 或 2）；gem 家族由引擎统一处理
export const RECIPES = [
  { id: "iron+stone", sources: [{ id: "iron_sword", qty: 1 }, { id: "whetstone", qty: 1 }], into: "long_sword" },
  { id: "fire+oil", sources: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }], into: "flame_staff" },
  { id: "roast+roast", sources: [{ id: "roast", qty: 2 }], into: "feast" },
  { id: "axe+stone", sources: [{ id: "battle_axe", qty: 1 }, { id: "whetstone", qty: 1 }], into: "dragon_axe" },
  { id: "huntbow+scope", sources: [{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }], into: "sharpshooter_bow" },
  { id: "wood+clover", sources: [{ id: "wooden_sword", qty: 1 }, { id: "clover", qty: 1 }], into: "lucky_sword" },
  { id: "leather+leather", sources: [{ id: "leather_armor", qty: 2 }], into: "chain_armor" },
];

// 宝石家族规则：同色同阶两枚相邻 → 升一阶（最高 GEM_MAX）
export function gemRecipeTarget(a, b) {
  if (a.type !== "gem" || b.type !== "gem") return null;
  if (a.gem.color !== b.gem.color || a.gem.level !== b.gem.level) return null;
  if (a.gem.level >= GEM_MAX) return null;
  return `gem_${a.gem.color}_${a.gem.level + 1}`;
}

// ---------------- 职业 ----------------
export const CLASSES = {
  berserker: {
    id: "berserker", name: { zh: "狂战士", en: "Berserker" }, icon: "🪓",
    desc: { zh: "受击积攒怒气，怒气化为攻速。近战猛攻，越挨打越凶。", en: "Taking hits builds rage that becomes attack speed. The harder you get hit, the harder you hit back." },
    perk: "rage",
    grid: { cols: 5, rows: 4, blocked: [] },
    gridB: { cols: 4, rows: 5, blocked: [] },
    startersA: ["wooden_sword", "leather_armor", "banana", "whetstone"],
    startersB: ["battle_axe", "wooden_shield", "apple"],
    starterGold: 10,
  },
  ranger: {
    id: "ranger", name: { zh: "游侠", en: "Ranger" }, icon: "🏹",
    desc: { zh: "幸运之裔：天生高暴击高命中。远程放箭，右侧越空越强。", en: "Blessed with luck: innate crit and accuracy. Loose arrows from range, stronger the more open space you give them." },
    perk: "luck",
    grid: { cols: 3, rows: 7, blocked: [] },
    gridB: { cols: 4, rows: 5, blocked: [] },
    startersA: ["short_bow", "clover", "banana"],
    startersB: ["hunt_bow", "boots", "apple"],
    starterGold: 10,
  },
  pyromancer: {
    id: "pyromancer", name: { zh: "火法师", en: "Pyromancer" }, icon: "🔥",
    desc: { zh: "魔力代替耐力：每秒回魔、施法耗魔。点燃叠烧，越烧越痛。", en: "Mana replaces stamina: it regenerates each second and spells spend it. Stack burn and watch them cook." },
    perk: "mana",
    grid: { cols: 4, rows: 5, blocked: ["0,0", "3,0", "0,4", "3,4"] },
    gridB: { cols: 4, rows: 5, blocked: [] },
    startersA: ["fire_staff", "mana_potion", "apple"],
    startersB: ["fire_staff", "roast", "mana_elixir"],
    starterGold: 10,
  },
};

export const CLASS_ORDER = ["berserker", "ranger", "pyromancer"];

// ---------------- 对手构筑（AI 冒险者） ----------------
// items: [{id, x, y, rot}] 固定摆法；scaling 按轮次由引擎计算
export const ENEMIES = {
  novice: {
    id: "novice", name: { zh: "新手剑士", en: "Novice Swordsman" }, icon: "🗡️",
    desc: { zh: "刚上路的小伙子，动作还很生疏。", en: "A green lad just starting out. Clumsy but eager." },
    grid: { cols: 4, rows: 5 },
    items: [
      { id: "wooden_sword", x: 0, y: 1, rot: 0 },
      { id: "banana", x: 2, y: 3, rot: 0 },
    ],
    hp: 85, dmgMul: 1.0, armorMul: 1.0,
  },
  dual_blade: {
    id: "dual_blade", name: { zh: "双刀狂徒", en: "Dual-Blade Maniac" }, icon: "🔪",
    desc: { zh: "两把快刀乱舞，暴击惊人。", en: "Two fast blades in a whirlwind, with nasty crits." },
    grid: { cols: 4, rows: 5 },
    items: [
      { id: "dagger", x: 0, y: 1, rot: 0 },
      { id: "dagger", x: 0, y: 2, rot: 0 },
      { id: "clover", x: 1, y: 2, rot: 0 },
      { id: "boots", x: 2, y: 2, rot: 0 },
      { id: "leather_armor", x: 0, y: 3, rot: 0 },
      { id: "banana", x: 3, y: 4, rot: 0 },
    ],
    hp: 100, dmgMul: 1.0, armorMul: 1.0,
  },
  poisoner: {
    id: "poisoner", name: { zh: "毒药师", en: "Venom Alchemist" }, icon: "☠️",
    desc: { zh: "箭上淬毒，让你眼睁睁看着血条慢慢见底。", en: "Arrows dipped in venom — watch your health drain away." },
    grid: { cols: 4, rows: 5 },
    items: [
      { id: "short_bow", x: 0, y: 1, rot: 0 },
      { id: "venom_arrow", x: 2, y: 1, rot: 0 },
      { id: "banana", x: 2, y: 4, rot: 0 },
      { id: "apple", x: 3, y: 4, rot: 0 },
    ],
    hp: 100, dmgMul: 1.0, armorMul: 1.0,
  },
  flame_monk: {
    id: "flame_monk", name: { zh: "火焰修士", en: "Flame Monk" }, icon: "🔥",
    desc: { zh: "火杖配油瓶，一套点燃叠得飞快。", en: "A staff and an oil flask — burn stacks pile up fast." },
    grid: { cols: 4, rows: 5 },
    items: [
      { id: "fire_staff", x: 0, y: 1, rot: 0 },
      { id: "oil_flask", x: 1, y: 1, rot: 0 },
      { id: "mana_potion", x: 2, y: 1, rot: 0 },
      { id: "leather_armor", x: 0, y: 3, rot: 0 },
      { id: "apple", x: 2, y: 4, rot: 0 },
    ],
    hp: 95, dmgMul: 1.0, armorMul: 1.0,
  },
  ironclad: {
    id: "ironclad", name: { zh: "铁壁卫", en: "Ironclad Guard" }, icon: "🪖",
    desc: { zh: "重甲加烤肉，正面硬得吓人——试试火系与破阵。", en: "Heavy armor and roast meat — try fire and heavy blows." },
    grid: { cols: 4, rows: 5 },
    items: [
      { id: "iron_armor", x: 0, y: 0, rot: 0 },
      { id: "iron_shield", x: 2, y: 1, rot: 0 },
      { id: "roast", x: 0, y: 4, rot: 0 },
      { id: "iron_sword", x: 2, y: 3, rot: 0 },
    ],
    hp: 120, dmgMul: 1.0, armorMul: 1.0,
  },
  legend: {
    id: "legend", name: { zh: "传说冒险者", en: "Legendary Adventurer" }, icon: "🔱",
    desc: { zh: "手持英雄长剑的传奇前辈——远征的终点。", en: "A legendary veteran wielding the Hero Longsword — the end of the expedition." },
    grid: { cols: 4, rows: 5 },
    items: [
      { id: "long_sword", x: 0, y: 1, rot: 0 },
      { id: "whetstone", x: 1, y: 1, rot: 0 },
      { id: "iron_shield", x: 2, y: 1, rot: 0 },
      { id: "boots", x: 3, y: 1, rot: 0 },
      { id: "feast", x: 3, y: 3, rot: 0 },
      { id: "clover", x: 1, y: 4, rot: 0 },
    ],
    hp: 140, dmgMul: 1.0, armorMul: 1.0,
  },
};

// 对手出场表：轮次 → 对手 id（1-18）
export function enemyForRound(round) {
  if (round <= 3) return "novice";
  if (round <= 6) return "dual_blade";
  if (round <= 9) return "poisoner";
  if (round <= 12) return "flame_monk";
  if (round <= 15) return "ironclad";
  return "legend";
}

// ---------------- 远征参数 ----------------
export const EXPEDITION = {
  maxRounds: 18,
  winsNeeded: 10,
  lossesOut: 5,
  incomeBase: 6, // 每回合收入 = incomeBase + round（封顶 incomeCap）
  incomeCap: 22,
  expansionSlots: 2,
  expansionCost: [5, 8, 12], // 三次扩容价格
  expansionCells: 5,
  fatigueAfter: 30,
  fatigueRate: 3,
  hardCap: 60,
};

// ---------------- 残局关卡 ----------------
// tray: 可用物品与数量；enemy: 对手 id（无缩放）；hint 由求解器验证后回填
// 三星：胜利 / 剩余血量≥50% / 用时≤starTime（逐章收紧：20→16→12）
export const PUZZLES = [
  // 第一章 · 启蒙（教联动）
  { id: "p01", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "wooden_sword", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "banana", qty: 1 }], enemy: "novice" },
  { id: "p02", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "wooden_sword", qty: 1 }, { id: "whetstone", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "apple", qty: 1 }], enemy: "novice" },
  { id: "p03", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "iron_sword", qty: 1 }, { id: "whetstone", qty: 1 }, { id: "wooden_shield", qty: 1 }, { id: "banana", qty: 1 }], enemy: "novice" },
  { id: "p04", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "short_bow", qty: 2 }, { id: "clover", qty: 1 }, { id: "roast", qty: 1 }], enemy: "dual_blade" },
  { id: "p05", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "iron_sword", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }], enemy: "dual_blade" },
  { id: "p06", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "iron_sword", qty: 1 }, { id: "whetstone", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "apple", qty: 1 }], enemy: "dual_blade" },
  { id: "p07", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "war_hammer", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "banana", qty: 1 }], enemy: "dual_blade" },
  { id: "p08", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "short_bow", qty: 1 }, { id: "hunt_bow", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "leather_armor", qty: 1 }], enemy: "poisoner" },
  { id: "p09", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "hunt_bow", qty: 1 }, { id: "scope", qty: 1 }, { id: "venom_arrow", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "roast", qty: 1 }], enemy: "poisoner" },
  { id: "p10", chapter: 1, starTime: 20, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "leather_armor", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }], enemy: "poisoner" },
  // 第二章 · 进阶（旋转与合成）
  { id: "p11", chapter: 2, starTime: 16, grid: { cols: 4, rows: 5 }, tray: [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }], enemy: "flame_monk" },
  { id: "p12", chapter: 2, starTime: 16, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }], enemy: "flame_monk" },
  { id: "p13", chapter: 2, starTime: 16, grid: { cols: 4, rows: 5 }, tray: [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }], enemy: "flame_monk" },
  { id: "p14", chapter: 2, starTime: 16, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }], enemy: "flame_monk" },
  { id: "p15", chapter: 2, starTime: 16, grid: { cols: 4, rows: 5 }, tray: [{ id: "big_axe", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 2 }], enemy: "ironclad" },
  { id: "p16", chapter: 2, starTime: 16, grid: { cols: 4, rows: 5 }, tray: [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "mana_elixir", qty: 1 }, { id: "roast", qty: 1 }], enemy: "ironclad" },
  { id: "p17", chapter: 2, starTime: 16, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }], enemy: "ironclad" },
  { id: "p18", chapter: 2, starTime: 16, grid: { cols: 5, rows: 4 }, tray: [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "roast", qty: 2 }], enemy: "ironclad" },
  { id: "p19", chapter: 2, starTime: 16, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }], enemy: "ironclad" },
  { id: "p20", chapter: 2, starTime: 16, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "apple", qty: 1 }], enemy: "legend" },
  // 第三章 · 大师（组合残局）
  { id: "p21", chapter: 3, starTime: 14, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }], enemy: "legend" },
  { id: "p22", chapter: 3, starTime: 14, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "roast", qty: 1 }, { id: "leather_armor", qty: 1 }], enemy: "legend" },
  { id: "p23", chapter: 3, starTime: 14, grid: { cols: 4, rows: 5 }, tray: [{ id: "fireball_scroll", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "clover", qty: 1 }], enemy: "legend" },
  { id: "p24", chapter: 3, starTime: 14, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "mana_elixir", qty: 1 }, { id: "roast", qty: 1 }, { id: "iron_shield", qty: 1 }], enemy: "legend" },
  { id: "p25", chapter: 3, starTime: 14, grid: { cols: 4, rows: 5 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }], enemy: "legend" },
  { id: "p26", chapter: 3, starTime: 14, grid: { cols: 5, rows: 4, blocked: ["0,0", "4,0", "0,3", "4,3"] }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }], enemy: "legend" },
  { id: "p27", chapter: 3, starTime: 14, grid: { cols: 5, rows: 4, blocked: ["0,0", "4,0", "0,3", "4,3"] }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }], enemy: "legend" },
  { id: "p28", chapter: 3, starTime: 14, grid: { cols: 5, rows: 4, blocked: ["0,0", "4,0", "0,3", "4,3"] }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }], enemy: "legend" },
  { id: "p29", chapter: 3, starTime: 14, grid: { cols: 5, rows: 4 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }], enemy: "legend" },
  { id: "p30", chapter: 3, starTime: 14, grid: { cols: 5, rows: 4 }, tray: [{ id: "fire_staff", qty: 1 }, { id: "oil_flask", qty: 1 }, { id: "fireball_scroll", qty: 1 }, { id: "iron_shield", qty: 1 }, { id: "roast", qty: 1 }, { id: "apple", qty: 1 }], enemy: "legend" },
];

export const PUZZLE_STARS = { hpPct: 50, time: 14 };

// ---------------- 镜像模式 ----------------
export const MIRROR = {
  growthHp: 1.1,
  growthDmg: 1.05,
  baseIncome: 10,
};
