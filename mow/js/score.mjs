// score.mjs — 《割草！Mow!》计分唯一口径（UI 不得自算分）。
// 上限钳制：任何路径的得分都不可能超过 SCORE_CAP。

export const SCORE_CAP = 999999;

export function clampScore(v) {
  return Math.max(0, Math.min(SCORE_CAP, Math.round(v) || 0));
}

const KILL_BASE = Object.freeze({
  caterpillar: 8,
  beetle: 12,
  wasp: 16,
  toadstool: 24,
  thornball: 20,
  elite: 160,
});

/** 单杀得分：基础分 × 连击加成（连击最高 ×2.5） */
export function killScore(type, combo) {
  const base = KILL_BASE[type] ?? 8;
  const mult = 1 + Math.min(1.5, (combo || 0) * 0.03);
  return Math.round(base * mult);
}

/** 花粉爆发得分：越攒越值钱 */
export function burstScore(count) {
  return 60 + (count || 0) * 15;
}

/** Boss 击杀奖励 */
export function bossScore(kills) {
  return 1200 + Math.min(kills || 0, 500);
}

/**
 * 单局星级（1~3 星）：
 * - 击破园丁巨人（won）：3★ = 击杀 ≥ 600 且 连击峰值 ≥ 40；2★ = 击杀 ≥ 350；否则 1★；
 * - 失败（lost）：存活 ≥ 5:00 得 1★，否则 0★。
 */
export function starsFor({ won, kills, maxCombo, time }) {
  if (won) {
    if (kills >= 600 && maxCombo >= 40) return 3;
    if (kills >= 350) return 2;
    return 1;
  }
  return time >= 300 ? 1 : 0;
}

/** 取更优战绩（先比通关，再比星级，再比得分） */
export function bestOf(a, b) {
  if (!a) return b;
  if (!b) return a;
  const rank = (r) => (r.won ? 2000 : 1000) + (r.stars ?? 0) * 100 + Math.min(r.score, SCORE_CAP);
  return rank(b) > rank(a) ? b : a;
}
