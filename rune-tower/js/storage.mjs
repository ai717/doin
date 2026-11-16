// 本地存档管理器（严格遵循 doin.<slug>.v1 规范与 try/catch 隔离）

export const STORAGE_KEY = "doin.rune-tower.v1";

const DEFAULT_STATE = {
  maxChapterUnlocked: 1, // 1: 1-5, 2: 6-10, 3: 11-15, 4: 16-20
  bestWave: 0,
  totalWins: 0,
  totalKills: 0,
  fastestWinSeconds: 0,
  unlockedRelics: [],
  soundEnabled: true,
  lastPlayed: 0,
  savedRun: null,
};

let memoryFallback = { ...DEFAULT_STATE };

function normalizeSavedRun(run) {
  if (!run || typeof run !== "object") return null;
  return {
    wave: Math.max(1, Math.min(20, Number(run.wave) || 1)),
    chapter: Math.max(1, Math.min(4, Number(run.chapter) || 1)),
    mana: Math.max(0, Number(run.mana) || 0),
    crystalHp: Math.max(1, Math.min(20, Number(run.crystalHp) || 20)),
    score: Math.max(0, Number(run.score) || 0),
    kills: Math.max(0, Number(run.kills) || 0),
    towers: run.towers && typeof run.towers === "object" ? run.towers : {},
    activeRelics: Array.isArray(run.activeRelics) ? run.activeRelics.filter((id) => typeof id === "string") : [],
    elapsedSeconds: Math.max(0, Number(run.elapsedSeconds) || 0),
    rerollsLeft: Math.max(0, Math.min(2, Number(run.rerollsLeft) || 0)),
  };
}

function normalizeState(data) {
  if (!data || typeof data !== "object") return { ...DEFAULT_STATE };
  const bestWave = Math.max(0, Math.min(20, Number(data.bestWave) || 0));
  // 章节解锁随历史最高波次动态保底计算
  const derivedChapter = bestWave >= 15 ? 4 : bestWave >= 10 ? 3 : bestWave >= 5 ? 2 : 1;
  const storedChapter = Math.max(1, Math.min(4, Number(data.maxChapterUnlocked) || 1));

  return {
    maxChapterUnlocked: Math.max(storedChapter, derivedChapter),
    bestWave,
    totalWins: Math.max(0, Number(data.totalWins) || 0),
    totalKills: Math.max(0, Number(data.totalKills) || 0),
    fastestWinSeconds: Math.max(0, Number(data.fastestWinSeconds) || 0),
    unlockedRelics: Array.isArray(data.unlockedRelics) ? data.unlockedRelics.filter((id) => typeof id === "string") : [],
    soundEnabled: typeof data.soundEnabled === "boolean" ? data.soundEnabled : true,
    lastPlayed: Number(data.lastPlayed) || Date.now(),
    savedRun: normalizeSavedRun(data.savedRun),
  };
}

export function loadSaveData() {
  try {
    if (typeof localStorage === "undefined") return { ...memoryFallback };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    const normalized = normalizeState(parsed);
    memoryFallback = { ...normalized };
    return normalized;
  } catch {
    return { ...memoryFallback };
  }
}

export function writeSaveData(data) {
  const normalized = normalizeState(data);
  memoryFallback = { ...normalized };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // 内存静默兜底
  }
  return normalized;
}

export function updateStats({ wave = 0, won = false, kills = 0, timeSeconds = 0, newRelics = [] } = {}) {
  const current = loadSaveData();
  const nextChapter = wave >= 15 ? 4 : wave >= 10 ? 3 : wave >= 5 ? 2 : current.maxChapterUnlocked;

  const next = {
    ...current,
    maxChapterUnlocked: Math.max(current.maxChapterUnlocked, nextChapter),
    bestWave: Math.max(current.bestWave, wave),
    totalWins: won ? current.totalWins + 1 : current.totalWins,
    totalKills: current.totalKills + kills,
    fastestWinSeconds: won && timeSeconds > 0
      ? (current.fastestWinSeconds === 0 ? timeSeconds : Math.min(current.fastestWinSeconds, timeSeconds))
      : current.fastestWinSeconds,
    unlockedRelics: Array.from(new Set([...current.unlockedRelics, ...newRelics])),
    lastPlayed: Date.now(),
    savedRun: won ? null : current.savedRun,
  };
  return writeSaveData(next);
}

export function saveCurrentRun(runState) {
  const current = loadSaveData();
  const normalizedRun = normalizeSavedRun(runState);
  return writeSaveData({
    ...current,
    savedRun: normalizedRun,
  });
}

export function clearSavedRun() {
  const current = loadSaveData();
  return writeSaveData({
    ...current,
    savedRun: null,
  });
}

export function clearSaveData() {
  memoryFallback = { ...DEFAULT_STATE };
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // 静默降级
  }
  return { ...DEFAULT_STATE };
}
