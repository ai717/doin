// 连连看核心规则层（纯函数 / 数据化，DOM-free，可被 Node 单测直接 import）
//
// 可解性口径（诚实声明）：
//   本模块不对「存在完整消除序列」做全局回溯穷举 —— 逻辑盘 12×10 的状态空间不可行。
//   全局可解性由三层不变量共同保证：
//     1. 成对不变量：每种图案计数恒为偶数（生成与洗牌都不破坏）；
//     2. 可用性不变量：开局与每次成功消除后立即扫描全盘，若不存在任何一对
//        「图案相同且 ≤2 折可连」的块，就自动洗牌（不消耗玩家主动次数），
//        上限 50 次；玩家因此永远不会面对无棋可下的死盘；
//     3. 洗牌等价性：洗牌只置换剩余块的位置，不改变图案计数，外圈恒空。
//   这与经典 QQ 连连看的成熟口径一致。

import { MOTIF_COUNT } from "./motifs.mjs";
import { clearScore, clampScore, endBonus, starsFor } from "./score.mjs";

export { MOTIF_COUNT };

/** 逻辑盘行数（8 实心行 + 上下各 1 圈外通道） */
export const ROWS = 10;
/** 逻辑盘列数（10 实心列 + 左右各 1 圈外通道） */
export const COLS = 12;
/** 实心区行数 */
export const SOLID_ROWS = 8;
/** 实心区列数 */
export const SOLID_COLS = 10;
/** 主线关卡总数 */
export const LEVEL_COUNT = 36;
/** 连击时间窗（毫秒） */
export const COMBO_WINDOW_MS = 3000;
/** 自动兜底洗牌次数上限 */
export const AUTO_SHUFFLE_LIMIT = 50;
/** 生成期重排次数上限 */
export const GENERATE_ATTEMPTS = 200;

const CHAPTER_KINDS = [6, 8, 10];
const CHAPTER_TILES = [56, 64, 72];
const CHAPTER_SECONDS = [2.2, 2.02, 1.87];
const CHAPTER_NAMES = [
  { zh: "灯市初开", en: "Lantern Market" },
  { zh: "长街深巷", en: "Deep Alleys" },
  { zh: "满城琉璃", en: "Glass City" }
];

const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

/* ------------------------------------------------------------------ 随机 */

/** FNV-1a 32 位字符串散列。 */
export function hashSeed(str) {
  const text = String(str ?? "");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 —— 可注入种子的确定性 PRNG。 */
export function makeRng(seed) {
  let a = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 关卡固定种子。 */
export function levelSeed(level) {
  return hashSeed("pair-link:" + clampLevel(level));
}

/** Fisher-Yates 原地洗牌（依赖注入的 rng，保证可复现）。 */
export function shuffleArray(list, rng) {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

/* ------------------------------------------------------------ 关卡参数 */

export function clampLevel(level) {
  const n = Number.isFinite(level) ? Math.floor(level) : 1;
  return Math.max(1, Math.min(LEVEL_COUNT, n));
}

/**
 * 关卡参数公式（唯一权威，禁止在别处手写 36 行常量）：
 *   chapter = ceil(L / 12)，k = L - 12·(chapter - 1)，step = floor((k - 1) / 4)
 *   kinds = [6, 8, 10][chapter - 1] + step
 *   tiles = 56 + 8·(chapter - 1) + 4·step          （恒为偶数，≤ 80）
 *   timeMs = ceil(tiles × [2.20, 2.02, 1.87][chapter - 1]) × 1000
 */
export function levelParams(level) {
  const L = clampLevel(level);
  const chapter = Math.ceil(L / 12);
  const k = L - 12 * (chapter - 1);
  const step = Math.floor((k - 1) / 4);
  const kinds = CHAPTER_KINDS[chapter - 1] + step;
  const tiles = CHAPTER_TILES[chapter - 1] + 4 * step;
  const seconds = CHAPTER_SECONDS[chapter - 1];
  return {
    level: L,
    chapter,
    step,
    kinds,
    tiles,
    timeMs: Math.ceil(tiles * seconds) * 1000,
    hints: 3,
    shuffles: 2,
    chapterName: CHAPTER_NAMES[chapter - 1]
  };
}

/** 章名（中/英）。 */
export function chapterName(level) {
  return levelParams(level).chapterName;
}

/* ------------------------------------------------------------ 盘面工具 */

export function isSolidCell(r, c) {
  return r >= 1 && r <= SOLID_ROWS && c >= 1 && c <= SOLID_COLS;
}

function isPerimeterSolid(r, c) {
  return isSolidCell(r, c) && (r === 1 || r === SOLID_ROWS || c === 1 || c === SOLID_COLS);
}

export function emptyBoard() {
  const board = [];
  for (let r = 0; r < ROWS; r += 1) {
    const row = [];
    for (let c = 0; c < COLS; c += 1) row.push(0);
    board.push(row);
  }
  return board;
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function solidCells() {
  const cells = [];
  for (let r = 1; r <= SOLID_ROWS; r += 1) {
    for (let c = 1; c <= SOLID_COLS; c += 1) cells.push({ r, c });
  }
  return cells;
}

export function inBounds(cell) {
  return Boolean(cell) && cell.r >= 0 && cell.r < ROWS && cell.c >= 0 && cell.c < COLS;
}

function isFree(board, r, c) {
  return r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c] === 0;
}

/** 每种图案的剩余计数（索引 1..12 有效）。 */
export function motifCounts(board) {
  const counts = new Array(MOTIF_COUNT + 1).fill(0);
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const v = board[r][c];
      if (v > 0 && v <= MOTIF_COUNT) counts[v] += 1;
    }
  }
  return counts;
}

/** 实心区是否已清空。 */
export function isBoardCleared(board) {
  for (let r = 1; r <= SOLID_ROWS; r += 1) {
    for (let c = 1; c <= SOLID_COLS; c += 1) {
      if (board[r][c] !== 0) return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------ 三线连通 */

/** p→q 之间（不含端点）是否全空；p、q 必须同行或同列。 */
export function straightClear(board, p, q) {
  if (!inBounds(p) || !inBounds(q)) return false;
  if (p.r === q.r) {
    const lo = Math.min(p.c, q.c);
    const hi = Math.max(p.c, q.c);
    for (let c = lo + 1; c < hi; c += 1) if (board[p.r][c] !== 0) return false;
    return true;
  }
  if (p.c === q.c) {
    const lo = Math.min(p.r, q.r);
    const hi = Math.max(p.r, q.r);
    for (let r = lo + 1; r < hi; r += 1) if (board[r][p.c] !== 0) return false;
    return true;
  }
  return false;
}

/** 从 cell 向四个方向直线可直达的全部空格（含外圈通道）。 */
function reachable(board, cell) {
  const out = [];
  for (let d = 0; d < DIRS.length; d += 1) {
    const dr = DIRS[d][0];
    const dc = DIRS[d][1];
    let r = cell.r + dr;
    let c = cell.c + dc;
    while (isFree(board, r, c)) {
      out.push({ r, c });
      r += dr;
      c += dc;
    }
  }
  return out;
}

function pathKey(cells) {
  let cornerSum = 0;
  for (let i = 1; i < cells.length - 1; i += 1) cornerSum += cells[i].r * COLS + cells[i].c;
  let lex = "";
  for (let i = 0; i < cells.length; i += 1) {
    lex += String(cells[i].r).padStart(2, "0") + String(cells[i].c).padStart(2, "0");
  }
  return [cells.length, cornerSum, lex];
}

function betterKey(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  if (a[2] < b[2]) return -1;
  if (a[2] > b[2]) return 1;
  return 0;
}

/**
 * 三线连通判定：返回 { cells, folds } 或 null。
 *   cells 为折线节点序列（首 = a，末 = b，中间为拐点，一律取格中心）；
 *   folds ∈ {0, 1, 2} 为拐点数。
 * 返回结果确定：0 折 → 1 折 → 2 折依次尝试，2 折取排序后第一条
 * （段数最短 → 拐点行列和最小 → 字典序稳定比较）。
 */
export function findLinkPath(board, a, b) {
  if (!inBounds(a) || !inBounds(b)) return null;
  if (a.r === b.r && a.c === b.c) return null;
  const va = board[a.r][a.c];
  const vb = board[b.r][b.c];
  if (va === 0 || vb === 0 || va !== vb) return null;

  const start = { r: a.r, c: a.c };
  const end = { r: b.r, c: b.c };

  // 0 折：直连
  if ((start.r === end.r || start.c === end.c) && straightClear(board, start, end)) {
    return { cells: [start, end], folds: 0 };
  }

  // 1 折：候选拐点仅 (a.r, b.c) 与 (b.r, a.c)
  const corners = [
    { r: start.r, c: end.c },
    { r: end.r, c: start.c }
  ];
  for (let i = 0; i < corners.length; i += 1) {
    const corner = corners[i];
    if (corner.r === start.r && corner.c === start.c) continue;
    if (corner.r === end.r && corner.c === end.c) continue;
    if (!isFree(board, corner.r, corner.c)) continue;
    if (straightClear(board, start, corner) && straightClear(board, corner, end)) {
      return { cells: [start, corner, end], folds: 1 };
    }
  }

  // 2 折
  const near = reachable(board, start);
  const far = reachable(board, end);
  if (near.length === 0 || far.length === 0) return null;

  const farSet = new Set(far.map((p) => p.r * COLS + p.c));
  let best = null;

  for (let i = 0; i < near.length; i += 1) {
    const p = near[i];
    for (let c = 0; c < COLS; c += 1) {
      if (c === p.c) continue;
      if (!farSet.has(p.r * COLS + c)) continue;
      const q = { r: p.r, c };
      if (!straightClear(board, p, q)) continue;
      const cells = [start, p, q, end];
      const key = pathKey(cells);
      if (best === null || betterKey(key, best.key) < 0) best = { cells, key };
    }
    for (let r = 0; r < ROWS; r += 1) {
      if (r === p.r) continue;
      if (!farSet.has(r * COLS + p.c)) continue;
      const q = { r, c: p.c };
      if (!straightClear(board, p, q)) continue;
      const cells = [start, p, q, end];
      const key = pathKey(cells);
      if (best === null || betterKey(key, best.key) < 0) best = { cells, key };
    }
  }

  if (best) return { cells: best.cells, folds: 2 };
  return null;
}

/** 扫描全盘，返回第一对可消的块（Map 插入序，确定性）。 */
export function findAnyPair(board) {
  const groups = new Map();
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const v = board[r][c];
      if (v === 0) continue;
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push({ r, c });
    }
  }
  const keys = [...groups.keys()].sort((x, y) => x - y);
  for (let k = 0; k < keys.length; k += 1) {
    const list = groups.get(keys[k]);
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (findLinkPath(board, list[i], list[j])) return [list[i], list[j]];
      }
    }
  }
  return null;
}

/** 是否至少存在一对可消。 */
export function hasAnyPair(board) {
  return findAnyPair(board) !== null;
}

/** 提示：返回第一对可消（与 findAnyPair 同一扫描序）。 */
export function findHint(board) {
  return findAnyPair(board);
}

/* ------------------------------------------------------------ 生成 / 洗牌 */

/**
 * 按 N 块、S 种分配偶数计数：base 取偶数，余量按 2 为单位分给随机子集，
 * 保证「每种计数为偶数、互差 ≤ 2、且 ≥ 2」。
 */
export function allocateCounts(tiles, kinds, rng) {
  const base = Math.floor(tiles / kinds / 2) * 2;
  const counts = new Array(kinds).fill(base);
  let rest = tiles - base * kinds;
  const order = shuffleArray(
    Array.from({ length: kinds }, (_, i) => i),
    rng
  );
  let cursor = 0;
  while (rest >= 2) {
    counts[order[cursor % kinds]] += 2;
    rest -= 2;
    cursor += 1;
  }
  return counts;
}

function orderCells(cells, rng, chapter) {
  const shuffled = shuffleArray(cells.slice(), rng);
  if (chapter < 2) return shuffled;
  // 第 2 章起「外圈优先」：先铺满实心区边界，内部留洞，形成「被围住」的观感。
  const perimeter = shuffled.filter((cell) => isPerimeterSolid(cell.r, cell.c));
  const interior = shuffled.filter((cell) => !isPerimeterSolid(cell.r, cell.c));
  return perimeter.concat(interior);
}

/** 生成一局盘面；未通过可解性校验时用同一 PRNG 流重排（最多 200 次）。 */
export function generateBoard(params, rng) {
  let board = emptyBoard();
  for (let attempt = 0; attempt < GENERATE_ATTEMPTS; attempt += 1) {
    const next = emptyBoard();
    const counts = allocateCounts(params.tiles, params.kinds, rng);
    const pool = [];
    for (let id = 1; id <= params.kinds; id += 1) {
      for (let n = 0; n < counts[id - 1]; n += 1) pool.push(id);
    }
    const cells = orderCells(solidCells(), rng, params.chapter);
    shuffleArray(pool, rng);
    const limit = Math.min(pool.length, cells.length);
    for (let i = 0; i < limit; i += 1) {
      const cell = cells[i];
      next[cell.r][cell.c] = pool[i];
    }
    board = next;
    if (hasAnyPair(board)) return board;
  }
  return board;
}

/** 生成一关：{ board, params, rng }。 */
export function createLevel(level, rng) {
  const params = levelParams(level);
  const random = typeof rng === "function" ? rng : makeRng(levelSeed(params.level));
  return { board: generateBoard(params, random), params, rng: random };
}

/** 只置换剩余块的位置：图案计数不变，外圈恒空。 */
export function shuffleBoard(board, rng) {
  const next = cloneBoard(board);
  const cells = [];
  const values = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (next[r][c] !== 0) {
        cells.push({ r, c });
        values.push(next[r][c]);
      }
    }
  }
  shuffleArray(values, rng);
  for (let i = 0; i < cells.length; i += 1) {
    next[cells[i].r][cells[i].c] = values[i];
  }
  return next;
}

/**
 * 死局化解：反复洗牌直到存在可消对或达到上限。
 * 返回 { board, shuffles, solvable }。
 */
export function resolveDeadlock(board, rng, limit = AUTO_SHUFFLE_LIMIT) {
  let next = board;
  let shuffles = 0;
  const cap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : AUTO_SHUFFLE_LIMIT;
  while (!hasAnyPair(next) && shuffles < cap) {
    next = shuffleBoard(next, rng);
    shuffles += 1;
  }
  return { board: next, shuffles, solvable: hasAnyPair(next) };
}

/* ------------------------------------------------------------ 状态机 */

function baseState(level, mode, rng) {
  const params = levelParams(level);
  const { board } = createLevel(params.level, rng);
  return {
    mode,
    phase: "ready",
    level: params.level,
    params,
    board,
    selected: null,
    score: 0,
    combo: 0,
    comboPeak: 0,
    comboTimerMs: 0,
    hintsLeft: params.hints,
    shufflesLeft: params.shuffles,
    activeShuffles: 0,
    autoShuffles: 0,
    remainingMs: params.timeMs,
    clearedPairs: 0,
    hintPair: null,
    hintTimerMs: 0,
    stars: 0,
    finalBonus: 0,
    clearedBoards: 0,
    chainMult: 1,
    replays: 0,
    lastEvent: null,
    failReason: null,
    rng
  };
}

/** 新建一局。mode: "level" | "endless"。 */
export function createState(level = 1, options = {}) {
  const mode = options.mode === "endless" ? "endless" : "level";
  const startLevel = mode === "endless" ? 1 : clampLevel(level);
  const seed = Number.isFinite(options.seed) ? options.seed : levelSeed(startLevel);
  return baseState(startLevel, mode, makeRng(seed));
}

/** 重玩当前关卡（换一副新盘面，进度与难度不变）。无尽模式则重开一轮。 */
export function restartLevel(state) {
  const replays = (state.replays || 0) + 1;
  const level = state.mode === "endless" ? 1 : state.level;
  const seed = hashSeed("pair-link:replay:" + level + ":" + replays);
  const next = baseState(level, state.mode, makeRng(seed));
  next.replays = replays;
  return next;
}

/** 从 ready / paused 进入 playing。 */
export function startGame(state) {
  if (state.phase === "playing") return state;
  if (state.phase === "won" || state.phase === "lost") return state;
  return { ...state, phase: "playing" };
}

export function pauseGame(state) {
  if (state.phase !== "playing") return state;
  return { ...state, phase: "paused" };
}

export function resumeGame(state) {
  if (state.phase !== "paused") return state;
  return { ...state, phase: "playing" };
}

function noop(state) {
  return { action: null, state };
}

/** 终局判定：'playing' | 'won' | 'lost'。 */
export function levelOutcome(state) {
  if (!state) return "playing";
  return state.phase === "won" || state.phase === "lost" ? state.phase : "playing";
}

/** 点选一格。返回 { action, state }；非法或非 playing 一律安全 no-op。 */
export function applyPick(state, cell) {
  if (!state || state.phase !== "playing") return noop(state);
  if (!inBounds(cell)) return noop(state);

  const picked = { r: cell.r, c: cell.c };
  const value = state.board[picked.r][picked.c];

  if (value === 0) {
    if (!state.selected) return noop(state);
    return {
      action: { type: "deselect" },
      state: { ...state, selected: null, hintPair: null, hintTimerMs: 0, lastEvent: "deselect" }
    };
  }

  if (!state.selected) {
    return {
      action: { type: "select", cell: picked },
      state: { ...state, selected: picked, hintPair: null, hintTimerMs: 0, lastEvent: "select" }
    };
  }

  const first = state.selected;
  if (first.r === picked.r && first.c === picked.c) {
    return {
      action: { type: "deselect" },
      state: { ...state, selected: null, lastEvent: "deselect" }
    };
  }

  const path = findLinkPath(state.board, first, picked);

  if (!path) {
    if (state.board[first.r][first.c] === value) {
      // 图案相同但不可连通：保留第一枚选中态（试探友好），第二枚抖动。
      return {
        action: { type: "invalid", cell: picked },
        state: { ...state, lastEvent: "invalid" }
      };
    }
    // 图案不同：改选第二枚。
    return {
      action: { type: "reselect", cell: picked },
      state: { ...state, selected: picked, hintPair: null, hintTimerMs: 0, lastEvent: "reselect" }
    };
  }

  return commitClear(state, path);
}

function commitClear(state, path) {
  const board = cloneBoard(state.board);
  const first = path.cells[0];
  const last = path.cells[path.cells.length - 1];
  board[first.r][first.c] = 0;
  board[last.r][last.c] = 0;

  const combo = state.comboTimerMs > 0 ? state.combo + 1 : 0;
  const gain = clearScore({ folds: path.folds, combo, chainMult: state.chainMult });

  let next = {
    ...state,
    board,
    selected: null,
    hintPair: null,
    hintTimerMs: 0,
    score: clampScore(state.score + gain),
    combo,
    comboPeak: Math.max(state.comboPeak, combo),
    comboTimerMs: COMBO_WINDOW_MS,
    clearedPairs: state.clearedPairs + 1,
    lastEvent: "clear"
  };

  if (!isBoardCleared(board)) {
    const resolved = resolveDeadlock(board, state.rng);
    next = {
      ...next,
      board: resolved.board,
      autoShuffles: state.autoShuffles + resolved.shuffles
    };
    if (!resolved.solvable) {
      next = {
        ...next,
        phase: "lost",
        failReason: "deadlock",
        stars: 0,
        combo: 0,
        comboTimerMs: 0,
        lastEvent: "deadlock"
      };
    }
    return {
      action: {
        type: "clear",
        cells: path.cells,
        folds: path.folds,
        combo,
        gain,
        autoShuffles: resolved.shuffles
      },
      state: next
    };
  }

  if (state.mode === "endless") {
    const advanced = advanceEndless(next);
    return {
      action: { type: "clear", cells: path.cells, folds: path.folds, combo, gain, boardCleared: true },
      state: advanced
    };
  }

  const bonus = endBonus({
    remainingMs: next.remainingMs,
    hintsLeft: next.hintsLeft,
    shufflesLeft: next.shufflesLeft
  });
  const total = clampScore(next.score + bonus);
  const stars = starsFor({
    remainingMs: next.remainingMs,
    timeMs: next.params.timeMs,
    activeShuffles: next.activeShuffles,
    comboPeak: next.comboPeak
  });

  return {
    action: { type: "clear", cells: path.cells, folds: path.folds, combo, gain, boardCleared: true },
    state: {
      ...next,
      phase: "won",
      score: total,
      finalBonus: bonus,
      stars,
      comboTimerMs: 0,
      lastEvent: "win"
    }
  };
}

function advanceEndless(state) {
  const cleared = state.clearedBoards + 1;
  const timeBonus = Math.floor(state.remainingMs / 1000) * 10;
  const chainMult = Math.min(4, 1 + 0.25 * cleared);
  const nextLevel = Math.min(LEVEL_COUNT, cleared + 1);
  const fresh = baseState(nextLevel, "endless", state.rng);
  return {
    ...fresh,
    phase: "playing",
    score: clampScore(state.score + timeBonus),
    comboPeak: state.comboPeak,
    clearedBoards: cleared,
    chainMult,
    replays: state.replays,
    autoShuffles: state.autoShuffles,
    activeShuffles: 0,
    lastEvent: "boardCleared"
  };
}

/** 推进计时与连击窗口。非 playing 状态一律 no-op。 */
export function tick(state, dtMs) {
  if (!state || state.phase !== "playing") return state;
  const dt = Number.isFinite(dtMs) ? Math.max(0, dtMs) : 0;
  if (dt === 0) return state;

  const comboTimerMs = Math.max(0, state.comboTimerMs - dt);
  const hintTimerMs = Math.max(0, state.hintTimerMs - dt);
  const remainingMs = Math.max(0, state.remainingMs - dt);

  let next = {
    ...state,
    comboTimerMs,
    hintTimerMs,
    remainingMs,
    combo: comboTimerMs === 0 ? 0 : state.combo,
    hintPair: hintTimerMs === 0 ? null : state.hintPair
  };

  if (remainingMs === 0) {
    next = { ...next, phase: "lost", failReason: "timeout", stars: 0, lastEvent: "timeout" };
  }
  return next;
}

/** 使用提示。返回 { action, state }。 */
export function useHint(state) {
  if (!state || state.phase !== "playing") return noop(state);
  if (state.hintsLeft <= 0) return noop(state);

  let board = state.board;
  let autoShuffles = 0;
  let pair = findHint(board);
  if (!pair) {
    const resolved = resolveDeadlock(board, state.rng);
    board = resolved.board;
    autoShuffles = resolved.shuffles;
    pair = findHint(board);
    if (!pair) {
      return {
        action: null,
        state: { ...state, board, autoShuffles: state.autoShuffles + autoShuffles, phase: "lost", failReason: "deadlock", stars: 0 }
      };
    }
  }

  return {
    action: { type: "hint", pair },
    state: {
      ...state,
      board,
      autoShuffles: state.autoShuffles + autoShuffles,
      hintsLeft: state.hintsLeft - 1,
      hintPair: pair,
      hintTimerMs: 1500,
      selected: null,
      lastEvent: "hint"
    }
  };
}

/** 主动洗牌。返回 { action, state }。 */
export function useShuffle(state) {
  if (!state || state.phase !== "playing") return noop(state);
  if (state.shufflesLeft <= 0) return noop(state);

  const shuffled = shuffleBoard(state.board, state.rng);
  const resolved = resolveDeadlock(shuffled, state.rng);

  return {
    action: { type: "shuffle" },
    state: {
      ...state,
      board: resolved.board,
      shufflesLeft: state.shufflesLeft - 1,
      activeShuffles: state.activeShuffles + 1,
      autoShuffles: state.autoShuffles + resolved.shuffles,
      selected: null,
      hintPair: null,
      hintTimerMs: 0,
      lastEvent: "shuffle",
      ...(resolved.solvable ? {} : { phase: "lost", failReason: "deadlock", stars: 0 })
    }
  };
}

/* ------------------------------------------- 计分口径再导出（唯一权威在 score.mjs） */

export { clearScore, clampScore, endBonus, starsFor } from "./score.mjs";
