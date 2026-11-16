// score.mjs —— 计分唯一口径（经典原味档）：每格 +1、每行/列 +10、十字共鸣 +25。
// UI 不得自算分；得分恒为非负且随放置单调不减。

export const SCORE_PER_CELL = 1;
export const SCORE_PER_LINE = 10;
export const SCORE_CROSS = 25;

function safeCount(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

/** 一次放置的得分（放置格分 + 消行分 + 十字加码） */
export function scoreForPlacement(cellCount, lineCount, cross) {
  const cells = safeCount(cellCount);
  const lines = safeCount(lineCount);
  return cells * SCORE_PER_CELL + lines * SCORE_PER_LINE + (cross ? SCORE_CROSS : 0);
}

/** 单次消除波次的基础分行（不含放置格分） */
export function lineScore(lineCount, cross) {
  const lines = safeCount(lineCount);
  return lines * SCORE_PER_LINE + (cross ? SCORE_CROSS : 0);
}
