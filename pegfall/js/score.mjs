// 计分唯一口径：星评、关卡成绩与累计统计都在这里算。

export const OUTCOME_CLEAR = "clear";
export const OUTCOME_FAIL = "fail";

export const MAX_BALLS = 10;
export const STAR_THRESHOLDS = Object.freeze([5, 2]);

export function starsForBalls(ballsLeft) {
  const balls = Math.max(0, Math.trunc(ballsLeft));
  if (balls >= STAR_THRESHOLDS[0]) return 3;
  if (balls >= STAR_THRESHOLDS[1]) return 2;
  return 1;
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
  const stars = outcome === OUTCOME_CLEAR ? starsForBalls(state.ballsLeft) : 0;
  return {
    outcome,
    stars,
    score: Math.max(0, Math.trunc(state.score)),
    ballsLeft: Math.max(0, Math.trunc(state.ballsLeft)),
    orangeLeft: Math.max(0, Math.trunc(state.orangeLeft)),
    orangeTotal: Math.max(0, Math.trunc(state.orangeTotal)),
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
