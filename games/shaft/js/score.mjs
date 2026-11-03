// score.mjs — 是男人就下一百层（shaft）计分唯一口径。
// 纯函数、DOM-free：HUD、结算与测试都只从这里取分，UI 不得自算。

export const POINTS_PER_FLOOR = 10;
export const POINTS_PER_HP = 15;
export const TIME_BONUS_RATE = 4;

export function floorsPoints(floors) {
  const n = Math.max(0, Math.round(Number(floors) || 0));
  return n * POINTS_PER_FLOOR;
}

export function lifePoints(hp) {
  const n = Math.max(0, Math.round(Number(hp) || 0));
  return n * POINTS_PER_HP;
}

/** 比标准用时就早多少秒 × 倍率；慢于标准不扣分，只清零奖励。 */
export function timeBonus(elapsed, parTime) {
  const e = Math.max(0, Number(elapsed) || 0);
  const par = Number(parTime);
  if (!Number.isFinite(par) || par <= 0) return 0;
  return Math.max(0, Math.round((par - e) * TIME_BONUS_RATE));
}

export function computeScore({ floors = 0, hp = 0, elapsed = 0, parTime: par = 0 } = {}) {
  return floorsPoints(floors) + lifePoints(hp) + timeBonus(elapsed, par);
}

export const STAR_RULES = {
  clear: 1,
  lifeRatio2: 0.5,
  lifeRatio3: 2 / 3,
  timeRatio3: 1,
};

/**
 * 三星：★ 通关；★★ 剩余生命 ≥ 50%；★★★ 剩余生命 ≥ 2/3 且用时不超过标准。
 * 未通关一律 0 星。
 */
export function computeStars({ won = false, hp = 0, maxHp = 1, elapsed = 0, parTime = 0 } = {}) {
  if (!won) return 0;
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const t = Math.max(0, Number(elapsed) || 0);
  const par = Number(parTime);
  let stars = 1;
  if (ratio >= STAR_RULES.lifeRatio2) stars = 2;
  if (ratio >= STAR_RULES.lifeRatio3 && Number.isFinite(par) && par > 0 && t <= par) stars = 3;
  return stars;
}

/** 结算面板的星级说明阈值，供 UI 与测试共享。 */
export function starHintValues() {
  return {
    life2: Math.round(STAR_RULES.lifeRatio2 * 100),
    life3: Math.round(STAR_RULES.lifeRatio3 * 100),
  };
}
