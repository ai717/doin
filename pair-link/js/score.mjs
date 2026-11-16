// 计分唯一口径（纯函数，DOM-free）。UI 与 engine 都不得重复实现这里的公式。

export const BASE_PAIR = 100;
/** 折线奖励：0 折 / 1 折 / 2 折 */
export const FOLD_BONUS = [0, 10, 30];
export const COMBO_STEP = 50;
export const PER_SECOND = 10;
export const PER_ITEM = 80;
export const MAX_SCORE = 9999999;

/** 分数钳制：非有限数 → 0，负数 → 0，超过上限 → 上限。 */
export function clampScore(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(value)));
}

/**
 * 单次成功消除的得分。
 *   基础分 100 + 折线奖励（0/10/30），整体乘连击倍率（无尽模式跨盘继承），
 *   再加上连击奖励 50 × 连击数（连击奖励不乘倍率）。
 */
export function clearScore({ folds = 0, combo = 0, chainMult = 1 } = {}) {
  const f = Math.max(0, Math.min(FOLD_BONUS.length - 1, Number.isFinite(folds) ? Math.floor(folds) : 0));
  const c = Math.max(0, Number.isFinite(combo) ? Math.floor(combo) : 0);
  const m = Number.isFinite(chainMult) && chainMult > 0 ? Math.min(4, chainMult) : 1;
  return clampScore(Math.round((BASE_PAIR + FOLD_BONUS[f]) * m) + COMBO_STEP * c);
}

/** 关卡结算加分：剩余时间每秒 +10，未用提示 / 未用主动洗牌各 +80。 */
export function endBonus({ remainingMs = 0, hintsLeft = 0, shufflesLeft = 0 } = {}) {
  const seconds = Math.max(0, Math.floor((Number.isFinite(remainingMs) ? remainingMs : 0) / 1000));
  const hints = Math.max(0, Number.isFinite(hintsLeft) ? Math.floor(hintsLeft) : 0);
  const shuffles = Math.max(0, Number.isFinite(shufflesLeft) ? Math.floor(shufflesLeft) : 0);
  return seconds * PER_SECOND + (hints + shuffles) * PER_ITEM;
}

/**
 * 星级判定（每关 1–3 星）。
 *   ★    通关
 *   ★★   剩余时间比例 ≥ 25% 且主动洗牌 ≤ 1
 *   ★★★  剩余时间比例 ≥ 40% 且主动洗牌 = 0 且连击峰值 ≥ 4
 */
export function starsFor({ remainingMs = 0, timeMs = 1, activeShuffles = 0, comboPeak = 0 } = {}) {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return 1;
  const ratio = Math.max(0, Math.min(1, remainingMs / timeMs));
  const shuffles = Number.isFinite(activeShuffles) ? activeShuffles : 0;
  const peak = Number.isFinite(comboPeak) ? comboPeak : 0;
  if (ratio >= 0.4 && shuffles === 0 && peak >= 4) return 3;
  if (ratio >= 0.25 && shuffles <= 1) return 2;
  return 1;
}

/** 秒 → mm:ss。 */
export function formatClock(ms) {
  const total = Math.max(0, Math.ceil((Number.isFinite(ms) ? ms : 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}
