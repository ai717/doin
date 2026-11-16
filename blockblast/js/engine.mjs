// engine.mjs —— 积木爆破规则唯一权威：8×8 方格网格、行列双轴满行消除状态机。
// 纯函数、DOM-free、不可变状态：操作无效果时原样返回传入的同一对象引用，
// 调用方用 === 即可判断"这一步没生效"，引擎永不抛错。
//
// 核心契约：
//   - 8×8 网格（64 格），任意整行或整列填满即消除，行与列可同爆（十字共鸣）；
//   - 三块队列自由选放，确定性 bag 均衡补块（每袋各形状 1 个 + 随机复制，复制数由难度决定）；
//   - 三档难度（difficulty.mjs）：休闲空盘起步 / 标准 6 格起手障碍 / 大师 12 格 + 强袋；
//   - 计分经典原味：每格 +1、每行/列 +10、十字共鸣 +25（score.mjs 口径）；
//   - Combo：连续"放置即消"递增，放置未消清零；
//   - 终局：队列三块（含全部旋转）均无合法落位 = 放不下，无尽模式唯一终局；
//   - 彩纸粒子与消除事件全部由种子确定性派生，同种子 + 同输入序列逐帧一致。
//
// 坐标：row/col ∈ [0, 8)，扁平索引 index = row * 8 + col。
// 放置锚点 = 抓手格（到质心最近的格，grabCell），UI 预览与落子共用，所见即所得。

import { mulberry32 } from "./rng.mjs";
import { SCORE_PER_CELL, SCORE_PER_LINE, SCORE_CROSS } from "./score.mjs";
import { difficultyById, DEFAULT_DIFFICULTY } from "./difficulty.mjs";

export const GRID = 8;
export const CELL_COUNT = GRID * GRID;

export const MODE = {
  CLASSIC: "classic",
};

export const STATUS = {
  PLAYING: "playing",
  OVER: "over",
};

export const OVER_REASON = {
  STUCK: "stuck", // 队列无任何合法落位（无尽模式唯一终局）
};

export const QUEUE_SIZE = 3;
export const MAX_PARTICLES = 360;
export const ROTATIONS = 4;

// 糖果色索引（1 基，0 = 空格）。render 层按索引取色。
export const PIECES = [
  { id: "mono", color: 1, cells: [[0, 0]] },
  { id: "domino", color: 2, cells: [[0, 0], [0, 1]] },
  { id: "tri-line", color: 3, cells: [[0, 0], [0, 1], [0, 2]] },
  { id: "corner", color: 4, cells: [[0, 0], [0, 1], [1, 0]] },
  { id: "square", color: 5, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: "tet-line", color: 6, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: "tet-t", color: 7, cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: "tet-l", color: 8, cells: [[0, 0], [1, 0], [2, 0], [0, 1]] },
  { id: "tet-s", color: 9, cells: [[0, 0], [0, 1], [1, 1], [1, 2]] },
  { id: "pento-plus", color: 10, cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] },
  { id: "pento-l", color: 11, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1]] },
];

export const PIECE_IDS = PIECES.map((p) => p.id);
const PIECE_BY_ID = new Map(PIECES.map((p) => [p.id, p]));

const cellsCache = new Map();

/** 归一化旋转：(r, c) -> (c, -r)，再平移使 min row/col 为 0 */
function rotateOffsets(cells) {
  const rotated = cells.map(([r, c]) => [c, -r]);
  const minR = Math.min(...rotated.map((c) => c[0]));
  const minC = Math.min(...rotated.map((c) => c[1]));
  return rotated.map(([r, c]) => [r - minR, c - minC]);
}

/** 取某形状在给定旋转（0..3）下的格偏移（已归一化到原点） */
export function pieceCells(pieceId, rotation = 0) {
  const shape = PIECE_BY_ID.get(pieceId) ?? PIECES[0];
  const rot = ((Math.round(Number(rotation)) || 0) % ROTATIONS + ROTATIONS) % ROTATIONS;
  const key = `${shape.id}#${rot}`;
  let cells = cellsCache.get(key);
  if (cells) return cells;
  cells = shape.cells.map((c) => [c[0], c[1]]);
  for (let i = 0; i < rot; i += 1) cells = rotateOffsets(cells);
  cellsCache.set(key, cells);
  return cells;
}

export function pieceColor(pieceId) {
  const shape = PIECE_BY_ID.get(pieceId) ?? PIECES[0];
  return shape.color;
}

/**
 * 以"质心最近格"为原点重排形状偏移：光标恒落在块体真实格上（跟手锚定）。
 * 平局取遍历首个最近格，确定性输出；预览与真实落子共用，所见即所得。
 */
const centeredCache = new Map();
const grabCache = new Map();

/**
 * 取某形状某旋转下的「抓手格」：到质心距离最近的格（平局取遍历首个，确定性输出）。
 * 预览锚点、落子校验、跟手 UI 共用这一个原子，保证「光标恒落在块体真实格上」
 * 且预览格子与引擎落子格子永远是同一套（所见即所得）。
 */
export function grabCell(pieceId, rotation = 0) {
  const shape = PIECE_BY_ID.get(pieceId) ?? PIECES[0];
  const rot = ((Math.round(Number(rotation)) || 0) % ROTATIONS + ROTATIONS) % ROTATIONS;
  const key = `${shape.id}#${rot}`;
  let out = grabCache.get(key);
  if (out) return out;
  const cells = pieceCells(shape.id, rot);
  const n = cells.length;
  const cr = cells.reduce((s, c) => s + c[0], 0) / n;
  const cc = cells.reduce((s, c) => s + c[1], 0) / n;
  let best = cells[0];
  let bestD = Infinity;
  for (const [r, c] of cells) {
    const d = (r - cr) * (r - cr) + (c - cc) * (c - cc);
    if (d < bestD) {
      bestD = d;
      best = [r, c];
    }
  }
  out = [best[0], best[1]];
  grabCache.set(key, out);
  return out;
}

export function centeredCells(pieceId, rotation = 0) {
  const shape = PIECE_BY_ID.get(pieceId) ?? PIECES[0];
  const rot = ((Math.round(Number(rotation)) || 0) % ROTATIONS + ROTATIONS) % ROTATIONS;
  const key = `${shape.id}#${rot}`;
  let out = centeredCache.get(key);
  if (out) return out;
  const [gr, gc] = grabCell(shape.id, rot);
  const cells = pieceCells(shape.id, rot);
  out = cells.map(([r, c]) => [r - gr, c - gc]);
  centeredCache.set(key, out);
  return out;
}

export function cellIndex(row, col) {
  return row * GRID + col;
}

export function inBoard(row, col) {
  return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < GRID && col >= 0 && col < GRID;
}

// ---------------------------------------------------------------- 状态构建

function hashSeed(seed, salt) {
  let h = (seed >>> 0) ^ Math.imul(salt >>> 0, 0x9e3779b9);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 生成一袋：各形状各 1 个 + 随机 dupMin~dupMax 个复制（难度决定袋强），Fisher-Yates 打乱 */
function makeChunk(seed, bagIndex, dupMin, dupMax) {
  const rng = mulberry32(hashSeed(seed, bagIndex + 1));
  const bag = PIECE_IDS.slice();
  const dups = dupMin + Math.floor(rng() * (dupMax - dupMin + 1));
  for (let i = 0; i < dups; i += 1) bag.push(PIECE_IDS[Math.floor(rng() * PIECE_IDS.length)]);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = bag[i];
    bag[i] = bag[j];
    bag[j] = tmp;
  }
  return bag;
}

/**
 * 确定性起手障碍：从种子派生随机格染色（糖果色 1..11）。
 * 兜底保证首队列有合法落位——预填后三块（含全部旋转）均放不下则减半重试，
 * 多轮仍失败回退空盘（确定性输出，同种子同结果）。
 */
function prefillBoard(seed, count, queue) {
  let n = Math.max(0, Math.trunc(count));
  for (let attempt = 0; attempt < 6 && n > 0; attempt += 1) {
    const rng = mulberry32(hashSeed(seed, 0x9a11 + attempt * 7 + n));
    const board = new Array(CELL_COUNT).fill(0);
    let placed = 0;
    let guard = 0;
    while (placed < n && guard < n * 20) {
      guard += 1;
      const idx = Math.floor(rng() * CELL_COUNT);
      if (board[idx] !== 0) continue;
      board[idx] = 1 + Math.floor(rng() * PIECES.length);
      placed += 1;
    }
    if (placed === n && queueHasLegalPlacement(board, queue)) return board;
    n = Math.floor(n / 2);
  }
  return new Array(CELL_COUNT).fill(0);
}

export function createState({ seed = 1, difficulty = DEFAULT_DIFFICULTY } = {}) {
  const diff = difficultyById(difficulty) ?? difficultyById(DEFAULT_DIFFICULTY);
  const base = {
    mode: MODE.CLASSIC,
    difficulty: diff.id,
    dupMin: diff.dupMin,
    dupMax: diff.dupMax,
    seed: (Number(seed) >>> 0) || 1,
    board: new Array(CELL_COUNT).fill(0),
    queue: [],
    stream: [],
    streamPos: 0,
    bagIndex: 0,
    score: 0,
    rowsCleared: 0,
    crossCount: 0,
    combo: 0,
    maxCombo: 0,
    piecesPlaced: 0,
    status: STATUS.PLAYING,
    overReason: null,
    lastPlaced: null,
    events: [],
    particles: [],
    spawnCounter: 0,
  };
  // 先补队列（预填合法性检查需要真实首队列），再按难度铺起手障碍
  const filled = refillQueue(base);
  if (diff.prefills > 0) {
    return { ...filled, board: prefillBoard(filled.seed, diff.prefills, filled.queue) };
  }
  return filled;
}

/** 队列补足至 3；无尽模式无预算约束（袋强由难度决定） */
export function refillQueue(state) {
  if (state.status !== STATUS.PLAYING) return state;
  const queue = state.queue.slice();
  const stream = state.stream.slice();
  let streamPos = state.streamPos;
  let bagIndex = state.bagIndex;
  while (queue.length < QUEUE_SIZE) {
    if (streamPos >= stream.length) {
      const chunk = makeChunk(state.seed, bagIndex, state.dupMin, state.dupMax);
      for (const id of chunk) stream.push(id);
      bagIndex += 1;
    }
    queue.push(stream[streamPos]);
    streamPos += 1;
  }
  if (
    queue.length === state.queue.length &&
    stream.length === state.stream.length &&
    streamPos === state.streamPos &&
    bagIndex === state.bagIndex
  ) {
    return state;
  }
  return { ...state, queue, stream, streamPos, bagIndex };
}

// ---------------------------------------------------------------- 放置校验

/** 该形状该旋转在 (row, col) 锚点下是否可放（全部落空格且不越界） */
export function canPlace(board, pieceId, rotation, row, col) {
  const cells = pieceCells(pieceId, rotation);
  for (const [dr, dc] of cells) {
    const r = row + dr;
    const c = col + dc;
    if (!inBoard(r, c)) return false;
    if (board[cellIndex(r, c)] !== 0) return false;
  }
  return true;
}

/** 某拼块（含全部旋转）是否存在任意合法落位 */
export function hasLegalPlacement(board, pieceId) {
  for (let rot = 0; rot < ROTATIONS; rot += 1) {
    const cells = pieceCells(pieceId, rot);
    const maxR = Math.max(...cells.map((c) => c[0]));
    const maxC = Math.max(...cells.map((c) => c[1]));
    for (let row = 0; row + maxR < GRID; row += 1) {
      for (let col = 0; col + maxC < GRID; col += 1) {
        if (canPlace(board, pieceId, rot, row, col)) return true;
      }
    }
  }
  return false;
}

/** 整个队列是否还有任何合法落位 */
export function queueHasLegalPlacement(board, queue) {
  for (const id of queue) {
    if (hasLegalPlacement(board, id)) return true;
  }
  return false;
}

// ---------------------------------------------------------------- 消除与计分

/** 找出所有满行/满列（返回行列下标数组） */
export function findFullLines(board) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < GRID; r += 1) {
    let full = true;
    for (let c = 0; c < GRID; c += 1) {
      if (board[cellIndex(r, c)] === 0) {
        full = false;
        break;
      }
    }
    if (full) rows.push(r);
  }
  for (let c = 0; c < GRID; c += 1) {
    let full = true;
    for (let r = 0; r < GRID; r += 1) {
      if (board[cellIndex(r, c)] === 0) {
        full = false;
        break;
      }
    }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

function spawnParticles(state, rows, cols, cross) {
  const rng = mulberry32(hashSeed(state.seed, 0x5eed + state.piecesPlaced * 31 + state.spawnCounter));
  state.spawnCounter += 1;
  const parts = state.particles.slice();
  const perCell = cross ? 9 : 6;
  const colors = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (const r of rows) {
    for (let c = 0; c < GRID; c += 1) {
      for (let i = 0; i < perCell && parts.length < MAX_PARTICLES; i += 1) {
        parts.push({
          x: c + 0.5,
          y: r + 0.5,
          vx: (rng() - 0.5) * 7,
          vy: (rng() - 0.5) * 7 - 1.5,
          life: 0.5 + rng() * 0.5,
          maxLife: 1,
          size: 0.08 + rng() * 0.14,
          color: colors[Math.floor(rng() * colors.length)],
          rot: rng() * Math.PI,
          vr: (rng() - 0.5) * 12,
        });
      }
    }
  }
  for (const c of cols) {
    for (let r = 0; r < GRID; r += 1) {
      for (let i = 0; i < perCell && parts.length < MAX_PARTICLES; i += 1) {
        parts.push({
          x: c + 0.5,
          y: r + 0.5,
          vx: (rng() - 0.5) * 7,
          vy: (rng() - 0.5) * 7 - 1.5,
          life: 0.5 + rng() * 0.5,
          maxLife: 1,
          size: 0.08 + rng() * 0.14,
          color: colors[Math.floor(rng() * colors.length)],
          rot: rng() * Math.PI,
          vr: (rng() - 0.5) * 12,
        });
      }
    }
  }
  return parts;
}

function pushEvent(events, event) {
  const next = events.slice();
  next.push(event);
  return next.slice(-24);
}

/**
 * 执行一次放置 + 行列消除 + 计分 + 补块 + 终局判定。
 * intent: { type: "place", slot, rotation, row, col }
 * 返回 { state, action }；无效果（含终局后操作）时 state 为原引用、action 为 null。
 */
export function applyIntent(state, intent) {
  if (!intent || intent.type !== "place") return { state, action: null };
  if (state.status !== STATUS.PLAYING) return { state, action: null };

  const slot = Number(intent.slot);
  const rotation = Number(intent.rotation);
  const row = Number(intent.row);
  const col = Number(intent.col);
  if (!Number.isInteger(slot) || slot < 0 || slot >= state.queue.length) return { state, action: null };
  if (!Number.isInteger(rotation) || !Number.isInteger(row) || !Number.isInteger(col)) return { state, action: null };

  const pieceId = state.queue[slot];
  const cells = pieceCells(pieceId, rotation);
  const color = pieceColor(pieceId);

  const landing = [];
  for (const [dr, dc] of cells) {
    const r = row + dr;
    const c = col + dc;
    if (!inBoard(r, c)) return { state, action: null };
    const idx = cellIndex(r, c);
    if (state.board[idx] !== 0) return { state, action: null };
    landing.push(idx);
  }

  const board = state.board.slice();
  for (const idx of landing) board[idx] = color;

  const { rows, cols } = findFullLines(board);
  const lineCount = rows.length + cols.length;
  const cross = rows.length > 0 && cols.length > 0;

  let score = state.score + landing.length * SCORE_PER_CELL;
  let events = state.events;
  let particles = state.particles;
  let rowsCleared = state.rowsCleared;
  let crossCount = state.crossCount;
  let combo = 0;
  let maxCombo = state.maxCombo;

  if (lineCount > 0) {
    for (const r of rows) {
      for (let c = 0; c < GRID; c += 1) board[cellIndex(r, c)] = 0;
    }
    for (const c of cols) {
      for (let r = 0; r < GRID; r += 1) board[cellIndex(r, c)] = 0;
    }
    score += lineCount * SCORE_PER_LINE;
    if (cross) {
      score += SCORE_CROSS;
      crossCount += 1;
    }
    rowsCleared += lineCount;
    combo = state.combo + 1;
    if (combo > maxCombo) maxCombo = combo;
    events = pushEvent(events, {
      kind: "clear",
      axis: cross ? "cross" : rows.length > 0 ? "row" : "col",
      rows,
      cols,
      cross,
      lineCount,
      gain: landing.length * SCORE_PER_CELL + lineCount * SCORE_PER_LINE + (cross ? SCORE_CROSS : 0),
      t: 0.55,
    });
    if (cross) {
      events = pushEvent(events, { kind: "cross", t: 1 });
    }
    particles = spawnParticles(
      { ...state, board, particles, spawnCounter: state.spawnCounter },
      rows,
      cols,
      cross,
    );
  }

  const queue = state.queue.slice();
  queue.splice(slot, 1);

  let next = {
    ...state,
    board,
    queue,
    score,
    rowsCleared,
    crossCount,
    combo,
    maxCombo,
    piecesPlaced: state.piecesPlaced + 1,
    lastPlaced: { row, col, cells: cells.map((c) => [c[0], c[1]]), color, pieceId, rotation },
    events,
    particles,
    spawnCounter: state.spawnCounter + 1,
  };

  next = refillQueue(next);

  // 终局判定：无尽模式唯一终局——队列三块（含全部旋转）均无合法落位
  if (!queueHasLegalPlacement(next.board, next.queue)) {
    next = { ...next, status: STATUS.OVER, overReason: OVER_REASON.STUCK };
  }

  return { state: next, action: "place" };
}

// ---------------------------------------------------------------- stepFrame（粒子/事件确定性推进）

/** 固定步长推进：仅推进粒子与事件计时，不改变规则状态 */
export function stepFrame(state, dt) {
  const d = Number(dt);
  if (!Number.isFinite(d) || d <= 0) return state;
  if (state.particles.length === 0 && state.events.length === 0) return state;

  let changed = false;
  const particles = [];
  for (const p of state.particles) {
    const life = p.life - d;
    if (life <= 0) {
      changed = true;
      continue;
    }
    changed = true;
    particles.push({
      ...p,
      life,
      x: p.x + p.vx * d,
      y: p.y + p.vy * d,
      vy: p.vy + 9 * d,
      rot: p.rot + p.vr * d,
    });
  }
  const events = [];
  for (const e of state.events) {
    const t = e.t - d;
    if (t <= 0) {
      changed = true;
      continue;
    }
    changed = true;
    events.push({ ...e, t });
  }
  if (!changed) return state;
  return { ...state, particles, events };
}

// ---------------------------------------------------------------- 诊断 / 守恒

export function filledCount(state) {
  let n = 0;
  for (let i = 0; i < CELL_COUNT; i += 1) if (state.board[i] !== 0) n += 1;
  return n;
}

export function invariants(state) {
  let filled = 0;
  let valid = true;
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const v = state.board[i];
    if (v === 0) continue;
    filled += 1;
    if (!Number.isInteger(v) || v < 1 || v > PIECES.length) valid = false;
  }
  return {
    cellCountInRange: filled >= 0 && filled <= CELL_COUNT,
    boardValuesValid: valid,
    queueSizeOk: state.queue.length >= 0 && state.queue.length <= QUEUE_SIZE,
    queuePiecesKnown: state.queue.every((id) => PIECE_BY_ID.has(id)),
    scoreNonNegativeFinite: Number.isFinite(state.score) && state.score >= 0,
    comboNonNegative: state.combo >= 0 && state.maxCombo >= state.combo,
    rowsNonNegative: state.rowsCleared >= 0 && state.crossCount >= 0,
    statusConsistent:
      (state.status === STATUS.OVER) === (state.overReason !== null),
  };
}

/** 供 UI 渲染的只读快照（复制容器，防止调用方注解污染引擎） */
export function snapshot(state) {
  return {
    mode: state.mode,
    difficulty: state.difficulty,
    board: state.board.slice(),
    queue: state.queue.slice(),
    score: state.score,
    rowsCleared: state.rowsCleared,
    crossCount: state.crossCount,
    combo: state.combo,
    maxCombo: state.maxCombo,
    piecesPlaced: state.piecesPlaced,
    status: state.status,
    overReason: state.overReason,
    lastPlaced: state.lastPlaced ? { ...state.lastPlaced } : null,
    events: state.events.map((e) => ({ ...e })),
    particles: state.particles.map((p) => ({ ...p })),
  };
}
