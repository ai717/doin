// storage.mjs — 跳一跳存档唯一口径 · Key: doin.jump-jump.v1
// localStorage 不可用或数据损坏时静默降级内存默认值，绝不白屏抛错。

const KEY = "doin.jump-jump.v1";

export const LEVEL_COUNT = 25;
const MAX_SCORE = 10_000_000;
const MAX_COMBO = 9999;
const MAX_DISTANCE = 100_000;
const MODES = ["odyssey", "endless", "sniper"];

function toInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function defaults() {
  return {
    v: 1,
    sound: true,
    mode: "odyssey",
    endless: { best: 0, bestCombo: 0, maxDistance: 0 },
    odyssey: { unlocked: 1, stars: {}, clears: 0 },
    sniper: { best: 0, rank: "" },
  };
}

let backend = null;
function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__jj_probe__", "1");
      localStorage.removeItem("__jj_probe__");
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

function normalizeStars(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const id = Math.round(Number(key));
    if (!Number.isFinite(id) || id < 1 || id > LEVEL_COUNT) continue;
    out[String(id)] = toInt(value, 0, 3);
  }
  return out;
}

export function normalize(raw) {
  const out = defaults();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;

  if (typeof raw.sound === "boolean") out.sound = raw.sound;
  if (typeof raw.mode === "string" && MODES.includes(raw.mode)) out.mode = raw.mode;

  if (raw.endless && typeof raw.endless === "object" && !Array.isArray(raw.endless)) {
    const e = raw.endless;
    out.endless = {
      best: toInt(e.best, 0, MAX_SCORE),
      bestCombo: toInt(e.bestCombo, 0, MAX_COMBO),
      maxDistance: toInt(e.maxDistance, 0, MAX_DISTANCE),
    };
  }

  if (raw.odyssey && typeof raw.odyssey === "object" && !Array.isArray(raw.odyssey)) {
    const o = raw.odyssey;
    out.odyssey = {
      unlocked: toInt(o.unlocked, 1, LEVEL_COUNT),
      stars: normalizeStars(o.stars),
      clears: toInt(o.clears, 0, MAX_SCORE),
    };
  }

  if (raw.sniper && typeof raw.sniper === "object" && !Array.isArray(raw.sniper)) {
    const s = raw.sniper;
    const rank = typeof s.rank === "string" ? s.rank.slice(0, 4) : "";
    out.sniper = { best: toInt(s.best, 0, MAX_SCORE), rank };
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

export function setSound(enabled) {
  const data = load();
  data.sound = !!enabled;
  return save(data);
}

export function setMode(mode) {
  const data = load();
  if (MODES.includes(mode)) data.mode = mode;
  return save(data);
}

/** 无尽模式结算：返回 { data, isNewBest } */
export function recordEndless(data, result) {
  const next = normalize(data);
  const score = toInt(result?.score, 0, MAX_SCORE);
  const combo = toInt(result?.bestCombo, 0, MAX_COMBO);
  const dist = toInt(result?.maxDistance, 0, MAX_DISTANCE);
  const isNewBest = score > next.endless.best;
  next.endless = {
    best: Math.max(next.endless.best, score),
    bestCombo: Math.max(next.endless.bestCombo, combo),
    maxDistance: Math.max(next.endless.maxDistance, dist),
  };
  return { data: next, isNewBest };
}

/** 旅途关卡结算：写入星级并解锁下一关 */
export function recordLevel(data, levelId, stars) {
  const next = normalize(data);
  const id = toInt(levelId, 1, LEVEL_COUNT);
  const s = toInt(stars, 0, 3);
  const prev = next.odyssey.stars[String(id)] ?? 0;
  const improved = s > prev;
  if (s > 0) {
    next.odyssey.stars[String(id)] = Math.max(prev, s);
    if (s > prev && prev === 0) next.odyssey.clears = toInt(next.odyssey.clears + 1, 0, MAX_SCORE);
    if (id >= next.odyssey.unlocked && id < LEVEL_COUNT) next.odyssey.unlocked = id + 1;
  }
  return { data: next, improved, best: next.odyssey.stars[String(id)] ?? 0 };
}

/** 靶心试炼结算 */
export function recordSniper(data, total, rank) {
  const next = normalize(data);
  const score = toInt(total, 0, MAX_SCORE);
  const isNewBest = score > next.sniper.best;
  next.sniper = {
    best: Math.max(next.sniper.best, score),
    rank: isNewBest || !next.sniper.rank ? String(rank ?? "").slice(0, 4) : next.sniper.rank,
  };
  return { data: next, isNewBest };
}

export function totalStars(data) {
  const safe = normalize(data);
  return Object.values(safe.odyssey.stars).reduce((sum, n) => sum + n, 0);
}

export function resetAll() {
  return save(defaults());
}
