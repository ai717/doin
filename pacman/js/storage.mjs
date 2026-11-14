// storage.mjs —— 存档唯一口径 doin.pacman.v1：集中 try/catch，损坏自动 normalize 退回默认，静默降级内存

import { MAZES, SETPIECES } from "./mazes.mjs";
import { clampInt, SCORE_MAX, TIME_MS_MAX } from "./score.mjs";
// 速度档的合法取值以 engine 为唯一权威，存档只做归一化，不另抄一份清单
import { SPEED_TIERS, DEFAULT_SPEED_TIER } from "./engine.mjs";

export const KEY = "doin.pacman.v1";
export const VERSION = 1;

export const MAZE_COUNT = MAZES.length;
export const SETPIECE_IDS = SETPIECES.map((sp) => sp.id);
export const SPEED_TIER_IDS = SPEED_TIERS.map((t) => t.id);
export const DEFAULT_TIER = DEFAULT_SPEED_TIER;

export function defaults() {
  return {
    v: VERSION,
    muted: false,
    // AI 可读化：意图柔光环 / 幽灵眼睛指向真实 target / 底部节拍轨 / 巢内充能倒计时
    assist: { aiRead: true },
    prefs: { speedTier: DEFAULT_SPEED_TIER },
    last: { mode: "campaign", level: 1, setpiece: SETPIECE_IDS[0] },
    campaign: { unlocked: 1, levels: {} },
    arcade: { best: { score: 0, level: 0, dots: 0, ghosts: 0 } },
    setpieces: {},
    records: { highScore: 0, bestChain: 0, ghostsEaten: 0, runs: 0 },
  };
}

function num(raw, min, max, dflt = 0) {
  return clampInt(raw, min, max, dflt);
}

/** 关卡号必须严格落在 1..MAZE_COUNT；越界一慨无效（绝不静默钳成最后一关） */
function levelId(id) {
  const n = Number(id);
  return Number.isInteger(n) && n >= 1 && n <= MAZE_COUNT ? n : 0;
}

function normalizeLevels(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (let id = 1; id <= MAZE_COUNT; id += 1) {
    const rec = raw[id] ?? raw[String(id)];
    if (!rec || typeof rec !== "object") continue;
    const stars = num(rec.stars, 0, 3, 0);
    out[id] = {
      stars,
      cleared: rec.cleared === true || stars > 0,
      best: num(rec.best, 0, SCORE_MAX, 0),
      timeMs: num(rec.timeMs, 0, TIME_MS_MAX, 0),
      noDeath: rec.noDeath === true,
    };
  }
  return out;
}

function normalizeSetpieces(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of SETPIECE_IDS) {
    const rec = raw[id];
    if (!rec || typeof rec !== "object") continue;
    out[id] = {
      cleared: rec.cleared === true,
      best: num(rec.best, 0, SCORE_MAX, 0),
      timeMs: num(rec.timeMs, 0, TIME_MS_MAX, 0),
      tries: num(rec.tries, 0, 9999, 0),
    };
  }
  return out;
}

/** 任何输入都归一化成合法存档，绝不抛错 */
export function normalize(raw) {
  const src = raw && typeof raw !== "string" && typeof raw === "object" ? raw : {};
  const lastMode = ["campaign", "arcade", "setpiece"].includes(src.last?.mode) ? src.last.mode : "campaign";
  const spId = SETPIECE_IDS.includes(src.last?.setpiece) ? src.last.setpiece : SETPIECE_IDS[0];
  return {
    v: VERSION,
    muted: src.muted === true,
    // 只有显式写过 true 才算开；没写过（undefined）沿用默认全开，写过 false / 0 / 脏值一律按关
    assist: { aiRead: src.assist?.aiRead === undefined ? true : src.assist.aiRead === true },
    prefs: { speedTier: SPEED_TIER_IDS.includes(src.prefs?.speedTier) ? src.prefs.speedTier : DEFAULT_SPEED_TIER },
    last: {
      mode: lastMode,
      level: num(src.last?.level, 1, MAZE_COUNT, 1),
      setpiece: spId,
    },
    campaign: {
      unlocked: num(src.campaign?.unlocked, 1, MAZE_COUNT, 1),
      levels: normalizeLevels(src.campaign?.levels),
    },
    arcade: {
      best: {
        score: num(src.arcade?.best?.score, 0, SCORE_MAX, 0),
        level: num(src.arcade?.best?.level, 0, 999, 0),
        dots: num(src.arcade?.best?.dots, 0, SCORE_MAX, 0),
        ghosts: num(src.arcade?.best?.ghosts, 0, SCORE_MAX, 0),
      },
    },
    setpieces: normalizeSetpieces(src.setpieces),
    records: {
      highScore: num(src.records?.highScore, 0, SCORE_MAX, 0),
      bestChain: num(src.records?.bestChain, 0, 99, 0),
      ghostsEaten: num(src.records?.ghostsEaten, 0, SCORE_MAX, 0),
      runs: num(src.records?.runs, 0, 999999, 0),
    },
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
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(safe));
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

// ---------------------------------------------------------------- 战役

export function levelRecord(data, id) {
  const lv = levelId(id);
  const safe = normalize(data);
  if (!lv) return { stars: 0, cleared: false, best: 0, timeMs: 0, noDeath: false };
  return safe.campaign.levels[lv] ?? { stars: 0, cleared: false, best: 0, timeMs: 0, noDeath: false };
}

/** 记一次战役结果：星级与分数只在更优时覆盖，通关用时取最快的一档 */
export function recordLevel(data, id, { stars = 0, score = 0, timeMs = 0, cleared = false, noDeath = false } = {}) {
  const lv = levelId(id);
  if (!lv) return { data: normalize(data), improved: false };
  const s = num(stars, 0, 3, 0);
  const sc = num(score, 0, SCORE_MAX, 0);
  const t = num(timeMs, 0, TIME_MS_MAX, 0);
  const prev = levelRecord(data, lv);
  const improved = s > prev.stars || sc > prev.best;
  const snapshot = write(data, (safe) => {
    safe.campaign.levels[lv] = {
      stars: Math.max(prev.stars, s),
      cleared: prev.cleared || cleared === true,
      best: Math.max(prev.best, sc),
      timeMs: cleared && t ? Math.min(prev.timeMs || Infinity, t) : prev.timeMs,
      noDeath: prev.noDeath || noDeath === true,
    };
    if (cleared) safe.campaign.unlocked = Math.max(safe.campaign.unlocked, Math.min(lv + 1, MAZE_COUNT));
    safe.records.highScore = Math.max(safe.records.highScore, sc);
  });
  return { data: snapshot, improved };
}

export function isLevelUnlocked(data, id) {
  const lv = levelId(id);
  if (!lv) return false;
  if (lv === 1) return true;
  return levelRecord(data, lv - 1).cleared === true;
}

export function highestUnlocked(data) {
  const safe = normalize(data);
  let best = 1;
  for (let id = 1; id <= MAZE_COUNT; id += 1) {
    if (!isLevelUnlocked(safe, id)) break;
    best = id;
  }
  return best;
}

export function totalStars(data) {
  const safe = normalize(data);
  let sum = 0;
  for (let id = 1; id <= MAZE_COUNT; id += 1) sum += (safe.campaign.levels[id]?.stars ?? 0);
  return sum;
}

export function campaignCleared(data) {
  const safe = normalize(data);
  return safe.campaign.levels[MAZE_COUNT]?.cleared === true;
}

// ---------------------------------------------------------------- 街机无尽

export function arcadeBest(data) {
  return normalize(data).arcade.best;
}

export function recordArcade(data, { score = 0, level = 0, dots = 0, ghosts = 0 } = {}) {
  const sc = num(score, 0, SCORE_MAX, 0);
  return write(data, (safe) => {
    safe.arcade.best = {
      score: Math.max(safe.arcade.best.score, sc),
      level: Math.max(safe.arcade.best.level, num(level, 0, 999, 0)),
      dots: Math.max(safe.arcade.best.dots, num(dots, 0, SCORE_MAX, 0)),
      ghosts: Math.max(safe.arcade.best.ghosts, num(ghosts, 0, SCORE_MAX, 0)),
    };
    safe.records.highScore = Math.max(safe.records.highScore, sc);
  });
}

// ---------------------------------------------------------------- 残局

export function setpieceRecord(data, id) {
  const safe = normalize(data);
  return safe.setpieces[id] ?? { cleared: false, best: 0, timeMs: 0, tries: 0 };
}

export function recordSetpiece(data, id, { cleared = false, score = 0, timeMs = 0 } = {}) {
  if (!SETPIECE_IDS.includes(id)) return { data: normalize(data), improved: false };
  const prev = setpieceRecord(data, id);
  const sc = num(score, 0, SCORE_MAX, 0);
  const t = num(timeMs, 0, TIME_MS_MAX, 0);
  const snapshot = write(data, (safe) => {
    const cur = safe.setpieces[id] ?? { cleared: false, best: 0, timeMs: 0, tries: 0 };
    safe.setpieces[id] = {
      cleared: cur.cleared || cleared === true,
      best: Math.max(cur.best, sc),
      timeMs: cleared && t ? Math.min(cur.timeMs || Infinity, t) : cur.timeMs,
      tries: Math.min(9999, cur.tries + 1),
    };
    safe.records.highScore = Math.max(safe.records.highScore, sc);
  });
  return { data: snapshot, improved: sc > prev.best };
}

export function setpiecesCleared(data) {
  const safe = normalize(data);
  return SETPIECE_IDS.filter((id) => safe.setpieces[id]?.cleared).length;
}

// ---------------------------------------------------------------- 通用记录与偏好

export function recordRunStats(data, { chain = 0, ghostsEaten = 0 } = {}) {
  return write(data, (safe) => {
    safe.records.bestChain = Math.max(safe.records.bestChain, num(chain, 0, 99, 0));
    safe.records.ghostsEaten = safe.records.ghostsEaten + num(ghostsEaten, 0, SCORE_MAX, 0);
    safe.records.runs = Math.min(999999, safe.records.runs + 1);
  });
}

export function setMuted(data, muted) {
  return write(data, (safe) => {
    safe.muted = muted === true;
  });
}

export function setAssist(data, { aiRead } = {}) {
  return write(data, (safe) => {
    if (typeof aiRead === "boolean") safe.assist.aiRead = aiRead;
  });
}

export function setSpeedTier(data, tier) {
  return write(data, (safe) => {
    safe.prefs.speedTier = SPEED_TIER_IDS.includes(tier) ? tier : DEFAULT_SPEED_TIER;
  });
}

export function setLast(data, { mode, level, setpiece } = {}) {
  return write(data, (safe) => {
    if (["campaign", "arcade", "setpiece"].includes(mode)) safe.last.mode = mode;
    if (level !== undefined) safe.last.level = num(level, 1, MAZE_COUNT, safe.last.level);
    if (SETPIECE_IDS.includes(setpiece)) safe.last.setpiece = setpiece;
  });
}
