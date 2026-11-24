// Rating: 1 star for a clear, 2 for moves <= optimal*1.5, 3 for exact optimal.
// Optimal comes from the BFS solver via level data; the UI never computes it.

export function rate(level, moves) {
  const optimal = Math.max(1, Math.trunc(level?.optimal ?? 1));
  const used = Math.max(0, Math.trunc(moves ?? 0));
  if (used <= optimal) return 3;
  if (used <= Math.floor(optimal * 1.5)) return 2;
  return 1;
}

export function ratingLabelKey(stars) {
  if (stars >= 3) return "starsThree";
  if (stars === 2) return "starsTwo";
  return "starsOne";
}

export function efficiency(level, moves) {
  const optimal = Math.max(1, Math.trunc(level?.optimal ?? 1));
  const used = Math.max(0, Math.trunc(moves ?? 0));
  return Math.round((optimal / Math.max(used, optimal)) * 100);
}
