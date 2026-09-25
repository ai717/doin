// filepath: games/jigsaw/js/engine.mjs
// 纯规则层：碎片网格、交换、锁定、重排、胜利判定。不依赖 DOM / Canvas / 本地存储。
//
// 三条铁律（docs/GAME-SPEC.md §3）：
//   1. 合法交换必执行；拖已锁定块 / 同格交换 / 终止态操作一律返回 action: null，绝不抛错。
//   2. 状态不可变：所有函数返回新 state，原 state 永不被修改。
//   3. 不碰 DOM 与浏览器存储 —— 本模块必须能被 node:test 直接 import。
//
// 状态约定（与 PRD §3.1 一致）：
//   state.grid[r][c] = 放在 (r,c) 上的碎片"原本属于"哪一格 —— 即碎片身份。
//   state.grid[r][c] 等于 {r,c} 本身 ⇒ 该格已放对。
//   不变式：放对的格必然已锁定，未放对的格必然未锁定（applyMove / shuffle 都维持它）。

export const MIN_SIZE = 3;
export const MAX_SIZE = 5;

/** 确定性 PRNG：同一 seed 必得同一序列（艺术图、洗牌、测试复现） */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a：把任意字符串稳定映射成 32 位无符号整数（关卡 seed、每日选题） */
export function hashString(text) {
  let h = 2166136261;
  const value = String(text);
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function isSize(n) {
  return Number.isInteger(n) && n >= MIN_SIZE && n <= MAX_SIZE;
}

function sizeOf(levelOrSize) {
  if (isSize(levelOrSize)) return levelOrSize;
  if (levelOrSize && isSize(levelOrSize.n)) return levelOrSize.n;
  return 0;
}

export function inBounds(state, cell) {
  if (!state || !cell) return false;
  return (
    Number.isInteger(cell.r) &&
    Number.isInteger(cell.c) &&
    cell.r >= 0 &&
    cell.c >= 0 &&
    cell.r < state.n &&
    cell.c < state.n
  );
}

export function sameCell(a, b) {
  return !!a && !!b && a.r === b.r && a.c === b.c;
}

/** 该格现在放着的碎片的身份（它原本属于哪一格）；越界返回 null */
export function pieceAt(state, r, c) {
  const row = state && state.grid ? state.grid[r] : null;
  const cell = row ? row[c] : null;
  return cell ? { r: cell.r, c: cell.c } : null;
}

/** 该格是否已经放对 */
export function isPlaced(state, r, c) {
  const row = state && state.grid ? state.grid[r] : null;
  const cell = row ? row[c] : null;
  return !!cell && cell.r === r && cell.c === c;
}

export function isLocked(state, r, c) {
  const row = state && state.locked ? state.locked[r] : null;
  return !!row && row[c] === true;
}

export function cloneState(state) {
  return {
    n: state.n,
    grid: state.grid.map((row) => row.map((cell) => ({ r: cell.r, c: cell.c }))),
    locked: state.locked.map((row) => row.slice()),
    moves: state.moves,
  };
}

/** Fisher-Yates，rng 注入以保证可复现 */
export function shuffled(list, rng) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * 把 values 排到 cells 上，保证没有任何一块落在自己的原格（无不动点）。
 * 先随机洗牌，再逐个修复"洗回原位"的位置：与某个既不撞 cells[i] 也不被 cells[j] 撞的位置交换。
 * cells.length >= 2 时该位置必然存在，所以修复一定收敛（不会死循环）。
 */
function derange(cells, values, rng) {
  const order = shuffled(values, rng);
  const k = cells.length;
  for (let i = 0; i < k; i++) {
    if (!sameCell(order[i], cells[i])) continue;
    for (let j = 0; j < k; j++) {
      if (j === i) continue;
      if (sameCell(order[j], cells[i])) continue;
      if (sameCell(order[i], cells[j])) continue;
      const tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
      break;
    }
  }
  return order;
}

/**
 * 建立初始局面：n×n 网格，碎片全部打乱且没有任何一块已在原位。
 * @param {number} n 网格边长 3..5
 * @param {number|string|Function} seed 种子，或直接传一个 rng 函数
 * @param {Function} [rng] 可注入的随机源（测试用固定种子）
 */
export function createState(n, seed, rng) {
  const size = isSize(n) ? n : MIN_SIZE;
  const random =
    typeof rng === "function"
      ? rng
      : typeof seed === "function"
        ? seed
        : mulberry32(hashString(seed === undefined || seed === null ? "jigsaw" : seed));

  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) cells.push({ r, c });
  }
  const order = derange(cells, cells, random);

  const grid = [];
  const locked = [];
  for (let r = 0; r < size; r++) {
    grid.push(order.slice(r * size, r * size + size).map((cell) => ({ r: cell.r, c: cell.c })));
    locked.push(new Array(size).fill(false));
  }
  return { n: size, grid, locked, moves: 0 };
}

/**
 * 执行一次交换。合法则完整执行并返回新状态；非法返回原状态 + action: null（安全 no-op）。
 * 交换后任一格若已放对，则当场锁定（locked 里返回本次新锁定的格，供 UI 播放锁定反馈）。
 */
export function applyMove(state, swap) {
  const idle = { state, action: null, reason: null, locked: [] };
  if (!state || !swap) return idle;
  const from = swap.from;
  const to = swap.to;
  if (!inBounds(state, from) || !inBounds(state, to)) return idle;
  if (sameCell(from, to)) return { ...idle, reason: "same" };
  if (isLocked(state, from.r, from.c) || isLocked(state, to.r, to.c)) {
    return { ...idle, reason: "locked" };
  }

  const next = cloneState(state);
  const carried = next.grid[from.r][from.c];
  next.grid[from.r][from.c] = next.grid[to.r][to.c];
  next.grid[to.r][to.c] = carried;
  next.moves = state.moves + 1;

  const lockedNow = [];
  for (const cell of [from, to]) {
    if (!next.locked[cell.r][cell.c] && isPlaced(next, cell.r, cell.c)) {
      next.locked[cell.r][cell.c] = true;
      lockedNow.push({ r: cell.r, c: cell.c });
    }
  }
  return { state: next, action: "swap", reason: null, locked: lockedNow };
}

/** 所有未锁定的格（也就是还能动的碎片所在处） */
export function unlockedCells(state) {
  const cells = [];
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      if (!state.locked[r][c]) cells.push({ r, c });
    }
  }
  return cells;
}

/**
 * 重排：把所有未锁定碎片重新打乱。
 * 不改变锁定集合，也不会把任何碎片放到自己的原位（避免"重排直接拼好一块"的怪事）。
 * 未锁定格少于 2 个时返回 action: null（调用方不应消耗重排次数）。
 */
export function shuffle(state, rng) {
  if (!state) return { state, action: null };
  const cells = unlockedCells(state);
  if (cells.length < 2) return { state, action: null };

  const random = typeof rng === "function" ? rng : mulberry32(hashString("jigsaw-shuffle"));
  const values = cells.map((cell) => state.grid[cell.r][cell.c]);
  const order = derange(cells, values, random);

  const next = cloneState(state);
  cells.forEach((cell, index) => {
    next.grid[cell.r][cell.c] = { r: order[index].r, c: order[index].c };
  });
  return { state: next, action: "shuffle" };
}

/** 胜利判定：所有格都已放对。这是唯一终止态。 */
export function isSolved(state) {
  if (!state) return false;
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      if (!isPlaced(state, r, c)) return false;
    }
  }
  return true;
}

export function placedCount(state) {
  let count = 0;
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      if (isPlaced(state, r, c)) count++;
    }
  }
  return count;
}

/** 还有没有可执行的交换（未锁定格 ≥ 2 就有） */
export function anyLegalMove(state) {
  return !!state && unlockedCells(state).length >= 2;
}

/** 存档快照：order[i] = 第 i 格上碎片的原始格序号；locked 同序展开 */
export function snapshot(state) {
  const order = [];
  const locked = [];
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      const cell = state.grid[r][c];
      order.push(cell.r * state.n + cell.c);
      locked.push(state.locked[r][c] === true);
    }
  }
  return { n: state.n, moves: state.moves, order, locked };
}

/** 快照结构校验：必须是合法排列，且"放对 ⇔ 已锁定" */
export function validateSnapshot(levelOrSize, snap) {
  const size = sizeOf(levelOrSize);
  if (!size) return false;
  if (!snap || typeof snap !== "object" || snap.n !== size) return false;
  const total = size * size;
  if (!Array.isArray(snap.order) || snap.order.length !== total) return false;
  if (!Array.isArray(snap.locked) || snap.locked.length !== total) return false;

  const seen = new Set();
  for (const value of snap.order) {
    if (!Number.isInteger(value) || value < 0 || value >= total) return false;
    if (seen.has(value)) return false;
    seen.add(value);
  }
  for (let i = 0; i < total; i++) {
    if ((snap.order[i] === i) !== (snap.locked[i] === true)) return false;
  }
  return true;
}

/** 由快照还原；结构非法或已经拼完（不该出现在存档里）时回退到该关初始局面 */
export function restore(levelOrSize, snap) {
  const size = sizeOf(levelOrSize);
  const seed = levelOrSize && typeof levelOrSize === "object" ? levelOrSize.seed : undefined;
  const fresh = () => createState(size || MIN_SIZE, seed === undefined ? "jigsaw-restore" : seed);
  if (!validateSnapshot(levelOrSize, snap)) return fresh();

  const grid = [];
  const locked = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    const lockRow = [];
    for (let c = 0; c < size; c++) {
      const index = snap.order[r * size + c];
      row.push({ r: Math.floor(index / size), c: index % size });
      lockRow.push(snap.locked[r * size + c] === true);
    }
    grid.push(row);
    locked.push(lockRow);
  }
  const state = {
    n: size,
    grid,
    locked,
    moves: Number.isInteger(snap.moves) && snap.moves >= 0 ? snap.moves : 0,
  };
  if (isSolved(state)) return fresh();
  return state;
}
