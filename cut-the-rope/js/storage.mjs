// 割绳子本地存档唯一口径：doin.cut-the-rope.v1
// 集中 try/catch，损坏自动归一化退回默认，安全降级内存

const STORAGE_KEY = "doin.cut-the-rope.v1";

let memoryFallback = null;

function getDefaultData() {
  return {
    version: 1,
    currentLevel: 1,
    soundEnabled: true,
    levels: {} // { [id]: { stars: number, bestTime: number } }
  };
}

function normalize(raw) {
  if (!raw || typeof raw !== "object") return getDefaultData();
  const def = getDefaultData();
  const soundEnabled = typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : def.soundEnabled;
  const currentLevel = typeof raw.currentLevel === "number" && raw.currentLevel >= 1 && raw.currentLevel <= 40
    ? Math.floor(raw.currentLevel)
    : 1;

  const levels = {};
  if (raw.levels && typeof raw.levels === "object") {
    for (const [k, v] of Object.entries(raw.levels)) {
      const id = parseInt(k, 10);
      if (!Number.isNaN(id) && id >= 1 && id <= 40 && v && typeof v === "object") {
        levels[id] = {
          stars: Math.max(0, Math.min(3, parseInt(v.stars, 10) || 0)),
          bestTime: typeof v.bestTime === "number" ? Math.max(0, v.bestTime) : 0
        };
      }
    }
  }

  return {
    version: 1,
    currentLevel,
    soundEnabled,
    levels
  };
}

export function loadSaveData() {
  try {
    if (typeof localStorage !== "undefined") {
      const item = localStorage.getItem(STORAGE_KEY);
      if (!item) return getDefaultData();
      return normalize(JSON.parse(item));
    }
  } catch (err) {
    // 降级使用内存存储
  }
  return memoryFallback ?? getDefaultData();
}

export function saveSaveData(data) {
  const norm = normalize(data);
  memoryFallback = norm;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(norm));
    }
  } catch (err) {
    // 静默降级
  }
  return norm;
}

export function recordLevelClear(levelId, stars, timeElapsed) {
  const data = loadSaveData();
  const prev = data.levels[levelId] || { stars: 0, bestTime: 999999 };
  const newStars = Math.max(prev.stars, stars);
  const newBestTime = prev.bestTime > 0 ? Math.min(prev.bestTime, timeElapsed) : timeElapsed;

  data.levels[levelId] = {
    stars: newStars,
    bestTime: newBestTime
  };
  if (levelId < 40) {
    data.currentLevel = Math.max(data.currentLevel, levelId + 1);
  }
  return saveSaveData(data);
}
