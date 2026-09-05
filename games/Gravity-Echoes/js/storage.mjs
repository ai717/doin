const SAVE_KEY = 'doin.Gravity-Echoes.v1';

const DEFAULT_STATE = {
  highScore: 0,
  highestSector: 1,
  totalGamesPlayed: 0,
  soundEnabled: true,
  updatedAt: 0
};

export function loadSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...DEFAULT_STATE };
    }
    return {
      highScore: Number.isFinite(parsed.highScore) && parsed.highScore >= 0 ? Math.floor(parsed.highScore) : 0,
      highestSector: Number.isFinite(parsed.highestSector) && parsed.highestSector >= 1 ? Math.floor(parsed.highestSector) : 1,
      totalGamesPlayed: Number.isFinite(parsed.totalGamesPlayed) && parsed.totalGamesPlayed >= 0 ? Math.floor(parsed.totalGamesPlayed) : 0,
      soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      updatedAt: Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveGameRecord({ score = 0, sector = 1 }) {
  try {
    const current = loadSaveData();
    const safeScore = Number.isFinite(score) && score >= 0 ? Math.floor(score) : 0;
    const safeSector = Number.isFinite(sector) && sector >= 1 ? Math.floor(sector) : 1;
    const newHigh = Math.max(current.highScore, safeScore);
    const newSector = Math.max(current.highestSector, safeSector);
    const updated = {
      highScore: newHigh,
      highestSector: newSector,
      totalGamesPlayed: current.totalGamesPlayed + 1,
      soundEnabled: current.soundEnabled,
      updatedAt: Date.now()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return {
      ...DEFAULT_STATE,
      highScore: Number.isFinite(score) && score >= 0 ? Math.floor(score) : 0,
      highestSector: Number.isFinite(sector) && sector >= 1 ? Math.floor(sector) : 1
    };
  }
}

export function saveSoundSetting(enabled) {
  try {
    const current = loadSaveData();
    current.soundEnabled = Boolean(enabled);
    current.updatedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(current));
  } catch {
    // 降级
  }
}
