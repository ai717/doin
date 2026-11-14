// 莓园打地鼠 — 计分唯一口径（DOM-free）
// UI 不得自算分：所有分数变化必须走这里。
// 鼠种字面量与 engine.mjs 的 SPECIES 对齐（此处不反向 import engine，避免循环依赖，
// key 完备性由 tests/engine.test.mjs 断言）。

/** 各鼠种基础分 */
export const BASE_POINTS = Object.freeze({
  normal: 1,
  gold: 5,
  helmet: 3,
  bomb: 0,
});

/** 铁盔鼠第一击（掀盔）给的分 */
export const HELMET_BLOCK_POINTS = 1;

/** 误击炸弹鼠的扣分（钳制后不会低于 0） */
export const BOMB_PENALTY = 3;

/** 连击倍率阶梯 */
export const COMBO_TIERS = Object.freeze([
  { at: 24, mult: 3 },
  { at: 16, mult: 2 },
  { at: 8, mult: 1.5 },
]);

export function comboMultiplier(combo) {
  const n = Number.isFinite(combo) && combo > 0 ? Math.floor(combo) : 0;
  for (const tier of COMBO_TIERS) {
    if (n >= tier.at) return tier.mult;
  }
  return 1;
}

/** 下一档倍率还差多少连击（HUD 提示用；已封顶返回 null） */
export function nextComboTier(combo) {
  const n = Number.isFinite(combo) && combo > 0 ? Math.floor(combo) : 0;
  let target = null;
  for (const tier of COMBO_TIERS) {
    if (n < tier.at) target = tier;
  }
  return target;
}

/**
 * 命中得分：基础分 × 连击倍率 × 狂热倍率，取整且恒 ≥ 0。
 * isBlock=true 表示铁盔鼠的掀盔那一击（按 HELMET_BLOCK_POINTS 计）。
 */
export function hitPoints(species, combo = 0, options = {}) {
  const { frenzy = false, isBlock = false } = options;
  const base = isBlock ? HELMET_BLOCK_POINTS : (BASE_POINTS[species] ?? 0);
  const raw = base * comboMultiplier(combo) * (frenzy ? 2 : 1);
  return Math.max(0, Math.round(raw));
}

/** 误击炸弹：扣分后钳制在 0 以上 */
export function applyBombPenalty(score) {
  return Math.max(0, Math.floor(score) - BOMB_PENALTY);
}

/** 命中率（0~1），分母为 0 时返回 0 */
export function accuracy(hits, misses) {
  const total = Math.floor(hits) + Math.floor(misses);
  if (total <= 0) return 0;
  return Math.floor(hits) / total;
}

/** 命中率百分比整数（HUD 展示） */
export function accuracyPercent(hits, misses) {
  return Math.round(accuracy(hits, misses) * 100);
}

/** 结算摘要：把一局结果整理成可存储/展示的形状 */
export function summarizeRun(run) {
  const hits = Math.max(0, Math.floor(run.hits ?? 0));
  const misses = Math.max(0, Math.floor(run.misses ?? 0));
  return {
    score: Math.max(0, Math.floor(run.score ?? 0)),
    maxCombo: Math.max(0, Math.floor(run.maxCombo ?? 0)),
    hits,
    misses,
    bombs: Math.max(0, Math.floor(run.bombs ?? 0)),
    frenzyCount: Math.max(0, Math.floor(run.frenzyCount ?? 0)),
    accuracy: accuracyPercent(hits, misses),
  };
}

/** 是否是新的最高分 */
export function isNewBest(prevBest, score) {
  return Math.floor(score) > Math.floor(prevBest ?? 0);
}
