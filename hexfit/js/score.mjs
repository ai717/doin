// score.mjs —— 计分唯一口径：满行消除 4/4/4/4 → 2^18 倍率公式
import { BASE_SCORE_PER_ROW, MAX_MULTIPLIER_EXP, RUSH_THRESHOLD } from "./engine.mjs";

export const MULT_CAP = 2 ** MAX_MULTIPLIER_EXP; // 262144

/** 单次放置消 N 行的波次倍率（不含狂潮连乘） */
export function waveMultiplier(rowsCleared) {
  if (rowsCleared <= 0) return 1;
  const exp = Math.min(rowsCleared - 1, MAX_MULTIPLIER_EXP);
  return 2 ** exp;
}

/** 含狂潮连乘的最终倍率 */
export function totalMultiplier(rowsCleared, rushCombo, rushActive) {
  if (rowsCleared <= 0) return 1;
  const wave = rowsCleared - 1;
  const rush = rushActive ? rushCombo : 0;
  const exp = Math.min(wave + rush, MAX_MULTIPLIER_EXP);
  return Math.min(2 ** exp, MULT_CAP);
}

/** 得分 = 行数 × 100 × 倍率 */
export function scoreFor(rowsCleared, multiplier) {
  if (rowsCleared <= 0) return 0;
  return rowsCleared * BASE_SCORE_PER_ROW * Math.min(multiplier, MULT_CAP);
}

/** 是否触发蜜流狂潮 */
export function triggersRush(rowsCleared) {
  return rowsCleared >= RUSH_THRESHOLD;
}

/** HUD/结果屏一致读取的满分上限（单行极限） */
export function perfectScore() {
  return BASE_SCORE_PER_ROW * MULT_CAP;
}

/** 倍率档位描述 key（供 i18n） */
export function tierLabel(multiplier) {
  if (multiplier >= MULT_CAP) return "royal";
  if (multiplier >= 256) return "gold";
  if (multiplier >= 16) return "rush";
  if (multiplier >= 4) return "triple";
  if (multiplier >= 2) return "double";
  return "single";
}
