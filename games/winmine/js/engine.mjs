// 经典扫雷（WinMine 复刻）规则引擎：纯函数、零依赖，不触碰 DOM / storage / 计时器。
// 棋盘用扁平 Array 表示，索引 = row * cols + col。
// 延后布雷：createState 只建空盘，首次 reveal 时才布雷，保证首击格及 8 邻域无雷。
// 之后全程保留原版 WinMine 的规则（含可能出现的猜雷局面），不复刻 "无猜保证"。
// 所有状态转换不可变：操作无效果时原样返回传入的同一对象引用，
// 调用方用 === 即可判断"这一步没生效"，绝不抛错。

export const HIDDEN = 0;   // 未翻开、未标记
export const REVEALED = 1; // 已翻开
export const FLAG = 2;     // 已插旗
export const QUESTION = 3;  // 已打问号（原版右键循环的中间态）

export const STATUS_READY = "ready";
export const STATUS_PLAYING = "playing";
export const STATUS_WON = "won";
export const STATUS_LOST = "lost";

// 雷格自身的 adjacency 值。用 -1 而非 0，保证"adjacency === 0 才扩散"的
// 判断在遇到雷时都走保守分支。
export const MINE_ADJACENCY = -1;

export const MIN_ROWS = 9;
export const MAX_ROWS = 24;
export const MIN_COLS = 9;
export const MAX_COLS = 30;
export const MIN_MINES = 10;

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

// 确定性 PRNG：同一 seed 必得同一棋盘，存档重放与测试都依赖它。
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizeSeed(value) {
  const n = Number(value);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n) % 4294967296;
  return Math.floor(Math.random() * 4294967296);
}

// 雷数上限留出首击 3x3 安全区的空间，保证 placeMines 永远无需降级。
export function normalizeConfig(config = {}) {
  const rows = clampInt(config.rows, MIN_ROWS, MAX_ROWS, 9);
  const cols = clampInt(config.cols, MIN_COLS, MAX_COLS, 9);
  const cells = rows * cols;
  const maxMines = Math.max(MIN_MINES - 1, cells - 9);
  const defaultMines = clampInt(Math.round(cells * 0.15625), MIN_MINES, maxMines, 10);
  const mines = clampInt(config.mines, 1, maxMines, defaultMines);
  return { rows, cols, mines };
}

const neighborCache = new Map();

export function neighborTable(rows, cols) {
  const key = rows + "x" + cols;
  const cached = neighborCache.get(key);
  if (cached) return cached;
  const table = new Array(rows * cols);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const list = [];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const nr = row + dr;
          const nc = col + dc;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          list.push(nr * cols + nc);
        }
      }
      table[row * cols + col] = list;
    }
  }
  neighborCache.set(key, table);
  return table;
}

export function isValidIndex(state, index) {
  return Number.isInteger(index) && index >= 0 && index < state.rows * state.cols;
}

export function cellCount(state) {
  return state.rows * state.cols;
}

export function remainingMines(state) {
  return state.mines - state.flagCount;
}

export function isMine(state, index) {
  return isValidIndex(state, index) && state.mineField[index] === 1;
}

export function createState(config = {}) {
  const { rows, cols, mines } = normalizeConfig(config);
  const cells = rows * cols;
  return {
    rows,
    cols,
    mines,
    seed: normalizeSeed(config.seed),
    mineField: new Array(cells).fill(0),
    cellState: new Array(cells).fill(HIDDEN),
    adjacency: new Array(cells).fill(0),
    seeded: false,
    status: STATUS_READY,
    revealedCount: 0,
    flagCount: 0,
    explodedIndex: -1,
    firstIndex: -1,
    // 本次操作新揭开的格子，按 BFS 顺序，供 UI 做由近及远的展开动效。
    lastRevealed: [],
    stats: { reveals: 0, chords: 0, flagsPlaced: 0 },
  };
}

export function safeZone(state, index) {
  return [index].concat(neighborTable(state.rows, state.cols)[index]);
}

export function placeMines(state, safeIndex) {
  if (state.seeded) return state;
  if (!isValidIndex(state, safeIndex)) return state;

  const cells = state.rows * state.cols;
  const table = neighborTable(state.rows, state.cols);

  let forbidden = new Set(safeZone(state, safeIndex));
  let candidates = [];
  for (let i = 0; i < cells; i += 1) if (!forbidden.has(i)) candidates.push(i);

  let mines = state.mines;
  if (candidates.length < mines) {
    forbidden = new Set([safeIndex]);
    candidates = [];
    for (let i = 0; i < cells; i += 1) if (!forbidden.has(i)) candidates.push(i);
  }
  if (candidates.length < mines) mines = candidates.length;

  const rng = mulberry32(state.seed);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }

  const mineField = new Array(cells).fill(0);
  for (let i = 0; i < mines; i += 1) mineField[candidates[i]] = 1;

  const adjacency = new Array(cells).fill(0);
  for (let i = 0; i < cells; i += 1) {
    if (mineField[i] === 1) {
      adjacency[i] = MINE_ADJACENCY;
      continue;
    }
    let count = 0;
    for (const n of table[i]) if (mineField[n] === 1) count += 1;
    adjacency[i] = count;
  }

  return {
    ...state,
    mineField,
    adjacency,
    seeded: true,
    mines,
    firstIndex: safeIndex,
    status: STATUS_PLAYING,
  };
}

function lose(state, index) {
  return { ...state, status: STATUS_LOST, explodedIndex: index, lastRevealed: [] };
}

// 胜利时把剩余隐藏格自动插旗，remainingMines 归零，UI 无需特殊分支。
function settle(state) {
  const cells = state.rows * state.cols;
  if (state.revealedCount !== cells - state.mines) return state;
  const cellState = state.cellState.slice();
  let flagCount = state.flagCount;
  for (let i = 0; i < cells; i += 1) {
    if (cellState[i] === HIDDEN || cellState[i] === QUESTION) {
      cellState[i] = FLAG;
      flagCount += 1;
    }
  }
  return { ...state, cellState, flagCount, status: STATUS_WON };
}

function flood(state, starts) {
  const table = neighborTable(state.rows, state.cols);
  const cellState = state.cellState.slice();
  const order = [];
  const queue = [];

  for (const start of starts) {
    if (cellState[start] !== HIDDEN && cellState[start] !== QUESTION) continue;
    cellState[start] = REVEALED;
    order.push(start);
    queue.push(start);
  }

  let head = 0;
  while (head < queue.length) {
    const index = queue[head];
    head += 1;
    if (state.adjacency[index] !== 0) continue;
    for (const n of table[index]) {
      if (cellState[n] !== HIDDEN && cellState[n] !== QUESTION) continue;
      if (state.mineField[n] === 1) continue;
      cellState[n] = REVEALED;
      order.push(n);
      queue.push(n);
    }
  }

  if (order.length === 0) return state;
  return settle({
    ...state,
    cellState,
    revealedCount: state.revealedCount + order.length,
    lastRevealed: order,
  });
}

export function reveal(state, index) {
  if (state.status === STATUS_WON || state.status === STATUS_LOST) return state;
  if (!isValidIndex(state, index)) return state;
  if (state.cellState[index] === REVEALED || state.cellState[index] === FLAG) return state;

  let next = state;
  if (!next.seeded) {
    next = placeMines(next, index);
    if (next === state) return state;
  }
  if (next.mineField[index] === 1) return lose(next, index);

  const flooded = flood(next, [index]);
  if (flooded === next) return state;
  return { ...flooded, stats: { ...flooded.stats, reveals: flooded.stats.reveals + 1 } };
}

// 右键循环：隐藏 → 旗 → 问号 → 隐藏。旗才计入 flagCount，问号不计（对齐原版）。
export function mark(state, index) {
  if (state.status === STATUS_WON || state.status === STATUS_LOST) return state;
  if (!isValidIndex(state, index)) return state;

  const current = state.cellState[index];
  if (current === REVEALED) return state;

  const cellState = state.cellState.slice();
  let { flagCount } = state;
  let action;
  if (current === HIDDEN) {
    cellState[index] = FLAG;
    flagCount += 1;
    action = "flag";
  } else if (current === FLAG) {
    cellState[index] = QUESTION;
    flagCount -= 1;
    action = "question";
  } else {
    cellState[index] = HIDDEN;
    action = "unmark";
  }
  return {
    ...state,
    cellState,
    flagCount,
    lastRevealed: [],
    stats: { ...state.stats, flagsPlaced: state.stats.flagsPlaced + 1 },
    _action: action,
  };
}

// Chord：数字格的旗数已等于数字时，展开其余隐藏/问号邻居。旗标错就炸。
export function chord(state, index) {
  if (state.status !== STATUS_PLAYING) return state;
  if (!isValidIndex(state, index)) return state;
  if (state.cellState[index] !== REVEALED) return state;

  const count = state.adjacency[index];
  if (count <= 0) return state;

  const neighbors = neighborTable(state.rows, state.cols)[index];
  let flags = 0;
  for (const n of neighbors) if (state.cellState[n] === FLAG) flags += 1;
  if (flags !== count) return state;

  const targets = neighbors.filter(
    (n) => state.cellState[n] === HIDDEN || state.cellState[n] === QUESTION,
  );
  if (targets.length === 0) return state;
  for (const n of targets) if (state.mineField[n] === 1) return lose(state, n);

  const next = flood(state, targets);
  if (next === state) return state;
  return { ...next, stats: { ...next.stats, chords: next.stats.chords + 1 } };
}

// 统一意图入口。action 为 null 表示"这一步没生效"，引擎本身永不抛错。
export function applyIntent(state, intent) {
  if (!intent || !Number.isInteger(intent.index)) return { state, action: null };
  const index = intent.index;

  if (intent.type === "flag") {
    const next = mark(state, index);
    if (next === state) return { state, action: null };
    return { state: next, action: next._action };
  }

  if (intent.type === "reveal") {
    if (state.cellState[index] === REVEALED) {
      const next = chord(state, index);
      return next === state ? { state, action: null } : { state: next, action: "chord" };
    }
    const next = reveal(state, index);
    return next === state ? { state, action: null } : { state: next, action: "reveal" };
  }

  if (intent.type === "chord") {
    const next = chord(state, index);
    return next === state ? { state, action: null } : { state: next, action: "chord" };
  }

  return { state, action: null };
}