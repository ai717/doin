// filepath: games/sokoban/js/score.mjs
// 唯一计分口径：总分 = 基础分 + 推数分 + 时间分（上限 1000）。
// 推数分以本关目标推数（parPushes）为基准：不超过目标推数即满分，每超 1 推扣分。
// UI 与 storage 都只读这里的常量与函数，绝不自算。

export const BASE_SCORE = 400;
export const PUSH_MAX = 350;
export const TIME_MAX = 250;
export const PERFECT = BASE_SCORE + PUSH_MAX + TIME_MAX; // 1000

export const PUSH_PENALTY = 9;
export const PUSH_FLOOR = 70;
export const TIME_STEP_SECONDS = 10;
export const TIME_PENALTY = 6;
export const TIME_FLOOR = 60;

/** 该关的目标用时（秒）：推数越多的关卡给的宽限越多 */
export function targetSeconds(par) {
  return 40 + Math.max(0, par) * 1.6;
}

export function pushScore(pushes, par) {
  const safePushes = Number.isFinite(pushes) ? Math.max(0, Math.floor(pushes)) : 0;
  const safePar = Number.isFinite(par) ? Math.max(1, Math.floor(par)) : 1;
  const over = Math.max(0, safePushes - safePar);
  return Math.max(PUSH_FLOOR, PUSH_MAX - over * PUSH_PENALTY);
}

export function timeScore(timeMs, par) {
  const seconds = Number.isFinite(timeMs) ? Math.max(0, timeMs) / 1000 : 0;
  const over = Math.max(0, seconds - targetSeconds(par));
  const penalty = Math.floor(over / TIME_STEP_SECONDS) * TIME_PENALTY;
  return Math.max(TIME_FLOOR, TIME_MAX - penalty);
}

/** 单局得分明细；total 永不超过 PERFECT */
export function scoreRun({ pushes, timeMs, par }) {
  const base = BASE_SCORE;
  const push = pushScore(pushes, par);
  const time = timeScore(timeMs, par);
  return {
    base,
    push,
    time,
    total: Math.max(0, Math.min(PERFECT, base + push + time)),
  };
}

/** 三星：≥90% 满分；二星：≥70% */
export function starsFor(total) {
  const value = Number.isFinite(total) ? Math.max(0, Math.min(PERFECT, total)) : 0;
  if (value >= PERFECT * 0.9) return 3;
  if (value >= PERFECT * 0.7) return 2;
  return 1;
}

/** 毫秒 -> mm:ss（超过 99 分钟则钳制，避免 UI 溢出） */
export function formatTime(ms) {
  const total = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  const minutes = Math.min(99, Math.floor(total / 60));
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
