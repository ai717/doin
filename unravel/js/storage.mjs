// unravel storage — single persistence authority with silent in-memory fallback.

const KEY = "doin.unravel.v1";
let backend;
let memoryMap;

function storage() {
  if (backend) return backend;
  memoryMap = new Map();
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__unravel_probe__", "1");
      localStorage.removeItem("__unravel_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    /* privacy mode or restricted storage: fall through to memory */
  }
  backend = {
    getItem: (k) => (memoryMap.has(k) ? memoryMap.get(k) : null),
    setItem: (k, v) => memoryMap.set(k, String(v)),
    removeItem: (k) => memoryMap.delete(k),
  };
  return backend;
}

export function resetBackendForTests() {
  backend = null;
  memoryMap = null;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function normalizeProgress(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const stars = {};
  if (src.stars && typeof src.stars === "object") {
    for (const key of Object.keys(src.stars)) {
      const n = Number(src.stars[key]);
      if (Number.isFinite(n) && n >= 0 && n <= 3) stars[key] = Math.floor(n);
    }
  }
  return {
    maxLevel: clampInt(src.maxLevel, 1, 40, 1),
    stars,
    mode: src.mode === "relax" ? "relax" : "level",
    sound: src.sound === false ? false : true,
    relaxCount: clampInt(src.relaxCount, 0, 1000000, 0),
  };
}

export function loadProgress() {
  try {
    const raw = storage().getItem(KEY);
    if (!raw) return normalizeProgress(null);
    return normalizeProgress(JSON.parse(raw));
  } catch {
    return normalizeProgress(null);
  }
}

export function saveProgress(progress) {
  try {
    storage().setItem(KEY, JSON.stringify(normalizeProgress(progress)));
  } catch {
    /* silent */
  }
}

export function patchProgress(patch) {
  const next = { ...loadProgress(), ...patch };
  saveProgress(next);
  return next;
}
