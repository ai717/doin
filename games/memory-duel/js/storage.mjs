// 记忆对决 · 本地持久化与存档 (集中 try/catch，损坏自动 normalize 退回默认，静默降级内存)

export const STORAGE_KEY = "doin.memory-duel.v1";

let memoryBackend = null;

function getStorage() {
  if (memoryBackend) return memoryBackend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__probe__", "1");
      localStorage.removeItem("__probe__");
      memoryBackend = localStorage;
      return memoryBackend;
    }
  } catch {
    // 隐私模式或无权限
  }

  const map = new Map();
  memoryBackend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return memoryBackend;
}

export const DEFAULT_SAVE_DATA = {
  version: 1,
  sound: true,
  challenge: {
    unlockedTier: 0, // 0: novice, 1: veteran, 2: master
    stars: { novice: 0, veteran: 0, master: 0 },
    wins: { novice: 0, veteran: 0, master: 0 },
  },
  puzzles: {
    unlockedLevel: 0,
    stars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  stats: {
    totalMatches: 0,
    wins: 0,
    totalPairsMatched: 0,
    totalSteals: 0,
    totalLocks: 0,
  },
};

export function normalizeSaveData(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SAVE_DATA };

  const sound = typeof raw.sound === "boolean" ? raw.sound : true;
  const challenge = {
    unlockedTier: typeof raw.challenge?.unlockedTier === "number" ? Math.max(0, Math.min(2, Math.floor(raw.challenge.unlockedTier))) : 0,
    stars: {
      novice: typeof raw.challenge?.stars?.novice === "number" ? Math.max(0, Math.min(3, Math.floor(raw.challenge.stars.novice))) : 0,
      veteran: typeof raw.challenge?.stars?.veteran === "number" ? Math.max(0, Math.min(3, Math.floor(raw.challenge.stars.veteran))) : 0,
      master: typeof raw.challenge?.stars?.master === "number" ? Math.max(0, Math.min(3, Math.floor(raw.challenge.stars.master))) : 0,
    },
    wins: {
      novice: typeof raw.challenge?.wins?.novice === "number" ? Math.max(0, Math.floor(raw.challenge.wins.novice)) : 0,
      veteran: typeof raw.challenge?.wins?.veteran === "number" ? Math.max(0, Math.floor(raw.challenge.wins.veteran)) : 0,
      master: typeof raw.challenge?.wins?.master === "number" ? Math.max(0, Math.floor(raw.challenge.wins.master)) : 0,
    },
  };

  const puzzleCount = 15;
  const rawPuzzleStars = Array.isArray(raw.puzzles?.stars) ? raw.puzzles.stars : [];
  const puzzleStars = Array.from({ length: puzzleCount }, (_, i) => {
    const val = rawPuzzleStars[i];
    return typeof val === "number" ? Math.max(0, Math.min(3, Math.floor(val))) : 0;
  });

  const unlockedLevel = typeof raw.puzzles?.unlockedLevel === "number"
    ? Math.max(0, Math.min(puzzleCount - 1, Math.floor(raw.puzzles.unlockedLevel)))
    : 0;

  const stats = {
    totalMatches: typeof raw.stats?.totalMatches === "number" ? Math.max(0, Math.floor(raw.stats.totalMatches)) : 0,
    wins: typeof raw.stats?.wins === "number" ? Math.max(0, Math.floor(raw.stats.wins)) : 0,
    totalPairsMatched: typeof raw.stats?.totalPairsMatched === "number" ? Math.max(0, Math.floor(raw.stats.totalPairsMatched)) : 0,
    totalSteals: typeof raw.stats?.totalSteals === "number" ? Math.max(0, Math.floor(raw.stats.totalSteals)) : 0,
    totalLocks: typeof raw.stats?.totalLocks === "number" ? Math.max(0, Math.floor(raw.stats.totalLocks)) : 0,
  };

  return {
    version: 1,
    sound,
    challenge,
    puzzles: {
      unlockedLevel,
      stars: puzzleStars,
    },
    stats,
  };
}

export function loadSaveData() {
  try {
    const raw = getStorage().getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SAVE_DATA };
    const parsed = JSON.parse(raw);
    return normalizeSaveData(parsed);
  } catch {
    return { ...DEFAULT_SAVE_DATA };
  }
}

export function saveSaveData(data) {
  try {
    const normalized = normalizeSaveData(data);
    getStorage().setItem(STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export function resetSaveData() {
  try {
    getStorage().removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
