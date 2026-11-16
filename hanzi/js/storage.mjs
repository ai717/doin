/**
 * Glyph Craft (字灵拆拆乐) - Storage Manager
 * Unified key: doin.hanzi.v1
 * Memory fallback on failure, data normalization.
 */

const STORAGE_KEY = 'doin.hanzi.v1';

let memoryFallback = null;

export function normalizeStorage(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      highestLevel: 1,
      levelStars: {},
      unlockedCodex: [],
      soundEnabled: true
    };
  }

  const highestLevel = typeof raw.highestLevel === 'number' && raw.highestLevel >= 1
    ? Math.min(22, Math.floor(raw.highestLevel))
    : 1;

  const levelStars = {};
  if (raw.levelStars && typeof raw.levelStars === 'object') {
    for (const [k, v] of Object.entries(raw.levelStars)) {
      const numK = parseInt(k, 10);
      const numV = parseInt(v, 10);
      if (!isNaN(numK) && numK >= 1 && numK <= 22 && !isNaN(numV) && numV >= 0 && numV <= 3) {
        levelStars[numK] = numV;
      }
    }
  }

  const unlockedCodex = Array.isArray(raw.unlockedCodex)
    ? raw.unlockedCodex.filter(item => typeof item === 'string')
    : [];

  const soundEnabled = raw.soundEnabled !== false;

  return {
    highestLevel,
    levelStars,
    unlockedCodex,
    soundEnabled
  };
}

export function loadGameData() {
  try {
    const rawStr = localStorage.getItem(STORAGE_KEY);
    if (!rawStr) {
      return memoryFallback ? normalizeStorage(memoryFallback) : normalizeStorage(null);
    }
    const parsed = JSON.parse(rawStr);
    return normalizeStorage(parsed);
  } catch (_e) {
    return memoryFallback ? normalizeStorage(memoryFallback) : normalizeStorage(null);
  }
}

export function saveGameData(data) {
  const normalized = normalizeStorage(data);
  memoryFallback = normalized;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (_e) {
    // Silently retain in memory
  }
  return normalized;
}

export function recordLevelSuccess(levelId, stars, newDiscoveredIds = []) {
  const current = loadGameData();
  const prevStars = current.levelStars[levelId] || 0;
  if (stars > prevStars) {
    current.levelStars[levelId] = stars;
  }
  if (levelId >= current.highestLevel && current.highestLevel < 22) {
    current.highestLevel = Math.min(22, levelId + 1);
  }
  const codexSet = new Set(current.unlockedCodex);
  newDiscoveredIds.forEach(id => codexSet.add(id));
  current.unlockedCodex = Array.from(codexSet);

  return saveGameData(current);
}
