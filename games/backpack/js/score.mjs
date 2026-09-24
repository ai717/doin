// score.mjs — 计分唯一口径（UI 不得自行算分）：段位 / 残局三星 / 镜像纪录
import { PUZZLE_STARS } from "./data.mjs";

export const RANK_NAMES = ["bronze", "silver", "gold", "platinum", "master"];
export const MAX_RANK = RANK_NAMES.length - 1;

// 段位名称索引（0-4）
export function clampRank(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_RANK, Math.trunc(n)));
}

// 远征结算 → 段位积分（0-4 段）：10 胜晋级 +1，出局时按胜场给进度
export function expeditionRankProgress({ wins, losses }) {
  const w = Math.max(0, Math.trunc(wins));
  const l = Math.max(0, Math.trunc(losses));
  const promoted = w >= 10 ? 1 : 0;
  const partial = w >= 6 ? 0.5 : 0;
  return { promoted, partial, wins: w, losses: l };
}

// 残局三星：0 未过 / 1 过关 / 2 剩余血量≥阈值 / 3 且用时≤阈值
export function puzzleStars({ won, hpPct, time }) {
  if (!won) return 0;
  let stars = 1;
  if (hpPct * 100 >= PUZZLE_STARS.hpPct) stars = 2;
  if (hpPct * 100 >= PUZZLE_STARS.hpPct && time <= PUZZLE_STARS.time) stars = 3;
  return stars;
}

export function clampStars(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(3, Math.trunc(n)));
}

// 镜像纪录
export function mirrorBest({ rounds = 0, damage = 0 } = {}) {
  const r = Math.max(0, Math.trunc(Number(rounds) || 0));
  const d = Math.max(0, Math.trunc(Number(damage) || 0));
  return { rounds: r, damage: d };
}
