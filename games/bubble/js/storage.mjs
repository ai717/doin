/**
 * 极简泡泡堂 · 水泡大作战 (Bubble Arena Lite)
 * 存档管理 (集中 try/catch 降级内存, 稳健校验)
 */

const STORAGE_KEY = "doin.bubble.v1";

const DEFAULT_RECORD = {
  version: 1,
  unlockedMaps: ["map_pool"],
  aiLevel: "novice",
  wins: 0,
  losses: 0,
  totalTrapped: 0,
  totalPopped: 0,
  mapStars: {
    map_pool: 0,
    map_isles: 0,
    map_ice: 0,
    map_pirate: 0,
  },
  soundEnabled: true,
};

let memoryStore = null;

function getStore() {
  if (memoryStore) return memoryStore;
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryStore = normalizeRecord(parsed);
        return memoryStore;
      }
    }
  } catch (err) {
    // Degrade gracefully
  }
  memoryStore = { ...DEFAULT_RECORD };
  return memoryStore;
}

export function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_RECORD };
  }

  const validMaps = ["map_pool", "map_isles", "map_ice", "map_pirate"];
  const unlocked = Array.isArray(raw.unlockedMaps)
    ? raw.unlockedMaps.filter((m) => validMaps.includes(m))
    : ["map_pool"];
  if (!unlocked.includes("map_pool")) {
    unlocked.unshift("map_pool");
  }

  const validAI = ["novice", "skilled", "master"];
  const aiLevel = validAI.includes(raw.aiLevel) ? raw.aiLevel : "novice";

  const mapStars = { ...DEFAULT_RECORD.mapStars };
  if (raw.mapStars && typeof raw.mapStars === "object") {
    for (const key of validMaps) {
      if (typeof raw.mapStars[key] === "number" && raw.mapStars[key] >= 0 && raw.mapStars[key] <= 3) {
        mapStars[key] = Math.floor(raw.mapStars[key]);
      }
    }
  }

  return {
    version: 1,
    unlockedMaps: unlocked,
    aiLevel,
    wins: typeof raw.wins === "number" && raw.wins >= 0 ? Math.floor(raw.wins) : 0,
    losses: typeof raw.losses === "number" && raw.losses >= 0 ? Math.floor(raw.losses) : 0,
    totalTrapped: typeof raw.totalTrapped === "number" && raw.totalTrapped >= 0 ? Math.floor(raw.totalTrapped) : 0,
    totalPopped: typeof raw.totalPopped === "number" && raw.totalPopped >= 0 ? Math.floor(raw.totalPopped) : 0,
    mapStars,
    soundEnabled: raw.soundEnabled !== undefined ? Boolean(raw.soundEnabled) : true,
  };
}

export function saveRecord(patch = {}) {
  const current = getStore();
  const next = normalizeRecord({ ...current, ...patch });
  memoryStore = next;

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch (err) {
    // Degrade silently
  }
  return next;
}

export function loadRecord() {
  return getStore();
}

export function recordMatchResult(mapId, isWin, trappedCount = 0, poppedCount = 0) {
  const current = getStore();
  const newWins = isWin ? current.wins + 1 : current.wins;
  const newLosses = isWin ? current.losses : current.losses + 1;

  const unlocked = [...current.unlockedMaps];
  if (isWin) {
    if (mapId === "map_pool" && !unlocked.includes("map_isles")) {
      unlocked.push("map_isles");
    } else if (mapId === "map_isles" && !unlocked.includes("map_ice")) {
      unlocked.push("map_ice");
    } else if (mapId === "map_ice" && !unlocked.includes("map_pirate")) {
      unlocked.push("map_pirate");
    }
  }

  const prevStars = current.mapStars[mapId] || 0;
  const newStars = isWin ? Math.max(prevStars, 3) : prevStars;

  return saveRecord({
    wins: newWins,
    losses: newLosses,
    totalTrapped: current.totalTrapped + trappedCount,
    totalPopped: current.totalPopped + poppedCount,
    unlockedMaps: unlocked,
    mapStars: { ...current.mapStars, [mapId]: newStars },
  });
}
