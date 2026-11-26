// score.mjs —— 计分唯一口径：本作不比分数，比「用了几投」；星级锚定信息论最优步数

import { parOf } from "./levels.mjs";
import { clampInt } from "./engine.mjs";

export const STAR_MAX = 3;
/** 三星宽容度：盲猎关没有温度提示，多给一投 */
export function starTolerance(level) {
  return level?.blind ? 2 : 1;
}

/** 三星 / 二星门槛：三星 ≈ 二分最优 + 宽容度；二星 ≈ 预算留出 3 投 */
export function starThresholds(level) {
  const par = parOf(level.range);
  const three = par + starTolerance(level);
  const two = Math.max(three + 1, level.budget - 3);
  return { par, three, two };
}

/** 只有真正命中才算成绩；未命中一律 0 星 */
export function starsFor(level, used) {
  if (!level || !Number.isFinite(used) || used <= 0) return 0;
  const { three, two } = starThresholds(level);
  const n = clampInt(used, 1, level.budget, level.budget);
  if (n <= three) return 3;
  if (n <= two) return 2;
  return 1;
}

/** 评级用语键：猎手称号（i18n rank*） */
export function rankKeyOf(level, used) {
  const stars = starsFor(level, used);
  if (stars >= 3) return "rankAce";
  if (stars === 2) return "rankHunter";
  if (stars === 1) return "rankDeckhand";
  return "rankNone";
}

/** 效率百分比：理论最优 / 实投，上限 100 */
export function efficiencyOf(level, used) {
  const par = parOf(level.range);
  if (!Number.isFinite(used) || used <= 0) return 0;
  return Math.min(100, Math.round((par / used) * 100));
}
