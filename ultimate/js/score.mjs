// 计分唯一口径：UI 只读这里的数字，绝不自算。
//
// 对弈单局 =（基础分 + 大格占领分 + 效率分 + 连胜分）× 难度系数
//   基础分：胜 120 / 和 40 / 负 0
//   大格占领分：胜局按己方大格数 × 20
//   效率分：胜局按 (60 - 总手数) × 2，最低 0 —— 赢得越快越值钱
//   连胜分：胜局按 min(连胜,5) × 15
// 残局单关 = 星数 × 100 + 省下的步数 × 15（最多 3 星）。

import { STATUS_DRAW, STATUS_WON } from "./engine.mjs";

export const OUTCOME_WIN = "win";
export const OUTCOME_DRAW = "draw";
export const OUTCOME_LOSS = "loss";
export const OUTCOME_PLAYING = "playing";

export const BASE_WIN = 120;
export const BASE_DRAW = 40;
export const BIG_BONUS = 20;
export const EFFICIENCY_CAP = 60;
export const EFFICIENCY_STEP = 2;
export const STREAK_STEP = 15;
export const STREAK_CAP = 5;
export const STAR_VALUE = 100;
export const SAVE_STEP = 15;

export const TIER_FACTOR = Object.freeze({
  novice: 0.5,
  duelist: 1,
  master: 1.6,
  infallible: 2.2,
});

export function outcomeOf(state, perspective) {
  if (!state) return OUTCOME_PLAYING;
  if (state.status === STATUS_WON) return state.winner === perspective ? OUTCOME_WIN : OUTCOME_LOSS;
  if (state.status === STATUS_DRAW) return OUTCOME_DRAW;
  return OUTCOME_PLAYING;
}

export function difficultyFactor(tier) {
  return TIER_FACTOR[tier] ?? TIER_FACTOR.duelist;
}

export function countBigs(state, mark) {
  let count = 0;
  for (const value of state.bigs) if (value === mark) count += 1;
  return count;
}

export function scoreDuel(options = {}) {
  const outcome = options.outcome ?? OUTCOME_LOSS;
  const moves = Math.max(0, Math.trunc(options.moves ?? 0));
  const ownBigs = Math.max(0, Math.trunc(options.ownBigs ?? 0));
  const streakBefore = Math.max(0, Math.trunc(options.streakBefore ?? 0));
  const factor = difficultyFactor(options.tier);

  const base = outcome === OUTCOME_WIN ? BASE_WIN : outcome === OUTCOME_DRAW ? BASE_DRAW : 0;
  const bigs = outcome === OUTCOME_WIN ? ownBigs * BIG_BONUS : 0;
  const efficiency = outcome === OUTCOME_WIN ? Math.max(0, EFFICIENCY_CAP - moves) * EFFICIENCY_STEP : 0;
  const streak = outcome === OUTCOME_WIN ? Math.min(STREAK_CAP, streakBefore) * STREAK_STEP : 0;
  const total = Math.round((base + bigs + efficiency + streak) * factor);

  return { base, bigs, efficiency, streak, factor, total };
}

export function scoreCampaign(options = {}) {
  const stars = Math.min(3, Math.max(0, Math.trunc(options.stars ?? 0)));
  const used = Math.max(0, Math.trunc(options.used ?? 0));
  const par = Math.max(0, Math.trunc(options.par ?? 0));
  const saved = stars > 0 ? Math.max(0, par - used) : 0;
  return { stars, saved, total: stars * STAR_VALUE + saved * SAVE_STEP };
}

// 结算面板的四行明细；文案键由 UI 层查 i18n。
export function breakdown(score) {
  return [
    { key: "base", value: score.base ?? 0 },
    { key: "bigs", value: score.bigs ?? 0 },
    { key: "efficiency", value: score.efficiency ?? 0 },
    { key: "streak", value: score.streak ?? 0 },
    { key: "total", value: score.total ?? 0 },
  ];
}
