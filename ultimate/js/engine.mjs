// 《终极井字棋》规则引擎：81 格分形棋盘，纯函数、零依赖。
// 不触碰 DOM / localStorage / 计时器，node 可直接 import 测试。
//
// 坐标系：
//   big  = 0..8 的序号（row * 3 + col）
//   small= 0..8 的序号（row * 3 + col）
//   index= big * 9 + small
// 核心约束：在大格 big 的小格 small 落子后，下一回合的活跃战场锁定为「大格 small」；
// 若该大格已被占领或填满，则当前行动方获得全盘自由落子权（active = -1）。

export const EMPTY = 0;
export const MARK_X = 1;
export const MARK_O = 2;

export const STATUS_PLAYING = "playing";
export const STATUS_WON = "won";
export const STATUS_DRAW = "draw";

export const CELL_COUNT = 81;
export const BIG_COUNT = 9;
export const WILDCARD = -1;

export const LINES = Object.freeze([
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]);

export function other(mark) {
  if (mark === MARK_X) return MARK_O;
  if (mark === MARK_O) return MARK_X;
  return EMPTY;
}

export function markOf(mark) {
  if (mark === MARK_X) return "X";
  if (mark === MARK_O) return "O";
  return "";
}

export function bigOf(index) {
  return (index / 9) | 0;
}

export function smallOf(index) {
  return index % 9;
}

export function cellIndex(big, small) {
  return big * 9 + small;
}

function lineWinnerIn(board, base) {
  for (const line of LINES) {
    const first = board[base + line[0]];
    if (first === EMPTY) continue;
    if (
      board[base + line[1]] === first &&
      board[base + line[2]] === first
    ) {
      return first;
    }
  }
  return EMPTY;
}

// 读取每个大格的占领方。若同一大格内红蓝双方都连成三子（人为构造的非法局面），返回 null。
export function bigResults(cells) {
  const result = new Array(BIG_COUNT).fill(EMPTY);
  for (let big = 0; big < BIG_COUNT; big += 1) {
    const base = big * 9;
    let x = false;
    let o = false;
    for (const line of LINES) {
      const first = cells[base + line[0]];
      if (first === EMPTY) continue;
      if (cells[base + line[1]] !== first || cells[base + line[2]] !== first) continue;
      if (first === MARK_X) x = true;
      else o = true;
    }
    if (x && o) return null;
    result[big] = x ? MARK_X : o ? MARK_O : EMPTY;
  }
  return result;
}

function bigBoardFull(cells, big) {
  const base = big * 9;
  for (let i = 0; i < 9; i += 1) {
    if (cells[base + i] === EMPTY) return false;
  }
  return true;
}

export function isClosed(bigs, cells, big) {
  return bigs[big] !== EMPTY || bigBoardFull(cells, big);
}

function bigLineWinner(bigs) {
  for (const line of LINES) {
    const first = bigs[line[0]];
    if (first === EMPTY) continue;
    if (bigs[line[1]] === first && bigs[line[2]] === first) {
      return { winner: first, line: line.slice() };
    }
  }
  return null;
}

export function bigCounts(bigs) {
  let x = 0;
  let o = 0;
  for (const value of bigs) {
    if (value === MARK_X) x += 1;
    else if (value === MARK_O) o += 1;
  }
  return { x, o };
}

function hasPlayableCell(cells, bigs) {
  for (let big = 0; big < BIG_COUNT; big += 1) {
    if (isClosed(bigs, cells, big)) continue;
    const base = big * 9;
    for (let small = 0; small < 9; small += 1) {
      if (cells[base + small] === EMPTY) return true;
    }
  }
  return false;
}

// 由盘面推导终局：先看大三连；已无可落子的大格且无大三连时，按占领大格数定胜负（策划案第 3 节）。
function terminalOf(cells, bigs) {
  const hit = bigLineWinner(bigs);
  if (hit) {
    return { status: STATUS_WON, winner: hit.winner, winLine: hit.line };
  }
  if (!hasPlayableCell(cells, bigs)) {
    const counts = bigCounts(bigs);
    if (counts.x === counts.o) return { status: STATUS_DRAW, winner: EMPTY, winLine: null };
    return {
      status: STATUS_WON,
      winner: counts.x > counts.o ? MARK_X : MARK_O,
      winLine: null,
    };
  }
  return { status: STATUS_PLAYING, winner: EMPTY, winLine: null };
}

export function createEmptyState(options = {}) {
  return createState({ cells: new Array(CELL_COUNT).fill(EMPTY), ...options });
}

// 从盘面构造状态。cells 非法（长度 / 取值 / 同格双三连）时返回 null。
// active 显式给出（残局）或推导；current 缺省按落子数推导（X 先手）。
export function createState(options = {}) {
  const raw = options.cells ?? [];
  if (!Array.isArray(raw) || raw.length !== CELL_COUNT) return null;
  const cells = raw.map((value) => (value === MARK_X || value === MARK_O ? value : EMPTY));
  const bigs = bigResults(cells);
  if (bigs === null) return null;

  let x = 0;
  let o = 0;
  for (const value of cells) {
    if (value === MARK_X) x += 1;
    else if (value === MARK_O) o += 1;
  }
  // 回合数必须满足 X 先手：X 与 O 相等时轮到 X，X 比 O 多一时轮到 O，其余为非法盘面。
  const current = pickCurrent(options.current, x, o);
  if (current === EMPTY) return null;

  const active = normalizeActive(options.active, bigs, cells);
  const terminal = terminalOf(cells, bigs);

  return {
    cells,
    bigs,
    current,
    active,
    moves: Array.isArray(options.moves) ? options.moves.slice() : [],
    status: terminal.status,
    winner: terminal.winner,
    winLine: terminal.winLine,
  };
}

function inferredCurrent(x, o) {
  if (x === o) return MARK_X;
  if (x === o + 1) return MARK_O;
  return EMPTY;
}

function pickCurrent(explicit, x, o) {
  const inferred = inferredCurrent(x, o);
  if (inferred === EMPTY) return EMPTY;
  if (explicit !== MARK_X && explicit !== MARK_O) return inferred;
  if (explicit === inferred) return explicit;
  return EMPTY;
}

function normalizeActive(active, bigs, cells) {
  if (active === WILDCARD) return WILDCARD;
  if (Number.isInteger(active) && active >= 0 && active < BIG_COUNT && !isClosed(bigs, cells, active)) {
    return active;
  }
  return WILDCARD;
}

export function countEmpty(state) {
  let empty = 0;
  for (const value of state.cells) if (value === EMPTY) empty += 1;
  return empty;
}

// 可落子的大格集合：活跃大格唯一；自由落子权下为全部未终结大格。
export function playableBoards(state) {
  if (state.status !== STATUS_PLAYING) return [];
  const boards = [];
  for (let big = 0; big < BIG_COUNT; big += 1) {
    if (isClosed(state.bigs, state.cells, big)) continue;
    if (state.active === WILDCARD || state.active === big) boards.push(big);
  }
  return boards;
}

export function legalMoves(state) {
  if (!state || state.status !== STATUS_PLAYING) return [];
  const moves = [];
  for (const big of playableBoards(state)) {
    const base = big * 9;
    for (let small = 0; small < 9; small += 1) {
      if (state.cells[base + small] === EMPTY) moves.push(base + small);
    }
  }
  return moves;
}

export function isLegal(state, index) {
  if (!state || state.status !== STATUS_PLAYING) return false;
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) return false;
  if (state.cells[index] !== EMPTY) return false;
  const big = bigOf(index);
  if (state.active === WILDCARD) return !isClosed(state.bigs, state.cells, big);
  return state.active === big;
}

// 落子。非法操作原样返回同一个对象引用，调用方可用 === 判断。
export function applyMove(state, index) {
  if (!isLegal(state, index)) return state;

  const player = state.current;
  const cells = state.cells.slice();
  cells[index] = player;
  const bigs = state.bigs.slice();

  const big = bigOf(index);
  const small = smallOf(index);
  if (bigs[big] === EMPTY) {
    const won = lineWinnerIn(cells, big * 9);
    if (won !== EMPTY) bigs[big] = won;
  }

  const terminal = terminalOf(cells, bigs);
  const active = terminal.status === STATUS_PLAYING && !isClosed(bigs, cells, small) ? small : WILDCARD;
  return {
    cells,
    bigs,
    current: terminal.status === STATUS_PLAYING ? other(player) : EMPTY,
    active: terminal.status === STATUS_PLAYING ? active : WILDCARD,
    moves: state.moves.concat(index),
    status: terminal.status,
    winner: terminal.winner,
    winLine: terminal.winLine,
  };
}

// 从落子序列回放；损坏存档里的非法步被静默丢弃，绝不会抛错。
export function replay(options = {}, moves = []) {
  let state = createState(options);
  if (!state) return null;
  for (const index of moves) {
    const next = applyMove(state, index);
    if (next !== state) state = next;
  }
  return state;
}

export function boardKey(state) {
  return `${state.cells.join("")}|${state.active}|${state.current}|${state.status}`;
}

// 残局题解用的确定性胜负搜索：movesLeft 只统计「mover 自己的落子次数」。
// X 回合是「存在一手」；对手回合是「无论怎么应」都必须输。
export function canForceWin(state, mover, movesLeft, memo = new Map()) {
  if (!state) return false;
  if (state.status === STATUS_WON) return state.winner === mover;
  if (state.status === STATUS_DRAW) return false;
  if (movesLeft <= 0) return false;

  const key = `${boardKey(state)}|${movesLeft}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  const moves = legalMoves(state);
  if (moves.length === 0) {
    memo.set(key, false);
    return false;
  }

  let result;
  if (state.current === mover) {
    result = false;
    for (const move of moves) {
      if (canForceWin(applyMove(state, move), mover, movesLeft - 1, memo)) {
        result = true;
        break;
      }
    }
  } else {
    result = true;
    for (const move of moves) {
      if (!canForceWin(applyMove(state, move), mover, movesLeft, memo)) {
        result = false;
        break;
      }
    }
  }
  memo.set(key, result);
  return result;
}
