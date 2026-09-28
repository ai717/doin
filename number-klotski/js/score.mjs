/**
 * 计分与评星评级规则口径 (DOM-free)
 */

export const PAR_MOVES = {
  3: { threeStar: 32, twoStar: 55 },
  4: { threeStar: 78, twoStar: 135 },
  5: { threeStar: 180, twoStar: 300 },
  6: { threeStar: 350, twoStar: 600 },
};

export const SPEED_RANKS = {
  3: [
    { maxSec: 8, rank: "godly" },
    { maxSec: 18, rank: "master" },
    { maxSec: 35, rank: "adept" },
    { maxSec: Infinity, rank: "rookie" },
  ],
  4: [
    { maxSec: 18, rank: "godly" },
    { maxSec: 42, rank: "master" },
    { maxSec: 90, rank: "adept" },
    { maxSec: Infinity, rank: "rookie" },
  ],
  5: [
    { maxSec: 55, rank: "godly" },
    { maxSec: 130, rank: "master" },
    { maxSec: 260, rank: "adept" },
    { maxSec: Infinity, rank: "rookie" },
  ],
};

/**
 * 计算星级评定 (1 ~ 3 星)
 */
export function calculateStars(size, moves) {
  const par = PAR_MOVES[size] || PAR_MOVES[4];
  if (moves <= par.threeStar) return 3;
  if (moves <= par.twoStar) return 2;
  return 1;
}

/**
 * 计算每秒推步数 TPS
 */
export function calculateTps(moves, elapsedSeconds) {
  const s = Math.max(0.1, elapsedSeconds);
  const tps = moves / s;
  return Math.round(tps * 10) / 10;
}

/**
 * 获取极速评级标签
 */
export function getSpeedRank(size, elapsedSeconds) {
  const ranks = SPEED_RANKS[size] || SPEED_RANKS[4];
  for (const item of ranks) {
    if (elapsedSeconds <= item.maxSec) {
      return item.rank;
    }
  }
  return "rookie";
}

/**
 * 格式化耗时展示 00:00.0
 */
export function formatTime(seconds) {
  const sec = Math.max(0, seconds);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  const mmStr = String(m).padStart(2, "0");
  const ssStr = String(s).padStart(2, "0");
  return `${mmStr}:${ssStr}.${ms}`;
}
