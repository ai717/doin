// 黑白翻转规则引擎：纯函数、零依赖，不触碰 DOM / storage / 计时器。
// 棋盘 8×8，扁平 Array，索引 = row * 8 + col（row 0 在最上）。
// 状态转换不可变：applyMove 非法时返回传入的同一引用。
// 规则口径：默认 WOF（世界黑白棋联盟）标准 —— 无合法着法必 Pass，终局空位归胜方。
// 另备 1883 原版"空位不计"口径（RULES_CLASSIC），仅本地双人娱乐局可选，
// 且开关只影响终局结算，不影响任何一步的合法性与翻转结果。

export const SIZE = 8;
export const CELL_COUNT = SIZE * SIZE;

export const EMPTY = 0;
export const BLACK = 1; // 先手
export const WHITE = 2; // 后手

export const STATUS_PLAYING = "playing";
export const STATUS_OVER = "over";

// 终局结算口径。WOF 是唯一对外竞技口径（比分 64:0 ~ 32:32，总子数恒 64）；
// classic 是 1883 年原版规则，空位不归属，比分可能小于 64，仅供本地双人娱乐局。
export const RULES_WOF = "wof";
export const RULES_CLASSIC = "classic";

export function isRuleSet(value) {
  return value === RULES_WOF || value === RULES_CLASSIC;
}

// 八向扫描顺序固定（西北起顺时针）。它同时决定波次翻转动画与音阶的顺序，
// 因此任何重构都不得调整此数组顺序，否则每日/重放的表现会漂移。
export const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

// 标准开局的四枚起始子：白占主对角线（d4 / e5），黑占副对角线（d5 / e4）。
export const OPENING_CELLS = [
  { row: 3, col: 3, player: WHITE },
  { row: 4, col: 4, player: WHITE },
  { row: 3, col: 4, player: BLACK },
  { row: 4, col: 3, player: BLACK },
];

// ─── 坐标与索引互转 ───────────────────────────────────────────────
export function indexOf(row, col) {
  return row * SIZE + col;
}

export function rowCol(index) {
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

export function playerName(player) {
  if (player === BLACK) return "black";
  if (player === WHITE) return "white";
  return "none";
}

// 棋格名（a1-h8 国际记法，列 a-h 自左向右，行 1-8 自上向下）。
// 引擎层只返回坐标字符串，中文/英文展示全部交给 i18n。
export function cellName(index) {
  const [row, col] = rowCol(index);
  return String.fromCharCode(97 + col) + String(row + 1);
}

// ─── 盘面构造与序列化 ─────────────────────────────────────────────
export function emptyBoard() {
  return new Array(CELL_COUNT).fill(EMPTY);
}

export const BOARD_CHARS = { [EMPTY]: ".", [BLACK]: "B", [WHITE]: "W" };

export function formatBoard(board) {
  return board.map((cell) => BOARD_CHARS[cell] ?? ".").join("");
}

// 解析 64 字符三态串（B / W / .），长度或字符非法一律返回 null。
export function parseBoard(text) {
  if (typeof text !== "string" || text.length !== CELL_COUNT) return null;
  const board = emptyBoard();
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const ch = text[i];
    if (ch === ".") board[i] = EMPTY;
    else if (ch === "B" || ch === "b") board[i] = BLACK;
    else if (ch === "W" || ch === "w") board[i] = WHITE;
    else return null;
  }
  return board;
}

export function standardBoard() {
  const board = emptyBoard();
  for (const cell of OPENING_CELLS) board[indexOf(cell.row, cell.col)] = cell.player;
  return board;
}

// ─── 夹击扫描 ─────────────────────────────────────────────────────
// 返回按方向分组的被夹棋子索引：lines[k] 为第 k 个方向上的翻转序列，
// 序列从紧邻落点的第一枚开始、向外延伸。lines.length === 0 即非法着法。
export function flipLines(board, index, player) {
  const lines = [];
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) return lines;
  if (board[index] !== EMPTY) return lines;
  if (player !== BLACK && player !== WHITE) return lines;

  const [row, col] = rowCol(index);
  const foe = other(player);
  for (const [dr, dc] of DIRS) {
    const run = [];
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[indexOf(r, c)] === foe) {
      run.push(indexOf(r, c));
      r += dr;
      c += dc;
    }
    // 必须被己方棋子封口，且中间至少夹住一枚对手棋子
    if (run.length > 0 && inBounds(r, c) && board[indexOf(r, c)] === player) {
      lines.push(run);
    }
  }
  return lines;
}

export function flipsFor(board, index, player) {
  return flipLines(board, index, player).flat();
}

export function isLegalMove(board, index, player) {
  return flipLines(board, index, player).length > 0;
}

export function legalMoves(board, player) {
  const moves = [];
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (board[i] !== EMPTY) continue;
    if (flipLines(board, i, player).length > 0) moves.push(i);
  }
  return moves;
}

// ─── 子数与终局结算 ───────────────────────────────────────────────
export function countDiscs(board) {
  let black = 0;
  let white = 0;
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (board[i] === BLACK) black += 1;
    else if (board[i] === WHITE) white += 1;
  }
  return { black, white, empty: CELL_COUNT - black - white };
}

// WOF 终局：仍有空位时全部归子多的一方；双方子数相等则为平局，空位不归属。
// 因此终局总子数恒为 64，唯一例外是"平局且盘面有余空"（极罕见）。
// classic 口径下空位一律不归属，比分直接返回盘面实数。
export function finalScore(board, rules = RULES_WOF) {
  const { black, white, empty } = countDiscs(board);
  if (empty === 0 || rules === RULES_CLASSIC) return { black, white };
  if (black > white) return { black: black + empty, white };
  if (white > black) return { black, white: white + empty };
  return { black, white };
}

export function winnerOf(board, rules = RULES_WOF) {
  const { black, white } = finalScore(board, rules);
  if (black > white) return BLACK;
  if (white > black) return WHITE;
  return EMPTY;
}

// ─── 状态构造与落子 ───────────────────────────────────────────────
// createState(config):
//   board   盘面（Array<number> | 64 字符三态串），缺省为标准开局四子
//   current 行棋方，缺省 BLACK
//   rules   终局结算口径，缺省 WOF（RULES_CLASSIC 仅本地双人娱乐局使用）
//   moves   回放序列（索引数组），逐手 applyMove 推进
export function createState(config = {}) {
  let board;
  if (typeof config.board === "string") {
    board = parseBoard(config.board) ?? standardBoard();
  } else if (Array.isArray(config.board) || config.board instanceof Uint8Array) {
    if (config.board.length !== CELL_COUNT) {
      board = standardBoard();
    } else {
      board = Array.from(config.board, (v) => (v === BLACK || v === WHITE ? v : EMPTY));
    }
  } else {
    board = standardBoard();
  }

  const current = config.current === WHITE ? WHITE : BLACK;
  let state = {
    size: SIZE,
    board,
    current,
    rules: config.rules === RULES_CLASSIC ? RULES_CLASSIC : RULES_WOF,
    status: STATUS_PLAYING,
    moves: [],
    lastMove: -1,
    lastLines: [],
    lastFlips: [],
    passedPlayer: EMPTY,
    winner: EMPTY,
    finalScore: null,
  };

  // 若起始盘面上行棋方就无子可下，按 Pass 规则直接结算或让位。
  state = settle(state);

  const moves = Array.isArray(config.moves) ? config.moves : [];
  for (const move of moves) {
    const next = applyMove(state, move);
    if (next !== state) state = next;
  }
  return state;
}

// 在不动盘面的前提下解决"轮到某人但无子可下"：
// 对手有子可下 → 让位给对手（记录 passedPlayer）；
// 双方均无子可下 → 终局并按 WOF 结算。
export function settle(state) {
  if (state.status !== STATUS_PLAYING) return state;
  if (legalMoves(state.board, state.current).length > 0) return state;

  const foe = other(state.current);
  if (legalMoves(state.board, foe).length > 0) {
    return { ...state, current: foe, passedPlayer: state.current };
  }
  return {
    ...state,
    current: EMPTY,
    status: STATUS_OVER,
    winner: winnerOf(state.board, state.rules),
    finalScore: finalScore(state.board, state.rules),
    // 终局不播报让位：双方都无子可下是"结束"，不是"某一方被迫跳过"
    passedPlayer: EMPTY,
  };
}

export function applyMove(state, index) {
  if (state.status !== STATUS_PLAYING) return state;
  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) return state;

  const player = state.current;
  const lines = flipLines(state.board, index, player);
  if (lines.length === 0) return state; // 非法着法：静默忽略，同一引用

  const flips = lines.flat();
  const board = state.board.slice();
  board[index] = player;
  for (const cell of flips) board[cell] = player;

  const discs = countDiscs(board);
  const move = {
    index,
    player,
    lines,
    flips: flips.slice(),
    black: discs.black,
    white: discs.white,
  };

  const base = {
    ...state,
    board,
    current: other(player),
    moves: state.moves.concat(move),
    lastMove: index,
    lastLines: lines,
    lastFlips: flips,
    passedPlayer: EMPTY,
  };
  return settle(base);
}

export function boardKey(state) {
  return state.board.join("");
}

// 把"落子 + 翻转"抽成单一的纯函数入口，供 engine 与 solver 共用，避免两处各写一份规则。
// 非法着法返回 null（而不是抛错或返回原盘面），调用方必须显式判空。
export function placeDisc(board, index, player) {
  const lines = flipLines(board, index, player);
  if (lines.length === 0) return null;
  const next = board.slice();
  next[index] = player;
  for (const line of lines) {
    for (const cell of line) next[cell] = player;
  }
  return next;
}

export function keyOfBoard(board, player) {
  return `${board.join("")}|${player}`;
}

export function replay(config = {}) {
  return createState(config);
}

// ─── 局面查询工具（UI / AI / 题库共用，保持纯函数）────────────────
// 关键格位分类：角（永不丢失的锚点）/ X 位（角的斜邻，最毒）/ C 位（角的直邻）。
export const CORNER_INDICES = [0, 7, 56, 63];

const X_SQUARES = [9, 14, 49, 54];
const C_SQUARES = [1, 6, 8, 15, 48, 55, 57, 62];

export function isCorner(index) {
  return CORNER_INDICES.includes(index);
}

export function isXSquare(index) {
  return X_SQUARES.includes(index);
}

export function isCSquare(index) {
  return C_SQUARES.includes(index);
}

// 棋格类型 key（展示文本由 i18n 提供）：corner / x / c / edge / inner
export function squareKind(index) {
  if (isCorner(index)) return "corner";
  if (isXSquare(index)) return "x";
  if (isCSquare(index)) return "c";
  const [row, col] = rowCol(index);
  if (row === 0 || row === SIZE - 1 || col === 0 || col === SIZE - 1) return "edge";
  return "inner";
}

// 稳定子：永不可能被翻转的棋子，供 AI 的 Stability 评估项使用。
//
// 判据（保守但严格可靠，只会漏判不会误判）：
//   某格在某个轴向（横 / 竖 / 两条斜线）上"单侧封死" ⟹ 该轴线上它永远翻不动。
//   四个轴向全部封死 ⟹ 该格永久稳定。
//
// "单侧封死"指：从该格沿该方向前进，沿途全为同色，直到抵达棋盘边缘
// （对手无处落子）或某个已确认的稳定同色子（对手想夹击必先翻掉它，不可能）。
// 单侧成立即整轴安全 —— 因为夹击必须"一侧落子、另一侧有异色锚点"，
// 而封死的那一侧既无空格也无异色锚点。
const STABLE_AXES = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function sideSealed(board, stable, row, col, dr, dc) {
  const player = board[indexOf(row, col)];
  let r = row + dr;
  let c = col + dc;
  while (inBounds(r, c)) {
    const i = indexOf(r, c);
    if (board[i] !== player) return false; // 空格或异色都算开口
    if (stable[i]) return true; // 被已确认的稳定同色子封口
    r += dr;
    c += dc;
  }
  return true; // 一路同色直达棋盘边缘
}

export function stableSet(board) {
  const stable = new Array(CELL_COUNT).fill(false);

  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < CELL_COUNT; i += 1) {
      if (stable[i] || board[i] === EMPTY) continue;
      const [row, col] = rowCol(i);
      let safeAllAxes = true;
      for (const [dr, dc] of STABLE_AXES) {
        if (!sideSealed(board, stable, row, col, dr, dc) && !sideSealed(board, stable, row, col, -dr, -dc)) {
          safeAllAxes = false;
          break;
        }
      }
      if (safeAllAxes) {
        stable[i] = true;
        changed = true;
      }
    }
  }
  return stable;
}

export function stableCounts(board) {
  const stable = stableSet(board);
  let black = 0;
  let white = 0;
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (!stable[i]) continue;
    if (board[i] === BLACK) black += 1;
    else if (board[i] === WHITE) white += 1;
  }
  return { black, white, set: stable };
}
