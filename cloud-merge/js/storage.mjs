// storage.mjs: 云朵合成存档唯一口径 · Key: doin.cloud-merge.v1
// localStorage 不可用或数据损坏时静默降级内存默认值，绝不白屏抛错。

const KEY = "doin.cloud-merge.v1";
const MAX_LEVEL = 10;
const MAX_SCORE = 1_000_000_000;
const MAX_CHAIN = 9999;
const MAX_RAINBOWS = 99999;

function toInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function defaults() {
  return {
    sound: true,
    endless: { best: 0, maxLevel: 1, maxChain: 0, rainbows: 0 },
    daily: { date: null, best: 0, maxLevel: 1, rainbows: 0 },
  };
}

let backend = null;
function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__cm_probe__", "1");
      localStorage.removeItem("__cm_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // 隐私模式或受限环境：静默降级内存 Map
  }
  const map = new Map();
  backend = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  return backend;
}

export function normalize(raw) {
  const d = defaults();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const out = defaults();

  if (typeof raw.sound === "boolean") out.sound = raw.sound;

  if (raw.endless && typeof raw.endless === "object" && !Array.isArray(raw.endless)) {
    const e = raw.endless;
    out.endless = {
      best: toInt(e.best, 0, MAX_SCORE),
      maxLevel: toInt(e.maxLevel, 1, MAX_LEVEL),
      maxChain: toInt(e.maxChain, 0, MAX_CHAIN),
      rainbows: toInt(e.rainbows, 0, MAX_RAINBOWS),
    };
  }

  if (raw.daily && typeof raw.daily === "object" && !Array.isArray(raw.daily)) {
    const dd = raw.daily;
    out.daily = {
      date: isDateKey(dd.date) ? dd.date : null,
      best: toInt(dd.best, 0, MAX_SCORE),
      maxLevel: toInt(dd.maxLevel, 1, MAX_LEVEL),
      rainbows: toInt(dd.rainbows, 0, MAX_RAINBOWS),
    };
  }

  return out;
}

export function load() {
  try {
    const raw = storage().getItem(KEY);
    if (!raw) return defaults();
    return normalize(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

export function save(data) {
  const safe = normalize(data);
  try {
    storage().setItem(KEY, JSON.stringify(safe));
  } catch {
    // 写入异常静默处理
  }
  return safe;
}

export function recordResult(data, result) {
  const next = normalize(data);
  const score = toInt(result?.score, 0, MAX_SCORE);
  const maxLevel = toInt(result?.maxLevel, 1, MAX_LEVEL);
  const maxChain = toInt(result?.maxChain, 0, MAX_CHAIN);
  const rainbows = toInt(result?.rainbows, 0, MAX_RAINBOWS);

  if (result?.kind === "daily") {
    const date = isDateKey(result.date) ? result.date : null;
    const prev = next.daily;
    if (date && prev.date === date) {
      const isNewBest = score > prev.best;
      next.daily = {
        date,
        best: Math.max(prev.best, score),
        maxLevel: Math.max(prev.maxLevel, maxLevel),
        rainbows: Math.max(prev.rainbows, rainbows),
      };
      return { data: next, isNewBest };
    }
    next.daily = { date, best: score, maxLevel, rainbows };
    return { data: next, isNewBest: false };
  }

  const prev = next.endless;
  const isNewBest = score > prev.best;
  next.endless = {
    best: Math.max(prev.best, score),
    maxLevel: Math.max(prev.maxLevel, maxLevel),
    maxChain: Math.max(prev.maxChain, maxChain),
    rainbows: Math.max(prev.rainbows, rainbows),
  };
  return { data: next, isNewBest };
}

export function setSound(enabled) {
  const data = load();
  data.sound = !!enabled;
  return save(data);
}

export function resetAll() {
  return save(defaults());
}
