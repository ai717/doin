// Pure scoring helpers shared by the engine, UI and tests.

export function starsFor({ time = 0, par = 60, damaged = false, mode = "level", kills = 0 }) {
  if (mode === "rush") {
    if (kills >= 18) return 3;
    if (kills >= 10) return 2;
    return 1;
  }
  let stars = 1;
  if (!damaged) stars += 1;
  if (time <= par) stars += 1;
  return Math.max(1, Math.min(3, stars));
}

export function killScore(chain = 1) {
  return 100 * Math.max(1, Math.min(5, chain));
}

export function timeBonus({ time = 0, par = 60 }) {
  return Math.max(0, Math.round((par - time) * 20));
}

export function formatTime(ms) {
  const total = Math.max(0, Math.round(Number(ms) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function levelRecord(stars = 0, score = 0, chain = 0) {
  return { stars: Math.max(0, Math.min(3, stars | 0)), score: Math.max(0, score | 0), chain: Math.max(0, chain | 0) };
}
