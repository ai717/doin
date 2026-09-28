/**
 * Picross Storage Module
 * Single authority for localStorage reading and writing.
 * Storage key: doin.picross.v1
 * All operations protected by try/catch with graceful memory fallback.
 */

const STORAGE_KEY = "doin.picross.v1";

const DEFAULT_DATA = {
  version: 1,
  currentLevelId: "p1",
  completedLevels: {}, // levelId -> { stars: number, bestTimeMs: number, completedAt: number }
  customLevels: [],
  soundEnabled: true,
  tool: "paint", // 'paint' | 'cross'
};

let memoryStore = null;

function getStore() {
  if (memoryStore !== null) return memoryStore;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) {
      memoryStore = { ...DEFAULT_DATA };
      return memoryStore;
    }
    const parsed = JSON.parse(raw);
    memoryStore = normalize(parsed);
  } catch {
    memoryStore = { ...DEFAULT_DATA };
  }
  return memoryStore;
}

function normalize(data) {
  if (!data || typeof data !== "object") return { ...DEFAULT_DATA };
  return {
    version: 1,
    currentLevelId: typeof data.currentLevelId === "string" ? data.currentLevelId : DEFAULT_DATA.currentLevelId,
    completedLevels: typeof data.completedLevels === "object" && data.completedLevels !== null ? data.completedLevels : {},
    customLevels: Array.isArray(data.customLevels) ? data.customLevels : [],
    soundEnabled: typeof data.soundEnabled === "boolean" ? data.soundEnabled : true,
    tool: data.tool === "cross" ? "cross" : "paint",
  };
}

function saveStore(data) {
  memoryStore = data;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Gracefully degrade to in-memory store
  }
}

export function loadGameData() {
  return { ...getStore() };
}

export function saveGameData(data) {
  const current = getStore();
  const next = normalize({ ...current, ...data });
  saveStore(next);
  return next;
}

export function recordLevelCompletion(levelId, stars, timeMs) {
  const current = getStore();
  const prev = current.completedLevels[levelId];
  const bestStars = prev ? Math.max(prev.stars, stars) : stars;
  const bestTimeMs = prev && prev.bestTimeMs ? Math.min(prev.bestTimeMs, timeMs) : timeMs;

  const nextCompleted = {
    ...current.completedLevels,
    [levelId]: {
      stars: bestStars,
      bestTimeMs,
      completedAt: Date.now(),
    },
  };

  saveStore({
    ...current,
    completedLevels: nextCompleted,
  });
}

export function getCompletedLevel(levelId) {
  const store = getStore();
  return store.completedLevels[levelId] || null;
}

export function getAllCompletedLevels() {
  return getStore().completedLevels;
}

export function saveCustomLevel(level) {
  const current = getStore();
  const customLevels = [...current.customLevels, level];
  saveStore({
    ...current,
    customLevels,
  });
}

export function getCustomLevels() {
  return getStore().customLevels;
}

export function setSoundEnabled(enabled) {
  const current = getStore();
  saveStore({ ...current, soundEnabled: Boolean(enabled) });
}

export function isSoundEnabled() {
  return getStore().soundEnabled;
}

export function setCurrentLevelId(id) {
  const current = getStore();
  saveStore({ ...current, currentLevelId: id });
}

export function getCurrentLevelId() {
  return getStore().currentLevelId;
}

export function resetAllProgress() {
  const reset = { ...DEFAULT_DATA };
  saveStore(reset);
  return reset;
}
