// 莓园打地鼠 — 存档唯一口径
// Key: doin.mole.v1

const STORAGE_KEY = "doin.mole.v1";
const MODES = ["easy", "normal", "crazy", "daily"];

const DEFAULT_STATE = Object.freeze({
  bestScore: Object.freeze({ easy: 0, normal: 0, crazy: 0, daily: 0 }),
  bestCombo: Object.freeze({ easy: 0, normal: 0, crazy: 0, daily: 0 }),
  dailyDate: "",
  dailyScore: 0,
  difficulty: "normal",
  soundEnabled: true,
  gamesPlayed: 0,
});

let memoryFallback = { ...DEFAULT_STATE, bestScore: { ...DEFAULT_STATE.bestScore }, bestCombo: { ...DEFAULT_STATE.bestCombo } };

const clampInt = (val, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = typeof val === "number" && Number.isFinite(val) ? Math.floor(val) : fallback;
  return Math.min(max, Math.max(min, n));
};

function normalizeScores(raw) {
  const out = {};
  for (const mode of MODES) {
    out[mode] = clampInt(raw?.[mode], 0);
  }
  return out;
}

export function normalizeStorageData(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_STATE, bestScore: { ...DEFAULT_STATE.bestScore }, bestCombo: { ...DEFAULT_STATE.bestCombo } };
  }
  return {
    bestScore: normalizeScores(raw.bestScore),
    bestCombo: normalizeScores(raw.bestCombo),
    dailyDate: typeof raw.dailyDate === "string" ? raw.dailyDate.slice(0, 16) : "",
    dailyScore: clampInt(raw.dailyScore, 0),
    difficulty: MODES.includes(raw.difficulty) && raw.difficulty !== "daily" ? raw.difficulty : "normal",
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
      return { ...DEFAULT_STATE, bestScore: { ...DEFAULT_STATE.bestScore }, bestCombo: { ...DEFAULT_STATE.bestCombo } };
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

/** 取某模式的历史最高分（非法模式回 0） */
export function bestOf(data, mode) {
  if (!MODES.includes(mode)) return 0;
  return data?.bestScore?.[mode] ?? 0;
}

/** 跨天则清零今日成绩，返回归一化后的存档 */
export function rollDailyIfNeeded(data, today) {
  const cleaned = normalizeStorageData(data);
  if (cleaned.dailyDate !== today) {
    return { ...cleaned, dailyDate: today, dailyScore: 0 };
  }
  return cleaned;
}

/** 用一局结果更新存档 */
export function updateWithRunResult(prev, run) {
  const base = normalizeStorageData(prev);
  const mode = MODES.includes(run?.mode) ? run.mode : "normal";
  const score = clampInt(run?.score, 0);
  const maxCombo = clampInt(run?.maxCombo, 0);

  const next = {
    ...base,
    bestScore: { ...base.bestScore },
    bestCombo: { ...base.bestCombo },
    gamesPlayed: base.gamesPlayed + 1,
  };
  if (score > next.bestScore[mode]) next.bestScore[mode] = score;
  if (maxCombo > next.bestCombo[mode]) next.bestCombo[mode] = maxCombo;

  if (mode === "daily" && typeof run?.date === "string") {
    if (base.dailyDate !== run.date) {
      next.dailyDate = run.date;
      next.dailyScore = score;
    } else if (score > base.dailyScore) {
      next.dailyScore = score;
    }
  }
  if (mode !== "daily" && base.difficulty !== mode) next.difficulty = mode;
  return next;
}
