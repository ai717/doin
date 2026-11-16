// storage.mjs —— 存档唯一口径 doin.lantern-maze.v1：集中 try/catch，损坏自动 normalize 退回默认，静默降级内存

import { LEVEL_COUNT, LEVELS_PER_WATCH, levelById } from "./levels.mjs";
import { clampInt, SCORE_MAX } from "./score.mjs";

export const KEY = "doin.lantern-maze.v1";
export const VERSION = 1;
export const MAX_LANES = 24;
export const TALLY_MAX = LEVEL_COUNT * 3;
/** 破晓冲刺余量上限 900 秒：足够容纳任何"剩余更漏"口径 */
export const LEFT_MS_MAX = 900000;

export function defaults() {
  return {
    v: VERSION,
    muted: false,
    last: 1,
    assist: { fog: true },
    levels: {},
    timed: { best: { chain: 0, score: 0, leftMs: 0 } },
    survival: { best: { rounds: 0, score: 0 } },
    records: { highScore: 0, longestTrain: 0, ghostsEaten: 0 },
    lanes: [],
  };
}

function normalizeLevels(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const rec = raw[id] ?? raw[String(id)];
    if (!rec || typeof rec !== "object") continue;
    const stars = clampInt(rec.stars, 0, 3, 0);
    const cleared = rec.cleared === true || stars > 0;
    out[id] = {
      stars,
      cleared,
      best: clampInt(rec.best, 0, SCORE_MAX, 0),
      timeMs: clampInt(rec.timeMs, 0, 3600000, 0),
      noDeath: rec.noDeath === true,
    };
  }
  return out;
}

function clampBest(raw, ranges) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const [k, [min, max]] of Object.entries(ranges)) out[k] = clampInt(src[k], min, max, 0);
  return out;
}

function normalizeTimed(raw) {
  return { best: clampBest(raw?.best, { chain: [0, 999], score: [0, SCORE_MAX], leftMs: [0, LEFT_MS_MAX] }) };
}

function normalizeSurvival(raw) {
  return { best: clampBest(raw?.best, { rounds: [0, 999], score: [0, SCORE_MAX] }) };
}

function normalizeLanes(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const lane of raw) {
    if (!lane || typeof lane !== "object") continue;
    const code = typeof lane.code === "string" ? lane.code.trim() : "";
    if (!code || code.length > 4096) continue;
    out.push({
      code,
      name: typeof lane.name === "string" ? lane.name.slice(0, 24) : "",
      dots: clampInt(lane.dots, 0, 9999, 0),
      best: {
        score: clampInt(lane.best?.score, 0, SCORE_MAX, 0),
        eaten: clampInt(lane.best?.eaten, 0, 9999, 0),
        timeMs: clampInt(lane.best?.timeMs, 0, 3600000, 0),
        cleared: lane.best?.cleared === true,
      },
    });
    if (out.length >= MAX_LANES) break;
  }
  return out;
}

/** 任何输入都归一化成合法存档，绝不抛错 */
export function normalize(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    v: VERSION,
    muted: src.muted === true,
    last: clampInt(src.last, 1, LEVEL_COUNT, 1),
    assist: { fog: src.assist?.fog !== false },
    levels: normalizeLevels(src.levels),
    timed: normalizeTimed(src.timed),
    survival: normalizeSurvival(src.survival),
    records: {
      highScore: clampInt(src.records?.highScore, 0, SCORE_MAX, 0),
      longestTrain: clampInt(src.records?.longestTrain, 0, 99, 0),
      ghostsEaten: clampInt(src.records?.ghostsEaten, 0, SCORE_MAX, 0),
    },
    lanes: normalizeLanes(src.lanes),
  };
}

function readRaw() {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function load() {
  const raw = readRaw();
  if (!raw) return defaults();
  try {
    return normalize(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

export function save(data) {
  const safe = normalize(data);
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify(safe));
    }
  } catch {
    // 配额或隐私模式：静默降级为内存存档
  }
  return safe;
}

export function clear() {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(KEY);
  } catch {
    // 静默
  }
  return defaults();
}

function write(data, mutator) {
  const safe = normalize(data);
  mutator(safe);
  return save(safe);
}

// ---------------------------------------------------------------- 主线更签

export function levelRecord(data, id) {
  const safe = normalize(data);
  return safe.levels[id] ?? { stars: 0, cleared: false, best: 0, timeMs: 0, noDeath: false };
}

/** 记一次主线结果：星级与分数只在更优时覆盖，通关用时取最快的一档 */
export function recordLevel(data, id, { stars = 0, score = 0, timeMs = 0, cleared = false, noDeath = false } = {}) {
  const lvl = levelById(id);
  if (!lvl) return { data: normalize(data), improved: false };
  const s = clampInt(stars, 0, 3, 0);
  const sc = clampInt(score, 0, SCORE_MAX, 0);
  const t = clampInt(timeMs, 0, 3600000, 0);
  const prev = levelRecord(data, id);
  const improved = s > prev.stars || sc > prev.best;
  const safe = write(data, (draft) => {
    draft.levels[id] = {
      stars: Math.max(prev.stars, s),
      cleared: prev.cleared || cleared === true,
      best: Math.max(prev.best, sc),
      timeMs: cleared && t ? Math.min(prev.timeMs || Infinity, t) : prev.timeMs,
      noDeath: prev.noDeath || noDeath === true,
    };
    draft.records.highScore = Math.max(draft.records.highScore, sc);
    draft.last = clampInt(Math.max(draft.last, cleared ? Math.min(id + 1, LEVEL_COUNT) : id), 1, LEVEL_COUNT, 1);
  });
  return { data: safe, improved };
}

export function isLevelUnlocked(data, id) {
  const lvl = levelById(id);
  if (!lvl) return false;
  if (id === 1) return true;
  return levelRecord(data, id - 1).cleared === true;
}

export function highestUnlocked(data) {
  const safe = normalize(data);
  let best = 1;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    if (isLevelUnlocked(safe, id)) best = id;
    else break;
  }
  return best;
}

export function watchStars(data, watch) {
  const safe = normalize(data);
  let sum = 0;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    if (Math.ceil(id / LEVELS_PER_WATCH) === watch) sum += levelRecord(safe, id).stars;
  }
  return sum;
}

export function totalStars(data) {
  const safe = normalize(data);
  let sum = 0;
  for (let id = 1; id <= LEVEL_COUNT; id += 1) sum += levelRecord(safe, id).stars;
  return sum;
}

/** 第 w 更是否整更打通 */
export function watchCleared(data, w) {
  const safe = normalize(data);
  const from = (w - 1) * LEVELS_PER_WATCH + 1;
  const to = Math.min(LEVEL_COUNT, from + LEVELS_PER_WATCH - 1);
  if (from > LEVEL_COUNT) return false;
  for (let id = from; id <= to; id += 1) {
    if (!levelRecord(safe, id).cleared) return false;
  }
  return true;
}

/** 模式解锁口径：破晓冲刺需打通三更，百鬼夜巷需打通五更 */
export function modeUnlocked(data, mode) {
  const safe = normalize(data);
  if (mode === "timed") return watchCleared(safe, 3);
  if (mode === "survival") return watchCleared(safe, 5);
  return true;
}

// ---------------------------------------------------------------- 限时与生存

export function recordTimed(data, { chain = 0, score = 0, leftMs = 0 } = {}) {
  return write(data, (safe) => {
    safe.timed.best = {
      chain: Math.max(safe.timed.best.chain, clampInt(chain, 0, 999, 0)),
      score: Math.max(safe.timed.best.score, clampInt(score, 0, SCORE_MAX, 0)),
      leftMs: Math.max(safe.timed.best.leftMs, clampInt(leftMs, 0, LEFT_MS_MAX, 0)),
    };
    safe.records.highScore = Math.max(safe.records.highScore, clampInt(score, 0, SCORE_MAX, 0));
  });
}

export function recordSurvival(data, { rounds = 0, score = 0, longestTrain = 0, ghostsEaten = 0 } = {}) {
  return write(data, (safe) => {
    safe.survival.best = {
      rounds: Math.max(safe.survival.best.rounds, clampInt(rounds, 0, 999, 0)),
      score: Math.max(safe.survival.best.score, clampInt(score, 0, SCORE_MAX, 0)),
    };
    safe.records.highScore = Math.max(safe.records.highScore, clampInt(score, 0, SCORE_MAX, 0));
    safe.records.longestTrain = Math.max(safe.records.longestTrain, clampInt(longestTrain, 0, 99, 0));
    safe.records.ghostsEaten = Math.max(safe.records.ghostsEaten, clampInt(ghostsEaten, 0, SCORE_MAX, 0));
  });
}

// ---------------------------------------------------------------- 擂台簿（自家巷码成绩）

export function laneEntry(data, code) {
  const safe = normalize(data);
  return safe.lanes.find((l) => l.code === code) ?? null;
}

/** 保存/更新一条巷码及其本机最佳成绩；同码去重并提到最前 */
export function saveLane(data, { code, name = "", dots = 0, score = 0, eaten = 0, timeMs = 0, cleared = false } = {}) {
  if (typeof code !== "string" || !code.trim()) return { data: normalize(data), saved: false };
  const clean = code.trim().slice(0, 4096);
  const snapshot = write(data, (safe) => {
    const prev = safe.lanes.find((l) => l.code === clean);
    const entry = {
      code: clean,
      name: (name || prev?.name || "").slice(0, 24),
      dots: clampInt(dots || prev?.dots, 0, 9999, 0),
      best: {
        score: Math.max(prev?.best?.score ?? 0, clampInt(score, 0, SCORE_MAX, 0)),
        eaten: Math.max(prev?.best?.eaten ?? 0, clampInt(eaten, 0, 9999, 0)),
        timeMs: prev?.best?.timeMs && timeMs ? Math.min(prev.best.timeMs, timeMs) : clampInt(timeMs || prev?.best?.timeMs, 0, 3600000, 0),
        cleared: (prev?.best?.cleared ?? false) || cleared === true,
      },
    };
    safe.lanes = [entry, ...safe.lanes.filter((l) => l.code !== clean)].slice(0, MAX_LANES);
  });
  return { data: snapshot, saved: true };
}

/** 从擂台簿里删掉一条巷码 */
export function dropLane(data, code) {
  const had = normalize(data).lanes.some((l) => l.code === code);
  const snapshot = write(data, (safe) => {
    safe.lanes = safe.lanes.filter((l) => l.code !== code);
  });
  return { data: snapshot, dropped: had };
}

// ---------------------------------------------------------------- 偏好

export function setMuted(data, muted) {
  return write(data, (safe) => {
    safe.muted = muted === true;
  });
}

export function setLast(data, id) {
  return write(data, (safe) => {
    safe.last = clampInt(id, 1, LEVEL_COUNT, safe.last);
  });
}

export function setAssist(data, { fog } = {}) {
  return write(data, (safe) => {
    if (typeof fog === "boolean") safe.assist.fog = fog;
  });
}
