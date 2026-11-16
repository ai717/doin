// 计分唯一口径：星评、通关结算与最高分汇总。

export const OUTCOME_CLEAR = "clear";
export const OUTCOME_FAIL = "fail";

export const STAR_TOLERANCE = 3;
export const TWO_STAR_TOLERANCE = 9;
export const BASE_SCORE = 800;
export const STAR_SCORE = 400;
export const STEP_SCORE = 50;

export function starsForSteps(steps, optimal) {
  const used = Math.max(0, Math.trunc(Number(steps) || 0));
  const best = Math.max(1, Math.trunc(Number(optimal) || 0));
  if (used <= best + STAR_TOLERANCE) return 3;
  if (used <= best + TWO_STAR_TOLERANCE) return 2;
  return 1;
}

export function outcomeOf(state) {
  if (!state) return null;
  if (state.status === "won" || state.solved) return OUTCOME_CLEAR;
  if (state.status === "lost") return OUTCOME_FAIL;
  return null;
}

export function levelResult(state, level) {
  const outcome = outcomeOf(state);
  if (!outcome) return null;
  const optimal = Math.max(0, Math.trunc(level?.optimal ?? 0));
  const steps = Math.max(0, Math.trunc(state.steps));
  const stars = outcome === OUTCOME_CLEAR ? starsForSteps(steps, optimal) : 0;
  const score = outcome === OUTCOME_CLEAR
    ? BASE_SCORE + stars * STAR_SCORE + Math.max(0, optimal + 10 - steps) * STEP_SCORE
    : 0;
  return {
    outcome,
    stars,
    steps,
    optimal,
    score,
    levelId: state.levelId,
  };
}

export function totalOf(records) {
  let score = 0;
  let stars = 0;
  for (const record of Object.values(records ?? {})) {
    score += Math.max(0, Math.trunc(record?.bestScore ?? 0));
    stars += Math.max(0, Math.trunc(record?.stars ?? 0));
  }
  return { score, stars };
}
