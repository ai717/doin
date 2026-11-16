// score.mjs: 云朵合成计分唯一口径，纯函数，无副作用，UI/渲染层不得自算分。

export const RAIN_CLEAR_UNIT_SCORE = 15;
export const RAINBOW_COLLECT_SCORE = 100;

/**
 * 合体基础分：第 N 级云得 N*(N+1)/2 分（三角数）。
 * @param {number} level 目标等级 (2..10)
 * @returns {number} 基础分
 */
export function mergeScore(level) {
  const lv = Math.max(1, Math.trunc(Number(level) || 1));
  return (lv * (lv + 1)) / 2;
}

/**
 * 连锁倍率计算：单次投掷引发连续 >= 2 次合体，第 k 次倍率为 1 + 0.5 * (k - 1)。
 * @param {number} chain 当前连续合体次数 (>= 1)
 * @returns {number} 倍率系数
 */
export function chainMultiplier(chain) {
  const k = Math.max(1, Math.trunc(Number(chain) || 1));
  if (k <= 1) return 1;
  return 1 + 0.5 * (k - 1);
}

/**
 * 单次合体实得分数（带连锁加成并取整）。
 * @param {number} level 合成出的云朵等级
 * @param {number} chain 连锁次数
 * @returns {number}
 */
export function calculateMergePoints(level, chain = 1) {
  const base = mergeScore(level);
  const mult = chainMultiplier(chain);
  return Math.round(base * mult);
}

/**
 * 雷暴云降雨清场得分（每清除一朵云奖励 15 分）。
 * @param {number} clearedCount 清除云朵数量
 * @returns {number}
 */
export function rainClearScore(clearedCount = 1) {
  const count = Math.max(0, Math.trunc(Number(clearedCount) || 0));
  return count * RAIN_CLEAR_UNIT_SCORE;
}

/**
 * 收集 L10 彩虹云奖励得分。
 * @returns {number}
 */
export function rainbowCollectScore() {
  return RAINBOW_COLLECT_SCORE;
}
