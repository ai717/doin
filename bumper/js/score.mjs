/**
 * @file games/bumper/js/score.mjs
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

  // 1 星：抢 5 分决胜获胜
  const star1 = true;

  // 2 星：压倒性大胜 (蓝方得分 <= 1，即 5-0 或 5-1)
  const star2 = state.scores.blue <= 1 && state.scores.red >= state.targetScore;

  // 3 星：微操技巧 (触发至少 1 次双击急刹，或总碰撞次数 >= 8)
  const star3 = (state.stats.redBrakes >= 1) || (state.stats.collisions >= 8);

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
 * 汇总计算天梯 23 关全量收集概览
 * @param {Object} storageData
 * @returns {Object} { totalStars, maxStars: 69, percent }
 */
export function calculateTotalSummary(storageData) {
  const maxStars = 69; // 23 关 * 3 星 = 69 星
  const starsMap = storageData?.stars || {};

  let totalStars = 0;
  for (let i = 1; i <= 23; i++) {
    totalStars += (starsMap[i] || 0);
  }

  const percent = Math.round((totalStars / maxStars) * 100);

  return {
    totalStars,
    maxStars,
    percent,
  };
}
