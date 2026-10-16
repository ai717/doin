// storage.mjs — 存档唯一口径：key doin.backpack.v1
// 结构 { version, prefs:{muted}, progress:{ rank, wins, expeditions, stars:{}, mirror:{rounds,damage}, unlocked:{} } }
// localStorage 不可用（隐私模式 / 存储被禁）时静默降级内存，读到的任何坏值都退回默认。

import { PUZZLES } from "./data.mjs";
import { clampRank, clampStars, mirrorBest } from "./score.mjs";

export const STORAGE_KEY = "doin.backpack.v1";
export const SCHEMA_VERSION = 1;

const VALID_PUZZLE_IDS = new Set(PUZZLES.map((p) => p.id));
const CLASS_IDS = ["berserker", "ranger", "pyromancer"];

export function defaultProgress() {
  return {
    rank: 0,
    wins: 0,
    expeditions: 0,
    stars: {},
    mirror: { rounds: 0, damage: 0 },
    unlocked: { berserker: true, ranger: false, pyromancer: false },
  };
}

export function defaultState() {
  return { version: SCHEMA_VERSION, prefs: { muted: false }, progress: defaultProgress() };
}

function createMemoryFallback() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__doin_bp__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
    // 隐私模式或存储被禁用 → 内存兜底
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

function int(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

function bool(value) {
  return value === true || value === "true" || value === 1;
}

// 任何字段缺失、被手改坏、或引用了不存在的关卡 id，都静默丢弃，绝不把异常抛给 UI。
export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const progress = raw.progress && typeof raw.progress === "object" ? raw.progress : {};
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const rawStars = progress.stars && typeof progress.stars === "object" ? progress.stars : {};
  const stars = {};
  for (const [id, value] of Object.entries(rawStars)) {
    if (!VALID_PUZZLE_IDS.has(id)) continue;
    const s = clampStars(value);
    if (s > 0) stars[id] = s;
  }
  const mirror = mirrorBest(progress.mirror);
  const unlocked = {};
  for (const cls of CLASS_IDS) {
    unlocked[cls] = cls === "berserker" ? true : bool(progress.unlocked?.[cls]);
  }
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: bool(prefs.muted) },
    progress: {
      rank: clampRank(progress.rank),
      wins: int(progress.wins),
      expeditions: int(progress.expeditions),
      stars,
      mirror,
      unlocked,
    },
  };
}

export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return defaultState();
  }
}

export function save(state) {
  const next = normalize(state);
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // 写失败不影响本局游戏
  }
  return next;
}

// 段位 + 远征累计
export function recordExpedition(state, { rank, wins, expeditions }) {
  const next = normalize(state);
  next.progress.rank = Math.max(next.progress.rank, clampRank(rank));
  next.progress.wins += int(wins);
  next.progress.expeditions += int(expeditions);
  // 解锁曲线：游侠 1 胜、火法 3 胜
  next.progress.unlocked.ranger = next.progress.unlocked.ranger || next.progress.wins >= 1;
  next.progress.unlocked.pyromancer = next.progress.unlocked.pyromancer || next.progress.wins >= 3;
  return next;
}

// 残局三星只增不减
export function recordPuzzle(state, { puzzleId, stars }) {
  const next = normalize(state);
  if (!VALID_PUZZLE_IDS.has(puzzleId)) return { state: next, improved: false };
  const best = clampStars(stars);
  const before = next.progress.stars[puzzleId] ?? 0;
  if (best > before) next.progress.stars[puzzleId] = best;
  return { state: next, improved: best > before };
}

export function recordMirror(state, { rounds, damage }) {
  const next = normalize(state);
  const best = mirrorBest(next.progress.mirror);
  const isRecord = int(rounds) > best.rounds || int(damage) > best.damage;
  next.progress.mirror = {
    rounds: Math.max(best.rounds, int(rounds)),
    damage: Math.max(best.damage, int(damage)),
  };
  return { state: next, isRecord };
}

export function setMuted(state, muted) {
  const next = normalize(state);
  next.prefs.muted = Boolean(muted);
  return next;
}

export function resetAll() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch (error) {
    // 忽略
  }
  return defaultState();
}

// ---------------- 远征快照（"继续上次远征"） ----------------
// 独立 key，与全局进度分开；结构与控制器 run 状态对应，读入时由控制器再校验。
export const RUN_KEY = "doin.backpack.run.v1";

export function saveRun(run) {
  try {
    storage().setItem(RUN_KEY, JSON.stringify(run));
  } catch (error) {
    // 写失败不影响本局
  }
}

export function loadRun() {
  try {
    const raw = storage().getItem(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.mode !== "expedition") return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

export function clearRun() {
  try {
    storage().removeItem(RUN_KEY);
  } catch (error) {
    // 忽略
  }
}
