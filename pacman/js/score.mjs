// score.mjs —— 计分唯一口径（UI 不得自算分）：分数由 engine 累加，本层只负责安全上限、展示与评级

import { PELLET_SCORE, POWER_SCORE, GHOST_SCORE, FRUIT_SCORE, SYRUP_PELLET_BONUS_MULT } from "./engine.mjs";

export const SCORE_MAX = 9999999;
export const EXTRA_LIFE_AT = 10000;
/** 残局步数上限的安全上限（用于存档归一化） */
export const STEPS_MAX = 9999;
export const TIME_MS_MAX = 3600000;

export const PELLET = PELLET_SCORE;
export const POWER = POWER_SCORE;
export const SYRUP_BONUS_MULT = SYRUP_PELLET_BONUS_MULT;
export const GHOST_VALUES = GHOST_SCORE.slice();
export const FRUIT_TABLE = FRUIT_SCORE.slice();

export function clampInt(v, min, max, dflt = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** 连吃幽灵第 n 只的得分（0-based）。超出表长一律取最高档。 */
export function ghostScore(chainIndex) {
  const i = clampInt(chainIndex, 0, GHOST_VALUES.length - 1, 0);
  return GHOST_VALUES[i];
}

/** 水果分按关数取档，越界取最高档。 */
export function fruitScore(level) {
  const i = clampInt(level, 1, FRUIT_TABLE.length, 1) - 1;
  return FRUIT_TABLE[Math.min(i, FRUIT_TABLE.length - 1)];
}

/** 糖浆区的豆是双倍分（风险回报：玩家在里面被拖慢）。 */
export function pelletScore(inSyrup = false) {
  return inSyrup ? PELLET * SYRUP_BONUS_MULT : PELLET;
}

/**
 * 三星评级：① 清盘 ② 限时（用时不超过迷宫标准线）③ 零死亡
 * 与 engine.evaluateStars 同口径，但只吃纯数据，便于存档与结算页复用。
 */
export function rateRun({ cleared = false, deaths = 0, timeMs = 0, parMs = 0 } = {}) {
  const clear = cleared === true;
  const noDeath = clear && clampInt(deaths, 0, 99, 0) === 0;
  const fast = clear && Number.isFinite(timeMs) && parMs > 0 && timeMs <= parMs;
  const stars = clear ? (1 + (noDeath ? 1 : 0) + (fast ? 1 : 0)) : 0;
  return { stars, detail: { clear, noDeath, fast } };
}

/** 每满 EXTRA_LIFE_AT 分奖一条命，返回本次跨过了几个门槛 */
export function extraLifeThresholds(fromScore, toScore) {
  const a = clampInt(fromScore, 0, SCORE_MAX, 0);
  const b = clampInt(toScore, 0, SCORE_MAX, 0);
  if (b <= a) return 0;
  return Math.floor(b / EXTRA_LIFE_AT) - Math.floor(a / EXTRA_LIFE_AT);
}

export function formatScore(n) {
  return String(clampInt(n, 0, SCORE_MAX, 0)).padStart(6, "0");
}

/** 秒 → mm:ss（残局倒计时与结算用时共用） */
export function formatClock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
