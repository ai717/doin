// Single persistence authority for Flick Duel, with silent memory fallback.

import { BOARDS, DIFFICULTIES, MODES, SIDES, bestKey, normalizeSettings } from "./levels.mjs";

export const STORAGE_KEY = "doin.flick.v1";

let backend = null;

function memoryBackend() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__flick_probe__", "1");
      localStorage.removeItem("__flick_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // Private mode or restricted frame: fall back to memory.
  }
  backend = memoryBackend();
  return backend;
}

export function defaultProgress() {
  return {
    version: 1,
    settings: normalizeSettings(null),
    stats: { played: 0, wins: 0, losses: 0, draws: 0 },
    best: {},
  };
}

function safeInt(value, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function safeTime(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(Math.min(number, 86400) * 10) / 10;
}

const DIFFICULTY_IDS = new Set(DIFFICULTIES.map((level) => level.id));

function validBestKey(key) {
  if (typeof key !== "string") return false;
  const side = SIDES.find((item) => key.endsWith(`_${item}`));
  if (!side) return false;
  const withoutSide = key.slice(0, key.length - side.length - 1);
  const board = BOARDS.find((item) => withoutSide.endsWith(`_${item.id}`));
  if (!board) return false;
  const prefix = withoutSide.slice(0, withoutSide.length - board.id.length - 1);
  const split = prefix.indexOf("_");
  if (split <= 0) return false;
  const mode = prefix.slice(0, split);
  const difficulty = prefix.slice(split + 1);
  if (!MODES.includes(mode)) return false;
  if (difficulty === "duel") return true;
  return DIFFICULTY_IDS.has(difficulty);
}

export function normalize(raw) {
  const base = defaultProgress();
  if (!raw || typeof raw !== "object") return base;
  const statsRaw = raw.stats && typeof raw.stats === "object" ? raw.stats : {};
  const stats = {
    played: safeInt(statsRaw.played, 0, 999999),
    wins: safeInt(statsRaw.wins, 0, 999999),
    losses: safeInt(statsRaw.losses, 0, 999999),
    draws: safeInt(statsRaw.draws, 0, 999999),
  };
  const best = {};
  if (raw.best && typeof raw.best === "object") {
    for (const [key, value] of Object.entries(raw.best)) {
      if (!validBestKey(key) || !value || typeof value !== "object") continue;
      best[key] = {
        rounds: safeInt(value.rounds, 1, 60),
        time: safeTime(value.time),
      };
    }
  }
  return {
    version: 1,
    settings: normalizeSettings(raw.settings),
    stats,
    best,
  };
}

export function load() {
  try {
    const text = storage().getItem(STORAGE_KEY);
    if (!text) return defaultProgress();
    return normalize(JSON.parse(text));
  } catch {
    return defaultProgress();
  }
}

export function save(progress) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(progress)));
    return true;
  } catch {
    return false;
  }
}

export function rememberSettings(progress, settings) {
  if (!progress) return progress;
  progress.settings = normalizeSettings(settings);
  return progress;
}

/** Record one finished match. Returns { record, newBest } for the result sheet. */
export function recordMatch(progress, state) {
  const target = normalize(progress);
  const settings = normalizeSettings(state);
  const key = bestKey(settings);
  target.stats.played += 1;
  if (state.winner === "draw") {
    target.stats.draws += 1;
  } else if (state.winner) {
    if (state.mode === "duel") {
      target.stats.wins += 0;
    } else if (state.winner === settings.humanSide) {
      target.stats.wins += 1;
    } else {
      target.stats.losses += 1;
    }
  }

  let newBest = false;
  if (state.winner && state.winner !== "draw") {
    const existing = target.best[key];
    const rounds = safeInt(state.round, 1, 60);
    const time = safeTime(state.time);
    if (!existing) {
      target.best[key] = { rounds, time };
      newBest = true;
    } else if (rounds < existing.rounds || (rounds === existing.rounds && time < existing.time)) {
      target.best[key] = { rounds, time };
      newBest = true;
    }
  }
  return { progress: target, newBest, record: target.best[key] ?? null };
}

export function bestRecord(progress, settings) {
  return progress?.best?.[bestKey(settings)] ?? null;
}

export function setBackendForTests(nextBackend) {
  backend = nextBackend ?? null;
}

export function resetBackendForTests() {
  backend = null;
}
