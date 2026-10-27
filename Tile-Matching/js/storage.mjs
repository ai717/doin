const STORAGE_KEY = 'doin.Tile-Matching.v1';

const DEFAULT_SAVE_STATE = {
  highScores: {},
  levelStars: { 1: 0 },
  unlockedLevel: 1,
  soundEnabled: true,
  lastPlayed: 0
};

export class StorageManager {
  static load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SAVE_STATE };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SAVE_STATE };

      return {
        highScores: typeof parsed.highScores === 'object' && parsed.highScores ? parsed.highScores : {},
        levelStars: typeof parsed.levelStars === 'object' && parsed.levelStars ? parsed.levelStars : { 1: 0 },
        unlockedLevel: Number.isInteger(parsed.unlockedLevel) && parsed.unlockedLevel >= 1 ? parsed.unlockedLevel : 1,
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
        lastPlayed: typeof parsed.lastPlayed === 'number' ? parsed.lastPlayed : 0
      };
    } catch {
      return { ...DEFAULT_SAVE_STATE };
    }
  }

  static save(data) {
    try {
      const cur = this.load();
      const payload = {
        ...cur,
        ...data,
        lastPlayed: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }
}
