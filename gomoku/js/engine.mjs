// 五子连珠规则引擎：纯函数、零依赖，不触碰 DOM / storage / 计时器。
// 棋盘 15×15，扁平 Array，索引 = row * 15 + col。
// 状态转换不可变：applyMove 非法时返回传入的同一引用。
// 黑方启用 Renju 禁手（三三 / 四四 / 长连）。

export const SIZE = 15;
export const WIN_LENGTH = 5;
export const CELL_COUNT = SIZE * SIZE;

export const EMPTY = 0;
export const BLACK = 1; // 先手
export const WHITE = 2; // 后手

export const STATUS_PLAYING = "playing";
export const STATUS_WON = "won";
export const STATUS_FORBIDDEN = "forbidden"; // 黑方走出禁手，白方胜
export const STATUS_DRAW = "draw";

export const DIRS = [
  [0, 1], // 横 →
  [1, 0], // 竖 ↓
  [1, 1], // 右下 ↘
  [1, -1], // 左下 ↙
];

// ─── 坐标与索引互转 ───────────────────────────────────────────────
export function idx(row, col) {
  return row * SIZE + col;
}

export function rc(index) {
  return [Math.floor(index / SIZE), index % SIZE];
}

export function inBounds(row, col) {
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE;
}

export function other(player) {
  if (player === BLACK) return WHITE;
  if (player === WHITE) return BLACK;
  return EMPTY;
}

// ─── 模式（Pattern）识别 ──────────────────────────────────────────
// 沿一条方向线，分析以 (row, col) 为核心的连子结构。
// 返回 { count, openEnds }：连子数 + 两端开放数（0=双堵, 1=单开放, 2=双开放）
// 调用方根据 count + openEnds 推断模式：活四(4,2)、冲四(4,1)、活三(3,2)、眠三(3,1)...
export function lineShape(board, row, col, dr, dc, player) {
  if (!inBounds(row, col) || board[idx(row, col)] !== player) {
    return { count: 0, openEnds: 0 };
  }
  let count = 1;
  // 正方向延伸
  let r = row + dr;
  let c = col + dc;
  while (inBounds(r, c) && board[idx(r, c)] === player) {
    count += 1;
    r += dr;
    c += dc;
  }
  const openPos = inBounds(r, c) && board[idx(r, c)] === EMPTY ? 1 : 0;
  // 反方向延伸
  r = row - dr;
  c = col - dc;
  while (inBounds(r, c) && board[idx(r, c)] === player) {
    count += 1;
    r -= dr;
    c -= dc;
  }
  const openNeg = inBounds(r, c) && board[idx(r, c)] === EMPTY ? 1 : 0;
  return { count, openEnds: openPos + openNeg };
}

// 检查 (row, col) 落子后是否形成五连或长连（白方无长连限制）。
// 返回：{ win: bool, overline: bool, line: [indices] | null }
export function checkLineAt(board, row, col, player) {
  const result = { win: false, overline: false, line: null };
  if (!inBounds(row, col) || board[idx(row, col)] !== player) return result;
  for (const [dr, dc] of DIRS) {
    const cells = [idx(row, col)];
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[idx(r, c)] === player) {
      cells.push(idx(r, c));
      r += dr;
      c += dc;
    }
    r = row - dr;
    c = col - dc;
    while (inBounds(r, c) && board[idx(r, c)] === player) {
      cells.unshift(idx(r, c));
      r -= dr;
      c -= dc;
    }
    if (cells.length >= WIN_LENGTH) {
      if (cells.length === WIN_LENGTH) {
        return { win: true, overline: false, line: cells };
      }
      // 长连（6+）
      return { win: false, overline: true, line: cells };
    }
  }
  return result;
}

// ─── 黑方禁手判定 ────────────────────────────────────────────────
// 禁手仅对黑方生效。落子后扫描，若构成禁手则判负。
// 三三：同时形成 ≥2 个活三
// 四四：同时形成 ≥2 个四（活四或冲四）
// 长连：六子或以上连线
// 注意：禁手判定基于落子后的盘面，需扫描所有过该子的线。
export function classifyShape(board, row, col, player) {
  // 返回该子在每个方向上的模式：{ fours, openThrees, overline }
  let fours = 0;
  let openThrees = 0;
  let overline = false;
  for (const [dr, dc] of DIRS) {
    const shape = lineShape(board, row, col, dr, dc, player);
    if (shape.count >= 6) {
      overline = true;
    } else if (shape.count === 5) {
      // 五连，正常胜
    } else if (shape.count === 4) {
      fours += 1; // 任意四都算（活四 openEnds=2，冲四 openEnds=1）
    } else if (shape.count === 3 && shape.openEnds === 2) {
      openThrees += 1; // 活三
    }
  }
  return { fours, openThrees, overline };
}

export function isForbidden(board, row, col, player) {
  if (player !== BLACK) return false;
  const { fours, openThrees, overline } = classifyShape(board, row, col, player);
  if (overline) return true; // 长连禁手
  if (fours >= 2) return true; // 四四禁手
  if (openThrees >= 2) return true; // 三三禁手
  return false;
}

// ─── 候选着法生成 ─────────────────────────────────────────────────
// 只考虑距已有棋子 ≤ 2 格的空位，分支因子从 225 压到 20-40。
export function candidateMoves(state, radius = 2) {
  const result = new Set();
  const board = state.board;
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (board[i] === EMPTY) continue;
    const [r, c] = rc(i);
    for (let dr = -radius; dr <= radius; dr += 1) {
      for (let dc = -radius; dc <= radius; dc += 1) {
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const ni = idx(nr, nc);
        if (board[ni] === EMPTY) result.add(ni);
      }
    }
  }
  if (result.size === 0 && state.moves.length === 0) {
    return [idx(7, 7)]; // 天元开局
  }
  return [...result];
}

export function legalMoves(state) {
  if (state.status !== STATUS_PLAYING) return [];
  // 残局模式可能限定某些着法为唯一解，但引擎层面仍按全候选返回
  return candidateMoves(state);
}

// ─── 状态构造与落子 ───────────────────────────────────────────────
// createState 接受 preset（残局预落子）与 moves（回放序列）。
// moves 通过 applyMove 逐步推进，自动算出终局 status / winner / winLine。
// 非法步静默跳过，state.moves 只含已成功落下的合法步。
export function createState(config = {}) {
  const board = new Array(CELL_COUNT).fill(EMPTY);
  // 支持预落子（残局模式）
  if (Array.isArray(config.preset)) {
    for (const m of config.preset) {
      if (m && Number.isInteger(m.pos) && m.pos >= 0 && m.pos < CELL_COUNT) {
        board[m.pos] = m.player === WHITE ? WHITE : BLACK;
      }
    }
  }
  const firstPlayer = config.firstPlayer === WHITE ? WHITE : BLACK;
  // current 缺省取 firstPlayer；显式 BLACK / WHITE 时取该值
  const current =
    config.current === WHITE ? WHITE
    : config.current === BLACK ? BLACK
    : firstPlayer;
  let state = {
    size: SIZE,
    winLength: WIN_LENGTH,
    firstPlayer,
    current,
    board,
    moves: [],
    status: STATUS_PLAYING,
    winner: EMPTY,
    winLine: null,
    lastMove: -1,
    // 残局模式上下文
    tsumego: config.tsumego ?? null,
  };
  // 若 moves 提供，按其逐步 applyMove 重建（终局 status 会自动算出）
  const moves = Array.isArray(config.moves) ? config.moves : [];
  for (const m of moves) {
    const next = applyMove(state, m);
    if (next !== state) state = next;
  }
  return state;
}

export function applyMove(state, index) {
  if (state.status !== STATUS_PLAYING) return state;
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) return state;
  if (state.board[index] !== EMPTY) return state;

  const player = state.current;
  const board = state.board.slice();
  board[index] = player;
  const [r, c] = rc(index);

  // 长连 / 五连检查
  const lineResult = checkLineAt(board, r, c, player);
  let nextStatus = STATUS_PLAYING;
  let winner = EMPTY;
  let winLine = null;

  if (lineResult.win) {
    nextStatus = STATUS_WON;
    winner = player;
    winLine = lineResult.line;
  } else if (lineResult.overline) {
    if (player === BLACK) {
      // 黑方长连禁手 → 白方胜
      nextStatus = STATUS_FORBIDDEN;
      winner = WHITE;
      winLine = lineResult.line;
    } else {
      // 白方无禁手，长连也算胜
      nextStatus = STATUS_WON;
      winner = WHITE;
      winLine = lineResult.line;
    }
  } else if (player === BLACK && isForbidden(board, r, c, BLACK)) {
    // 三三 / 四四 禁手
    nextStatus = STATUS_FORBIDDEN;
    winner = WHITE;
    winLine = null;
  } else {
    // 检查和棋
    const draw = board.every((cell) => cell !== EMPTY);
    if (draw) nextStatus = STATUS_DRAW;
  }

  return {
    size: state.size,
    winLength: state.winLength,
    firstPlayer: state.firstPlayer,
    current: nextStatus === STATUS_PLAYING ? other(player) : EMPTY,
    board,
    moves: state.moves.concat(index),
    status: nextStatus,
    winner,
    winLine,
    lastMove: index,
    tsumego: state.tsumego,
  };
}

// 从落子序列重建状态。任何非法步静默忽略。
// createState 已自动按 moves 逐步 applyMove 推进状态并算出终局。
export function replay(config = {}) {
  return createState(config);
}

export function boardKey(state) {
  return state.board.join("");
}

// ─── 模式评估表（Pattern Score Table）──────────────────────────────
// 工业标准模式分值，AI 与残局求解共用。
export const PATTERN_SCORE = {
  FIVE: 100000,         // 五连（必胜）
  OPEN_FOUR: 10000,     // 活四（必胜）
  FOUR: 1000,          // 冲四（一步胜）
  OPEN_THREE: 200,     // 活三（一步成活四）
  THREE: 50,          // 眠三
  OPEN_TWO: 10,        // 活二
  TWO: 2,             // 眠二
  ONE: 1,             // 单子
};

// 从某玩家视角评估当前盘面（模式累加）。
export function evaluateBoard(board, player) {
  const opp = other(player);
  let myScore = 0;
  let oppScore = 0;
  // 遍历所有 5 连窗口，统计每条线上两方的子数
  for (const [dr, dc] of DIRS) {
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (!inBounds(r + 4 * dr, c + 4 * dc) && !inBounds(r - 0 * dr, c - 0 * dc)) continue;
        // 取以 (r,c) 起点，方向 (dr,dc)，长度 5 的窗口
        const cells = [];
        let ok = true;
        for (let k = 0; k < 5; k += 1) {
          const nr = r + k * dr;
          const nc = c + k * dc;
          if (!inBounds(nr, nc)) { ok = false; break; }
          cells.push(board[idx(nr, nc)]);
        }
        if (!ok) continue;
        let mine = 0;
        let theirs = 0;
        for (const v of cells) {
          if (v === player) mine += 1;
          else if (v === opp) theirs += 1;
        }
        if (mine > 0 && theirs > 0) continue;
        if (mine === 5) myScore += PATTERN_SCORE.FIVE;
        else if (mine === 4) myScore += PATTERN_SCORE.OPEN_FOUR;
        else if (mine === 3) myScore += PATTERN_SCORE.OPEN_THREE;
        else if (mine === 2) myScore += PATTERN_SCORE.OPEN_TWO;
        else if (mine === 1) myScore += PATTERN_SCORE.ONE;
        if (theirs === 5) oppScore += PATTERN_SCORE.FIVE;
        else if (theirs === 4) oppScore += PATTERN_SCORE.OPEN_FOUR;
        else if (theirs === 3) oppScore += PATTERN_SCORE.OPEN_THREE;
        else if (theirs === 2) oppScore += PATTERN_SCORE.OPEN_TWO;
        else if (theirs === 1) oppScore += PATTERN_SCORE.ONE;
      }
    }
  }
  return myScore - oppScore;
}
