// Single source of truth for Snowball Bros persistence with silent memory fallback.

export const STORAGE_KEY = "doin.snowball.v1";
export const LEVEL_COUNT = 30;

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
      localStorage.setItem("__snowball_probe__", "1");
      localStorage.removeItem("__snowball_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // Private mode or a restricted frame: fall back to memory.
  }
  backend = memoryBackend();
  return backend;
}

export function defaultProgress() {
  return {
    version: 1,
    stars: {},
    rush: { best: 0, kills: 0 },
    current: { mode: "level", levelIndex: 0 },
  };
}

function safeInt(value, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

export function normalize(raw) {
  const base = defaultProgress();
  if (!raw || typeof raw !== "object") return base;
  const stars = {};
  if (raw.stars && typeof raw.stars === "object") {
    for (const [key, value] of Object.entries(raw.stars)) {
      if (!/^snow_\d{2}$/.test(key)) continue;
      const index = Number(key.slice(5));
      if (index < 1 || index > LEVEL_COUNT) continue;
      if (!value || typeof value !== "object") continue;
      stars[key] = {
        stars: safeInt(value.stars, 0, 3),
        score: safeInt(value.score, 0, 999999),
        chain: safeInt(value.chain, 0, 99),
      };
    }
  }
  const rushRaw = raw.rush && typeof raw.rush === "object" ? raw.rush : {};
  const currentRaw = raw.current && typeof raw.current === "object" ? raw.current : {};
  const mode = currentRaw.mode === "rush" ? "rush" : "level";
  return {
    version: 1,
    stars,
    rush: {
      best: safeInt(rushRaw.best, 0, 9999999),
      kills: safeInt(rushRaw.kills, 0, 9999),
    },
    current: {
      mode,
      levelIndex: safeInt(currentRaw.levelIndex, 0, LEVEL_COUNT - 1),
    },
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

export function remember(progress, mode, levelIndex) {
  if (!progress) return progress;
  progress.current = {
    mode: mode === "rush" ? "rush" : "level",
    levelIndex: safeInt(levelIndex, 0, LEVEL_COUNT - 1),
  };
  return progress;
}

export function recordLevel(progress, levelId, stars, score, chain) {
  const target = progress ?? defaultProgress();
  const existing = target.stars[levelId];
  const next = {
    stars: safeInt(stars, 0, 3),
    score: safeInt(score, 0, 999999),
    chain: safeInt(chain, 0, 99),
  };
  if (!existing) target.stars[levelId] = next;
  else {
    target.stars[levelId] = {
      stars: Math.max(existing.stars, next.stars),
      score: Math.max(existing.score, next.score),
      chain: Math.max(existing.chain, next.chain),
    };
  }
  return target;
}

export function recordRush(progress, score, kills) {
  const target = progress ?? defaultProgress();
  target.rush.best = Math.max(target.rush.best, safeInt(score, 0, 9999999));
  target.rush.kills = Math.max(target.rush.kills, safeInt(kills, 0, 9999));
  return target;
}

export function levelRecord(progress, levelId) {
  return progress?.stars?.[levelId] ?? null;
}

export function totalStars(progress) {
  return Object.values(progress?.stars ?? {}).reduce((sum, record) => sum + (record.stars || 0), 0);
}

export function resetBackendForTests() {
  backend = null;
}
