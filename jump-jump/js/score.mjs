// score.mjs — 计分唯一口径。UI 层永远不得自己算分，只能读取这里派发的结果。
// 本模块是依赖叶子：不 import 任何兄弟模块，保证单向依赖（engine -> score）。

/** 普通安全着陆 / 边缘险着：基础分 */
export const SAFE_POINTS = 1;
/** 跳床自动腾空落点： bounce 奖励分 */
export const TRAMPOLINE_POINTS = 2;
/** 靶心命中倍率：得分 = 2 × 当前连击数（+2 / +4 / +6 / +8 ...） */
export const BULLSEYE_MULT = 2;
/** 黑胶唱机停留 1.5 秒的彩蛋奖赏 */
export const VINYL_BONUS = 5;

/** 靶心试炼环带（按落点距中心与半径之比） */
export const SNIPER_RINGS = [
  { ratio: 0.25, points: 100, ring: "bullseye" },
  { ratio: 0.5, points: 60, ring: "inner" },
  { ratio: 0.8, points: 30, ring: "outer" },
  { ratio: 1, points: 10, ring: "edge" },
];
export const SNIPER_MAX = 1000;

export const SNIPER_RANKS = [
  { min: 800, rank: "S" },
  { min: 620, rank: "A" },
  { min: 420, rank: "B" },
  { min: 0, rank: "C" },
];

/** 二星：靶心率门槛；三星：3 连靶心或零摇晃 */
export const STAR_ACCURACY = 0.6;
export const STAR_COMBO = 3;

/** 单步得分：靶心按等差数列飞跃，普通着陆恒为基础分 */
export function bullseyeGain(combo) {
  return BULLSEYE_MULT * Math.max(1, Math.round(combo));
}

export function landingPoints(kind, combo) {
  if (kind === "perfect") return bullseyeGain(combo);
  if (kind === "trampoline") return TRAMPOLINE_POINTS;
  return SAFE_POINTS;
}

export function sniperRing(distance, radius) {
  const r = radius > 0 ? radius : 1;
  for (const band of SNIPER_RINGS) {
    if (distance <= r * band.ratio) return { ring: band.ring, points: band.points, distance };
  }
  return { ring: "miss", points: 0, distance };
}

export function sniperRank(total) {
  for (const entry of SNIPER_RANKS) {
    if (total >= entry.min) return entry.rank;
  }
  return "C";
}

export function accuracyOf(jumps, bullseyes) {
  if (!jumps || jumps <= 0) return 0;
  return bullseyes / jumps;
}

/**
 * 三星评价（累积式，必须先拿到前一星）：
 *   ★     安全抵达终点平台
 *   ★★   靶心命中率 ≥ 60%
 *   ★★★  达成一次 3 连以上靶心，或本关无一次边缘摇晃
 */
export function computeStars({ jumps, bullseyes, bestCombo, wobbles, won }) {
  if (!won) return 0;
  if (accuracyOf(jumps, bullseyes) < STAR_ACCURACY) return 1;
  if (bestCombo >= STAR_COMBO || wobbles === 0) return 3;
  return 2;
}
