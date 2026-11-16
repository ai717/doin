// 森林冰火人 · 计分唯一口径
// 星级 = 宝石收集 + 零死亡（由 engine.computeStars 定义），此处负责口径封装与钳制
// UI 一律不得自算分

import { computeStars } from "./engine.mjs";

export const MAX_STARS = 3;
export const MIN_STARS = 1;

export function starsForStats(stats) {
  if (!stats) return MIN_STARS;
  return clampStars(computeStars(stats));
}

export function clampStars(stars) {
  const n = Math.trunc(Number(stars));
  if (!Number.isFinite(n)) return MIN_STARS;
  return Math.max(MIN_STARS, Math.min(MAX_STARS, n));
}

// 结算看板：宝石收集 / 死亡 / 同步踩板 / 用时
export function collectRate(stats) {
  if (!stats) return 0;
  const got = stats.gems.red + stats.gems.blue + stats.gems.gold;
  const total = stats.totalGems;
  if (!total) return 1;
  return Math.max(0, Math.min(1, got / total));
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.trunc(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function gemsCollected(stats) {
  if (!stats) return 0;
  return stats.gems.red + stats.gems.blue + stats.gems.gold;
}
