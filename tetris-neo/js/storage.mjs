// 存档唯一口径：key doin.tetris-neo.v1，localStorage 不可用时静默降级内存。
// 结构 { version, prefs:{muted,difficulty,board}, best:{<slot>:score}, runs:{<slot>:对局快照} }，
// slot = "<board>_<difficulty>"，每个难度/尺寸组合各自记最高分与未竟对局。
// 读到的任何值都过白名单与数值夹取，坏值回默认，绝不把异常抛给 UI。

export const STORAGE_KEY = "doin.tetris-neo.v1";
export const SCHEMA_VERSION = 1;

export const DIFFICULTIES = Object.freeze(["casual", "normal", "master"]);
export const BOARDS = Object.freeze(["mini", "standard", "wide"]);
export const DEFAULT_DIFFICULTY = "normal";
export const DEFAULT_BOARD = "standard";

export function normalizeDifficulty(value) {
  return DIFFICULTIES.includes(value) ? value : DEFAULT_DIFFICULTY;
}

export function normalizeBoard(value) {
  return BOARDS.includes(value) ? value : DEFAULT_BOARD;
}

export function slot(board, difficulty) {
  return `${normalizeBoard(board)}_${normalizeDifficulty(difficulty)}`;
}

export function defaultState() {
  return {
    version: SCHEMA_VERSION,
    prefs: { muted: false, difficulty: DEFAULT_DIFFICULTY, board: DEFAULT_BOARD },
    best: {},
    runs: {},
  };
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
      const probe = "__doin_tetris_neo__";
      localStorage.setItem(probe, "1");
      localStorage.removeItem(probe);
      backend = localStorage;
      return backend;
    }
  } catch (error) {
    // 隐私模式或存储被禁用
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

function isMatrix(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === "number" || typeof cell === "string"))
  );
}

// 对局快照只做形状校验：棋盘是矩阵、当前方块有矩阵与整数坐标。不合法就当没有存档。
function normalizeRun(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (!isMatrix(raw.grid)) return null;
  const piece = raw.piece;
  if (!piece || typeof piece !== "object" || !isMatrix(piece.matrix)) return null;
  if (!piece.pos || typeof piece.pos !== "object") return null;
  if (!Number.isFinite(Number(piece.pos.x)) || !Number.isFinite(Number(piece.pos.y))) return null;
  return raw;
}

function normalizeSlots(raw, guard) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw)) {
    const next = guard(value);
    if (next !== null && next !== undefined) out[key] = next;
  }
  return out;
}

export function normalize(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;
  const prefs = raw.prefs && typeof raw.prefs === "object" ? raw.prefs : {};
  return {
    version: SCHEMA_VERSION,
    prefs: {
      muted: bool(prefs.muted),
      difficulty: normalizeDifficulty(prefs.difficulty),
      board: normalizeBoard(prefs.board),
    },
    best: normalizeSlots(raw.best, (value) => int(value)),
    runs: normalizeSlots(raw.runs, normalizeRun),
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

function patch(mutate) {
  const next = load();
  mutate(next);
  return save(next);
}

export function readMuted() {
  return load().prefs.muted;
}

export function writeMuted(muted) {
  return patch((state) => {
    state.prefs.muted = bool(muted);
  }).prefs.muted;
}

export function readDifficulty() {
  return load().prefs.difficulty;
}

export function writeDifficulty(difficulty) {
  return patch((state) => {
    state.prefs.difficulty = normalizeDifficulty(difficulty);
  }).prefs.difficulty;
}

export function readBoard() {
  return load().prefs.board;
}

export function writeBoard(board) {
  return patch((state) => {
    state.prefs.board = normalizeBoard(board);
  }).prefs.board;
}

export function readBest(board, difficulty) {
  return load().best[slot(board, difficulty)] ?? 0;
}

// 最高分只增不减，返回写入后的值供 UI 直接显示。
export function recordBest(board, difficulty, score) {
  const key = slot(board, difficulty);
  const value = int(score);
  const state = patch((next) => {
    next.best[key] = Math.max(next.best[key] ?? 0, value);
  });
  return state.best[key] ?? 0;
}

export function readRun(board, difficulty) {
  return load().runs[slot(board, difficulty)] ?? null;
}

export function writeRun(board, difficulty, run) {
  const key = slot(board, difficulty);
  const snapshot = normalizeRun(run);
  patch((state) => {
    if (snapshot) state.runs[key] = snapshot;
    else delete state.runs[key];
  });
  return snapshot;
}

export function clearRun(board, difficulty) {
  const key = slot(board, difficulty);
  patch((state) => {
    delete state.runs[key];
  });
}

export function resetAll() {
  try {
    storage().removeItem(STORAGE_KEY);
  } catch (error) {
    // 忽略
  }
  return defaultState();
}
