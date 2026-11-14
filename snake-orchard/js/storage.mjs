const STORAGE_KEY = 'doin.snake-orchard.v1';

export const VALID_DIFFICULTIES = ['easy', 'normal', 'hard'];
export const VALID_THEMES = ['light', 'dark'];

const DEFAULT_STATE = Object.freeze({
  bestScore: 0,
  gamesPlayed: 0,
  applesTotal: 0,
  soundEnabled: true,
  theme: 'light',
  difficulty: 'normal'
});

let memoryFallback = { ...DEFAULT_STATE };

export function normalizeStorageData(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_STATE };
  }

  const parseNonNegativeInt = (val, fallback = 0) => {
    if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      return Math.floor(val);
    }
    return fallback;
  };

  const parseBoolean = (val, fallback = true) => {
    return typeof val === 'boolean' ? val : fallback;
  };

  const parseEnum = (val, allowed, fallback) => {
    return allowed.includes(val) ? val : fallback;
  };

  return {
    bestScore: parseNonNegativeInt(raw.bestScore, DEFAULT_STATE.bestScore),
    gamesPlayed: parseNonNegativeInt(raw.gamesPlayed, DEFAULT_STATE.gamesPlayed),
    applesTotal: parseNonNegativeInt(raw.applesTotal, DEFAULT_STATE.applesTotal),
    soundEnabled: parseBoolean(raw.soundEnabled, DEFAULT_STATE.soundEnabled),
    theme: parseEnum(raw.theme, VALID_THEMES, DEFAULT_STATE.theme),
    difficulty: parseEnum(raw.difficulty, VALID_DIFFICULTIES, DEFAULT_STATE.difficulty)
  };
}

export function loadGameData() {
  try {
    if (typeof localStorage === 'undefined') {
      return { ...memoryFallback };
    }
    const rawStr = localStorage.getItem(STORAGE_KEY);
    if (!rawStr) {
      return { ...DEFAULT_STATE };
    }
    const parsed = JSON.parse(rawStr);
    const cleaned = normalizeStorageData(parsed);
    memoryFallback = { ...cleaned };
    return cleaned;
  } catch {
    return { ...memoryFallback };
  }
}

export function saveGameData(data) {
  const cleaned = normalizeStorageData(data);
  memoryFallback = { ...cleaned };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // 降级使用内存存储
  }
  return cleaned;
}
