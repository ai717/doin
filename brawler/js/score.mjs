// score.mjs — 计分与评星唯一口径。UI 只负责展示，不得自算。
// 核心指标是击飞数与评级；分数仅作关卡记录与街机模式成绩。

export function clamp01(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return number < 0 ? 0 : number > 1 ? 1 : number;
}

export function clampInt(value, lo, hi) {
  const number = Math.trunc(Number(value) || 0);
  return number < lo ? lo : number > hi ? hi : number;
}

// 用时越短、血量越满，表现分越高；两项各占一半权重。
export function performance({ hpRatio = 0, time = 0, par = 60 } = {}) {
  const safePar = Math.max(1, Number(par) || 1);
  const safeTime = Math.max(1, Number(time) || 1);
  const timeScore = clamp01(safePar / safeTime);
  const hpScore = clamp01(hpRatio);
  return Math.round((timeScore * 0.55 + hpScore * 0.45) * 100);
}

export function starsFor({ hpRatio = 0, time = 0, par = 60 } = {}) {
  const score = performance({ hpRatio, time, par });
  if (score >= 80) return 3;
  if (score >= 55) return 2;
  return 1;
}

export function levelScore({ ko = 0, hpRatio = 0, time = 0, par = 60, continuesUsed = 0, bossDown = false } = {}) {
  const base = 500;
  const koScore = Math.max(0, Math.trunc(ko)) * 50;
  const timeScore = Math.round(clamp01(1 - Number(time) / Math.max(1, Number(par) * 2)) * 400);
  const hpScore = Math.round(clamp01(hpRatio) * 300);
  const bossBonus = bossDown ? 200 : 0;
  const penalty = Math.max(0, Math.trunc(continuesUsed)) * 80;
  return Math.max(0, base + koScore + timeScore + hpScore + bossBonus - penalty);
}

export function arcadeScore({ ko = 0, bossKills = 0, timeLeft = 0 } = {}) {
  return Math.max(0, Math.trunc(ko)) * 100
    + Math.max(0, Math.trunc(bossKills)) * 300
    + Math.max(0, Math.trunc(timeLeft)) * 2;
}

export function bestOf(previous, value) {
  const prev = Math.max(0, Math.trunc(Number(previous) || 0));
  const next = Math.max(0, Math.trunc(Number(value) || 0));
  return next > prev ? next : prev;
}
