/**
 * @file games/tug/js/score.mjs
 * 纯逻辑计分与 3 星成就判定模块，DOM-free。
 */

/**
 * 依据单人闯关终局状态结算 3 星成就
 * @param {Object} state - 终局状态快照
 * @returns {Object} { star1, star2, star3, totalStars }
 */
export function calculateStars(state) {
  if (state.status !== 'match_won' || state.matchWinner !== 'red') {
    return {
      star1: false,
      star2: false,
      star3: false,
      totalStars: 0,
    };
  }

  // 1 星：拔河获胜
  const star1 = true;

  // 2 星：2-0 零封获胜 (蓝方得分为 0)
  const star2 = state.scores.blue === 0 && state.scores.red >= 2;

  // 3 星：暴击技巧或爆发手速 (≥5次 PERFECT 暴击，或峰值 CPS ≥ 6.2)
  const star3 = state.stats.redPerfects >= 5 || state.stats.redMaxCps >= 6.2;

  let totalStars = 0;
  if (star1) totalStars += 1;
  if (star2) totalStars += 1;
  if (star3) totalStars += 1;

  return {
    star1,
    star2,
    star3,
    totalStars,
  };
}

/**
 * 汇总计算天梯 22 关全量收集概览
 * @param {Object} storageData
 * @returns {Object} { totalStars, maxStars: 66, percent }
 */
export function calculateTotalSummary(storageData) {
  const maxStars = 66;
  const starsMap = storageData?.stars || {};

  let totalStars = 0;
  for (let i = 1; i <= 22; i++) {
    totalStars += (starsMap[i] || 0);
  }

  const percent = Math.round((totalStars / maxStars) * 100);

  return {
    totalStars,
    maxStars,
    percent,
  };
}
