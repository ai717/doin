// filepath: games/klotski/js/engine.mjs
// 纯规则层：棋盘、方块、移动合法性、撤销、胜负判定。不依赖 DOM / Canvas / Storage。

export const COLS = 4;
export const ROWS = 5;

/** 出口：曹操左上角到达 (3,1) 即占据底部中央两列，可滑出棋盘 */
export const EXIT_R = 3;
export const EXIT_C = 1;

export const DIRS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};
export const DIR_NAMES = ["up", "down", "left", "right"];

export const KIND = {
  CAOCAO: "caocao",
  GUANYU: "guanyu",
  GENERAL: "general",
  SOLDIER: "soldier",
};

/** 确定性 PRNG：同一 seed 必得同一序列（木纹种子、测试复现） */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由关卡 id 生成稳定的木纹/装饰种子，保证同一关卡每次渲染一致 */
export function textureSeeds(levelId, count) {
  let h = 2166136261;
  const text = String(levelId);
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = mulberry32(h >>> 0);
  const seeds = [];
  for (let i = 0; i < count; i++) seeds.push(Math.floor(rand() * 100000));
  return seeds;
}

function kindOf(h, w) {
  if (h === 2 && w === 2) return KIND.CAOCAO;
  if (h === 1 && w === 2) return KIND.GUANYU;
  if (h === 2 && w === 1) return KIND.GENERAL;
  return KIND.SOLDIER;
}

/** 从 5 行 × 4 列字符网格解析方块：同字符连通单元即一块，形状由包围盒推断 */
export function parseGrid(grid) {
  const map = new Map();
  grid.forEach((row, r) => {
    const cells = typeof row === "string" ? [...row] : [];
    cells.forEach((ch, c) => {
      if (ch === "." || ch === " " || ch === undefined) return;
      if (!map.has(ch)) map.set(ch, []);
      map.get(ch).push({ r, c });
    });
  });
  const pieces = [];
  for (const [ch, cells] of map) {
    const rs = cells.map((cell) => cell.r);
    const cs = cells.map((cell) => cell.c);
    const r0 = Math.min(...rs);
    const c0 = Math.min(...cs);
    const h = Math.max(...rs) - r0 + 1;
    const w = Math.max(...cs) - c0 + 1;
    pieces.push({ id: ch, r: r0, c: c0, h, w, kind: kindOf(h, w) });
  }
  pieces.sort((a, b) => a.r - b.r || a.c - b.c);
  return pieces;
}

/** 20 格占用表：null 为空，否则为方块 id */
export function occupancy(state) {
  const grid = new Array(ROWS * COLS).fill(null);
  for (const piece of state.pieces) {
    for (let dr = 0; dr < piece.h; dr++) {
      for (let dc = 0; dc < piece.w; dc++) {
        grid[(piece.r + dr) * COLS + (piece.c + dc)] = piece.id;
      }
    }
  }
  return grid;
}

export function createState(level) {
  return {
    levelId: level.id,
    par: level.par,
    pieces: parseGrid(level.grid),
    moves: 0,
    history: [],
  };
}

export function cloneState(state) {
  return {
    levelId: state.levelId,
    par: state.par,
    pieces: state.pieces.map((piece) => ({ ...piece })),
    moves: state.moves,
    history: state.history.slice(),
  };
}

export function findPiece(state, id) {
  return state.pieces.find((piece) => piece.id === id) ?? null;
}

function fits(grid, piece, r, c) {
  if (r < 0 || c < 0 || r + piece.h > ROWS || c + piece.w > COLS) return false;
  for (let dr = 0; dr < piece.h; dr++) {
    for (let dc = 0; dc < piece.w; dc++) {
      const occupant = grid[(r + dr) * COLS + (c + dc)];
      if (occupant !== null && occupant !== piece.id) return false;
    }
  }
  return true;
}

/** 判定：该方块能否朝 dir 移动一格 */
export function canMove(state, id, dir) {
  const delta = DIRS[dir];
  if (!delta) return false;
  const piece = findPiece(state, id);
  if (!piece) return false;
  return fits(occupancy(state), piece, piece.r + delta[0], piece.c + delta[1]);
}

/** 该方向最多可连续滑动几格（拖拽用） */
export function maxSlide(state, id, dir) {
  const delta = DIRS[dir];
  if (!delta) return 0;
  const piece = findPiece(state, id);
  if (!piece) return 0;
  const grid = occupancy(state);
  let distance = 0;
  for (let step = 1; step <= ROWS + COLS; step++) {
    if (!fits(grid, piece, piece.r + delta[0] * step, piece.c + delta[1] * step)) break;
    distance = step;
  }
  return distance;
}

export function legalMoves(state, id) {
  return DIR_NAMES.filter((dir) => canMove(state, id, dir));
}

export function anyLegalMove(state) {
  return state.pieces.some((piece) => legalMoves(state, piece.id).length > 0);
}

/**
 * 执行一步移动。合法则完整执行并返回新状态；非法返回 null（调用方保持原状态，安全 no-op）。
 * 状态不可变：原 state 永不被修改。
 */
export function applyMove(state, id, dir) {
  const delta = DIRS[dir];
  if (!delta) return null;
  const piece = findPiece(state, id);
  if (!piece) return null;
  const grid = occupancy(state);
  const nextR = piece.r + delta[0];
  const nextC = piece.c + delta[1];
  if (!fits(grid, piece, nextR, nextC)) return null;

  const next = cloneState(state);
  const target = next.pieces.find((item) => item.id === id);
  target.r = nextR;
  target.c = nextC;
  next.moves = state.moves + 1;
  next.history.push({ id, fromR: piece.r, fromC: piece.c, toR: nextR, toC: nextC, dir });
  return next;
}

/** 连续滑动 n 格（每格计 1 步）；任一步非法即整体返回 null */
export function applySlide(state, id, dir, distance) {
  const steps = Math.floor(distance);
  if (!Number.isFinite(steps) || steps <= 0) return null;
  let current = state;
  for (let i = 0; i < steps; i++) {
    const next = applyMove(current, id, dir);
    if (!next) return i === 0 ? null : current;
    current = next;
  }
  return current;
}

/** 撤销一步：回到上一位置并回退步数 */
export function undo(state) {
  if (!state.history.length) return null;
  const last = state.history[state.history.length - 1];
  const next = cloneState(state);
  next.history.pop();
  const piece = next.pieces.find((item) => item.id === last.id);
  if (piece) {
    piece.r = last.fromR;
    piece.c = last.fromC;
  }
  next.moves = Math.max(0, state.moves - 1);
  return next;
}

export function goalPiece(state) {
  return state.pieces.find((piece) => piece.kind === KIND.CAOCAO) ?? null;
}

/** 胜利：曹操到达底部中央出口位 */
export function isSolved(state) {
  const piece = goalPiece(state);
  if (!piece) return false;
  return piece.r === EXIT_R && piece.c === EXIT_C;
}

/** 存档快照：只存必要字段，便于 normalize */
export function snapshot(state) {
  return {
    levelId: state.levelId,
    moves: state.moves,
    pieces: state.pieces.map((piece) => ({ id: piece.id, r: piece.r, c: piece.c })),
  };
}

/** 由快照还原；与关卡定义不符则回退到关卡初始状态 */
export function restore(level, snap) {
  const base = createState(level);
  if (!snap || typeof snap !== "object" || snap.levelId !== level.id) return base;
  if (!Array.isArray(snap.pieces)) return base;
  const map = new Map(snap.pieces.map((item) => [item && item.id, item]));
  let restored = 0;
  for (const piece of base.pieces) {
    const stored = map.get(piece.id);
    if (!stored || !Number.isInteger(stored.r) || !Number.isInteger(stored.c)) continue;
    if (stored.r < 0 || stored.c < 0 || stored.r + piece.h > ROWS || stored.c + piece.w > COLS) continue;
    piece.r = stored.r;
    piece.c = stored.c;
    restored++;
  }
  if (restored !== base.pieces.length) return createState(level);

  // 校验还原后的局面无重叠（同一格被两块占用即视为损坏快照）
  const hits = new Array(ROWS * COLS).fill(0);
  for (const piece of base.pieces) {
    for (let dr = 0; dr < piece.h; dr++) {
      for (let dc = 0; dc < piece.w; dc++) {
        hits[(piece.r + dr) * COLS + (piece.c + dc)] += 1;
      }
    }
  }
  if (hits.some((count) => count > 1)) return createState(level);

  const moves = Number.isInteger(snap.moves) ? Math.max(0, snap.moves) : 0;
  return {
    ...base,
    moves,
    history: Array.isArray(snap.history)
      ? snap.history.filter((item) => item && typeof item.id === "string").slice(-500)
      : [],
  };
}
