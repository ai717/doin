// 盲盒记忆牌 — 存档唯一口径
// Key: doin.memory-flip.v1

const STORAGE_KEY = "doin.memory-flip.v1";

const DEFAULT_STATE = Object.freeze({
  levelStars: Object.freeze({}),  // { [levelId]: { stars, flawless, bestMisses, bestMs } }
  chapterProgress: Object.freeze({}), // { [chapterOrder]: "open" | "done" }，第 1 章默认 open
  dailyDate: "",
  dailyBestMisses: Number.MAX_SAFE_INTEGER,
  dailyBestMs: Number.MAX_SAFE_INTEGER,
  soundEnabled: true,
  gamesPlayed: 0,
});

let memoryFallback = {
  ...DEFAULT_STATE,
  levelStars: {},
  chapterProgress: { 1: "open" },
};

const clampInt = (val, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = typeof val === "number" && Number.isFinite(val) ? Math.floor(val) : fallback;
  return Math.min(max, Math.max(min, n));
};

function normalizeLevelStars(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k !== "string" || !k.startsWith("level_")) continue;
    if (!v || typeof v !== "object") continue;
    out[k] = {
      stars: clampInt(v.stars, 0, 0, 3),
      flawless: typeof v.flawless === "boolean" ? v.flawless : false,
      bestMisses: clampInt(v.bestMisses, Number.MAX_SAFE_INTEGER, 0),
      bestMs: clampInt(v.bestMs, Number.MAX_SAFE_INTEGER, 0),
    };
  }
  return out;
}

function normalizeChapterProgress(raw) {
  const out = { 1: "open" };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    const order = Number(k);
    if (!Number.isInteger(order) || order < 1 || order > 5) continue;
    out[order] = v === "done" ? "done" : "open";
  }
  return out;
}

export function normalizeStorageData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ...DEFAULT_STATE,
      levelStars: {},
      chapterProgress: { 1: "open" },
    };
  }
  return {
    levelStars: normalizeLevelStars(raw.levelStars),
    chapterProgress: normalizeChapterProgress(raw.chapterProgress),
    dailyDate: typeof raw.dailyDate === "string" ? raw.dailyDate.slice(0, 16) : "",
    dailyBestMisses: clampInt(raw.dailyBestMisses, Number.MAX_SAFE_INTEGER, 0),
    dailyBestMs: clampInt(raw.dailyBestMs, Number.MAX_SAFE_INTEGER, 0),
    soundEnabled: typeof raw.soundEnabled === "boolean" ? raw.soundEnabled : true,
    gamesPlayed: clampInt(raw.gamesPlayed, 0),
  };
}

export function loadGameData() {
  try {
    if (typeof localStorage === "undefined") {
      return { ...memoryFallback };
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_STATE,
        levelStars: {},
        chapterProgress: { 1: "open" },
      };
    }
    const cleaned = normalizeStorageData(JSON.parse(raw));
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
    // 静默降级到内存
  }
  return cleaned;
}

/** 取某关历史最佳成绩（未玩过返回 null） */
export function bestOf(data, levelId) {
  return data?.levelStars?.[levelId] ?? null;
}

/** 累计总星数 */
export function totalStarsOf(data) {
  if (!data?.levelStars) return 0;
  return Object.values(data.levelStars).reduce((s, r) => s + (r?.stars ?? 0), 0);
}

/** 累计 flawless 数 */
export function flawlessCountOf(data) {
  if (!data?.levelStars) return 0;
  return Object.values(data.levelStars).filter((r) => r?.flawless).length;
}

/** 用一局结果更新存档（仅当更好时写入） */
export function updateWithRunResult(prev, run) {
  const base = normalizeStorageData(prev);
  // null/非对象 run：算一次游戏但不记星级（不破坏数据）
  if (!run || typeof run !== "object") {
    return { ...base, gamesPlayed: base.gamesPlayed + 1 };
  }
  const levelId = typeof run.levelId === "string" ? run.levelId : null;
  if (!levelId) {
    return { ...base, gamesPlayed: base.gamesPlayed + 1 };
  }
  const prevBest = base.levelStars[levelId] ?? null;
  const next = {
    ...base,
    levelStars: { ...base.levelStars },
    gamesPlayed: base.gamesPlayed + 1,
  };
  const newRecord = {
    stars: clampInt(run.stars, 0, 0, 3),
    flawless: typeof run.flawless === "boolean" ? run.flawless : false,
    bestMisses: clampInt(run.misses, Number.MAX_SAFE_INTEGER, 0),
    bestMs: clampInt(run.timeMs, Number.MAX_SAFE_INTEGER, 0),
  };
  if (!prevBest) {
    next.levelStars[levelId] = newRecord;
  } else {
    next.levelStars[levelId] = {
      stars: Math.max(prevBest.stars, newRecord.stars),
      flawless: prevBest.flawless || newRecord.flawless,
      bestMisses: Math.min(prevBest.bestMisses, newRecord.bestMisses),
      bestMs: Math.min(prevBest.bestMs, newRecord.bestMs),
    };
  }
  return next;
}

/** 跨天则清零每日成绩，返回归一化后的存档 */
export function rollDailyIfNeeded(data, today) {
  const cleaned = normalizeStorageData(data);
  if (cleaned.dailyDate !== today) {
    return {
      ...cleaned,
      dailyDate: today,
      dailyBestMisses: Number.MAX_SAFE_INTEGER,
      dailyBestMs: Number.MAX_SAFE_INTEGER,
    };
  }
  return cleaned;
}

/** 用每日成绩更新存档（最少错为主指标，用时仅次指标） */
export function updateDailyResult(prev, today, misses, timeMs) {
  const base = normalizeStorageData(prev);
  if (base.dailyDate !== today) {
    return {
      ...base,
      dailyDate: today,
      dailyBestMisses: clampInt(misses, Number.MAX_SAFE_INTEGER, 0),
      dailyBestMs: clampInt(timeMs, Number.MAX_SAFE_INTEGER, 0),
    };
  }
  const better = misses < base.dailyBestMisses
    || (misses === base.dailyBestMisses && timeMs < base.dailyBestMs);
  if (!better) return base;
  return {
    ...base,
    dailyBestMisses: clampInt(misses, Number.MAX_SAFE_INTEGER, 0),
    dailyBestMs: clampInt(timeMs, Number.MAX_SAFE_INTEGER, 0),
  };
}