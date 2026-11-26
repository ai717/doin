// Scoring: no total score by design. Progress = volume removed; finesse = curl evenness.
// Stars are a gentle quality grade, never a fail condition.

export function clamp01(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

// Finesse from the distribution of removed depths: even, thin curls score higher.
export function evennessOf(chipDepths = []) {
  if (!Array.isArray(chipDepths) || chipDepths.length === 0) return 0;
  const values = chipDepths.filter((value) => Number.isFinite(value) && value > 0);
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const cv = Math.sqrt(variance) / mean;
  return clamp01(1 - cv / 0.9);
}

export function grade(state, finesse = 0) {
  if (!state) return { stars: 0, progress: 0, finesse: 0 };
  const total = state.totalDepth > 0 ? 1 - state.removedDepth / state.totalDepth : 1;
  const progress = clamp01(1 - total);
  const value = clamp01(finesse);
  let stars = 1;
  if (progress >= 0.95) stars = 2;
  if (progress >= 0.95 && value >= 0.4) stars = 3;
  if (progress >= 0.95 && value >= 0.65) stars = 4;
  if (progress >= 0.95 && value >= 0.85) stars = 5;
  return { stars, progress, finesse: value };
}
