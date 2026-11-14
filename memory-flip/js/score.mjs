// 盲盒记忆牌 — 计分唯一口径
// UI 不自算分；所有星级判定通过本模块导出的纯函数。

import { LEVELS } from "./levels.mjs";

/**
 * 三星评级口径（按 PRD §3.4）：
 * ★ 错配 ≤ 1 次（前 4 章为"几乎零错"；第 5 章残局为"用满限定翻错次数内通关"）
 * ★ 用时 ≤ 关卡阈值（关卡 parSeconds）
 * ★ 最长连击 ≥ 2 次
 *
 * 第 5 章残局的"零错通关"额外彩蛋："工坊大师印章"，
 * 通过额外字段 flawless 标识（misses === 0 且通关）。
 */
export function gradeStars(state, levelId, elapsedMs) {
  const level = LEVELS.find((lv) => lv.id === levelId) ?? null;
  if (!level) return { stars: 0, flawless: false, misses: state.misses, maxCombo: state.maxCombo, timeMs: elapsedMs };
  const isEndgame = level.missBudget !== null;
  const seconds = elapsedMs / 1000;
  let stars = 0;
  if (isEndgame) {
    if (state.status === "won") stars += 1;
    if (state.status === "won" && state.misses <= level.parMisses) stars += 1;
    if (state.maxCombo >= level.parCombo) stars += 1;
  } else {
    if (state.misses <= 1) stars += 1;
    if (seconds <= level.parSeconds) stars += 1;
    if (state.maxCombo >= 2) stars += 1;
  }
  const flawless = state.status === "won" && state.misses === 0;
  return { stars, flawless, misses: state.misses, maxCombo: state.maxCombo, timeMs: elapsedMs };
}

/** 关卡总分（用于解锁提示）：3 星 + flawless 彩蛋 = 4 分；其他按 stars */
export function levelPoints(stars, flawless) {
  return stars + (flawless ? 1 : 0);
}

/** 累计总星（解锁沙盒高级机制用，未来扩展预留） */
export function totalStars(runResults) {
  return runResults.reduce((s, r) => s + (r?.stars ?? 0), 0);
}