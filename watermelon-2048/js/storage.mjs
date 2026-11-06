// 数字合成大西瓜 watermelon-2048 · 存档唯一口径 · Key: doin.watermelon-2048.v1
// localStorage 不可用 / 数据损坏 → 静默降级内存默认值，绝不白屏。
// 双纪录：无尽冲分（endless）+ 每日挑战（daily，按日期，跨日重置）。
// 每模式双纪录：最高分 + 最快达成 2048 用时（秒，0 表示尚未达成）。

const KEY = "doin.watermelon-2048.v1";
const MAX_LEVEL = 11;
const MAX_SCORE = 1_000_000_000;
const MAX_CHAIN = 9999;
const MAX_TIME = 99999;

function toInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function pickTime(next, candidate) {
  const t = toInt(candidate, 0, MAX_TIME);
  if (t <= 0) return next; // 本局未达成 2048 → 保留原纪录
  return next > 0 ? Math.min(next, t) : t;
}

export function defaults() {
  return {
    sound: true,
    endless: { best: 0, maxLevel: 0, maxChain: 0, bestTime: 0 },
    daily: { date: null, best: 0, maxLevel: 0, bestTime: 0 },
  };
}

let backend = null;
function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__wm2048_probe__", "1");
      localStorage.removeItem("__wm2048_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // 隐私模式或存储被禁用 → 内存降级
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
      maxLevel: toInt(e.maxLevel, 0, MAX_LEVEL),
      maxChain: toInt(e.maxChain, 0, MAX_CHAIN),
      bestTime: toInt(e.bestTime, 0, MAX_TIME),
    };
  }

  if (raw.daily && typeof raw.daily === "object" && !Array.isArray(raw.daily)) {
    const dd = raw.daily;
    out.daily = {
      date: isDateKey(dd.date) ? dd.date : null,
      best: toInt(dd.best, 0, MAX_SCORE),
      maxLevel: toInt(dd.maxLevel, 0, MAX_LEVEL),
      bestTime: toInt(dd.bestTime, 0, MAX_TIME),
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
    // 配额或写入异常：静默
  }
  return safe;
}

// 记录一局结果。result = { kind:"endless"|"daily", score, maxLevel, maxChain, time?, date? }
// 返回 { data, isNewBest }；纪录只增不减，每日跨日重置。
export function recordResult(data, result) {
  const next = normalize(data);
  const score = toInt(result?.score, 0, MAX_SCORE);
  const maxLevel = toInt(result?.maxLevel, 0, MAX_LEVEL);
  const maxChain = toInt(result?.maxChain, 0, MAX_CHAIN);
  const time = toInt(result?.time, 0, MAX_TIME);

  if (result?.kind === "daily") {
    const date = isDateKey(result.date) ? result.date : null;
    const prev = next.daily;
    if (date && prev.date === date) {
      const isNewBest = score > prev.best;
      next.daily = {
        date,
        best: Math.max(prev.best, score),
        maxLevel: Math.max(prev.maxLevel, maxLevel),
        bestTime: pickTime(prev.bestTime, time),
      };
      return { data: next, isNewBest };
    }
    // 新的一天（或首次）：重置当日纪录。
    next.daily = { date, best: score, maxLevel, bestTime: time };
    return { data: next, isNewBest: false };
  }

  // 默认按无尽处理。
  const prev = next.endless;
  const isNewBest = score > prev.best;
  next.endless = {
    best: Math.max(prev.best, score),
    maxLevel: Math.max(prev.maxLevel, maxLevel),
    maxChain: Math.max(prev.maxChain, maxChain),
    bestTime: pickTime(prev.bestTime, time),
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
