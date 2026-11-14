/**
 * Local storage manager for Tenpai King · Wait Finder (雀神听牌王 · 听牌速判)
 * Key: doin.tenpai.v1
 * Full in-memory fallback on quota errors or private browsing restrictions.
 */

const STORAGE_KEY = 'doin.tenpai.v1';

let memoryStore = null;

function getDefaultData() {
  return {
    version: 1,
    currentLevel: 1,
    unlockedLevel: 1,
    totalScore: 0,
    levelScores: {},
    soundEnabled: true,
    ruleMode: 'guobiao',
    wrongBook: []
  };
}

function normalizeData(raw) {
  if (!raw || typeof raw !== 'object') {
    return getDefaultData();
  }

  const def = getDefaultData();
  const unlockedLevel = Number.isInteger(raw.unlockedLevel) && raw.unlockedLevel >= 1
    ? Math.min(60, raw.unlockedLevel)
    : def.unlockedLevel;
  const currentLevel = Number.isInteger(raw.currentLevel) && raw.currentLevel >= 1
    ? Math.min(60, raw.currentLevel)
    : def.currentLevel;
  const totalScore = Number.isInteger(raw.totalScore) && raw.totalScore >= 0
    ? raw.totalScore
    : def.totalScore;

  return {
    version: 1,
    currentLevel,
    unlockedLevel,
    totalScore,
    levelScores: raw.levelScores && typeof raw.levelScores === 'object' ? raw.levelScores : {},
    soundEnabled: typeof raw.soundEnabled === 'boolean' ? raw.soundEnabled : true,
    ruleMode: raw.ruleMode === 'riichi' ? 'riichi' : 'guobiao',
    wrongBook: Array.isArray(raw.wrongBook) ? raw.wrongBook : []
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

export function recordQuestionResult(levelId, score, isPassed) {
  const current = loadSaveData();

  const prevScore = current.levelScores[levelId] || 0;
  if (score > prevScore) {
    const delta = score - prevScore;
    current.totalScore += delta;
    current.levelScores[levelId] = score;
  }

  if (isPassed && levelId >= current.unlockedLevel && levelId < 60) {
    current.unlockedLevel = levelId + 1;
  }

  if (isPassed && levelId < 60) {
    current.currentLevel = levelId + 1;
  }

  // Manage wrong questions review book
  if (!isPassed) {
    if (!current.wrongBook.includes(levelId)) {
      current.wrongBook.push(levelId);
    }
  } else {
    current.wrongBook = current.wrongBook.filter(id => id !== levelId);
  }

  return saveData(current);
}

export function setSoundPreference(enabled) {
  const current = loadSaveData();
  current.soundEnabled = Boolean(enabled);
  return saveData(current);
}

export function setRuleModePreference(mode) {
  const current = loadSaveData();
  current.ruleMode = mode === 'riichi' ? 'riichi' : 'guobiao';
  return saveData(current);
}
