/**
 * Local storage manager for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * Key: doin.luban.v1
 * Full in-memory fallback on quota errors or private browsing restrictions.
 */

const STORAGE_KEY = 'doin.luban.v1';

let memoryStore = null;

function getDefaultData() {
  return {
    version: 1,
    currentLevel: 1,
    unlockedLevel: 1,
    levelRatings: {},
    levelBestSteps: {},
    soundEnabled: true
  };
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') {
    return getDefaultData();
  }

  const def = getDefaultData();
  const unlockedLevel = Number.isInteger(raw.unlockedLevel) && raw.unlockedLevel >= 1
    ? Math.min(36, raw.unlockedLevel)
    : def.unlockedLevel;
  const currentLevel = Number.isInteger(raw.currentLevel) && raw.currentLevel >= 1
    ? Math.min(36, raw.currentLevel)
    : def.currentLevel;

  return {
    version: 1,
    currentLevel,
    unlockedLevel,
    levelRatings: raw.levelRatings && typeof raw.levelRatings === 'object' ? raw.levelRatings : {},
    levelBestSteps: raw.levelBestSteps && typeof raw.levelBestSteps === 'object' ? raw.levelBestSteps : {},
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

export function recordLevelCompletion(levelId, ratingId, steps) {
  const current = loadSaveData();

  // Update best steps
  const prevSteps = current.levelBestSteps[levelId];
  if (!prevSteps || steps < prevSteps) {
    current.levelBestSteps[levelId] = steps;
  }

  // Update rating if better
  const ranks = { gold: 3, silver: 2, bronze: 1 };
  const prevRating = current.levelRatings[levelId];
  const prevRank = ranks[prevRating] || 0;
  const newRank = ranks[ratingId] || 1;
  if (newRank >= prevRank) {
    current.levelRatings[levelId] = ratingId;
  }

  // Unlock next level
  if (levelId >= current.unlockedLevel && levelId < 36) {
    current.unlockedLevel = levelId + 1;
  }
  if (levelId < 36) {
    current.currentLevel = levelId + 1;
  }

  return saveData(current);
}

export function setSoundPreference(enabled) {
  const current = loadSaveData();
  current.soundEnabled = Boolean(enabled);
  return saveData(current);
}
