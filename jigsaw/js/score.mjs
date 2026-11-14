// filepath: games/jigsaw/js/score.mjs
// 唯一计分口径：总分 = 基础分 + 步数分 + 时间分。UI / 结算面板不许自己算。
// 主线满分 800；今日精选额外 +150 基础分（PRD §3.3），满分 950。
//
// 与 PRD §4 算例对齐（第 2 行可完整复算）：
//   L1  n=3 par=12  8 步 40s  -> 200 + 500 + 100 = 800
//   L25 n=4 par=20 35 步 180s -> 200 + (500-5*15=425) + (100-8*2=84) = 709
// PRD 算例第 3 行把 L50 的时间分写成"保底 20"，与它自己给出的公式（100 - 8*2 = 84）不自洽；
// 本实现以公式为准（L50：75 步 400s -> 200 + 100 + 44 = 344）。

export const BASE_SCORE = 200;
export const DAILY_BONUS = 150;
export const MOVE_MAX = 500;
export const TIME_MAX = 100;

export const PERFECT = BASE_SCORE + MOVE_MAX + TIME_MAX; // 800
export const DAILY_PERFECT = PERFECT + DAILY_BONUS; // 950

export const MOVE_PENALTY = 5;
export const MOVE_FLOOR = 100;
export const TIME_STEP_SECONDS = 10;
export const TIME_PENALTY = 2;
export const TIME_FLOOR = 20;

export function baseScoreFor(isDaily = false) {
  return BASE_SCORE + (isDaily ? DAILY_BONUS : 0);
}

/** 该难度的满分上限（HUD 分母 / 选关未通关显示） */
export function perfectScoreFor(isDaily = false) {
  return isDaily ? DAILY_PERFECT : PERFECT;
}

/** 目标用时（秒）：拼图不催时间，比 klotski 宽松一倍 */
export function targetSeconds(par) {
  return 60 + Math.max(0, Number.isFinite(par) ? par : 0) * 2;
}

/**
 * 步数分（严格按 PRD §4 的三段式）：
 *   moves ≤ par            -> 500
 *   par < moves ≤ par·2    -> 500 - 5·(moves - par)
 *   moves > par·2          -> 保底 100
 * 注意第三段是"硬保底"而不是逐级衰减：moves 刚过 2·par 时会从 500-5·par 直接落到 100。
 * 这是 PRD 明确写下的口径（L50 算例也据此得出步数分 100），故照做；若日后要改成平滑衰减，
 * 必须同时更新本节注释、score.test.mjs 的算例与 PROJECT_LOG。
 */
export function moveScore(moves, par) {
  const safeMoves = Number.isFinite(moves) ? Math.max(0, Math.floor(moves)) : 0;
  const safePar = Number.isFinite(par) ? Math.max(1, Math.floor(par)) : 1;
  if (safeMoves <= safePar) return MOVE_MAX;
  if (safeMoves <= safePar * 2) return MOVE_MAX - (safeMoves - safePar) * MOVE_PENALTY;
  return MOVE_FLOOR;
}

/** 时间分：≤ targetSeconds 满分；每超 10 秒 -2；保底 20 */
export function timeScore(timeMs, par) {
  const seconds = Number.isFinite(timeMs) ? Math.max(0, timeMs) / 1000 : 0;
  const over = Math.max(0, seconds - targetSeconds(par));
  const penalty = Math.floor(over / TIME_STEP_SECONDS) * TIME_PENALTY;
  return Math.max(TIME_FLOOR, TIME_MAX - penalty);
}

/** 单局得分明细；total 永不超过该难度满分 */
export function scoreRun({ moves, timeMs, par, isDaily = false }) {
  const base = baseScoreFor(isDaily);
  const move = moveScore(moves, par);
  const time = timeScore(timeMs, par);
  const total = Math.max(0, Math.min(perfectScoreFor(isDaily), base + move + time));
  return { base, move, time, total };
}

/** 毫秒 -> mm:ss（超过 99:59 整体钳制，避免 UI 溢出） */
export function formatTime(ms) {
  const seconds = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const total = Math.min(99 * 60 + 59, seconds);
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
