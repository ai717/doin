// score.mjs - the only place that turns a run into stars or alarm levels.
// The UI never computes a rating itself.

export const STARS_MAX = 3;

// Par is the length of the authored route. A clean run stays close to it; a
// wandering drag burns stars instead of failing the player.
export function starsFor(level, travelled) {
  if (!level || !(travelled > 0)) return 1;
  const ratio = travelled / level.par;
  if (ratio <= 1.18) return 3;
  if (ratio <= 1.5) return 2;
  return 1;
}

// 0 = calm, 1 = warm, 2 = hot. Mirrors the three lamps on the dossier.
export function alarmFor(clearance, dragging) {
  if (!dragging) return 0;
  if (!Number.isFinite(clearance)) return 0;
  if (clearance < 14) return 2;
  if (clearance < 44) return 1;
  return 0;
}

export function totalStars(progress) {
  return Object.values(progress ?? {}).reduce((sum, stars) => sum + (Number(stars) || 0), 0);
}

export function clearedCount(progress) {
  return Object.keys(progress ?? {}).length;
}
