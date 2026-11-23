// unravel score — single scoring authority. UI never computes stars itself.

export function computeStars({ won, elapsedMs, undoCount, slotPeak, parMs, cap }) {
  if (!won) return 0;
  let stars = 1;
  if (slotPeak <= cap - 2 && undoCount <= 3) stars += 1;
  if (elapsedMs <= parMs && undoCount <= 1) stars += 1;
  return Math.min(stars, 3);
}

export function formatTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
