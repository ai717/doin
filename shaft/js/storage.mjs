// storage.mjs — 是男人就下一百层存档唯一口径 · Key: doin.shaft.v1
// localStorage 不可用或数据损坏时静默降级内存，读取一律归一化，绝不白屏抛错。

import { LEVEL_COUNT, MODES } from "./levels.mjs";

const KEY = "doin.shaft.v1";
const MAX_DEPTH = 5000;
const MAX_TIME = 100000;
const MAX_SCORE = 10_000_000;

function toInt(value, min, max) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function toRatio(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_TIME, n));
}

export function defaults() {
  return {
    v: 1,
    sound: true,
    mode: "campaign",
    lastLevel: 1,
    campaign: { unlocked: 1, stars: {}, clears: 0, bestTime: 0 },
    classic: { clears: 0, bestTime: 0, bestDepth: 0, bestScore: 0 },
    endless: { bestDepth: 0, bestScore: 0 },
  };
}

let backend = null;
let memoryMap = new Map();

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("__shaft_probe__", "1");
      localStorage.removeItem("__shaft_probe__");
      backend = localStorage;
      return backend;
    }
  } catch {
    // 隐私模式或受限环境：静默降级内存
  }
  backend = {
    getItem: (k) => (memoryMap.has(k) ? memoryMap.get(k) : null),
    setItem: (k, v) => memoryMap.set(k, String(v)),
    removeItem: (k) => memoryMap.delete(k),
  };
  return backend;
}

function normalizeStars(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const id = Math.round(Number(key));
    if (!Number.isFinite(id) || id < 1 || id > LEVEL_COUNT) continue;
    const stars = toInt(value, 0, 3);
    if (stars > 0) out[String(id)] = stars;
  }
  return out;
}

export function normalize(raw) {
  const out = defaults();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;

  if (typeof raw.sound === "boolean") out.sound = raw.sound;
  if (typeof raw.mode === "string" && MODES.includes(raw.mode)) out.mode = raw.mode;

  if (raw.campaign && typeof raw.campaign === "object" && !Array.isArray(raw.campaign)) {
    const c = raw.campaign;
    out.campaign = {
      unlocked: toInt(c.unlocked, 1, LEVEL_COUNT),
      stars: normalizeStars(c.stars),
      clears: toInt(c.clears, 0, MAX_SCORE),
      bestTime: toRatio(c.bestTime),
    };
  }

  if (raw.classic && typeof raw.classic === "object" && !Array.isArray(raw.classic)) {
    const c = raw.classic;
    out.classic = {
      clears: toInt(c.clears, 0, MAX_SCORE),
      bestTime: toRatio(c.bestTime),
      bestDepth: toInt(c.bestDepth, 0, MAX_DEPTH),
      bestScore: toInt(c.bestScore, 0, MAX_SCORE),
    };
  }

  if (raw.endless && typeof raw.endless === "object" && !Array.isArray(raw.endless)) {
    const e = raw.endless;
    out.endless = {
      bestDepth: toInt(e.bestDepth, 0, MAX_DEPTH),
      bestScore: toInt(e.bestScore, 0, MAX_SCORE),
    };
  }

  out.lastLevel = toInt(raw.lastLevel, 1, out.campaign.unlocked);
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
    // 写入异常静默
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

export function setLastLevel(level) {
  const data = load();
  data.lastLevel = toInt(level, 1, data.campaign.unlocked);
  return save(data);
}

/** 关卡结算：写入星级、最快用时并解锁下一关。 */
export function recordCampaign(data, levelId, result = {}) {
  const next = normalize(data);
  const id = toInt(levelId, 1, LEVEL_COUNT);
  const stars = toInt(result.stars, 0, 3);
  const elapsed = toRatio(result.elapsed);
  const prev = next.campaign.stars[String(id)] ?? 0;
  const improved = stars > prev;

  if (stars > 0 && result.won) {
    next.campaign.stars[String(id)] = Math.max(prev, stars);
    if (prev === 0) next.campaign.clears = toInt(next.campaign.clears + 1, 0, MAX_SCORE);
    if (id >= next.campaign.unlocked && id < LEVEL_COUNT) next.campaign.unlocked = id + 1;
    if (elapsed > 0 && (next.campaign.bestTime <= 0 || elapsed < next.campaign.bestTime)) {
      next.campaign.bestTime = elapsed;
    }
  }
  return { data: next, improved, best: next.campaign.stars[String(id)] ?? 0 };
}

/** 经典百层结算：通关次数、最速用时、最深深度与最高分。 */
export function recordClassic(data, result = {}) {
  const next = normalize(data);
  const won = !!result.won;
  const elapsed = toRatio(result.elapsed);
  const depth = toInt(result.floors, 0, MAX_DEPTH);
  const score = toInt(result.score, 0, MAX_SCORE);
  const isNewBest = score > next.classic.bestScore || depth > next.classic.bestDepth;
  if (won) {
    next.classic.clears = toInt(next.classic.clears + 1, 0, MAX_SCORE);
    if (elapsed > 0 && (next.classic.bestTime <= 0 || elapsed < next.classic.bestTime)) {
      next.classic.bestTime = elapsed;
    }
  }
  next.classic.bestDepth = Math.max(next.classic.bestDepth, depth);
  next.classic.bestScore = Math.max(next.classic.bestScore, score);
  return { data: next, isNewBest };
}

/** 无尽深渊结算：最深深度与最高分。 */
export function recordEndless(data, result = {}) {
  const next = normalize(data);
  const depth = toInt(result.floors, 0, MAX_DEPTH);
  const score = toInt(result.score, 0, MAX_SCORE);
  const isNewBest = depth > next.endless.bestDepth;
  next.endless.bestDepth = Math.max(next.endless.bestDepth, depth);
  next.endless.bestScore = Math.max(next.endless.bestScore, score);
  return { data: next, isNewBest };
}

export function totalStars(data) {
  const safe = normalize(data);
  return Object.values(safe.campaign.stars).reduce((sum, n) => sum + n, 0);
}

export function resetAll() {
  return save(defaults());
}

/** 测试专用：清空内存后端，避免跨用例数据泄漏。 */
export function resetBackendForTests() {
  memoryMap = new Map();
  backend = null;
}
