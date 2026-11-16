// 对手 AI：DOM-free 的落点评估器。只做“给定棋盘与方块，选出最优落点”，
// 具体按键节奏由 game.mjs 按关卡参数逐步执行，所以 AI 的思考过程肉眼可见。

import { COLS, ROWS, cellsOf, collide, dropDistance, findFullRows, removeRows } from "./engine.mjs";

function copyGrid(grid) {
  return grid.map((row) => row.slice());
}

// Dellacherie 风格的地形特征：越高、洞越多、越崎岖，越危险。
export function analyzeGrid(grid) {
  const heights = new Array(COLS).fill(0);
  let holes = 0;
  for (let x = 0; x < COLS; x += 1) {
    let first = -1;
    for (let y = 0; y < ROWS; y += 1) {
      if (grid[y][x] !== 0) {
        first = y;
        break;
      }
    }
    if (first === -1) continue;
    heights[x] = ROWS - first;
    for (let y = first + 1; y < ROWS; y += 1) {
      if (grid[y][x] === 0) holes += 1;
    }
  }
  let aggregate = 0;
  let bumpiness = 0;
  let maxHeight = 0;
  for (let x = 0; x < COLS; x += 1) {
    aggregate += heights[x];
    maxHeight = Math.max(maxHeight, heights[x]);
    if (x > 0) bumpiness += Math.abs(heights[x] - heights[x - 1]);
  }

  let wells = 0;
  for (let x = 0; x < COLS; x += 1) {
    const leftWall = x === 0 ? ROWS : heights[x - 1];
    const rightWall = x === COLS - 1 ? ROWS : heights[x + 1];
    const wall = Math.min(leftWall, rightWall);
    if (heights[x] < wall - 2) wells += wall - 2 - heights[x];
  }

  let rowTransitions = 0;
  for (let y = 0; y < ROWS; y += 1) {
    let prev = 1;
    for (let x = 0; x < COLS; x += 1) {
      const filled = grid[y][x] !== 0 ? 1 : 0;
      if (filled !== prev) rowTransitions += 1;
      prev = filled;
    }
    if (prev === 0) rowTransitions += 1;
  }
  let colTransitions = 0;
  for (let x = 0; x < COLS; x += 1) {
    let prev = 0;
    for (let y = 0; y < ROWS; y += 1) {
      const filled = grid[y][x] !== 0 ? 1 : 0;
      if (filled !== prev) colTransitions += 1;
      prev = filled;
    }
  }

  return { heights, holes, aggregate, bumpiness, maxHeight, wells, rowTransitions, colTransitions };
}

function scoreCandidate(grid, type, rot, x, profile, pending) {
  const cells = cellsOf(type, rot);
  let fits = true;
  for (let i = 0; i < cells.length; i += 1) {
    const cx = x + cells[i][0];
    if (cx < 0 || cx >= COLS) {
      fits = false;
      break;
    }
  }
  if (!fits) return null;
  let y = -4;
  if (collide(grid, type, rot, x, y)) return null;
  const dy = dropDistance(grid, type, rot, x, y);
  const finalY = y + dy;
  if (finalY < 0) return null;

  const next = copyGrid(grid);
  let landingHeight = 0;
  for (let i = 0; i < cells.length; i += 1) {
    const cx = x + cells[i][0];
    const cy = finalY + cells[i][1];
    if (cy < 0 || cy >= ROWS || cx < 0 || cx >= COLS) {
      fits = false;
      break;
    }
    next[cy][cx] = 1;
    landingHeight += ROWS - cy;
  }
  if (!fits) return null;
  landingHeight = cells.length > 0 ? landingHeight / cells.length : 0;

  const full = findFullRows(next);
  const cleared = full.length;
  const settled = removeRows(next, full);
  const f = analyzeGrid(settled);

  let score = 0;
  score -= 0.51 * f.aggregate;
  score -= 0.36 * f.holes;
  score -= 0.18 * f.bumpiness;
  score -= 0.26 * f.wells;
  score -= 0.05 * (f.rowTransitions + f.colTransitions);
  score += 0.76 * cleared * 1.4;
  if (f.maxHeight > 16) score -= (f.maxHeight - 16) * 2.6;
  if (f.holes > 10) score -= (f.holes - 10) * 0.45;

  // 蓄力四行：没有垃圾压力时，低级消行会被扣分，Tetris 重炮加分。
  if (pending <= 0 && profile.tetrisBias > 0) {
    if (cleared >= 1 && cleared < 4) score -= profile.tetrisBias * (4 - cleared) * 1.8;
    if (cleared === 4) score += profile.tetrisBias * 5.0;
  }
  // 对手正在压过来：任何消行都是救命抵消，优先消行。
  if (pending > 0) {
    score += profile.garbageAware * cleared * 9.0;
    if (cleared > 0) score += profile.garbageAware * 3.0;
  }

  return { rot, x, y: finalY, score, cleared, landingHeight };
}

export function collectMoves(grid, type, profile, pending = 0) {
  const moves = [];
  const seen = new Set();
  for (let rot = 0; rot < 4; rot += 1) {
    for (let x = -3; x <= COLS; x += 1) {
      const candidate = scoreCandidate(grid, type, rot, x, profile, pending);
      if (!candidate) continue;
      const key = `${rot}:${x}:${candidate.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push(candidate);
    }
  }
  return moves;
}

// 选出本块的最佳方案。useHold 表示先换手，再按 rotations / targetX 下落。
export function planPlacement(board, profile, rng = Math.random) {
  const active = board.active;
  if (!active) return null;
  const pending = board.pending.length;
  let moves = collectMoves(board.grid, active.type, profile, pending).map((move) => ({ ...move, useHold: false }));

  if (profile.holdSkill > 0 && !board.holdUsed) {
    const alt = board.hold ?? board.queue[0];
    if (alt && alt !== active.type) {
      const held = collectMoves(board.grid, alt, profile, pending).map((move) => ({ ...move, useHold: true }));
      moves = moves.concat(held);
    }
  }
  if (!moves.length) return null;
  moves.sort((a, b) => b.score - a.score);

  let chosen = moves[0];
  if (profile.mistake > 0 && moves.length > 1 && rng() < profile.mistake) {
    const window = Math.min(moves.length, 6);
    const index = Math.floor(rng() * window);
    chosen = moves[index];
  }

  const rotations = chosen.rot;
  const targetX = chosen.x;
  return {
    useHold: chosen.useHold,
    rotations,
    targetX,
    y: chosen.y,
    score: chosen.score,
    cleared: chosen.cleared,
    type: chosen.useHold ? (board.hold ?? board.queue[0]) : active.type,
  };
}

// AI 每步操作：按当前实际位置判断下一步该转、该移，还是直接硬降。
export function nextAiAction(plan, board) {
  if (!plan || !board.active) return "drop";
  if (plan.rotations > 0) {
    plan.rotations -= 1;
    return "rotate";
  }
  if (board.active.x < plan.targetX) return "right";
  if (board.active.x > plan.targetX) return "left";
  return "drop";
}
