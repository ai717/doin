// 数字合成大西瓜 watermelon-2048 · 计分唯一口径（纯函数，UI 不得自算）
// 2048 铁律：合并得分 = 新水果数字值 × 连锁倍率；摘瓜奖励固定 2048 分。
// 算例：2+2→4 得 4 分；16→16(连锁第2次) 得 16×1.5=24 分；1024+1024→2048 得 2048 分。

// 摘瓜（摘下 2048 大西瓜）固定奖励 = 大西瓜自身的数字值。
export const HARVEST_BONUS = 2048;

// 第 level 级水果的数字值：2^level（2,4,8,…,2048）。
export function valueOf(level) {
  const n = Math.trunc(Number(level));
  if (!Number.isFinite(n) || n <= 0) return 2;
  if (n > 31) return 2 ** 31; // 数值上限保护（本作 n<=11）
  return 2 ** n;
}

// 单次合并得分 = 新值 × 连锁倍率（chainIndex 从 0 起，每多一级 ×1.5）。
// 倍率 = 1 + 0.5×chainIndex：第 1 次 ×1、第 2 次 ×1.5、第 3 次 ×2…
export function mergeScore(level, chainIndex = 0) {
  const ci = Math.trunc(Number(chainIndex));
  const k = Number.isFinite(ci) && ci > 0 ? ci : 0;
  return Math.round(valueOf(level) * (1 + 0.5 * k));
}

// 摘瓜固定奖励（爆分 + 清空占位双收益）。
export function harvestScore() {
  return HARVEST_BONUS;
}

export function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

export function isBetterScore(candidate, current) {
  return clampScore(candidate) > clampScore(current);
}
