// 连连看 link-up · 计分唯一口径（UI 不得自算分）

export const MAX_SCORE = 800;
export const DAILY_LEVEL_INDEX = 41;

export function baseScore(levelIndex) {
  // 第 1 章 200，逐章 +40：200 / 240 / 280 / 320 / 360
  return 200 + Math.floor((levelIndex - 1) / 10) * 40;
}

export function timeTmaxSeconds(rows, cols) {
  return 180 + (rows * cols - 36) * 2;
}

export function timeScore(rows, cols, elapsedMs) {
  const t = elapsedMs / 1000;
  const full = 400;
  if (t <= timeTmaxSeconds(rows, cols)) return full;
  const penalty = Math.floor((t - timeTmaxSeconds(rows, cols)) / 10) * 10;
  return Math.max(100, full - penalty); // 超时保底 100，绝不制造倒计时焦虑
}

export function comboBonusFor(combo) {
  // 第 k 连的该次加成 = 10 × (k−1)
  return combo >= 2 ? 10 * (combo - 1) : 0;
}

export function computeScore({ levelIndex, rows, cols, elapsedMs, comboBonus }) {
  const total = baseScore(levelIndex) + timeScore(rows, cols, elapsedMs) + (comboBonus || 0);
  return Math.max(0, Math.min(MAX_SCORE, Math.round(total)));
}
