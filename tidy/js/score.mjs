/**
 * @file games/tidy/js/score.mjs
 * 纯算分与三星成就判定模块，严格 DOM-free。
 * 遵循「得分永不大于总分」原则与 72 颗全量星星统计口径。
 */

export const MAX_LEVELS = 24;
export const STARS_PER_LEVEL = 3;
export const MAX_POSSIBLE_STARS = MAX_LEVELS * STARS_PER_LEVEL; // 72 星

/**
 * 计算单关通关星数 (1~3 星)
 * @param {Object} options
 * @param {boolean} options.cleared 是否全量收纳归位
 * @param {number} options.failedAttempts 未匹配弹回次数
 * @param {number} options.elapsedTime 通关耗时 (s)
 * @param {number} options.targetSeconds 推荐三星宽限时间 (s)
 * @returns {number} 0 ~ 3
 */
export function calculateStars(options = {}) {
  const {
    cleared = false,
    failedAttempts = 0,
    elapsedTime = 0,
    targetSeconds = 45,
  } = options;

  if (!cleared) return 0;

  let stars = 1; // 通关保底 1 星

  // ★ 沉着专注：失误未匹配尝试 <= 2 次
  if (failedAttempts <= 2) {
    stars += 1;
  }

  // ★ 行云流水：耗时在宽限目标时间内
  if (elapsedTime <= targetSeconds) {
    stars += 1;
  }

  return Math.min(STARS_PER_LEVEL, Math.max(1, stars));
}

/**
 * 汇总全关卡进度统计
 * @param {Object} recordMap 关卡记录字典 { [levelId]: { stars: number, bestTime: number } }
 * @returns {Object} 汇总对象
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
