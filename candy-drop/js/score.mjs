// score.mjs: 计分唯一口径（UI 不得自算分），上限钳制，永不显示「得分 > 总分」

import { LEVEL_COUNT, LEVELS_PER_BOX, levelsOfBox } from "./levels.mjs";

/** 送进嘴里即得分，此后每颗星再加一份 */
export const WIN_SCORE = 200;
export const STAR_SCORE = 100;
/** 单关满分：进嘴 + 三星 */
export const LEVEL_MAX = WIN_SCORE + STAR_SCORE * 3;
/** 全站满分：40 关 × 单关满分 */
export const TOTAL_MAX = LEVEL_MAX * LEVEL_COUNT;
/** 每盒满分（8 关） */
export const BOX_MAX = LEVEL_MAX * LEVELS_PER_BOX;
/** 解锁下一盒所需的本盒星数 */
export const BOX_UNLOCK_STARS = 12;

export function clampInt(n, min, max, fallback = min) {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

/** 单关得分：未进嘴一律 0（只收星不算通关分） */
export function scoreOf(stars, won) {
  const s = clampInt(stars, 0, 3, 0);
  if (!won) return 0;
  return Math.min(LEVEL_MAX, WIN_SCORE + s * STAR_SCORE);
}

/** 星级：0..3，UI 只读取不计算 */
export function starsOfRun(starsTaken) {
  return clampInt(starsTaken, 0, 3, 0);
}

/** 累计总分：钳制到 TOTAL_MAX，永不越界 */
export function totalScore(levels) {
  let sum = 0;
  for (const rec of Object.values(levels ?? {})) {
    sum += clampInt(rec?.score, 0, LEVEL_MAX, 0);
  }
  return Math.min(TOTAL_MAX, sum);
}

/** 某盒累计星（0..3×每盒关数） */
export function boxStars(levels, box) {
  let sum = 0;
  for (const lvl of levelsOfBox(box)) {
    sum += clampInt(levels?.[lvl.id]?.stars, 0, 3, 0);
  }
  return sum;
}
