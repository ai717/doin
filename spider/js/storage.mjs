// Spider Solitaire Storage Module
// Manages local persistence with safety guards, fallback to in-memory on quota or restriction.

const STORAGE_KEY = 'doin.spider.v1';

const DEFAULT_STATE = {
  soundMuted: false,
  levelProgress: {},
  endlessStats: {
    gamesPlayed: 0,
    gamesWon: 0,
    winStreak: 0,
    bestMoves: 0
  },
  dailyStats: {},
  savedGame: null
};

export function normalizeStorageData(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STATE, levelProgress: {}, endlessStats: { ...DEFAULT_STATE.endlessStats }, dailyStats: {} };
  }

  const soundMuted = Boolean(raw.soundMuted);

  const levelProgress = {};
  if (raw.levelProgress && typeof raw.levelProgress === 'object') {
    for (const [key, val] of Object.entries(raw.levelProgress)) {
      if (val && typeof val === 'object') {
        levelProgress[key] = {
          completed: Boolean(val.completed),
          stars: Math.max(0, Math.min(3, Math.floor(Number(val.stars) || 0))),
          bestScore: Math.max(0, Math.floor(Number(val.bestScore) || 0)),
          bestMoves: Math.max(0, Math.floor(Number(val.bestMoves) || 0))
        };
      }
    }
  }

  const rawEndless = raw.endlessStats || {};
  const endlessStats = {
    gamesPlayed: Math.max(0, Math.floor(Number(rawEndless.gamesPlayed) || 0)),
    gamesWon: Math.max(0, Math.floor(Number(rawEndless.gamesWon) || 0)),
    winStreak: Math.max(0, Math.floor(Number(rawEndless.winStreak) || 0)),
    bestMoves: Math.max(0, Math.floor(Number(rawEndless.bestMoves) || 0))
  };

  const dailyStats = {};
  if (raw.dailyStats && typeof raw.dailyStats === 'object') {
    for (const [dateKey, val] of Object.entries(raw.dailyStats)) {
      if (val && typeof val === 'object') {
        dailyStats[dateKey] = {
          completed: Boolean(val.completed),
          moves: Math.max(0, Math.floor(Number(val.moves) || 0)),
          score: Math.max(0, Math.floor(Number(val.score) || 0))
        };
      }
    }
  }

  let savedGame = null;
  if (raw.savedGame && typeof raw.savedGame === 'object') {
    try {
      if (raw.savedGame.engineState && Array.isArray(raw.savedGame.engineState.columns)) {
        savedGame = raw.savedGame;
      }
    } catch {
      savedGame = null;
    }
  }

  return {
    soundMuted,
    levelProgress,
    endlessStats,
    dailyStats,
    savedGame
  };
}

let memoryCache = { ...DEFAULT_STATE, levelProgress: {}, endlessStats: { ...DEFAULT_STATE.endlessStats }, dailyStats: {} };

export function loadGameData() {
  try {
    const rawStr = localStorage.getItem(STORAGE_KEY);
    if (!rawStr) return { ...memoryCache };
    const parsed = JSON.parse(rawStr);
    memoryCache = normalizeStorageData(parsed);
    return { ...memoryCache };
  } catch {
    return { ...memoryCache };
  }
}

export function saveGameData(partial) {
  try {
    const current = loadGameData();
    const updated = normalizeStorageData({ ...current, ...partial });
    memoryCache = { ...updated };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch {
    memoryCache = normalizeStorageData({ ...memoryCache, ...partial });
    return false;
  }
}

export function recordLevelResult(levelId, stars, score, moves) {
  const data = loadGameData();
  const current = data.levelProgress[levelId] || { completed: false, stars: 0, bestScore: 0, bestMoves: 0 };
  const updated = {
    completed: true,
    stars: Math.max(current.stars, stars),
    bestScore: Math.max(current.bestScore, score),
    bestMoves: current.bestMoves === 0 ? moves : Math.min(current.bestMoves, moves)
  };
  data.levelProgress[levelId] = updated;
  saveGameData({ levelProgress: data.levelProgress });
}

export function clearSavedGame() {
  return saveGameData({ savedGame: null });
}
