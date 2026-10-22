// filepath: games/bubble-bloom/js/score.mjs

// 计分唯一口径：engine 调用本模块累加，UI 不得自行计算分数。

export const BLOOM_BONUS = 1000;

const RANK_THRESHOLDS = [1200, 4000];
export const RANK_KEYS = ["rank.1", "rank.2", "rank.3"];

// 合成出第 tier 阶泡的基础分：三角数，2 阶 6 分到 10 阶 110 分。
export function mergePoints(tier) {
  const value = Math.round(tier);
  if (!Number.isFinite(value) || value < 2) return 0;
  return value * (value + 1);
}

// 连锁倍率：首次 1.0，2 连 1.25，3 连 1.6，4 连及以上 2.0 封顶。
export function chainMultiplier(chain) {
  const n = Math.round(chain);
  if (!Number.isFinite(n) || n <= 1) return 1;
  if (n === 2) return 1.25;
  if (n === 3) return 1.6;
  return 2;
}

export function mergeScore(tier, chain) {
  return Math.round(mergePoints(tier) * chainMultiplier(chain));
}

export function rankKey(score) {
  const value = Number.isFinite(score) ? score : 0;
  if (value >= RANK_THRESHOLDS[1]) return RANK_KEYS[2];
  if (value >= RANK_THRESHOLDS[0]) return RANK_KEYS[1];
  return RANK_KEYS[0];
}
