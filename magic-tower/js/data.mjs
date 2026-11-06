// 魔塔：勇者登顶 · 数值总表（唯一口径）
//
// 本文件只存数字与 id，严禁出现面向玩家的中文文案 —— 名称/描述一律由 i18n.mjs 按 id 查表。
// 100% 确定性：无随机掉落、无暴击闪避，所有战斗结果可由下面的数值直接推算。

export const GRID = 11;

// 勇者初始属性（进入 1 层瞬间）
export const START_STATS = Object.freeze({
  hp: 1500,
  atk: 12,
  def: 10,
  gold: 0,
  keys: Object.freeze({ y: 1, b: 0, r: 0 }),
});

// 道具效果：potion 同时抬升当前与上限，保证血条语义一致
export const ITEMS = Object.freeze({
  g: { gold: 10 }, // 金币袋
  G: { gold: 40 }, // 金库
  p: { hp: 400 }, // 小血瓶
  P: { hp: 1000 }, // 大血瓶
  A: { atk: 5 }, // 红宝石
  F: { def: 5 }, // 蓝宝石
  W: { atk: 15 }, // 武器
  S: { def: 15 }, // 护甲
  C: { cross: true }, // 神圣十字架（真结局前置）
  i: { compass: true }, // 楼层罗盘（解锁已探索楼层直达）
  T: { thief: true }, // 被囚的小偷（放他出来会打开暗墙）
  M: {}, // 商店（交互触发，不消耗）
  Z: {}, // 公主（真结局终点）
});

// 商店：每种商品每次购买价格递增，同层共享购买计数
export const SHOP = Object.freeze({
  hp: { amount: 500, base: 22, step: 8 },
  atk: { amount: 2, base: 40, step: 15 },
  def: { amount: 2, base: 40, step: 15 },
});

// 怪物总表。tier 仅用于图鉴排序与雷达分组，不参与伤害计算。
export const MONSTERS = Object.freeze({
  // 一区 · 苔痕石厅（1-5）
  mossSlime: { hp: 40, atk: 20, def: 0, gold: 2, tier: 1 },
  boneScout: { hp: 62, atk: 34, def: 3, gold: 4, tier: 1 },
  caveBat: { hp: 80, atk: 42, def: 6, gold: 6, tier: 1 },
  boneCaptain: { hp: 300, atk: 56, def: 14, gold: 30, tier: 1, boss: true },

  // 二区 · 幽回廊（6-10）
  graveBat: { hp: 110, atk: 58, def: 10, gold: 6, tier: 2 },
  hexAcolyte: { hp: 140, atk: 68, def: 14, gold: 10, tier: 2 },
  graveKnight: { hp: 175, atk: 76, def: 19, gold: 15, tier: 2 },
  crimsonHerald: { hp: 520, atk: 86, def: 26, gold: 60, tier: 2, boss: true },

  // 三区 · 磐石壁垒（11-15）
  orcGuard: { hp: 180, atk: 92, def: 22, gold: 14, tier: 3 },
  hexWarlock: { hp: 220, atk: 104, def: 27, gold: 20, tier: 3 },
  goldKnight: { hp: 270, atk: 114, def: 33, gold: 26, tier: 3 },
  ironWarden: { hp: 800, atk: 132, def: 38, gold: 110, tier: 3, boss: true },

  // 四区 · 熔岩深渊（16-20）
  wraithMage: { hp: 280, atk: 140, def: 36, gold: 24, tier: 4 },
  zweihander: { hp: 340, atk: 155, def: 42, gold: 32, tier: 4 },
  crimsonArchmage: { hp: 400, atk: 172, def: 48, gold: 40, tier: 4 },
  falseDemon: { hp: 1100, atk: 235, def: 55, gold: 180, tier: 4, boss: true },

  // 五区 · 魔塔之巅（21-24）
  darkRider: { hp: 300, atk: 210, def: 52, gold: 48, tier: 5 },
  abyssDrake: { hp: 340, atk: 230, def: 60, gold: 58, tier: 5 },
  demonKnight: { hp: 390, atk: 255, def: 68, gold: 70, tier: 5 },
  trueDemon: { hp: 1300, atk: 280, def: 76, gold: 0, tier: 5, boss: true },
});

export const ZONE_RANGES = Object.freeze([
  { zone: 1, from: 1, to: 5 },
  { zone: 2, from: 6, to: 10 },
  { zone: 3, from: 11, to: 15 },
  { zone: 4, from: 16, to: 20 },
  { zone: 5, from: 21, to: 24 },
]);

export const TOTAL_FLOORS = 24;

// 勇者段位：按通关总战损、步数与剩余生命综合评定（score.mjs 消费）
export const RANKS = Object.freeze([
  { id: "swordsaint", maxDamage: 2600, maxSteps: 2400 },
  { id: "paladin", maxDamage: 4200, maxSteps: 3100 },
  { id: "knight", maxDamage: 6200, maxSteps: 3900 },
  { id: "guard", maxDamage: 9000, maxSteps: 5200 },
  { id: "squire", maxDamage: Infinity, maxSteps: Infinity },
]);
