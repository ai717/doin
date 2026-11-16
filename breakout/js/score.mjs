// score.mjs — 计分唯一口径。UI 不得自算分；所有分值在此钳制上限。

import { BRICK_SCORE } from "./levels.mjs";

export const SCORE_CAP = 9_999_999;
export const LAYER_CLEAR_BASE = 500;
export const BOSS_CLEAR_BASE = 2000;
export const COMBO_DAMAGE_PER_10 = 1.1;
export const COMBO_DAMAGE_MAX = 3.0;

export function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(SCORE_CAP, Math.round(n)));
}

/** 砖块得分 = 基础分 × 连击倍率 × 金币磁铁(×2) */
export function brickScore(typeId, comboMult, goldRush) {
  const base = BRICK_SCORE[typeId] ?? 0;
  const raw = base * comboMult * (goldRush ? 2 : 1);
  return clampScore(raw);
}

/** 连击伤害倍率：每 10 连击 ×1.1，上限 ×3。 */
export function comboDamageMultiplier(combo) {
  const c = Math.max(0, Math.floor(combo));
  const steps = Math.floor(c / 10);
  const mult = Math.pow(COMBO_DAMAGE_PER_10, steps);
  return Math.max(1, Math.min(COMBO_DAMAGE_MAX, mult));
}

/** 层通关奖励。 */
export function layerClearBonus(boss) {
  return clampScore(boss ? BOSS_CLEAR_BASE : LAYER_CLEAR_BASE);
}

/** 砖块造成的伤害（考虑精准狙击 + 连击狂热）。 */
export function brickDamage(typeId, combo, sniper, comboFever) {
  let dmg = 1;
  if (sniper && (typeId === 3 || typeId === 4)) dmg *= 2;
  if (comboFever) dmg *= comboDamageMultiplier(combo);
  return Math.max(1, Math.round(dmg));
}
