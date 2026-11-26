// 方块对轰 · 规则唯一权威（严格 DOM-free，可被 node:test 直接驱动的纯规则内核）
// 7-Bag 随机、SRS 超级旋转（含墙踢）、锁延时、Hold、垃圾行缓冲与 1:1 抵消、
// 消行攻击力换算表（Tetris 四行 / T-Spin / Back-to-Back / Combo）全部在这里定义。
// 任何 UI、渲染、存档都不得在此文件出现 document / window / localStorage。

export const COLS = 10;
export const ROWS = 20;
export const VISIBLE_ROWS = ROWS;
export const PIECE_TYPES = Object.freeze(["I", "J", "L", "O", "S", "T", "Z"]);

export const COLORS = Object.freeze({
  I: "#22d3ee",
  J: "#3b6cf6",
  L: "#f59e0b",
  O: "#facc15",
  S: "#34d399",
  T: "#a855f7",
  Z: "#f43f5e",
  G: "#4a4b52",
});

// 每个方块 4 个朝向的绝对格子坐标（SRS 标准朝向盒），坐标为 [x, y]。
export const SHAPES = Object.freeze({
  I: Object.freeze([
    Object.freeze([[0, 1], [1, 1], [2, 1], [3, 1]]),
    Object.freeze([[2, 0], [2, 1], [2, 2], [2, 3]]),
    Object.freeze([[0, 2], [1, 2], [2, 2], [3, 2]]),
    Object.freeze([[1, 0], [1, 1], [1, 2], [1, 3]]),
  ]),
  J: Object.freeze([
    Object.freeze([[0, 0], [0, 1], [1, 1], [2, 1]]),
    Object.freeze([[1, 0], [2, 0], [1, 1], [1, 2]]),
    Object.freeze([[0, 1], [1, 1], [2, 1], [2, 2]]),
    Object.freeze([[0, 0], [1, 0], [1, 1], [1, 2]]),
  ]),
  L: Object.freeze([
    Object.freeze([[2, 0], [0, 1], [1, 1], [2, 1]]),
    Object.freeze([[1, 0], [1, 1], [2, 1], [1, 2]]),
    Object.freeze([[0, 1], [1, 1], [2, 1], [0, 2]]),
    Object.freeze([[1, 0], [0, 1], [1, 1], [1, 2]]),
  ]),
  O: Object.freeze([
    Object.freeze([[1, 0], [2, 0], [1, 1], [2, 1]]),
    Object.freeze([[1, 0], [2, 0], [1, 1], [2, 1]]),
    Object.freeze([[1, 0], [2, 0], [1, 1], [2, 1]]),
    Object.freeze([[1, 0], [2, 0], [1, 1], [2, 1]]),
  ]),
  S: Object.freeze([
    Object.freeze([[1, 0], [2, 0], [0, 1], [1, 1]]),
    Object.freeze([[1, 0], [1, 1], [2, 1], [2, 2]]),
    Object.freeze([[1, 1], [2, 1], [0, 2], [1, 2]]),
    Object.freeze([[0, 0], [0, 1], [1, 1], [1, 2]]),
  ]),
  T: Object.freeze([
    Object.freeze([[0, 1], [1, 1], [2, 1], [1, 0]]),
    Object.freeze([[1, 0], [1, 1], [2, 1], [1, 2]]),
    Object.freeze([[0, 1], [1, 1], [2, 1], [1, 2]]),
    Object.freeze([[1, 0], [0, 1], [1, 1], [1, 2]]),
  ]),
  Z: Object.freeze([
    Object.freeze([[0, 0], [1, 0], [1, 1], [2, 1]]),
    Object.freeze([[2, 0], [1, 1], [2, 1], [1, 2]]),
    Object.freeze([[0, 1], [1, 1], [1, 2], [2, 2]]),
    Object.freeze([[0, 0], [1, 0], [0, 1], [1, 2]]),
  ]),
});

export const SPAWN_X = 3;
export const SPAWN_Y = -1;
export const LOCK_DELAY = 0.5;
export const MAX_LOCK_RESETS = 15;
export const GARBAGE_DELAY = 1.5;
export const GARBAGE_COLOR = "G";

// 消行攻击力换算：单人 0、双行 1、三行 2、Tetris 4。
export const ATTACK_TABLE = Object.freeze({ 0: 0, 1: 0, 2: 1, 3: 2, 4: 4 });
// T-Spin 重炮：单 2、双 4、三 6。
export const TSPIN_ATTACK_TABLE = Object.freeze({ 0: 0, 1: 2, 2: 4, 3: 6 });
export const LINE_SCORES = Object.freeze([0, 100, 300, 500, 800]);
export const TSPIN_SCORES = Object.freeze([0, 400, 800, 1200]);

// SRS 墙踢表（已转换成屏幕坐标：y 向下为正）。
const KICKS_JLSTZ = Object.freeze({
  "01": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "12": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "23": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "30": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
});
const KICKS_I = Object.freeze({
  "01": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "12": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "23": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "30": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
});
const KICKS_O = Object.freeze({ "01": [[0, 0]], "12": [[0, 0]], "23": [[0, 0]], "30": [[0, 0]] });

export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 国际 7-Bag：每 7 个一组纯随机洗牌，保证任何连续 7 块里七种方块各一。
export class BagRandomizer {
  constructor(keys = PIECE_TYPES, rng = Math.random) {
    this.keys = [...keys];
    this.rng = rng;
    this.bag = [];
  }

  reset() {
    this.bag = [];
  }

  next() {
    if (this.bag.length === 0) {
      this.bag = [...this.keys];
      for (let i = this.bag.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }
}

export function createGrid() {
  const grid = [];
  for (let y = 0; y < ROWS; y += 1) grid.push(new Array(COLS).fill(0));
  return grid;
}

export function cellsOf(type, rot) {
  const states = SHAPES[type];
  if (!states) return [];
  return states[((rot % 4) + 4) % 4];
}

export function collide(grid, type, rot, x, y) {
  const cells = cellsOf(type, rot);
  for (let i = 0; i < cells.length; i += 1) {
    const cx = x + cells[i][0];
    const cy = y + cells[i][1];
    if (cx < 0 || cx >= COLS) return true;
    if (cy >= ROWS) return true;
    if (cy >= 0 && grid[cy][cx] !== 0) return true;
  }
  return false;
}

export function dropDistance(grid, type, rot, x, y) {
  let dy = 0;
  while (!collide(grid, type, rot, x, y + dy + 1)) dy += 1;
  return dy;
}

export function ghostOf(board) {
  const p = board.active;
  if (!p) return null;
  return { type: p.type, rot: p.rot, x: p.x, y: p.y + dropDistance(board.grid, p.type, p.rot, p.x, p.y) };
}

export function createBoard(options = {}) {
  const seed = Number.isFinite(options.seed) ? Math.floor(options.seed) : 1;
  const rng = mulberry32(seed);
  const bag = new BagRandomizer(PIECE_TYPES, rng);
  const queue = [];
  for (let i = 0; i < 5; i += 1) queue.push(bag.next());
  return {
    cols: COLS,
    rows: ROWS,
    grid: createGrid(),
    active: null,
    queue,
    bag,
    hold: null,
    holdUsed: false,
    gravityMs: Number.isFinite(options.gravity) ? Math.max(30, options.gravity) : 700,
    gravityAcc: 0,
    softHeld: false,
    grounded: false,
    lockTimer: 0,
    lockResets: 0,
    pending: [],
    garbageTimer: 0,
    combo: 0,
    b2b: false,
    lines: 0,
    score: 0,
    ko: false,
    tspinEligible: false,
    rng,
    seed,
    stats: { attackOut: 0, cancelled: 0, sent: 0, received: 0, garbageApplied: 0 },
    lastEvent: null,
  };
}

export function spawnPiece(board, type, x = SPAWN_X, y = SPAWN_Y) {
  const piece = { type, rot: 0, x, y };
  board.active = piece;
  board.grounded = false;
  board.lockTimer = 0;
  board.lockResets = 0;
  board.tspinEligible = false;
  board.gravityAcc = 0;
  if (collide(board.grid, type, 0, x, y)) {
    board.ko = true;
    return false;
  }
  return true;
}

export function spawnNext(board) {
  const type = board.queue.shift();
  board.queue.push(board.bag.next());
  board.holdUsed = false;
  return spawnPiece(board, type);
}

export function holdPiece(board) {
  if (!board.active || board.holdUsed) return false;
  const current = board.active.type;
  const swapped = board.hold;
  board.hold = current;
  board.holdUsed = true;
  if (swapped) return spawnPiece(board, swapped);
  const next = board.queue.shift();
  board.queue.push(board.bag.next());
  return spawnPiece(board, next);
}

export function moveSide(board, dx) {
  const p = board.active;
  if (!p || dx === 0) return false;
  if (collide(board.grid, p.type, p.rot, p.x + dx, p.y)) return false;
  p.x += dx;
  if (board.grounded && !collide(board.grid, p.type, p.rot, p.x, p.y + 1)) {
    board.grounded = false;
    if (board.lockResets < MAX_LOCK_RESETS) {
      board.lockResets += 1;
      board.lockTimer = 0;
    }
  }
  board.tspinEligible = false;
  return true;
}

export function moveDown(board) {
  const p = board.active;
  if (!p) return false;
  if (!collide(board.grid, p.type, p.rot, p.x, p.y + 1)) {
    p.y += 1;
    board.grounded = false;
    return true;
  }
  board.grounded = true;
  return false;
}

export function softDrop(board) {
  const p = board.active;
  if (!p || board.grounded) return false;
  if (!collide(board.grid, p.type, p.rot, p.x, p.y + 1)) {
    p.y += 1;
    board.score += 1;
    return true;
  }
  board.grounded = true;
  return false;
}

export function hardDrop(board) {
  const p = board.active;
  if (!p) return 0;
  const dy = dropDistance(board.grid, p.type, p.rot, p.x, p.y);
  p.y += dy;
  board.score += dy * 2;
  board.grounded = true;
  return dy;
}

export function rotatePiece(board, dir) {
  const p = board.active;
  if (!p || dir === 0) return { ok: false, kick: [0, 0] };
  const from = p.rot;
  const to = (from + (dir > 0 ? 1 : 3)) % 4;
  const tableKey = `${from}${to}`;
  const type = p.type;
  const kicks = (type === "I" ? KICKS_I : type === "O" ? KICKS_O : KICKS_JLSTZ)[tableKey] ?? [[0, 0]];
  for (let i = 0; i < kicks.length; i += 1) {
    const [dx, dy] = kicks[i];
    if (!collide(board.grid, type, to, p.x + dx, p.y + dy)) {
      p.rot = to;
      p.x += dx;
      p.y += dy;
      board.tspinEligible = true;
      return { ok: true, kick: [dx, dy] };
    }
  }
  return { ok: false, kick: [0, 0] };
}

export function findFullRows(grid) {
  const full = [];
  for (let y = 0; y < grid.length; y += 1) {
    if (grid[y].every((cell) => cell !== 0)) full.push(y);
  }
  return full;
}

export function removeRows(grid, rowsToRemove) {
  if (!rowsToRemove.length) return grid.map((row) => row.slice());
  const dropped = new Set(rowsToRemove);
  const kept = grid.filter((_, y) => !dropped.has(y)).map((row) => row.slice());
  while (kept.length < grid.length) kept.unshift(new Array(grid[0].length).fill(0));
  return kept;
}

export function comboBonusOf(combo) {
  return combo >= 2 ? Math.floor((combo - 2) / 2) + 1 : 0;
}

export function attackFor({ lines, tspin = false, combo = 0, b2bBefore = false }) {
  if (!lines || lines < 1) return 0;
  const base = tspin ? TSPIN_ATTACK_TABLE[lines] ?? 0 : ATTACK_TABLE[lines] ?? 0;
  const difficult = lines === 4 || tspin;
  const b2bBonus = difficult && b2bBefore ? 1 : 0;
  const comboBonus = comboBonusOf(combo);
  return base + b2bBonus + comboBonus;
}

function cornerBlocked(grid, x, y) {
  if (x < 0 || x >= COLS) return true;
  if (y >= ROWS) return true;
  if (y < 0) return false;
  return grid[y][x] !== 0;
}

export function detectTSpin(board) {
  const p = board.active;
  if (!p || p.type !== "T" || !board.tspinEligible) return false;
  const cx = p.x + 1;
  const cy = p.y + 1;
  let filled = 0;
  if (cornerBlocked(board.grid, cx - 1, cy - 1)) filled += 1;
  if (cornerBlocked(board.grid, cx + 1, cy - 1)) filled += 1;
  if (cornerBlocked(board.grid, cx - 1, cy + 1)) filled += 1;
  if (cornerBlocked(board.grid, cx + 1, cy + 1)) filled += 1;
  return filled >= 3;
}

// 锁定当前方块：合并、消行、结算攻击力。返回结算明细，供控制器做抵消与对攻。
export function lockPiece(board) {
  const p = board.active;
  if (!p) {
    return { lines: 0, rows: [], tspin: false, b2b: false, combo: board.combo, attack: 0, score: 0, ko: board.ko, lockOut: false };
  }
  const tspin = detectTSpin(board);
  let lockOut = false;
  const cells = cellsOf(p.type, p.rot);
  for (let i = 0; i < cells.length; i += 1) {
    const x = p.x + cells[i][0];
    const y = p.y + cells[i][1];
    if (y < 0) {
      lockOut = true;
      continue;
    }
    if (y >= ROWS || x < 0 || x >= COLS) {
      lockOut = true;
      continue;
    }
    board.grid[y][x] = COLORS[p.type] ?? p.type;
  }

  const fullRows = findFullRows(board.grid);
  const lines = fullRows.length;
  if (lines > 0) board.grid = removeRows(board.grid, fullRows);

  const b2bBefore = board.b2b;
  const difficult = lines === 4 || (tspin && lines > 0);
  const comboAfter = lines > 0 ? board.combo + 1 : 0;
  const attack = attackFor({ lines, tspin, combo: comboAfter, b2bBefore });

  if (lines > 0) {
    board.combo = comboAfter;
    board.b2b = difficult;
    board.lines += lines;
    board.score += LINE_SCORES[lines] + (tspin ? TSPIN_SCORES[Math.min(lines, 3)] : 0);
  } else {
    board.combo = 0;
  }

  board.active = null;
  board.grounded = false;
  board.lockTimer = 0;
  board.tspinEligible = false;
  const ko = board.ko || lockOut;
  board.ko = ko;
  board.stats.attackOut += attack;
  const result = { lines, rows: fullRows, tspin, b2b: board.b2b, b2bTriggered: difficult && b2bBefore, combo: board.combo, attack, score: board.score, ko, lockOut };
  board.lastEvent = result;
  return result;
}

// 波浪垃圾行：同一波 70% 概率共用同一缺口列，保留“一根长条反打”的戏剧性生机。
export function makeGarbageHoles(count, rng, alignChance = 0.7) {
  const holes = [];
  if (count <= 0) return holes;
  const base = Math.floor(rng() * COLS);
  const aligned = rng() < alignChance;
  for (let i = 0; i < count; i += 1) {
    holes.push(aligned ? base : Math.floor(rng() * COLS));
  }
  return holes;
}

export function addIncoming(board, count, rng = board.rng) {
  if (count <= 0) return 0;
  const holes = makeGarbageHoles(count, rng);
  board.pending.push(...holes);
  board.garbageTimer = GARBAGE_DELAY;
  board.stats.received += count;
  return count;
}

export function cancelPending(board, amount) {
  let left = Math.max(0, Math.floor(amount));
  let removed = 0;
  while (left > 0 && board.pending.length > 0) {
    board.pending.shift();
    left -= 1;
    removed += 1;
  }
  board.stats.cancelled += removed;
  return left;
}

// 从底部插入垃圾行；顶部的方块被挤出棋盘即判定被顶穿（KO）。
export function insertGarbage(board, holes) {
  const count = holes.length;
  if (!count) return { rows: 0, ko: false };
  let overflow = false;
  for (let y = 0; y < count; y += 1) {
    if (board.grid[y].some((cell) => cell !== 0)) overflow = true;
  }
  const kept = board.grid.slice(count).map((row) => row.slice());
  const fresh = holes.map((hole) => {
    const row = new Array(COLS).fill(GARBAGE_COLOR);
    row[Math.max(0, Math.min(COLS - 1, hole))] = 0;
    return row;
  });
  board.grid = [...kept, ...fresh];
  board.stats.garbageApplied += count;
  if (board.active) {
    board.active.y -= count;
    if (collide(board.grid, board.active.type, board.active.rot, board.active.x, board.active.y)) overflow = true;
  }
  if (overflow) board.ko = true;
  return { rows: count, ko: overflow };
}

// 缓冲槽到点（或玩家锁定下一块）时升起，全部待处理垃圾行一次性灌入。
export function flushGarbage(board) {
  if (!board.pending.length) return { rows: 0, ko: board.ko };
  const holes = board.pending.splice(0, board.pending.length);
  board.garbageTimer = 0;
  return insertGarbage(board, holes);
}

export function pendingOf(board) {
  return board.pending.length;
}

export function boardHeight(grid) {
  for (let y = 0; y < grid.length; y += 1) {
    if (grid[y].some((cell) => cell !== 0)) return grid.length - y;
  }
  return 0;
}
