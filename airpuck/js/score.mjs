/**
 * @file games/airpuck/js/score.mjs
 * 计分与 3 星星级评估中心，UI 不得自算分。
 * 契约保证：永不显示得分 > 总分，集中计算全量成就与时间格式化。
 */

/**
 * 计算单关 3 星成就
 * 星级 1: 斩获 5 分夺冠获胜 (必得)
 * 星级 2: 绝佳压制（失球 <= 1 球，即 5:0 或 5:1）
 * 星级 3: 疾速争霸（在关卡推荐时间 targetSeconds 内取胜）
 */
export function calculateStars(state, level) {
  if (!state || state.winner !== 'p1') {
    return {
      stars: 0,
      won: false,
      goalsConceded: state ? state.scoreP2 : 5,
      timePassed: false,
      shutoutPassed: false,
    };
  }

  const targetSec = level?.targetSeconds || 60;
  const timePassed = state.elapsedTime <= targetSec;
  const shutoutPassed = state.scoreP2 <= 1;

  let stars = 1; // 获胜保底 1 星
  if (shutoutPassed) stars += 1;
  if (timePassed) stars += 1;

  return {
    stars,
    won: true,
    goalsConceded: state.scoreP2,
    timePassed,
    shutoutPassed,
  };
}

/**
 * 汇总全天梯 22 关通关总星数与总通关数 (满星 66 星)
 */
export function calculateTotalSummary(records = {}, levels = []) {
  let totalStars = 0;
  let clearedCount = 0;
  const maxStars = levels.length * 3;

  for (const level of levels) {
    const rec = records[level.id];
    if (rec && rec.won) {
      clearedCount += 1;
      totalStars += Math.min(3, Math.max(0, rec.stars || 0));
    }
  }

  return {
    totalStars,
    maxStars,
    clearedCount,
    totalLevels: levels.length,
    percentage: maxStars > 0 ? Math.round((totalStars / maxStars) * 100) : 0,
  };
}

/**
 * 格式化秒数为 mm:ss
 */
export function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
