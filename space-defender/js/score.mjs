// score.mjs — 计分唯一口径。UI 不得自算分；所有分值在此钳制上限。

import { ENEMY_TYPES } from "./levels.mjs";

export const COMBO_MAX = 8;
export const COMBO_WINDOW = 1.2;
export const GRAZE_SCORE = 15;
export const WAVE_CLEAR_BASE = 500;
export const BOSS_CLEAR_BASE = 1500;
export const SCORE_CAP = 9_999_999;
export const STAR_ACCURACY = 0.7;
export const STAR_TIME_SLACK = 1.0;

export function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(SCORE_CAP, Math.round(n)));
}

/** 连击倍率：1 → 8，链断归 1。 */
export function comboMultiplier(combo) {
  const c = Math.max(0, Math.min(COMBO_MAX, Math.floor(combo)));
  return c <= 0 ? 1 : c;
}

/** 击杀得分 = 敌机基础分 × 连击倍率 × OVERLOAD 翻倍。 */
export function killScore(typeId, combo, overload) {
  const type = ENEMY_TYPES[typeId];
  const base = type ? type.score : 50;
  const raw = base * comboMultiplier(combo) * (overload ? 2 : 1);
  return clampScore(raw);
}

export function grazeScore(combo, overload) {
  return clampScore(GRAZE_SCORE * comboMultiplier(combo) * (overload ? 2 : 1));
}

/** 波次通关奖励：基础分 + 剩余时间奖励（越快的清场越值钱）。 */
export function waveClearBonus(spec, timeUsed, noHit) {
  const base = spec?.boss ? BOSS_CLEAR_BASE : WAVE_CLEAR_BASE;
  const par = Math.max(1, spec?.par ?? 20);
  const speed = Math.max(0, par - timeUsed) * 20;
  return clampScore(base + speed + (noHit ? 300 : 0));
}

/**
 * 三星评价：三条独立判据，各得 1 星。
 * 1) 命中率 ≥ 70%  2) 全程未被击中  3) 在 par 时限内清空
 */
export function starsFor({ shots, hits, hitsTaken, timeUsed, par }) {
  const accuracy = shots > 0 ? hits / shots : 0;
  let stars = 0;
  if (accuracy >= STAR_ACCURACY) stars += 1;
  if ((hitsTaken ?? 0) === 0) stars += 1;
  if (timeUsed <= (par ?? Infinity) * STAR_TIME_SLACK) stars += 1;
  return Math.max(0, Math.min(3, stars));
}

/** 战役总星数上限：30 波 × 3 星。 */
export function totalStars(list) {
  if (!Array.isArray(list)) return 0;
  return list.reduce((sum, n) => sum + Math.max(0, Math.min(3, Math.floor(n || 0))), 0);
}
