// score.mjs — the single source of truth for scoring. The UI must never compute score itself.

export const SCORE_CAP = 9999999;
export const COMBO_WINDOW = 2.5; // seconds between kills to keep a chain alive
export const COMBO_STEP = 0.25;
export const COMBO_CAP = 8; // chain length counter cap
export const MULT_CAP = 3;

export function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(SCORE_CAP, Math.floor(n)));
}

// combo counts consecutive kills; multiplier grows by 0.25 per kill up to x3
export function comboMultiplier(combo) {
  const c = Math.max(0, Math.min(COMBO_CAP, Math.floor(Number(combo) || 0)));
  return Math.min(MULT_CAP, 1 + c * COMBO_STEP);
}

export function killScore(typeScore, combo) {
  const base = Number.isFinite(typeScore) ? typeScore : 0;
  return clampScore(base * comboMultiplier(combo));
}

export function brickScore() {
  return 5;
}

export function ricochetBonus() {
  return 30;
}

// End of stage bonuses. Pure so the UI can render the breakdown from the same numbers.
export function stageBonus({ timeLeft = 0, baseHp = 0, lives = 0, parTime = 150 }) {
  const time = Math.max(0, Math.floor(timeLeft));
  return clampScore(time * 10 + Math.max(0, baseHp) * 500 + Math.max(0, lives) * 250);
}

export function starsFor({ baseHp = 0, maxBaseHp = 3, time = 0, parTime = 150, deaths = 0 }) {
  return {
    starBaseIntact: baseHp >= maxBaseHp,
    starTime: time <= parTime,
    starNoLoss: deaths === 0,
  };
}

export function starCount(stars) {
  return (stars?.starBaseIntact ? 1 : 0) + (stars?.starTime ? 1 : 0) + (stars?.starNoLoss ? 1 : 0);
}
