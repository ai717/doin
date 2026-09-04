// 计分口径的唯一来源。UI 与结算面板只准读这里的数字，不许自己算。
//
// 单局得分 =（基础分 + 效率奖励 + 连胜奖励）× 难度系数
//   基础分：胜 100 / 平 30 / 负 0
//   效率奖励：仅胜局，剩余空格数 × 8 —— 赢得越干脆剩得越多
//   连胜奖励：仅胜局，min(本局之前的连胜, 5) × 20 —— 首胜不给，连胜越多越值钱
//   难度系数：轻松 0.6 / 普通 1.0 / 大师 1.6
// 平局保留连胜但不增长，失败才清零。双人同屏不计分、不入库。

import { EMPTY, STATUS_DRAW, STATUS_WON } from "./engine.mjs";
import { DIFFICULTY_META, DIFFICULTY_NORMAL } from "./ai.mjs";

export const BASE_WIN = 100;
export const BASE_DRAW = 30;
export const BASE_LOSS = 0;
export const EFFICIENCY_PER_CELL = 8;
export const STREAK_STEP = 20;
export const STREAK_CAP = 5;

export const OUTCOME_WIN = "win";
export const OUTCOME_DRAW = "draw";
export const OUTCOME_LOSS = "loss";
export const OUTCOME_PLAYING = "playing";

export function outcomeOf(state, perspective) {
  if (state.status === STATUS_WON) return state.winner === perspective ? OUTCOME_WIN : OUTCOME_LOSS;
  if (state.status === STATUS_DRAW) return OUTCOME_DRAW;
  return OUTCOME_PLAYING;
}

export function countEmpty(state) {
  let empty = 0;
  for (const cell of state.board) if (cell === EMPTY) empty += 1;
  return empty;
}

export function difficultyFactor(difficulty) {
  return (DIFFICULTY_META[difficulty] ?? DIFFICULTY_META[DIFFICULTY_NORMAL]).factor;
}

export function scoreResult(options = {}) {
  const outcome = options.outcome ?? OUTCOME_LOSS;
  const empty = Math.max(0, Math.trunc(options.empty ?? 0));
  const streakBefore = Math.max(0, Math.trunc(options.streakBefore ?? 0));
  const factor = difficultyFactor(options.difficulty);

  const base = outcome === OUTCOME_WIN ? BASE_WIN : outcome === OUTCOME_DRAW ? BASE_DRAW : BASE_LOSS;
  const efficiency = outcome === OUTCOME_WIN ? empty * EFFICIENCY_PER_CELL : 0;
  const streak = outcome === OUTCOME_WIN ? Math.min(STREAK_CAP, streakBefore) * STREAK_STEP : 0;
  const total = Math.round((base + efficiency + streak) * factor);

  return { base, efficiency, streak, factor, total };
}

// 结算面板的四行明细：基础 / 效率 / 连胜 / 合计（合计已含难度系数）。
// label 由 UI 层按当前语言提供（i18n 的 rowBase/rowEfficiency/rowStreak/rowTotal）。
export function breakdown(options = {}) {
  const score = scoreResult(options);
  return [
    { key: "base", value: score.base },
    { key: "efficiency", value: score.efficiency },
    { key: "streak", value: score.streak },
    { key: "total", value: score.total },
  ];
}
