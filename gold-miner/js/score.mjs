// 计分唯一口径：目标配额、钻石升值、商店价格、神秘袋奖励。
// engine / ui 都不许自己算钱，只能调用这里的纯函数。

export const BASE_TARGET = 1000;
export const TARGET_GROWTH = 1.65;
export const DIAMOND_VALUE = 600;
export const DIAMOND_VALUE_POLISHED = 900;
export const BAG_MONEY = 500;
export const BAG_DYNAMITE = 2;

export const SHOP_ITEMS = Object.freeze([
  Object.freeze({ type: "dynamite", cost: 200 }),
  Object.freeze({ type: "potion", cost: 280 }),
  Object.freeze({ type: "polish", cost: 320 }),
]);

// 第 1 关 1000，之后每关 ×1.65（与关卡生成解耦，UI 分母也用它）。
export function targetForLevel(level) {
  const lvl = Math.max(1, Math.trunc(Number(level) || 1));
  return Math.round(BASE_TARGET * Math.pow(TARGET_GROWTH, lvl - 1));
}

export function diamondValue(hasPolish) {
  return hasPolish ? DIAMOND_VALUE_POLISHED : DIAMOND_VALUE;
}

export function shopCost(type) {
  const item = SHOP_ITEMS.find((entry) => entry.type === type);
  return item ? item.cost : Infinity;
}

export function canAfford(money, type) {
  return money >= shopCost(type);
}

// 神秘袋：40% 现金 / 30% 炸药 / 30% 生力水。rng 可注入以便测试。
export function bagPrize(rng = Math.random) {
  const roll = rng();
  if (roll < 0.4) return { kind: "money", amount: BAG_MONEY };
  if (roll < 0.7) return { kind: "dynamite", amount: BAG_DYNAMITE };
  return { kind: "potion", amount: 1 };
}

export function isRoundWon(money, target) {
  return money >= target;
}
