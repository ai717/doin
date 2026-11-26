// 计分唯一口径：通关判定、星评与得分结算都集中在这里。

export const OUTCOME_CLEAR = "clear";
export const OUTCOME_FAIL = "fail";

export const CLEAR_BONUS = 1000;
export const LIFE_BONUS = 250;

export function starsForFossils(count) {
  return Math.max(0, Math.min(3, Math.trunc(Number(count) || 0)));
}

export function outcomeOf(state) {
  if (!state) return null;
  if (state.status === "won") return OUTCOME_CLEAR;
  if (state.status === "lost") return OUTCOME_FAIL;
  return null;
}

export function levelResult(state) {
  const outcome = outcomeOf(state);
  if (!outcome) return null;
  const clear = outcome === OUTCOME_CLEAR;
  const fossils = Math.max(0, Math.trunc(state.fossilsGot));
  const lives = Math.max(0, Math.trunc(state.player?.lives ?? 0));
  const score = Math.max(0, Math.trunc(state.score)) + (clear ? CLEAR_BONUS + lives * LIFE_BONUS : 0);
  return {
    outcome,
    stars: clear ? starsForFossils(fossils) : 0,
    score,
    fossils,
    lives,
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
