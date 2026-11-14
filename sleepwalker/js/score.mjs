/**
 * @file games/sleepwalker/js/score.mjs
 * 计分唯一口径，UI 不得自算分。
 */

/**
 * 计算单关通关星级
 * @param {object} engineState
 */
export function calculateStars(engineState) {
  if (engineState.status !== 'won') {
    return {
      stars: 0,
      star1: false, // 抵达终点
      star2: false, // 深度睡眠（无惊吓）
      star3: false, // 收集全 3 个金泡泡
      bubblesCount: 0,
    };
  }

  const star1 = true;
  const star2 = (engineState.scareCount === 0);
  const bubblesCount = engineState.bubbles.filter((b) => b.collected).length;
  const star3 = (bubblesCount >= 3);

  let stars = 1;
  if (star2) stars++;
  if (star3) stars++;

  return {
    stars,
    star1,
    star2,
    star3,
    bubblesCount,
  };
}

/**
 * 汇总全关卡统计
 * @param {object} storageData
 */
export function calculateTotalSummary(storageData) {
  let totalStars = 0;
  let totalBubbles = 0;
  let clearedCount = 0;

  const starsMap = storageData?.stars || {};
  const bubblesMap = storageData?.bubbles || {};

  for (let i = 1; i <= 22; i++) {
    const s = starsMap[i] || 0;
    const b = bubblesMap[i] || 0;
    if (s > 0) clearedCount++;
    totalStars += s;
    totalBubbles += b;
  }

  const maxStars = 66;
  const isMaster = totalStars >= maxStars;

  return {
    clearedCount,
    totalStars,
    maxStars,
    totalBubbles,
    maxBubbles: 66,
    isMaster,
  };
}
