// Single persistence authority for Raiden Lite, with silent memory fallback.

export const STORAGE_KEY = "doin.raiden.v1";
export const STAGE_COUNT = 6;

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
      localStorage.setItem("__raiden_probe__", "1");
      localStorage.removeItem("__raiden_probe__");
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
    stages: {},
    training: { bestGraze: 0, bestStars: 0 },
    current: { mode: "stage", stageIndex: 0 },
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
  const stages = {};
  if (raw.stages && typeof raw.stages === "object") {
    for (const [key, value] of Object.entries(raw.stages)) {
      const match = /^stage_([1-6])$/.exec(key);
      if (!match) continue;
      if (!value || typeof value !== "object") continue;
      stages[key] = {
        stars: safeInt(value.stars, 0, 3),
        best: safeInt(value.best, 0, 9999999),
        graze: safeInt(value.graze, 0, 99999),
      };
    }
  }
  const trainingRaw = raw.training && typeof raw.training === "object" ? raw.training : {};
  const currentRaw = raw.current && typeof raw.current === "object" ? raw.current : {};
  const mode = currentRaw.mode === "training" ? "training" : "stage";
  return {
    version: 1,
    stages,
    training: {
      bestGraze: safeInt(trainingRaw.bestGraze, 0, 99999),
      bestStars: safeInt(trainingRaw.bestStars, 0, 3),
    },
    current: {
      mode,
      stageIndex: safeInt(currentRaw.stageIndex, 0, STAGE_COUNT - 1),
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

export function remember(progress, mode, stageIndex) {
  if (!progress) return progress;
  progress.current = {
    mode: mode === "training" ? "training" : "stage",
    stageIndex: safeInt(stageIndex, 0, STAGE_COUNT - 1),
  };
  return progress;
}

export function recordStage(progress, stageId, stars, best, graze) {
  const target = progress ?? defaultProgress();
  const next = {
    stars: safeInt(stars, 0, 3),
    best: safeInt(best, 0, 9999999),
    graze: safeInt(graze, 0, 99999),
  };
  const existing = target.stages[stageId];
  target.stages[stageId] = existing
    ? {
        stars: Math.max(existing.stars, next.stars),
        best: Math.max(existing.best, next.best),
        graze: Math.max(existing.graze, next.graze),
      }
    : next;
  return target;
}

export function recordTraining(progress, graze, stars) {
  const target = progress ?? defaultProgress();
  target.training.bestGraze = Math.max(target.training.bestGraze, safeInt(graze, 0, 99999));
  target.training.bestStars = Math.max(target.training.bestStars, safeInt(stars, 0, 3));
  return target;
}

export function stageRecord(progress, stageId) {
  return progress?.stages?.[stageId] ?? null;
}

export function totalStars(progress) {
  return Object.values(progress?.stages ?? {}).reduce((sum, record) => sum + (record.stars || 0), 0);
}

export function resetBackendForTests() {
  backend = null;
}
