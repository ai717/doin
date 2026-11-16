// 霓虹弹珠台 · 存档唯一口径（key: doin.pinball.v1）
// localStorage 不可用或数据损坏时静默降级内存，读取数据严格归一化。

export const STORAGE_KEY = "doin.pinball.v1";

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

const DEFAULTS = {
  sound: true,
  unlockedLevel: 1,
  stars: {},          // { [levelId]: bestStars }
  bestSurvivalScore: 0,
  bestSurvivalCombo: 0
};

export function defaultSave() {
  return {
    sound: true,
    unlockedLevel: 1,
    stars: {},
    bestSurvivalScore: 0,
    bestSurvivalCombo: 0
  };
}

function normalize(raw) {
  const out = defaultSave();
  if (!raw || typeof raw !== "object") return out;
  if (typeof raw.sound === "boolean") out.sound = raw.sound;
  const unlocked = Number(raw.unlockedLevel);
  if (Number.isInteger(unlocked) && unlocked >= 1 && unlocked <= 30) out.unlockedLevel = unlocked;
  if (raw.stars && typeof raw.stars === "object") {
    for (const [key, value] of Object.entries(raw.stars)) {
      const id = Number(key);
      const stars = Number(value);
      if (Number.isInteger(id) && id >= 1 && id <= 30 && Number.isInteger(stars) && stars >= 0 && stars <= 3) {
        out.stars[id] = stars;
      }
    }
  }
  if (Number.isFinite(Number(raw.bestSurvivalScore)) && Number(raw.bestSurvivalScore) >= 0) {
    out.bestSurvivalScore = Math.floor(Number(raw.bestSurvivalScore));
  }
  if (Number.isFinite(Number(raw.bestSurvivalCombo)) && Number(raw.bestSurvivalCombo) >= 0) {
    out.bestSurvivalCombo = Math.floor(Number(raw.bestSurvivalCombo));
  }
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
    storage().setItem(STORAGE_KEY, JSON.stringify(save));
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
