// 泡泡射手 · 存档唯一口径（key: doin.bobble.v1）
// localStorage 不可用或数据损坏时静默降级内存，读取数据严格归一化。

export const STORAGE_KEY = "doin.bobble.v1";

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__probe__", "1");
      localStorage.removeItem("__probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    /* 隐私模式或存储被禁用 */
  }
  const map = new Map();
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
  return backend;
}

export function defaultSave() {
  return {
    sound: true,
    aim: "extended",      // classic | extended | pro
    assist: false,        // 色盲辅助符号
    stageUnlocked: 1,
    stars: {},            // { [levelId]: bestStars }
    puzzleSolved: [],     // 已解残局 id
    endlessShots: 0,
    endlessChain: 0,
    endlessScore: 0,
    dailyDate: 0,
    dailyShots: 0,
    dailyChain: 0
  };
}

function int(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function normalize(raw) {
  const out = defaultSave();
  if (!raw || typeof raw !== "object") return out;
  if (typeof raw.sound === "boolean") out.sound = raw.sound;
  if (typeof raw.assist === "boolean") out.assist = raw.assist;
  if (raw.aim === "classic" || raw.aim === "extended" || raw.aim === "pro") out.aim = raw.aim;
  out.stageUnlocked = int(raw.stageUnlocked, 1, 30, 1);
  if (raw.stars && typeof raw.stars === "object") {
    for (const [key, value] of Object.entries(raw.stars)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id < 1 || id > 30) continue;
      out.stars[id] = int(value, 0, 3, 0);
    }
  }
  if (Array.isArray(raw.puzzleSolved)) {
    const set = new Set();
    for (const v of raw.puzzleSolved) {
      const id = Number(v);
      if (Number.isInteger(id) && id >= 1 && id <= 24) set.add(id);
    }
    out.puzzleSolved = [...set].sort((a, b) => a - b);
  }
  out.endlessShots = int(raw.endlessShots, 0, 99999, 0);
  out.endlessChain = int(raw.endlessChain, 0, 99999, 0);
  out.endlessScore = int(raw.endlessScore, 0, 99999999, 0);
  out.dailyDate = int(raw.dailyDate, 0, 99999999, 0);
  out.dailyShots = int(raw.dailyShots, 0, 99999, 0);
  out.dailyChain = int(raw.dailyChain, 0, 99999, 0);
  return out;
}

export function loadSave() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return defaultSave();
    return normalize(JSON.parse(raw));
  } catch {
    return defaultSave();
  }
}

export function saveSave(save) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(save)));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    storage().removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function totalStars(save) {
  return Object.values(save.stars ?? {}).reduce((a, b) => a + b, 0);
}
