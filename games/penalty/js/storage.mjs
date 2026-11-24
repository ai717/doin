// Single storage authority for Penalty Shootout. Key: doin.penalty.v1.
// Corrupt data normalizes to defaults; restricted storage falls back to memory.

const KEY = "doin.penalty.v1";
const MODES = ["mode_solo", "mode_duo"];
const DIFFICULTIES = ["ai_novice", "ai_skilled", "ai_master"];

let memoryBackend = null;

function defaults() {
  return {
    version: 1,
    mode: "mode_solo",
    difficulty: "ai_novice",
    firstShooter: "side_a",
    muted: false,
    record: { played: 0, side_a_wins: 0, side_b_wins: 0, goals: 0 },
    best: { side_a: 0, side_b: 0 },
  };
}

function backend() {
  if (memoryBackend) return memoryBackend;
  try {
    if (typeof globalThis.localStorage !== "undefined") {
      globalThis.localStorage.setItem("__penalty_probe__", "1");
      globalThis.localStorage.removeItem("__penalty_probe__");
      return globalThis.localStorage;
    }
  } catch (error) { /* restricted storage: use memory */ }
  const map = new Map();
  memoryBackend = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
  return memoryBackend;
}

export function normalize(input) {
  const base = defaults();
  if (!input || typeof input !== "object" || Array.isArray(input)) return base;
  const mode = MODES.includes(input.mode) ? input.mode : base.mode;
  const difficulty = DIFFICULTIES.includes(input.difficulty) ? input.difficulty : base.difficulty;
  const firstShooter = input.firstShooter === "side_b" ? "side_b" : "side_a";
  const int = (value, fallback) => (Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback);
  const record = input.record && typeof input.record === "object" ? input.record : {};
  const best = input.best && typeof input.best === "object" ? input.best : {};
  return {
    version: 1,
    mode,
    difficulty: mode === "mode_solo" ? difficulty : base.difficulty,
    firstShooter,
    muted: Boolean(input.muted),
    record: {
      played: int(record.played, 0),
      side_a_wins: int(record.side_a_wins, 0),
      side_b_wins: int(record.side_b_wins, 0),
      goals: int(record.goals, 0),
    },
    best: { side_a: int(best.side_a, 0), side_b: int(best.side_b, 0) },
  };
}

export function load() {
  try {
    const raw = backend().getItem(KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return defaults();
  }
}

export function save(state) {
  const normalized = normalize(state);
  try {
    backend().setItem(KEY, JSON.stringify(normalized));
    return true;
  } catch (error) {
    return false;
  }
}

export function recordMatch(state, summary) {
  const next = normalize(state);
  next.record.played += 1;
  next.record.goals += (summary.score?.side_a ?? 0) + (summary.score?.side_b ?? 0);
  if (summary.winner === "side_a" || summary.winner === "side_b") {
    next.record[`${summary.winner}_wins`] += 1;
  }
  for (const side of ["side_a", "side_b"]) {
    const goals = summary.score?.[side] ?? 0;
    if (goals > next.best[side]) next.best[side] = goals;
  }
  save(next);
  return next;
}

export function resetBackendForTests() {
  memoryBackend = null;
}
