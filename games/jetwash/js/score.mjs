// Scoring authority. Clean wash is a three-star base; speed is a bonus tier,
// never a penalty (relax mode has no failure). UI must not recompute stars.

export function rate(elapsedSeconds) {
  const t = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? elapsedSeconds : Infinity;
  if (t <= 45) return 3;
  if (t <= 90) return 2;
  return 1;
}

export function formatTime(seconds) {
  const s = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

export function starArray(stars) {
  const n = Math.min(3, Math.max(0, Math.floor(stars || 0)));
  return [n >= 1, n >= 2, n >= 3];
}
