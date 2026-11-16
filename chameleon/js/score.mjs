// score.mjs —— 计分唯一口径：单人猎手战役星级 = 抓获回合数 + 误指次数

export const STAR_MAX = 3;

/**
 * 星级口径：
 *   3 星 = 3 回合内抓获且零误指
 *   2 星 = 4 回合内抓获
 *   1 星 = 6 回合内抓获（5~6 回合）
 *   0 星 = 未抓获
 */
export function starsFor({ caught = false, roundsUsed = 0, wrongAccuses = 0 } = {}) {
  if (!caught) return 0;
  if (roundsUsed <= 3 && wrongAccuses === 0) return 3;
  if (roundsUsed <= 4) return 2;
  return 1;
}

/** 供 HUD/结果屏一致读取的满分上限 */
export function perfectScore() {
  return STAR_MAX;
}

/** 单关评语 key（供 UI 走 i18n） */
export function rankKeyOf(stars) {
  if (stars <= 0) return "rankNone";
  if (stars === 1) return "rankOne";
  if (stars === 2) return "rankTwo";
  return "rankThree";
}