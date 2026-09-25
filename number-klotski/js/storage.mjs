/**
 * 数字华容道本地持久化存储口径
 * 统一 Key: doin.number-klotski.v1
 * 集中 try/catch，隐私模式静默降级内存
 */

export const STORAGE_KEY = "doin.number-klotski.v1";

let memoryBackend = null;

function getBackend() {
  if (memoryBackend) return memoryBackend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__probe__", "1");
      localStorage.removeItem("__probe__");
      memoryBackend = localStorage;
      return memoryBackend;
    }
  } catch {
    // 隐私模式或被禁用
  }
  const map = new Map();
  memoryBackend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return memoryBackend;
}

export function getDefaultState() {
  return {
    bestTimes: { 3: null, 4: null, 5: null },
    bestMoves: { 3: null, 4: null, 5: null },
    ladderMaxStage: 1,
    ladderStars: {}, // { [stageId]: stars }
    soundEnabled: true,
    keyMode: "push-tile", // 'push-tile' | 'move-blank'
    dailyPlayed: null, // YYYY-MM-DD
  };
}

export function normalizeState(raw) {
  const def = getDefaultState();
  if (!raw || typeof raw !== "object") return def;

  const out = { ...def };

  if (raw.bestTimes && typeof raw.bestTimes === "object") {
    for (const k of [3, 4, 5]) {
      const v = Number(raw.bestTimes[k]);
      if (Number.isFinite(v) && v > 0) out.bestTimes[k] = v;
    }
  }

  if (raw.bestMoves && typeof raw.bestMoves === "object") {
    for (const k of [3, 4, 5]) {
      const v = Number(raw.bestMoves[k]);
      if (Number.isFinite(v) && v > 0) out.bestMoves[k] = Math.floor(v);
    }
  }

  if (typeof raw.ladderMaxStage === "number" && raw.ladderMaxStage >= 1) {
    out.ladderMaxStage = Math.floor(raw.ladderMaxStage);
  }

  if (raw.ladderStars && typeof raw.ladderStars === "object") {
    out.ladderStars = { ...raw.ladderStars };
  }

  if (typeof raw.soundEnabled === "boolean") {
    out.soundEnabled = raw.soundEnabled;
  }

  if (raw.keyMode === "move-blank" || raw.keyMode === "push-tile") {
    out.keyMode = raw.keyMode;
  }

  if (typeof raw.dailyPlayed === "string") {
    out.dailyPlayed = raw.dailyPlayed;
  }

  return out;
}

export function loadSavedState() {
  const backend = getBackend();
  try {
    const raw = backend.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return getDefaultState();
  }
}

export function saveState(state) {
  const backend = getBackend();
  try {
    const norm = normalizeState(state);
    backend.setItem(STORAGE_KEY, JSON.stringify(norm));
  } catch {
    // 降级静默忽略
  }
}
