// filepath: games/klotski/js/score.mjs
// 唯一计分口径：总分 = 基础分 + 步数分 + 时间分（上限 800）。

export const BASE_SCORE = 200;
export const MOVE_MAX = 300;
export const TIME_MAX = 300;
export const PERFECT = BASE_SCORE + MOVE_MAX + TIME_MAX; // 800

export const MOVE_PENALTY = 5;
export const MOVE_FLOOR = 60;
export const TIME_STEP_SECONDS = 10;
export const TIME_PENALTY = 4;
export const TIME_FLOOR = 60;

/** 该关的目标用时（秒）：越难的关卡给的宽限越多 */
export function targetSeconds(par) {
  return 45 + Math.max(0, par) * 2;
}

export function moveScore(moves, par) {
  const safeMoves = Number.isFinite(moves) ? Math.max(0, Math.floor(moves)) : 0;
  const safePar = Number.isFinite(par) ? Math.max(1, Math.floor(par)) : 1;
  const over = Math.max(0, safeMoves - safePar);
  return Math.max(MOVE_FLOOR, MOVE_MAX - over * MOVE_PENALTY);
}

export function timeScore(timeMs, par) {
  const seconds = Number.isFinite(timeMs) ? Math.max(0, timeMs) / 1000 : 0;
  const over = Math.max(0, seconds - targetSeconds(par));
  const penalty = Math.floor(over / TIME_STEP_SECONDS) * TIME_PENALTY;
  return Math.max(TIME_FLOOR, TIME_MAX - penalty);
}

/** 单局得分明细；total 永不超过 PERFECT */
export function scoreRun({ moves, timeMs, par }) {
  const base = BASE_SCORE;
  const move = moveScore(moves, par);
  const time = timeScore(timeMs, par);
  return {
    base,
    move,
    time,
    total: Math.max(0, Math.min(PERFECT, base + move + time)),
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
