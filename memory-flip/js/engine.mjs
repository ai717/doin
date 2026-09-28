// 盲盒记忆牌 — 规则引擎（严格 DOM-free：禁碰 document / window / localStorage）
// 纯状态机 + 确定性 PRNG，可被 node:test 直接驱动。
//
// 核心机制：翻牌失败时触发"咯哒轮转"——以两张翻错牌位为中心，
// 各取其盖牌邻位按顺时针方向轮转 1 格。机制等价于"位旋转，图腾不变"，
// 对子守恒 → 数学保证无死局。

import { pickTotemIds } from "./data.mjs";

export const STATUS = Object.freeze({
  PLAYING: "playing",
  WON: "won",
  LOST: "lost",
});

export const ACTION = Object.freeze({
  NONE: "none",
  FLIP_ONE: "flip-one",
  MATCH: "match",
  MISMATCH: "mismatch",
  MATCH_WIN: "match-win",
  MISMATCH_LOSE: "mismatch-lose",
  CANCEL: "cancel",
  END_TURN: "end-turn",
});

export const MECH = Object.freeze({
  NONE: "none",
  RING4: "ring4",
  RING8: "ring8",
  GEAR: "gear",
});

/** mulberry32 — 确定性 PRNG；同种子序列一致、可复现 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 当日固定种子：YYYY-MM-DD → 整数（保证全球同题） */
export function dailySeed(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return 0;
  const [y, m, d] = dateKey.split("-").map(Number);
  return ((y - 1970) * 372 + (m - 1) * 31 + (d - 1)) * 7 + 3;
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 4 邻 / 8 邻方向定义（顺时针：上 → 右 → 下 → 左，及四角）
const DIRS_4 = Object.freeze([[-1, 0], [0, 1], [1, 0], [0, -1]]);
const DIRS_8 = Object.freeze([
  [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1],
]);

// ---------------------------------------------------------------------------
// 状态构造
// ---------------------------------------------------------------------------

/**
 * 生成一关盘面：
 * 1. 每类图腾恰出现 2 张（对子守恒前提）；
 * 2. 无不动点打乱（Derangement）：任一张牌不落在"按对子顺序排列"的原始索引位；
 * 3. 同一图腾的两张牌不相邻（避免开局即送对）。
 * 失败重试上限 ROUNDS 次；超出抛错。
 */
export function generateBoard(rows, cols, totemCount, rng, opts = {}) {
  const total = rows * cols;
  if (total % 2 !== 0) throw new Error(`board size must be even: ${total}`);
  if (totemCount !== total / 2) {
    throw new Error(`totemCount(${totemCount}) must equal rows*cols/2 = ${total / 2}`);
  }
  const ids = pickTotemIds(totemCount);
  if (ids.length === 0) throw new Error(`pickTotemIds failed: totemCount=${totemCount}`);
  const ROUNDS = opts.maxRetry ?? 2000;

  for (let round = 0; round < ROUNDS; round += 1) {
    const tiles = [];
    for (const id of ids) { tiles.push(id); tiles.push(id); }
    for (let i = tiles.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    if (!isDerangement(tiles, ids)) continue;
    if (!noAdjacentPair(tiles, rows, cols)) continue;
    return tiles;
  }

  throw new Error(`generateBoard: ${ROUNDS} rounds failed (rows=${rows}, cols=${cols}, tot=${totemCount})`);
}

function isDerangement(tiles, ids) {
  for (let i = 0; i < tiles.length; i += 1) {
    if (tiles[i] === ids[Math.floor(i / 2)]) return false;
  }
  return true;
}

function noAdjacentPair(tiles, rows, cols) {
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const idx = r * cols + c;
      const t = tiles[idx];
      if (c + 1 < cols && tiles[r * cols + (c + 1)] === t) return false;
      if (r + 1 < rows && tiles[(r + 1) * cols + c] === t) return false;
    }
  }
  return true;
}

/**
 * 构造初始空白对局状态（可被 game.mjs 调度）。
 * @param {object} cfg { rows, cols, totemCount, seed, mech, missBudget, levelId }
 */
export function createLevel(cfg) {
  const rows = Math.floor(cfg.rows);
  const cols = Math.floor(cfg.cols);
  const totemCount = Math.floor(cfg.totemCount);
  if (rows < 2 || cols < 2) throw new Error(`board too small: ${rows}x${cols}`);
  if (totemCount !== (rows * cols) / 2) {
    throw new Error(`totemCount=${totemCount} != rows*cols/2`);
  }
  const seed = Number.isInteger(cfg.seed) ? cfg.seed >>> 0 : 0;
  const rng = mulberry32(seed);
  const tiles = generateBoard(rows, cols, totemCount, rng, cfg.maxRetry);
  const mech = Object.values(MECH).includes(cfg.mech) ? cfg.mech : MECH.NONE;
  const missBudget = Number.isInteger(cfg.missBudget) && cfg.missBudget > 0 ? cfg.missBudget : null;

  return {
    levelId: cfg.levelId ?? null,
    rows,
    cols,
    totemCount,
    seed,
    mech,
    missBudget,
    grid: tiles.slice(),
    faceUp: new Array(tiles.length).fill(false),
    flipped: [],
    foundPairs: [],
    misses: 0,
    combo: 0,
    maxCombo: 0,
    turnsUsed: 0,
    status: STATUS.PLAYING,
  };
}

/** 沙盒可调配置项创建关卡：rows/cols/mech 自选，起始即开放（参 PRD §5 定案 #3） */
export function createSandbox({ rows, cols, mech, seed } = {}) {
  const r = Math.floor(rows ?? 4);
  const c = Math.floor(cols ?? 4);
  const totemCount = (r * c) / 2;
  return createLevel({
    levelId: "sandbox",
    rows: r, cols: c, totemCount,
    seed: Number.isInteger(seed) ? seed : (Date.now() & 0xffffffff),
    mech: mech ?? "none",
    missBudget: null,
    maxRetry: 4000,
  });
}

// ---------------------------------------------------------------------------
// 咯哒轮转
// ---------------------------------------------------------------------------

/**
 * 应用轮转：盘面 grid 与 faceUp 的状态就地修改。
 *
 * 4 邻得上→右→下→左；8 邻得上→右上→右→右下→下→左下→左→左上。
 * - 已翻开位、空槽（grid=null）、参与轮转中心牌自身不参与；
 * - 越界位跳过；
 * - 两个 center 邻接块重叠时，重叠格只参与一次（按第一次错配位置为主）。
 * - 象限整体旋转 90°（gear 机制）：盘面拆 2x2 象限，错配位置所属象限内
 *   所有格（含盖牌/翻开/空槽）整体旋转 90°，这是齿轮联动的物理语义。
 *
 * @returns {Array<{center:number, mech:string, positions:number[]}>} 实际发生的轮转描述（UI 动画/测试断言用）
 */
export function applyRotation(state, centers) {
  switch (state.mech) {
    case MECH.NONE: return [];
    case MECH.RING4: return rotateRing(state, centers, DIRS_4, "ring4");
    case MECH.RING8: return rotateRing(state, centers, DIRS_8, "ring8");
    case MECH.GEAR: return rotateQuadrants(state, centers);
    default: return [];
  }
}

function rotateRing(state, centers, dirs, mechLabel) {
  const rotations = [];
  const alreadyMoved = new Set();
  const exclude = new Set(centers); // 翻错牌自身不参与轮转（PRD §3.1）

  for (const c of centers) {
    const positions = [];
    const cr = Math.floor(c / state.cols);
    const cc = c % state.cols;
    for (const [dr, dc] of dirs) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (nr < 0 || nr >= state.rows || nc < 0 || nc >= state.cols) continue;
      const idx = nr * state.cols + nc;
      if (exclude.has(idx)) continue;                  // 翻错牌自身不参与
      if (state.grid[idx] === null) continue;
      if (state.faceUp[idx]) continue;
      if (alreadyMoved.has(idx)) continue;
      positions.push(idx);
    }
    if (positions.length < 2) continue;

    // 顺时针前进 1 格：旧 positions[i] 的牌前进到新 positions[(i+1) % n]
    // 即 上→右→下→左→上 的物理语义
    const oldTiles = positions.map((idx) => state.grid[idx]);
    const n = positions.length;
    for (let i = 0; i < n; i += 1) {
      const next = (i + 1) % n;
      state.grid[positions[next]] = oldTiles[i];
      alreadyMoved.add(positions[i]);
      alreadyMoved.add(positions[next]);
    }
    rotations.push({ center: c, mech: mechLabel, positions: positions.slice() });
  }
  return rotations;
}

/**
 * 象限整体旋转 90°：盘面分为 2x2 象限，错配位置所属象限内
 * 所有格（含盖牌/翻开/空槽）整体旋转 90°。
 * 若两个错配位置在同一象限则只转一次；不同象限同时转。
 * 仅适配 rows/cols 偶数的盘面（levels.mjs 已约束）。
 */
function rotateQuadrants(state, centers) {
  const rotations = [];
  const seen = new Set();
  const halfRows = Math.floor(state.rows / 2);
  const halfCols = Math.floor(state.cols / 2);
  if (halfRows < 1 || halfCols < 1) return rotations;
  const M = halfRows;
  const N = halfCols;

  for (const c of centers) {
    const cr = Math.floor(c / state.cols);
    const cc = c % state.cols;
    const qr = cr < halfRows ? 0 : 1;
    const qc = cc < halfCols ? 0 : 1;
    const qKey = `${qr},${qc}`;
    if (seen.has(qKey)) continue;
    seen.add(qKey);

    const positions = [];
    for (let r = 0; r < M; r += 1) {
      for (let c2 = 0; c2 < N; c2 += 1) {
        positions.push((qr * M + r) * state.cols + (qc * N + c2));
      }
    }
    const oldTiles = positions.map((idx) => state.grid[idx]);
    const oldFace = positions.map((idx) => state.faceUp[idx]);
    // 顺时针 90° 矩阵：new[r][c] = old[M-1-c][r]
    for (let r = 0; r < M; r += 1) {
      for (let c2 = 0; c2 < N; c2 += 1) {
        const oldR = M - 1 - c2;
        const oldC = r;
        const newIdx = (qr * M + r) * state.cols + (qc * N + c2);
        state.grid[newIdx] = oldTiles[oldR * N + oldC];
        state.faceUp[newIdx] = oldFace[oldR * N + oldC];
      }
    }
    rotations.push({ center: c, mech: "gear", positions: positions.slice() });
  }
  return rotations;
}

// ---------------------------------------------------------------------------
// 翻牌主操作
// ---------------------------------------------------------------------------

/**
 * 翻开位 idx 的盖牌。
 * - 翻 1 张：仅记录（连击续命中可继续翻第 2 张）
 * - 翻 2 张：配对 / 错配；错配时按 mech 触发轮转；终局判断
 *
 * 状态变更就地；返回描述事件的对象供 UI 与测试使用。
 *
 * 合法性：终局 / 已翻 2 张未结清 / 点的是空槽或已翻开位 → action:none 静默。
 */
export function flip(stateIn, idx) {
  if (stateIn.status !== STATUS.PLAYING) return { action: ACTION.NONE, state: stateIn, event: null };
  if (idx < 0 || idx >= stateIn.grid.length) return { action: ACTION.NONE, state: stateIn, event: null };
  if (stateIn.grid[idx] === null) return { action: ACTION.NONE, state: stateIn, event: null };
  if (stateIn.faceUp[idx]) {
    // 翻第 1 张后再点同一张 = 取消（盖回 + 清 flipped）
    if (stateIn.flipped.length === 1 && stateIn.flipped[0] === idx) {
      stateIn.faceUp[idx] = false;
      stateIn.flipped = [];
      return { action: ACTION.CANCEL, state: stateIn, event: { idx } };
    }
    return { action: ACTION.NONE, state: stateIn, event: null };
  }
  if (stateIn.flipped.length >= 2) return { action: ACTION.NONE, state: stateIn, event: null };

  const state = stateIn;
  state.faceUp[idx] = true;
  state.flipped.push(idx);
  if (state.flipped.length < 2) {
    return { action: ACTION.FLIP_ONE, state, event: { idx } };
  }

  const [a, b] = state.flipped;
  if (state.grid[a] === state.grid[b]) {
    const totem = state.grid[a];
    state.grid[a] = null;
    state.grid[b] = null;
    state.faceUp[a] = false;
    state.faceUp[b] = false;
    state.foundPairs.push(totem);
    state.combo += 1;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    state.turnsUsed += 1;

    if (state.grid.every((g) => g === null)) {
      state.status = STATUS.WON;
      return { action: ACTION.MATCH_WIN, state, event: { a, b, totem, rotations: [] } };
    }
    state.flipped = [];
    return { action: ACTION.MATCH, state, event: { a, b, totem, rotations: [] } };
  }

  state.misses += 1;
  state.combo = 0;
  state.turnsUsed += 1;

  // 先盖回两张错配牌，再触发轮转：
  // - 保证旋转时盘面无翻开位（faceUp 全 false），避免 faceUp 跟随位置迁移造成不变量破裂
  // - ring4/ring8 通过 exclude 集合排除翻错牌自身（PRD §3.1 "翻错牌自身不参与轮转"）
  // - gear 象限整体旋转包含所有格，但 faceUp 全 false 时迁移无害
  state.faceUp[a] = false;
  state.faceUp[b] = false;
  state.flipped = [];

  const rotations = applyRotation(state, [a, b]);

  if (state.missBudget !== null && state.misses >= state.missBudget && state.grid.some((g) => g !== null)) {
    state.status = STATUS.LOST;
    return { action: ACTION.MISMATCH_LOSE, state, event: { a, b, rotations } };
  }
  return { action: ACTION.MISMATCH, state, event: { a, b, rotations } };
}

/** 取消第一张已翻开牌（翻第一张后再点同一张 = 取消；容错用）。 */
export function cancelFlip(stateIn) {
  if (stateIn.status !== STATUS.PLAYING) return { action: ACTION.NONE, state: stateIn };
  if (stateIn.flipped.length !== 1) return { action: ACTION.NONE, state: stateIn };
  const state = stateIn;
  const idx = state.flipped[0];
  state.faceUp[idx] = false;
  state.flipped = [];
  return { action: ACTION.CANCEL, state, event: { idx } };
}

/** 当前是否允许翻牌（仅状态判断，UI 提示用） */
export function canFlip(state) {
  return state.status === STATUS.PLAYING && state.flipped.length < 2;
}

/** 当前盘面是否还有未配对图腾 */
export function hasUnmatched(state) {
  return state.grid.some((g) => g !== null);
}

/** 集藏册进度（已配对图腾 id 数组） */
export function foundTotems(state) {
  return state.foundPairs.slice();
}

/**
 * 检验不变量（用于 ≥1000 步随机游走测试与生成器自检）：
 * 1. 盘面图腾守恒：每类图腾总数为偶数（含网格中 + 已找到的对子，每对算 2 张）
 * 2. 翻开位数 ≤ 2
 * 3. 空槽数 = 已配对数 × 2
 */
export function invariantsHold(state) {
  const counts = new Map();
  for (const t of state.grid) {
    if (t === null) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  for (const t of state.foundPairs) {
    counts.set(t, (counts.get(t) ?? 0) + 2);
  }
  for (const [, n] of counts) {
    if (n % 2 !== 0) return false;
  }
  const faceUpCount = state.faceUp.filter(Boolean).length;
  if (faceUpCount > 2) return false;
  const emptyCount = state.grid.filter((g) => g === null).length;
  if (emptyCount !== state.foundPairs.length * 2) return false;
  return true;
}

/** 模拟一回合结束（仅测试辅助）：当前已翻 2 张且没匹配则盖回。 */
export function endTurn(stateIn) {
  const state = stateIn;
  if (state.flipped.length !== 2) return { action: ACTION.NONE, state };
  state.faceUp[state.flipped[0]] = false;
  state.faceUp[state.flipped[1]] = false;
  state.flipped = [];
  return { action: ACTION.END_TURN, state };
}