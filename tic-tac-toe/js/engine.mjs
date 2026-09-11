// 井字棋规则引擎：纯函数、零依赖，不触碰 DOM / storage / 计时器。
// 棋盘用扁平 Array 表示，索引 = row * size + col。
// 所有状态转换不可变：applyMove 非法时原样返回传入的同一个对象引用。

export const EMPTY = 0;
export const PLAYER_X = 1;
export const PLAYER_O = 2;

export const STATUS_PLAYING = "playing";
export const STATUS_WON = "won";
export const STATUS_DRAW = "draw";

export function other(player) {
  if (player === PLAYER_X) return PLAYER_O;
  if (player === PLAYER_O) return PLAYER_X;
  return EMPTY;
}

export function markOf(player) {
  if (player === PLAYER_X) return "X";
  if (player === PLAYER_O) return "O";
  return "";
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

// 所有长度恰为 winLength 的连线：横、竖、右下对角、左下对角。
// 3x3 连三 => 8 条；4x4 连四 => 10 条。
export function generateWinLines(size, winLength) {
  const lines = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col + winLength <= size; col += 1) {
      const line = [];
      for (let k = 0; k < winLength; k += 1) line.push(row * size + col + k);
      lines.push(line);
    }
  }
  for (let col = 0; col < size; col += 1) {
    for (let row = 0; row + winLength <= size; row += 1) {
      const line = [];
      for (let k = 0; k < winLength; k += 1) line.push((row + k) * size + col);
      lines.push(line);
    }
  }
  for (let row = 0; row + winLength <= size; row += 1) {
    for (let col = 0; col + winLength <= size; col += 1) {
      const line = [];
      for (let k = 0; k < winLength; k += 1) line.push((row + k) * size + col + k);
      lines.push(line);
    }
  }
  for (let row = 0; row + winLength <= size; row += 1) {
    for (let col = winLength - 1; col < size; col += 1) {
      const line = [];
      for (let k = 0; k < winLength; k += 1) line.push((row + k) * size + col - k);
      lines.push(line);
    }
  }
  return lines;
}

const lineCache = new Map();

export function winLinesFor(size, winLength) {
  const key = size + ":" + winLength;
  let lines = lineCache.get(key);
  if (!lines) {
    lines = generateWinLines(size, winLength);
    lineCache.set(key, lines);
  }
  return lines;
}

// firstPlayer 只影响开局谁先落子；后续轮换由引擎推进。
export function normalizeConfig(config = {}) {
  const size = clampInt(config.size, 2, 8, 3);
  const winLength = clampInt(config.winLength, 2, size, size);
  const firstPlayer = config.firstPlayer === PLAYER_O ? PLAYER_O : PLAYER_X;
  return { size, winLength, firstPlayer };
}

export function createState(config = {}) {
  const { size, winLength, firstPlayer } = normalizeConfig(config);
  return {
    size,
    winLength,
    firstPlayer,
    board: new Array(size * size).fill(EMPTY),
    current: firstPlayer,
    moves: [],
    status: STATUS_PLAYING,
    winner: EMPTY,
    winLine: null,
  };
}

export function findWinLine(board, lines) {
  for (const line of lines) {
    const value = board[line[0]];
    if (value === EMPTY) continue;
    let all = true;
    for (const index of line) {
      if (board[index] !== value) {
        all = false;
        break;
      }
    }
    if (all) return { winner: value, line };
  }
  return null;
}

export function legalMoves(state) {
  const moves = [];
  if (state.status !== STATUS_PLAYING) return moves;
  for (let i = 0; i < state.board.length; i += 1) {
    if (state.board[i] === EMPTY) moves.push(i);
  }
  return moves;
}

// 落子。非法（越界 / 已占 / 非对局中）时返回传入的同一引用，便于调用方用 === 判断。
export function applyMove(state, index) {
  if (state.status !== STATUS_PLAYING) return state;
  if (!Number.isInteger(index) || index < 0 || index >= state.board.length) return state;
  if (state.board[index] !== EMPTY) return state;

  const player = state.current;
  const board = state.board.slice();
  board[index] = player;

  const hit = findWinLine(board, winLinesFor(state.size, state.winLength));
  const draw = !hit && board.every((cell) => cell !== EMPTY);

  return {
    size: state.size,
    winLength: state.winLength,
    firstPlayer: state.firstPlayer,
    board,
    current: hit || draw ? EMPTY : other(player),
    moves: state.moves.concat(index),
    status: hit ? STATUS_WON : draw ? STATUS_DRAW : STATUS_PLAYING,
    winner: hit ? hit.winner : EMPTY,
    winLine: hit ? hit.line : null,
  };
}

// 从落子序列重建状态。落子过程中任何一步非法都会被静默忽略，
// 这样损坏的本地存档最多退化成更短的一局，而不会抛错白屏。
export function replay(config, moves = []) {
  let state = createState(config);
  for (const index of moves) {
    const next = applyMove(state, index);
    if (next !== state) state = next;
  }
  return state;
}

export function boardKey(state) {
  return state.board.join("");
}
