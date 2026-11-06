/**
 * 数字华容道核心规则引擎 (DOM-free)
 * 严格遵从纯函数范式，不碰 document / window / localStorage
 */

/**
 * 确定性 PRNG (Mulberry32)
 */
export function createRng(seed = 123456789) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 创建已归位的终态棋盘
 * @param {number} size 棋盘边长 (3, 4, 5, 6)
 * @returns {number[]} 长度为 size*size 的数组，1 ~ size*size-1，末尾为 0
 */
export function createSolvedBoard(size = 4) {
  const total = size * size;
  const board = new Array(total);
  for (let i = 0; i < total - 1; i++) {
    board[i] = i + 1;
  }
  board[total - 1] = 0; // 0 代表空格
  return board;
}

/**
 * 查找空格坐标与索引
 */
export function findBlank(board, size) {
  const index = board.indexOf(0);
  if (index === -1) return { row: -1, col: -1, index: -1 };
  const row = Math.floor(index / size);
  const col = index % size;
  return { row, col, index };
}

/**
 * 判断棋盘是否已完美归位
 */
export function isSolved(board, size) {
  const total = size * size;
  if (board.length !== total) return false;
  for (let i = 0; i < total - 1; i++) {
    if (board[i] !== i + 1) return false;
  }
  return board[total - 1] === 0;
}

/**
 * 计算逆序数 (忽略空格 0)
 */
export function countInversions(board) {
  let inv = 0;
  const len = board.length;
  for (let i = 0; i < len - 1; i++) {
    const a = board[i];
    if (a === 0) continue;
    for (let j = i + 1; j < len; j++) {
      const b = board[j];
      if (b !== 0 && a > b) {
        inv++;
      }
    }
  }
  return inv;
}

/**
 * 数学可解性校验判定
 * - 奇数阶 (3, 5): 逆序数为偶数即充要可解
 * - 偶数阶 (4, 6): (逆序数 + 空格距底部的行数 [1-based]) 为偶数
 */
export function isSolvable(board, size) {
  const inv = countInversions(board);
  const blank = findBlank(board, size);
  if (blank.row === -1) return false;

  if (size % 2 === 1) {
    return inv % 2 === 0;
  } else {
    const rowFromBottom = size - blank.row; // 1-based 从下往上行数
    return (inv + rowFromBottom) % 2 === 1;
  }
}

/**
 * 计算点击/滑动目标瓦片时能够连推的所有滑块路径 (整行/整列连推)
 * @returns {null | { direction: string, tiles: Array<{ value: number, fromRow: number, fromCol: number, toRow: number, toCol: number }> }}
 */
export function getSlidePath(board, size, targetRow, targetCol) {
  if (targetRow < 0 || targetRow >= size || targetCol < 0 || targetCol >= size) {
    return null;
  }
  const blank = findBlank(board, size);
  if (blank.row === targetRow && blank.col === targetCol) {
    return null; // 点的就是空格本身
  }

  // 同一行：水平滑动
  if (blank.row === targetRow) {
    const moved = [];
    if (targetCol < blank.col) {
      // 目标在空格左侧，整段方块向右移动填补空格
      for (let c = blank.col - 1; c >= targetCol; c--) {
        const val = board[blank.row * size + c];
        moved.push({
          value: val,
          fromRow: blank.row,
          fromCol: c,
          toRow: blank.row,
          toCol: c + 1,
        });
      }
      return { direction: "right", tiles: moved };
    } else {
      // 目标在空格右侧，整段方块向左移动填补空格
      for (let c = blank.col + 1; c <= targetCol; c++) {
        const val = board[blank.row * size + c];
        moved.push({
          value: val,
          fromRow: blank.row,
          fromCol: c,
          toRow: blank.row,
          toCol: c - 1,
        });
      }
      return { direction: "left", tiles: moved };
    }
  }

  // 同一列：垂直滑动
  if (blank.col === targetCol) {
    const moved = [];
    if (targetRow < blank.row) {
      // 目标在空格上方，整段方块向下移动填补空格
      for (let r = blank.row - 1; r >= targetRow; r--) {
        const val = board[r * size + blank.col];
        moved.push({
          value: val,
          fromRow: r,
          fromCol: blank.col,
          toRow: r + 1,
          toCol: blank.col,
        });
      }
      return { direction: "down", tiles: moved };
    } else {
      // 目标在空格下方，整段方块向上移动填补空格
      for (let r = blank.row + 1; r <= targetRow; r++) {
        const val = board[r * size + blank.col];
        moved.push({
          value: val,
          fromRow: r,
          fromCol: blank.col,
          toRow: r - 1,
          toCol: blank.col,
        });
      }
      return { direction: "up", tiles: moved };
    }
  }

  // 不在同行同列，无法推入
  return null;
}

/**
 * 应用一次移动 (支持单格或跨格连推)
 * @returns {{ success: boolean, action: string | null, newBoard: number[], movedTiles: Array, newBlank: {row: number, col: number} }}
 */
export function applyMove(board, size, targetRow, targetCol) {
  const path = getSlidePath(board, size, targetRow, targetCol);
  if (!path || path.tiles.length === 0) {
    return {
      success: false,
      action: null,
      newBoard: board,
      movedTiles: [],
      newBlank: findBlank(board, size),
    };
  }

  const nextBoard = [...board];
  for (const t of path.tiles) {
    nextBoard[t.toRow * size + t.toCol] = t.value;
  }
  // 空格移动到 targetRow, targetCol
  nextBoard[targetRow * size + targetCol] = 0;

  return {
    success: true,
    action: path.direction,
    newBoard: nextBoard,
    movedTiles: path.tiles,
    newBlank: { row: targetRow, col: targetCol, index: targetRow * size + targetCol },
  };
}

/**
 * 键盘方向移动
 * @param {'up'|'down'|'left'|'right'} direction
 * @param {'push-tile'|'move-blank'} mode 默认 push-tile
 */
export function moveByDirection(board, size, direction, mode = "push-tile") {
  const blank = findBlank(board, size);
  let targetRow = blank.row;
  let targetCol = blank.col;

  if (mode === "push-tile") {
    // 例如 按 'down': 上方方块向下落入空格
    if (direction === "up") targetRow = blank.row + 1;
    else if (direction === "down") targetRow = blank.row - 1;
    else if (direction === "left") targetCol = blank.col + 1;
    else if (direction === "right") targetCol = blank.col - 1;
  } else {
    // move-blank: 移动空格视角
    if (direction === "up") targetRow = blank.row - 1;
    else if (direction === "down") targetRow = blank.row + 1;
    else if (direction === "left") targetCol = blank.col - 1;
    else if (direction === "right") targetCol = blank.col + 1;
  }

  return applyMove(board, size, targetRow, targetCol);
}

/**
 * 从完全归位终态逆向随机游走打乱，拓扑保证 100% 可解
 * @param {number} size 棋盘大小
 * @param {number} steps 逆推步数
 * @param {Function} [rng] 随机数发生器
 */
export function shuffleBoard(size = 4, steps = 120, rng = Math.random) {
  let board = createSolvedBoard(size);
  let prevTarget = -1;

  for (let s = 0; s < steps; s++) {
    const blank = findBlank(board, size);
    const candidates = [];

    // 四向邻居
    if (blank.row > 0) candidates.push({ r: blank.row - 1, c: blank.col });
    if (blank.row < size - 1) candidates.push({ r: blank.row + 1, c: blank.col });
    if (blank.col > 0) candidates.push({ r: blank.row, c: blank.col - 1 });
    if (blank.col < size - 1) candidates.push({ r: blank.row, c: blank.col + 1 });

    // 过滤掉上一动反悔的震荡
    const filtered = candidates.filter((cand) => cand.r * size + cand.c !== prevTarget);
    const pool = filtered.length > 0 ? filtered : candidates;
    const choice = pool[Math.floor(rng() * pool.length)];

    const res = applyMove(board, size, choice.r, choice.c);
    if (res.success) {
      board = res.newBoard;
      prevTarget = blank.row * size + blank.col;
    }
  }

  // 若极其偶然打乱后仍是归位状态，强制再走两步
  if (isSolved(board, size)) {
    const blank = findBlank(board, size);
    const neighborR = blank.row > 0 ? blank.row - 1 : blank.row + 1;
    board = applyMove(board, size, neighborR, blank.col).newBoard;
  }

  return board;
}
