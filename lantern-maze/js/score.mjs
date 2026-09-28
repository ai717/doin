// score.mjs —— 计分唯一口径（UI 不得自算分），上限钳制

export const SCORE_MAX = 999999;
export const EXTRA_LIFE_AT = 10000;

export const DOT_VALUE = 10;
export const PEARL_VALUE = 50;
export const GHOST_VALUES = [200, 400, 800, 1600];
/** 流明灯价值按更次递增（一更 100 → 五更 3000+） */
export const FRUIT_TABLE = [100, 300, 500, 700, 1000, 2000, 3000, 5000];

export function clampInt(v, min, max, dflt = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function dotScore() {
  return DOT_VALUE;
}

export function pearlScore() {
  return PEARL_VALUE;
}

export function ghostScore(chainIndex) {
  const i = clampInt(chainIndex, 0, GHOST_VALUES.length - 1, 0);
  return GHOST_VALUES[i];
}

export function fruitScore(cfg, alreadyEaten = 0) {
  if (cfg && Number.isFinite(cfg.fruitValue) && cfg.fruitValue > 0) return cfg.fruitValue;
  const i = clampInt(alreadyEaten, 0, FRUIT_TABLE.length - 1, 0);
  return FRUIT_TABLE[i];
}

export function clearBonus(lives, cfg) {
  const l = clampInt(lives, 0, 9, 0);
  return l * (cfg && cfg.bonusPerLife ? cfg.bonusPerLife : 500);
}

export function fruitValueForWatch(watch) {
  const w = clampInt(watch, 1, 5, 1);
  return FRUIT_TABLE[Math.min(FRUIT_TABLE.length - 1, (w - 1) * 2)];
}

/**
 * 更签（三星）评级：① 清巷 ② 本更零熄灯 ③ 效率项
 * @returns {{stars:number, detail:{clear:boolean,noDeath:boolean,fast:boolean}}}
 */
export function rateRun({ cleared, deaths, timeMs, parMs, bestChain, longestTrain }) {
  const clear = cleared === true;
  const noDeath = clear && clampInt(deaths, 0, 99, 0) === 0;
  const fast =
    clear &&
    ((Number.isFinite(timeMs) && Number.isFinite(parMs) && parMs > 0 && timeMs <= parMs) ||
      clampInt(bestChain, 0, 99, 0) >= 3 ||
      clampInt(longestTrain, 0, 99, 0) >= 3);
  const stars = (clear ? 1 : 0) + (noDeath ? 1 : 0) + (fast ? 1 : 0);
  return { stars: clear ? Math.max(1, stars) : 0, detail: { clear, noDeath, fast } };
}

export function formatScore(n) {
  const v = clampInt(n, 0, SCORE_MAX, 0);
  return String(v).padStart(6, "0");
}
