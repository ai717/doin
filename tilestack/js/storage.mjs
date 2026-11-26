/**
 * Local storage manager for TileStack (千层瓦片 · 叠叠消)
 * Key: doin.tilestack.v1
 * Complete fallback to in-memory store on quota errors or private browsing restrictions.
 */

const STORAGE_KEY = 'doin.tilestack.v1';

let memoryStore = null;

function getDefaultData() {
  return {
    version: 1,
    currentLevel: 1,
    unlockedLevel: 1,
    levelStars: {},
    highScores: {},
    soundEnabled: true
  };
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') {
    return getDefaultData();
  }

  const def = getDefaultData();
  const unlockedLevel = Number.isInteger(raw.unlockedLevel) && raw.unlockedLevel >= 1
    ? Math.min(40, raw.unlockedLevel)
    : def.unlockedLevel;
  const currentLevel = Number.isInteger(raw.currentLevel) && raw.currentLevel >= 1
    ? Math.min(40, raw.currentLevel)
    : def.currentLevel;

  return {
    version: 1,
    currentLevel,
    unlockedLevel,
    levelStars: raw.levelStars && typeof raw.levelStars === 'object' ? raw.levelStars : {},
    highScores: raw.highScores && typeof raw.highScores === 'object' ? raw.highScores : {},
    soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : true
  };
}

export function loadSaveData() {
  if (memoryStore) {
    return normalizeData(memoryStore);
  }

  try {
    const rawStr = localStorage.getItem(STORAGE_KEY);
    if (!rawStr) {
      const initial = getDefaultData();
      saveData(initial);
      return initial;
    }
    const parsed = JSON.parse(rawStr);
    return normalizeData(parsed);
  } catch (err) {
    if (!memoryStore) {
      memoryStore = getDefaultData();
    }
    return normalizeData(memoryStore);
  }
}

export function saveData(data) {
  const normalized = normalizeData(data);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (err) {
    memoryStore = normalized;
  }
  return normalized;
}

export function recordLevelCompletion(levelId, stars, score) {
  const current = loadSaveData();
  
  // Record stars
  const prevStars = current.levelStars[levelId] || 0;
  if (stars > prevStars) {
    current.levelStars[levelId] = stars;
  }

  // Record score
  const prevScore = current.highScores[levelId] || 0;
  if (score > prevScore) {
    current.highScores[levelId] = score;
  }

  // Unlock next level
  if (levelId >= current.unlockedLevel && levelId < 40) {
    current.unlockedLevel = levelId + 1;
  }

  // Advance currentLevel
  if (levelId < 40) {
    current.currentLevel = levelId + 1;
  }

  return saveData(current);
}

export function setSoundPreference(enabled) {
  const current = loadSaveData();
  current.soundEnabled = Boolean(enabled);
  return saveData(current);
}
