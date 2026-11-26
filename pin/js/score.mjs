/**
 * @file games/pin/js/score.mjs
 * 纯算分与三星成就判定模块，严格 DOM-free。
 * 遵循契约：得分永不大于总分，69 颗全量星星统计与无尽积分计算口径。
 */

export const MAX_LEVELS = 23;
export const STARS_PER_LEVEL = 3;
export const MAX_POSSIBLE_STARS = MAX_LEVELS * STARS_PER_LEVEL; // 69 星

/**
 * 计算关卡模式三星成就
 * @param {Object} options
 * @param {boolean} options.cleared 是否通关
 * @param {number} options.maxCombo 最大连击数
 * @param {number} options.elapsedTime 通关耗时 (s)
 * @param {number} options.targetSeconds 宽限目标时间 (s)
 * @returns {number} 0 ~ 3 星
 */
export function calculateStars(options = {}) {
  const {
    cleared = false,
    maxCombo = 0,
    elapsedTime = 0,
    targetSeconds = 30,
  } = options;

  if (!cleared) return 0;

  let stars = 1; // 通关保底 1 星

  // ★★ 行云流水：达成 >= 4 连击
  if (maxCombo >= 4) {
    stars += 1;
  }

  // ★★★ 钟表大师：在宽限目标时间内行云流水清空
  if (elapsedTime <= targetSeconds) {
    stars += 1;
  }

  return Math.min(STARS_PER_LEVEL, Math.max(1, stars));
}

/**
 * 汇总关卡模式全量进度
 */
export function calculateTotalSummary(recordMap = {}) {
  let totalStars = 0;
  let clearedCount = 0;
  let totalBestTime = 0;

  for (let id = 1; id <= MAX_LEVELS; id++) {
    const rec = recordMap[id];
    if (rec && rec.stars > 0) {
      totalStars += Math.min(STARS_PER_LEVEL, Math.max(0, rec.stars));
      clearedCount += 1;
      if (typeof rec.bestTime === 'number' && rec.bestTime > 0) {
        totalBestTime += rec.bestTime;
      }
    }
  }

  return {
    totalStars: Math.min(MAX_POSSIBLE_STARS, totalStars),
    maxStars: MAX_POSSIBLE_STARS,
    clearedCount,
    totalLevels: MAX_LEVELS,
    totalBestTime,
    completionPercentage: Math.round((clearedCount / MAX_LEVELS) * 100),
  };
}

/**
 * 格式化秒数为 mm:ss
 */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
