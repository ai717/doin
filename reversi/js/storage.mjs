// 存档唯一口径：偏好 / 对弈战绩 / 残局星级 / 冲刺最高分。
// localStorage 在隐私模式或被禁用时会抛异常，一律集中 try/catch 降级到内存，绝不白屏。
// 读取必须 normalize：任何字段缺失、类型不对或越界，都退回默认值而不是崩掉。
//
// 说明：首版不持久化"对局进行中"的盘面（PRD §3.5 只要求战绩 / 残局进度 / 最高分），
// 归一化会忽略未知字段，日后补 session 不需要迁移。

import { BLACK, WHITE } from "./engine.mjs";
import { TIER_KEYS, TIER_DUELIST } from "./ai.mjs";
import { PUZZLE_STARS_MAX, mergePuzzleResult } from "./score.mjs";

export const STORAGE_KEY = "doin.reversi.v1";
export const SCHEMA_VERSION = 1;

export const MODES = { PLAY: "play", PUZZLE: "puzzle", RUSH: "rush" };
export const MODE_KEYS = [MODES.PLAY, MODES.PUZZLE, MODES.RUSH];

// 五种经典开局（PRD §3.5 模式 A）。"random" 由 rng.mjs 的种子 PRNG 抽前两手。
export const OPENINGS = ["standard", "diagonal", "perpendicular", "parallel", "random"];
export const DEFAULT_OPENING = "standard";

export const DEFAULT_TIER = TIER_DUELIST; // 首访默认"棋手"档：休闲玩家的合理起点
export const DEFAULT_SIDE = BLACK;

// 题库 id 契约：p + 章号(01-06) + 题号(01-10)，与 tools/gen-puzzles.mjs 的产出一致。
// 归一化时按此精确校验：既拒掉伪造的 key，也不会把 p0199 这种"长得像"的脏数据留下。
const PUZZLE_ID_PATTERN = /^p0[1-6](0[1-9]|10)$/;

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: {
      mode: MODES.PLAY,
      tier: DEFAULT_TIER,
      side: DEFAULT_SIDE,
      opening: DEFAULT_OPENING,
      blitz: false,
      classic: false, // 经典口径（空位不计），仅本地双人可选
      muted: false,
      showMobility: true,
    },
    records: {
      vs: emptyVersus(),
      highlights: { maxFlip: 0, bestSwing: 0 },
      puzzle: {},
      rush: { bestScore: 0, bestCombo: 0 },
    },
  };
}

function emptyVersus() {
  const vs = {};
  for (const tier of TIER_KEYS) vs[tier] = { w: 0, d: 0, l: 0 };
  return vs;
}

function createMemoryFallback() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

let backend;

function storage() {
  if (backend) return backend;
  try {
    if (typeof localStorage !== "undefined") {
      const probe = "__doin_reversi__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (e) {
    // 隐私模式 / 存储受限：静默降级内存
  }
  backend = createMemoryFallback();
  return backend;
}

export function resetBackendForTests() {
  backend = undefined;
}

// ─── 归一化工具 ───────────────────────────────────────────────────
function int(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

function bool(value) {
  return Boolean(value);
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function pickSide(value) {
  return value === WHITE ? WHITE : value === BLACK ? BLACK : DEFAULT_SIDE;
}

export function isPuzzleId(value) {
  return typeof value === "string" && PUZZLE_ID_PATTERN.test(value);
}

function normalizeVersus(raw) {
  const vs = emptyVersus();
  if (!raw || typeof raw !== "object") return vs;
  for (const tier of TIER_KEYS) {
    const src = raw[tier];
    if (!src || typeof src !== "object") continue;
    vs[tier] = { w: int(src.w), d: int(src.d), l: int(src.l) };
  }
  return vs;
}

function normalizeHighlights(raw) {
  if (!raw || typeof raw !== "object") return { maxFlip: 0, bestSwing: 0 };
  return { maxFlip: int(raw.maxFlip), bestSwing: int(raw.bestSwing) };
}

function normalizePuzzle(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, value] of Object.entries(raw)) {
    if (!isPuzzleId(id) || !value || typeof value !== "object") continue;
    out[id] = {
      stars: Math.min(PUZZLE_STARS_MAX, int(value.stars)),
      hadWrongRetry: bool(value.hadWrongRetry),
      firstMoveOptimal: bool(value.firstMoveOptimal),
    };
  }
  return out;
}

function normalizeRush(raw) {
  if (!raw || typeof raw !== "object") return { bestScore: 0, bestCombo: 0 };
  return { bestScore: int(raw.bestScore), bestCombo: int(raw.bestCombo) };
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  const records = raw.records && typeof raw.records === "object" ? raw.records : {};
  return {
    version: SCHEMA_VERSION,
    prefs: {
      mode: oneOf(prefs.mode, MODE_KEYS, MODES.PLAY),
      tier: oneOf(prefs.tier, TIER_KEYS, DEFAULT_TIER),
      side: pickSide(prefs.side),
      opening: oneOf(prefs.opening, OPENINGS, DEFAULT_OPENING),
      blitz: bool(prefs.blitz),
      classic: bool(prefs.classic),
      muted: bool(prefs.muted),
      showMobility: prefs.showMobility === undefined ? true : bool(prefs.showMobility),
    },
    records: {
      vs: normalizeVersus(records.vs),
      highlights: normalizeHighlights(records.highlights),
      puzzle: normalizePuzzle(records.puzzle),
      rush: normalizeRush(records.rush),
    },
  };
}

// ─── 读写 ─────────────────────────────────────────────────────────
export function load() {
  try {
    const raw = storage().getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalize(JSON.parse(raw));
  } catch (e) {
    return defaultState();
  }
}

export function save(state) {
  try {
    storage().setItem(STORAGE_KEY, JSON.stringify(normalize(state)));
    return true;
  } catch (e) {
    return false;
  }
}

// ─── 局部更新（一律返回新的归一化状态，严禁 UI 就地改字段）─────────
export function patchPrefs(state, patch) {
  const current = normalize(state);
  return normalize({ ...current, prefs: { ...current.prefs, ...(patch ?? {}) } });
}

export function applyOutcome(state, outcome, tier) {
  const current = normalize(state);
  const key = TIER_KEYS.includes(tier) ? tier : DEFAULT_TIER;
  const bucket = { ...current.records.vs[key] };
  if (outcome === "win") bucket.w += 1;
  else if (outcome === "draw") bucket.d += 1;
  else if (outcome === "loss") bucket.l += 1;
  return {
    ...current,
    records: {
      ...current.records,
      vs: { ...current.records.vs, [key]: bucket },
    },
  };
}

export function applyHighlights(state, highlights) {
  const current = normalize(state);
  const prev = current.records.highlights;
  return {
    ...current,
    records: {
      ...current.records,
      highlights: {
        maxFlip: Math.max(prev.maxFlip, int(highlights?.maxFlip)),
        bestSwing: Math.max(prev.bestSwing, int(highlights?.bestSwing)),
      },
    },
  };
}

export function applyPuzzleResult(state, id, result) {
  const current = normalize(state);
  if (!isPuzzleId(id)) return current;
  const prev = current.records.puzzle[id];
  // 星级合并规则（只升不降 / 同级保留更干净的一次）由计分口径唯一提供，此处不再重复实现。
  const merged = mergePuzzleResult(prev, result);
  return {
    ...current,
    records: {
      ...current.records,
      puzzle: { ...current.records.puzzle, [id]: merged },
    },
  };
}

export function applyRushResult(state, result) {
  const current = normalize(state);
  const rush = current.records.rush;
  return {
    ...current,
    records: {
      ...current.records,
      rush: {
        bestScore: Math.max(rush.bestScore, int(result?.score)),
        bestCombo: Math.max(rush.bestCombo, int(result?.combo)),
      },
    },
  };
}

// 清空全部战绩与进度，偏好（档位 / 执子 / 开局 / 静音）原样保留。
export function clearRecords(state) {
  const current = normalize(state);
  return { ...current, records: defaultState().records };
}
