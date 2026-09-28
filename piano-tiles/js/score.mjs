// Piano Tiles — 计分唯一口径
// 规则由 engine.comboMultiplier 决定，此处只对外暴露便捷函数

import { comboMultiplier, computeRank } from "./engine.mjs";

export function calcHitScore(quality, combo) {
  const mult = comboMultiplier(combo);
  const base = quality === "perfect" ? 2 : 1;
  return Math.round(base * mult * 10);
}

export function getRankName(maxCombo) {
  const r = computeRank(maxCombo);
  return r ? r.name : null;
}

export function getRankNameEn(maxCombo) {
  const r = computeRank(maxCombo);
  return r ? r.en : null;
}
