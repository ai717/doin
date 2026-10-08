// engine.mjs —— 规则唯一权威：蜂巢六边网格三轴满行消除状态机，纯函数 DOM-free。
//
// 核心契约：
//   - 半径 4 蜂巢盘（61 格），三轴（0°/60°/120°）满行即消除；
//   - 一次放置消 N 行倍率 2^(N-1)，消 ≥4 行进蜜流狂潮（连击再 ×2 连乘，封顶 2^18）；
//   - hex-bag 确定性块队列，支持种子注入与同种子逐帧一致；
//   - 消除后纵轴重力下落 + 级联重检，格数守恒、倍率恒为 2 的幂次且 ≤ 2^18。
//
// 坐标系：axial (q, r)，半径 R=4；|q|≤4, |r|≤4, |q+r|≤4 → 61 格。
// 三轴行方向：constant r（横轴）、constant q（左斜轴）、constant s=-q-r（右斜轴）。

export const RADIUS = 4;
export const CELL_COUNT = 61; // 1 + 3*R*(R+1) for R=4

export const BASE_SCORE_PER_ROW = 100;
export const MAX_MULTIPLIER_EXP = 18; // 2^18 = 262144
export const RUSH_THRESHOLD = 4; // 单次消 ≥4 行进狂潮

export const MODE = {
  CAMPAIGN: "campaign",
  SURVIVAL: "survival",
  DUEL: "duel",
};

// 蜜蜡块形状（axial 偏移数组，首格为锚点 (0,0)）
export const SHAPES = [
  { id: "mono", cells: [[0, 0]] },
  { id: "domino", cells: [[0, 0], [1, 0]] },
  { id: "tri-line", cells: [[0, 0], [1, 0], [2, 0]] },
  { id: "tri-bend", cells: [[0, 0], [1, 0], [1, -1]] },
  { id: "tetro-line", cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { id: "tetro-square", cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { id: "tetro-bend", cells: [[0, 0], [1, 0], [2, 0], [2, -1]] },
  { id: "tetro-t", cells: [[0, 0], [1, 0], [2, 0], [1, -1]] },
  { id: "pento-cluster", cells: [[0, 0], [1, 0], [1, -1], [0, 1], [-1, 1]] },
  { id: "pento-line", cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
  { id: "pento-y", cells: [[0, 0], [1, 0], [2, 0], [1, -1], [1, 1]] },
  { id: "pento-z", cells: [[0, 0], [1, 0], [1, -1], [2, -1], [2, -2]] },
];

export const SHAPE_COUNT = SHAPES.length;

// 轴向下 60° 逆时针旋转：(q, r) -> (-r, q+r)
function rotateCell([q, r]) {
  return [-r, q + r];
}

/** 取某形状在给定旋转（0..5）下的格偏移（已归一化到首格为原点） */
export function shapeCells(shapeId, rotation = 0) {
  const shape = SHAPES.find((s) => s.id === shapeId) ?? SHAPES[0];
  let cells = shape.cells.map(([q, r]) => [q, r]);
  const rot = ((rotation % 6) + 6) % 6;
  for (let i = 0; i < rot; i += 1) cells = cells.map(rotateCell);
  // 归一化：以最小 q,r 为原点
  const minQ = Math.min(...cells.map((c) => c[0]));
  const minR = Math.min(...cells.map((c) => c[1]));
  return cells.map(([q, r]) => [q - minQ, r - minR]);
}

export function cellKey(q, r) {
  return `${q},${r}`;
}

export function parseKey(key) {
  const [q, r] = key.split(",").map(Number);
  return [q, r];
}

/** 半径 R 内的全部合法格 */
export function allCells(radius = RADIUS) {
  const out = [];
  for (let q = -radius; q <= radius; q += 1) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r += 1) out.push([q, r]);
  }
  return out;
}

/** 三轴所有行（每条行为格 key 数组） */
export function allRows(radius = RADIUS) {
  const rows = [];
  // axis r（constant r）
  for (let r = -radius; r <= radius; r += 1) {
    const line = [];
    for (let q = -radius; q <= radius; q += 1) {
      if (Math.abs(q + r) <= radius) line.push(cellKey(q, r));
    }
    if (line.length) rows.push(line);
  }
  // axis q（constant q）
  for (let q = -radius; q <= radius; q += 1) {
    const line = [];
    for (let r = -radius; r <= radius; r += 1) {
      if (Math.abs(q + r) <= radius) line.push(cellKey(q, r));
    }
    if (line.length) rows.push(line);
  }
  // axis s=-q-r（constant s）
  for (let s = -radius; s <= radius; s += 1) {
    const line = [];
    for (let q = -radius; q <= radius; q += 1) {
      const r = -q - s;
      if (Math.abs(r) <= radius && Math.abs(q + r) <= radius) line.push(cellKey(q, r));
    }
    if (line.length) rows.push(line);
  }
  return rows;
}

export function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

/** 2 的幂次倍率，封顶 2^18 */
export function powerOfTwoCap(exp) {
  const e = clamp(Math.round(exp), 0, MAX_MULTIPLIER_EXP);
  return 2 ** e;
}

/** 是否在棋盘内 */
export function inBoard(q, r, radius = RADIUS) {
  return Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(q + r) <= radius;
}

// ---------------------------------------------------------------- 状态构建

export function createState({ seed = 1, mode = MODE.SURVIVAL, level = null } = {}) {
  return {
    mode,
    seed: (seed >>> 0) || 1,
    occupied: {}, // key -> true
    queue: [], // upcoming shape ids
    bag: [], // remaining shapes in current bag
    current: null, // { shapeId, rotation }
    score: 0,
    rowsCleared: 0,
    rushActive: false,
    rushCombo: 0,
    multiplier: 1,
    maxMultiplier: 1,
    piecesPlaced: 0,
    gameOver: false,
    winner: null,
    currentPlayer: 1,
    levelId: level?.id ?? null,
    piecesRemaining: level?.pieces ?? Infinity,
    goalRows: level?.goalRows ?? 0,
    goalMet: false,
    events: [], // {type, t, ...} transient render events
    particles: [], // honey flow particles
  };
}

// ---------------------------------------------------------------- hex-bag

import { mulberry32 } from "./rng.mjs";

/** 生成一袋：每形状各 1 个，打乱；袋内形状分布均衡 */
function makeBag(rng) {
  const bag = SHAPES.map((s) => s.id);
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

/** 从队列取下一块（若队列不足则补袋） */
export function drawPiece(state) {
  if (state.queue.length === 0) {
    const rng = mulberry32((state.seed ^ (state.piecesPlaced * 0x9e3779b9)) >>> 0);
    state.bag = makeBag(rng);
    state.queue = [...state.bag];
  }
  const shapeId = state.queue.shift();
  state.current = { shapeId, rotation: 0 };
  return state.current;
}

/** 预览下 N 块（不消耗） */
export function peekQueue(state, n = 3) {
  const out = [...state.queue];
  let seed = (state.seed ^ ((state.piecesPlaced + 1) * 0x9e3779b9)) >>> 0;
  while (out.length < n) {
    const rng = mulberry32(seed);
    const bag = makeBag(rng);
    out.push(...bag);
    seed = (seed * 0x85ebca6b + 1) >>> 0;
  }
  return out.slice(0, n);
}

// ---------------------------------------------------------------- 放置

/** 计算放置后占据的格 keys；非法返回 null */
export function placementKeys(state, shapeId, rotation, anchorQ, anchorR) {
  const cells = shapeCells(shapeId, rotation);
  const keys = [];
  for (const [dq, dr] of cells) {
    const q = anchorQ + dq;
    const r = anchorR + dr;
    if (!inBoard(q, r)) return null;
    const key = cellKey(q, r);
    if (state.occupied[key]) return null;
    keys.push(key);
  }
  return keys;
}

/** 是否存在任意合法放置位置 */
export function hasValidPlacement(state, shapeId, rotation) {
  const cells = shapeCells(shapeId, rotation);
  for (const [q, r] of allCells()) {
    let ok = true;
    for (const [dq, dr] of cells) {
      const qq = q + dq;
      const rr = r + dr;
      if (!inBoard(qq, rr) || state.occupied[cellKey(qq, rr)]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** 棋盘是否放不下任何当前块（含全部旋转） */
export function isBoardStuck(state) {
  if (!state.current) return false;
  for (let rot = 0; rot < 6; rot += 1) {
    if (hasValidPlacement(state, state.current.shapeId, rot)) return false;
  }
  return true;
}

// ---------------------------------------------------------------- 消除

/** 找出所有满行（返回 keys 数组） */
export function findFullRows(state) {
  const full = [];
  for (const row of allRows()) {
    if (row.every((k) => state.occupied[k])) full.push(row);
  }
  return full;
}

/** 纵轴重力：每列（固定 q）内 occupied 向 r 增大方向（下）压实 */
export function applyGravity(state) {
  // 按 q 分组
  const columns = {};
  for (const key of Object.keys(state.occupied)) {
    const [q, r] = parseKey(key);
    if (!columns[q]) columns[q] = [];
    columns[q].push(r);
  }
  const next = {};
  for (const qStr of Object.keys(columns)) {
    const q = Number(qStr);
    const rs = columns[qStr].sort((a, b) => a - b); // 上到下
    // 该列合法 r 范围
    const r1 = Math.max(-RADIUS, -q - RADIUS);
    const r2 = Math.min(RADIUS, -q + RADIUS);
    // 压实到最底（最大 r）
    const bottom = [];
    for (let i = 0; i < rs.length; i += 1) bottom.push(r2 - i);
    for (const r of bottom) next[cellKey(q, r)] = true;
  }
  state.occupied = next;
}

/**
 * 执行一次放置 + 满行消除 + 重力级联。
 * 返回 { placed: bool, rowsCleared: number, scoreGain: number, rushTriggered: bool, cascadeRows: number }
 */
export function placeAndClear(state, shapeId, rotation, anchorQ, anchorR) {
  if (state.gameOver) return { placed: false, rowsCleared: 0, scoreGain: 0, rushTriggered: false };
  if (state.mode === MODE.CAMPAIGN && state.piecesRemaining <= 0) {
    return { placed: false, rowsCleared: 0, scoreGain: 0, rushTriggered: false };
  }
  const keys = placementKeys(state, shapeId, rotation, anchorQ, anchorR);
  if (!keys) return { placed: false, rowsCleared: 0, scoreGain: 0, rushTriggered: false };

  for (const k of keys) state.occupied[k] = true;
  state.piecesPlaced += 1;
  if (state.mode === MODE.CAMPAIGN) state.piecesRemaining -= 1;

  // 级联消除
  let totalRows = 0;
  let firstWaveRows = 0;
  let rushTriggered = false;
  let guard = 0;
  while (guard < 64) {
    const full = findFullRows(state);
    if (full.length === 0) break;
    const clearedKeys = new Set();
    for (const row of full) for (const k of row) clearedKeys.add(k);
    for (const k of clearedKeys) delete state.occupied[k];
    totalRows += full.length;
    if (guard === 0) firstWaveRows = full.length;
    state.rowsCleared += full.length;
    applyGravity(state);
    guard += 1;
  }

  // 计分
  let scoreGain = 0;
  if (totalRows > 0) {
    const waveExp = totalRows - 1;
    let mult = powerOfTwoCap(waveExp);
    if (state.rushActive) {
      state.rushCombo += 1;
      mult = powerOfTwoCap(waveExp + state.rushCombo);
    }
    mult = Math.min(mult, 2 ** MAX_MULTIPLIER_EXP);
    scoreGain = totalRows * BASE_SCORE_PER_ROW * mult;
    state.score += scoreGain;
    state.multiplier = mult;
    if (mult > state.maxMultiplier) state.maxMultiplier = mult;
    if (totalRows >= RUSH_THRESHOLD) {
      if (!state.rushActive) rushTriggered = true;
      state.rushActive = true;
    }
  } else {
    // 未消除：狂潮中断
    state.rushActive = false;
    state.rushCombo = 0;
    state.multiplier = 1;
  }

  // campaign 目标
  if (state.mode === MODE.CAMPAIGN && state.goalRows > 0 && state.rowsCleared >= state.goalRows) {
    state.goalMet = true;
  }

  // 终局判定
  if (state.mode === MODE.CAMPAIGN) {
    if (state.goalMet) {
      state.gameOver = true;
      state.winner = 1;
    } else if (state.piecesRemaining <= 0) {
      state.gameOver = true;
      state.winner = null;
    }
  } else if (state.mode === MODE.DUEL) {
    // 切换玩家；若新玩家无法放置则对手胜
    state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  }

  // 消耗当前块
  state.current = null;
  if (!state.gameOver) drawPiece(state);

  return { placed: true, rowsCleared: totalRows, firstWaveRows, scoreGain, rushTriggered };
}

// ---------------------------------------------------------------- stepFrame（粒子 / 事件推进，纯确定性）

/** 固定步长推进：仅推进粒子与事件计时，不改变规则状态 */
export function stepFrame(state, dt) {
  const d = Number(dt);
  if (!Number.isFinite(d) || d <= 0) return state;
  for (const p of state.particles) p.life -= d;
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const e of state.events) e.t -= d;
  state.events = state.events.filter((e) => e.t > 0);
  return state;
}

// ---------------------------------------------------------------- 诊断 / 守恒

export function occupiedCount(state) {
  return Object.keys(state.occupied).length;
}

export function invariants(state) {
  const count = occupiedCount(state);
  const allIn = Object.keys(state.occupied).every((k) => {
    const [q, r] = parseKey(k);
    return inBoard(q, r);
  });
  const multPow = (Math.log2(state.multiplier) % 1 === 0) && state.multiplier <= 2 ** MAX_MULTIPLIER_EXP && state.multiplier >= 1;
  const scoreFinite = Number.isFinite(state.score) && state.score >= 0;
  return {
    cellCountInRange: count >= 0 && count <= CELL_COUNT,
    allCellsInBoard: allIn,
    multiplierPowerOfTwo: multPow,
    scoreNonNegativeFinite: scoreFinite,
  };
}

/** 供 UI 渲染的只读快照 */
export function snapshot(state) {
  return {
    mode: state.mode,
    score: state.score,
    rowsCleared: state.rowsCleared,
    rushActive: state.rushActive,
    rushCombo: state.rushCombo,
    multiplier: state.multiplier,
    maxMultiplier: state.maxMultiplier,
    gameOver: state.gameOver,
    winner: state.winner,
    currentPlayer: state.currentPlayer,
    current: state.current ? { ...state.current } : null,
    queue: peekQueue(state, 3),
    occupied: { ...state.occupied },
    piecesPlaced: state.piecesPlaced,
    piecesRemaining: state.mode === MODE.CAMPAIGN ? state.piecesRemaining : null,
    goalRows: state.goalRows,
    goalMet: state.goalMet,
    particles: state.particles.map((p) => ({ ...p })),
  };
}
