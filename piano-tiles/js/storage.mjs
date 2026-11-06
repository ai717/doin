// Piano Tiles — 存档唯一口径
// Key: doin.piano-tiles.v1

const STORAGE_KEY = "doin.piano-tiles.v1";

const DEFAULT_STATE = Object.freeze({
  bestScore: 0,
  bestCombo: 0,
  bestRank: null,       // string: '新秀' | '快手' | ...
  gamesPlayed: 0,
  soundEnabled: true,
});

let memoryFallback = { ...DEFAULT_STATE };

export function normalizeStorageData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_STATE };
  }

  const parseNonNegInt = (val, fallback = 0) =>
    typeof val === "number" && Number.isFinite(val) && val >= 0
      ? Math.floor(val)
      : fallback;

  return {
    bestScore: parseNonNegInt(raw.bestScore, DEFAULT_STATE.bestScore),
    bestCombo: parseNonNegInt(raw.bestCombo, DEFAULT_STATE.bestCombo),
    bestRank: typeof raw.bestRank === "string" ? raw.bestRank : DEFAULT_STATE.bestRank,
    gamesPlayed: parseNonNegInt(raw.gamesPlayed, DEFAULT_STATE.gamesPlayed),
    soundEnabled: typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : DEFAULT_STATE.soundEnabled,
  };
}

export function loadGameData() {
  try {
    if (typeof localStorage === "undefined") {
      return { ...memoryFallback };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
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
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
  } catch {
    // 静默降级
  }
  return cleaned;
}

/** 根据新一局结果更新最高纪录，返回更新后的数据 */
export function updateWithRunResult(prev, run) {
  const next = { ...prev };
  if (run.score > prev.bestScore) next.bestScore = run.score;
  if (run.maxCombo > prev.bestCombo) {
    next.bestCombo = run.maxCombo;
    if (run.rankName) next.bestRank = run.rankName;
  }
  next.gamesPlayed = prev.gamesPlayed + 1;
  return next;
}
