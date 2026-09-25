// 规则唯一权威：DOM-free 纯函数与玩法数值表。
// 不碰 document / window / localStorage，因此可被 node:test 直接验证。
// 玩法数值与外部交付版逐字一致，抽取过程不改平衡。

export const BOARD_CONFIGS = Object.freeze({
  mini: Object.freeze({ cols: 8, rows: 16 }),
  standard: Object.freeze({ cols: 10, rows: 20 }),
  wide: Object.freeze({ cols: 12, rows: 22 }),
});

export const DIFFICULTY_CONFIGS = Object.freeze({
  casual: Object.freeze({ startSpeed: 1050, step: 60, minSpeed: 180 }),
  normal: Object.freeze({ startSpeed: 800, step: 70, minSpeed: 100 }),
  master: Object.freeze({ startSpeed: 360, step: 35, minSpeed: 60 }),
});

export const COLORS = Object.freeze({
  I: "#00f0ff",
  J: "#2563eb",
  L: "#f97316",
  O: "#eab308",
  S: "#10b981",
  T: "#a855f7",
  Z: "#ef4444",
});

const shape = (rows) => Object.freeze(rows.map((row) => Object.freeze(row)));

export const SHAPES = Object.freeze({
  I: shape([[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]]),
  J: shape([[1, 0, 0], [1, 1, 1], [0, 0, 0]]),
  L: shape([[0, 0, 1], [1, 1, 1], [0, 0, 0]]),
  O: shape([[1, 1], [1, 1]]),
  S: shape([[0, 1, 1], [1, 1, 0], [0, 0, 0]]),
  T: shape([[0, 1, 0], [1, 1, 1], [0, 0, 0]]),
  Z: shape([[1, 1, 0], [0, 1, 1], [0, 0, 0]]),
});

export const PIECE_TYPES = Object.freeze(Object.keys(SHAPES));

// 消行得分表：下标 = 单次消行数，乘以当前等级。
export const LINE_SCORES = Object.freeze([0, 100, 300, 500, 800]);
export const LINES_PER_LEVEL = 10;

// 7-Bag 随机器：每 7 个一组不重复，rng 可注入以便测试用固定种子。
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
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }
}

export function createMatrix(width, height) {
  const matrix = [];
  for (let y = 0; y < height; y += 1) matrix.push(new Array(width).fill(0));
  return matrix;
}

export function createPiece(type, cols) {
  const matrix = SHAPES[type];
  return {
    matrix,
    color: COLORS[type],
    type,
    pos: { x: (cols / 2 | 0) - (matrix[0].length / 2 | 0), y: 0 },
  };
}

export function rotateMatrix(matrix) {
  return matrix.map((_, i) => matrix.map((col) => col[i]).reverse());
}

// 棋盘尺寸一律从 grid 自身推导：存档恢复后 grid 维度已与当前 board 校验一致。
export function collide(grid, piece, offset = { x: 0, y: 0 }) {
  const rows = grid.length;
  const cols = grid[0].length;
  const m = piece.matrix;
  const p = piece.pos;
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0) {
        const nx = p.x + x + offset.x;
        const ny = p.y + y + offset.y;
        if (nx < 0 || nx >= cols || ny >= rows) return true;
        if (ny >= 0 && grid[ny][nx] !== 0) return true;
      }
    }
  }
  return false;
}

// 幽灵方块落点：一直下移到再挪一格就碰撞为止。
export function dropPosition(grid, piece) {
  const ghost = { matrix: piece.matrix, pos: { x: piece.pos.x, y: piece.pos.y } };
  while (!collide(grid, ghost, { x: 0, y: 1 })) ghost.pos.y++;
  return ghost.pos.y;
}

// 墙踢：旋转后按净位移 0, +1, -1, +2, -2 … 依次试探，全部失败返回 null（调用方保持原姿态）。
// offset 是增量、net 是累加后的净位移——直接拿 offset 当位移会探到不对称的位置。
export function rotateWithKick(grid, piece) {
  const rotated = rotateMatrix(piece.matrix);
  const limit = rotated[0].length;
  let net = 0;
  let offset = 1;
  for (;;) {
    const candidate = { ...piece, matrix: rotated, pos: { ...piece.pos, x: piece.pos.x + net } };
    if (!collide(grid, candidate)) return candidate;
    net += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > limit) return null;
  }
}

export function mergeInto(grid, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        const targetY = piece.pos.y + y;
        if (targetY >= 0) grid[targetY][piece.pos.x + x] = piece.color;
      }
    });
  });
  return grid;
}

export function findFullRows(grid) {
  const full = [];
  for (let y = 0; y < grid.length; y += 1) {
    if (grid[y].every((cell) => cell !== 0)) full.push(y);
  }
  return full;
}

// 删行等价于原来的 splice + unshift：顶部补等量空行，保持行数不变。
export function removeRows(grid, rowIndexes) {
  const dropped = new Set(rowIndexes);
  const next = grid.filter((_, y) => !dropped.has(y));
  const cols = grid[0].length;
  while (next.length < grid.length) next.unshift(new Array(cols).fill(0));
  return next;
}

export function scoreForLines(linesCleared, level) {
  return (LINE_SCORES[linesCleared] ?? 0) * level;
}

export function levelForLines(totalLines) {
  return Math.floor(totalLines / LINES_PER_LEVEL) + 1;
}

export function dropIntervalFor(difficulty, level) {
  const cfg = DIFFICULTY_CONFIGS[difficulty] ?? DIFFICULTY_CONFIGS.normal;
  return Math.max(cfg.minSpeed, cfg.startSpeed - (level - 1) * cfg.step);
}
