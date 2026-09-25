const STORAGE_KEY = 'doin.freecell.v1';

const DEFAULT_STORAGE_STATE = {
  highScore: 0,
  bestTime: 0,
  gamesWon: 0,
  gamesPlayed: 0,
  soundMuted: false,
  savedGame: null
};

export function normalizeStorageData(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STORAGE_STATE };
  }

  const highScore = Number.isFinite(raw.highScore) && raw.highScore >= 0 ? Math.floor(raw.highScore) : 0;
  const bestTime = Number.isFinite(raw.bestTime) && raw.bestTime >= 0 ? Math.floor(raw.bestTime) : 0;
  const gamesWon = Number.isFinite(raw.gamesWon) && raw.gamesWon >= 0 ? Math.floor(raw.gamesWon) : 0;
  const gamesPlayed = Number.isFinite(raw.gamesPlayed) && raw.gamesPlayed >= gamesWon ? Math.floor(raw.gamesPlayed) : gamesWon;
  const soundMuted = Boolean(raw.soundMuted);

  let savedGame = null;
  if (raw.savedGame && typeof raw.savedGame === 'object') {
    try {
      if (
        Number.isInteger(raw.savedGame.seed) &&
        Array.isArray(raw.savedGame.cells) &&
        Array.isArray(raw.savedGame.foundations) &&
        Array.isArray(raw.savedGame.cascades)
      ) {
        savedGame = raw.savedGame;
      }
    } catch {
      savedGame = null;
    }
  }

  return {
    highScore,
    bestTime,
    gamesWon,
    gamesPlayed,
    soundMuted,
    savedGame
  };
}

let memoryCache = { ...DEFAULT_STORAGE_STATE };

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

export function clearSavedGame() {
  return saveGameData({ savedGame: null });
}
