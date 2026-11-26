// Single source of truth for scoring, star rating and after-action reports.
import { MODES, STATUS, accuracy, comboMultiplier } from "./engine.mjs";

export const STAR_ACCURACY = 0.7;
export const STAR_COMBO = 20;

export function comboLabel(state) {
  return comboMultiplier(state);
}

export function accuracyPct(state) {
  return Math.round(accuracy(state) * 1000) / 10;
}

export function starsFor(state) {
  if (state.status !== STATUS.WON) return 0;
  let stars = 1;
  const acc = accuracy(state);
  if (acc >= STAR_ACCURACY || state.bestCombo >= STAR_COMBO) stars += 1;
  const inTime = state.par > 0 ? state.elapsed <= state.par : true;
  if (state.hull === state.maxHull && inTime) stars += 1;
  return stars;
}

export function reportFor(state) {
  return {
    levelId: state.levelId,
    mode: state.mode,
    score: state.score,
    stars: starsFor(state),
    accuracy: accuracyPct(state),
    bestCombo: state.bestCombo,
    headons: state.headons,
    hull: state.hull,
    maxHull: state.maxHull,
    kills: state.kills,
    seconds: Math.round(state.elapsed * 10) / 10,
    par: state.par,
    wave: state.waveIndex + 1,
    waves: state.mode === MODES.SURVIVAL ? state.waveIndex + 1 : state.waveCount,
  };
}

export function formatScore(value) {
  const n = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  return n.toLocaleString("en-US");
}

export function clampScore(value) {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  return n < 0 ? 0 : n;
}

export function totalStars(progress) {
  const stars = progress?.stars ?? {};
  return Object.values(stars).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}
