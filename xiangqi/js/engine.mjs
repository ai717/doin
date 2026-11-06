// 中国象棋规则引擎：纯函数、零依赖、严格 DOM-free（禁碰 DOM / storage / 计时器）。
//
// 棋盘 9 列 × 10 行共 90 个交叉点，扁平 Array，索引 = row * 9 + col。
// row 0 在最上（黑方底线），row 9 在最下（红方底线），河界位于 row4/row5 之间。
// 棋子 = ±type：红方为正、黑方为负，EMPTY = 0。
//   type: GENERAL=1(帅/将) ADVISOR=2(仕/士) ELEPHANT=3(相/象) HORSE=4(马)
//         CHARIOT=5(车) CANNON=6(炮) PAWN=7(兵/卒)
//
// 规则口径（中国象棋协会规则的关键确定性子集）：
//   1. 蹩马腿：马走日，正交分量中点有子即禁；
//   2. 塞象眼：相/象走田，田字中心有子即禁，且不得过河；
//   3. 将帅照面：两将同列无隔子即"对将"，造成照面的一手非法（isAttacked 内实现）；
//   4. 炮打隔子：吃子必须恰好隔一个炮架，直行不吃子；
//   5. 兵卒：未过河只进不横，过河（红 row<=4 / 黑 row>=5）后可横走；
//   6. 应将强制：被将军的一方所有合法着法必须解除将军，否则该着非法；
//   7. 困毙判负：无子可动且未被将军同样判负（与杀棋同分）；
//   8. 三次重复局面：连续将军 streak>=2 的一方判负（长将），否则判和；
//   9. 双方均无车马炮兵（仅剩帅仕相）判和。
//
// 终局以 status/result 表达：result.kind ∈ mate|stalemate|perpetual|repetition|bare。

export const COLS = 9;
export const ROWS = 10;
export const CELLS = COLS * ROWS;

export const EMPTY = 0;
export const RED = 1; // 红方，先手，棋盘下端
export const BLACK = 2; // 黑方，后手，棋盘上端

export const GENERAL = 1;
export const ADVISOR = 2;
export const ELEPHANT = 3;
export const HORSE = 4;
export const CHARIOT = 5;
export const CANNON = 6;
export const PAWN = 7;

export const STATUS_PLAYING = "playing";
export const STATUS_OVER = "over";

export const RESULT_MATE = "mate";
export const RESULT_STALEMATE = "stalemate";
export const RESULT_PERPETUAL = "perpetual";
export const RESULT_REPETITION = "repetition";
export const RESULT_BARE = "bare";

// 固定步长（120Hz）——stepFrame 的确定性契约。
export const STEP_MS = 1000 / 120;

// 棋谱字母（大写红小写黑，'.' 空），数据层残局一律用它表达。
const PIECE_CHARS = {
  K: GENERAL, A: ADVISOR, B: ELEPHANT, N: HORSE, R: CHARIOT, C: CANNON, P: PAWN,
};
const CHAR_BY_TYPE = {
  [GENERAL]: "K", [ADVISOR]: "A", [ELEPHANT]: "B", [HORSE]: "N",
  [CHARIOT]: "R", [CANNON]: "C", [PAWN]: "P",
};

export const START_BOARD =
  "rnbakabnr" +
  "........." +
  ".c.....c." +
  "p.p.p.p.p" +
  "........." +
  "........." +
  "P.P.P.P.P" +
  ".C.....C." +
  "........." +
  "RNBAKABNR";

// ─── 坐标与棋子工具 ───────────────────────────────────────────────
export function idx(row, col) {
  return row * COLS + col;
}
export function rowOf(index) {
  return Math.floor(index / COLS);
}
export function colOf(index) {
  return index % COLS;
}
export function inBounds(row, col) {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS;
}
export function sideOf(piece) {
  if (piece > 0) return RED;
  if (piece < 0) return BLACK;
  return EMPTY;
}
export function typeOf(piece) {
  return piece > 0 ? piece : -piece;
}
export function other(side) {
  return side === RED ? BLACK : RED;
}
export function crossedRiver(side, row) {
  return side === RED ? row <= 4 : row >= 5;
}
export function ownHalf(side, row) {
  return side === RED ? row >= 5 : row <= 4;
}
export function inPalace(side, row, col) {
  if (col < 3 || col > 5) return false;
  return side === RED ? row >= 7 && row <= 9 : row >= 0 && row <= 2;
}
export function sameSidePiece(piece, side) {
  return piece !== 0 && sideOf(piece) === side;
}

// 坐标名：列 a-i（自左向右）、行 0-9（自上向下）。引擎只出坐标，文案交给 i18n。
export function cellName(index) {
  return String.fromCharCode(97 + colOf(index)) + rowOf(index);
}

// ─── 盘面序列化 ───────────────────────────────────────────────────
export function serializeBoard(board) {
  let out = "";
  for (let i = 0; i < CELLS; i += 1) {
    const piece = board[i];
    if (piece === 0) {
      out += ".";
      continue;
    }
    const ch = CHAR_BY_TYPE[typeOf(piece)];
    out += piece > 0 ? ch : ch.toLowerCase();
  }
  return out;
}

export function parseBoard(source) {
  if (typeof source === "string" && source.length === CELLS) {
    const board = new Array(CELLS).fill(0);
    for (let i = 0; i < CELLS; i += 1) {
      const ch = source[i];
      if (ch === ".") continue;
      const upper = ch.toUpperCase();
      const type = PIECE_CHARS[upper];
      if (!type) return null;
      board[i] = ch === upper ? type : -type;
    }
    return board;
  }
  if (Array.isArray(source) && source.length === CELLS && source.every((v) => Number.isInteger(v))) {
    return source.slice();
  }
  return null;
}

// 局面键（重复判定用）：盘面 + 行棋方。
export function positionKey(board, turn) {
  return `${serializeBoard(board)}|${turn}`;
}

// ─── 攻击判定（含将帅照面）────────────────────────────────────────
const ORTHO_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const HORSE_JUMPS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
];

export function generalIndex(board, side) {
  const target = side === RED ? GENERAL : -GENERAL;
  for (let i = 0; i < CELLS; i += 1) {
    if (board[i] === target) return i;
  }
  return -1;
}

// 目标格是否被 bySide 一方攻击。将帅照面在此等价于"被敌将攻击"，
// 因此"走完之后己方被攻击"天然涵盖照面非法。
export function isAttacked(board, target, bySide) {
  const r = rowOf(target);
  const c = colOf(target);

  // 正交射线：车（首个子）、炮（隔一子）、将帅照面（同列首个子是敌将）
  for (let d = 0; d < 4; d += 1) {
    const dr = ORTHO_DIRS[d][0];
    const dc = ORTHO_DIRS[d][1];
    let rr = r + dr;
    let cc = c + dc;
    let seen = 0;
    while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
      const piece = board[idx(rr, cc)];
      if (piece !== 0) {
        if (sideOf(piece) === bySide) {
          const type = typeOf(piece);
          if (seen === 0) {
            if (type === CHARIOT) return true;
            if (type === GENERAL && dc === 0) return true;
          } else if (type === CANNON) {
            return true;
          }
        }
        seen += 1;
        if (seen > 1) break;
      }
      rr += dr;
      cc += dc;
    }
  }

  // 马：从目标格反查八个跳点，蹩腿位为马向目标的正交中点
  for (let j = 0; j < 8; j += 1) {
    const dr = HORSE_JUMPS[j][0];
    const dc = HORSE_JUMPS[j][1];
    const sr = r + dr;
    const sc = c + dc;
    if (!inBounds(sr, sc)) continue;
    const piece = board[idx(sr, sc)];
    if (piece === 0 || sideOf(piece) !== bySide || typeOf(piece) !== HORSE) continue;
    const legR = Math.abs(dr) === 2 ? sr + (dr > 0 ? -1 : 1) : sr;
    const legC = Math.abs(dc) === 2 ? sc + (dc > 0 ? -1 : 1) : sc;
    if (board[idx(legR, legC)] === 0) return true;
  }

  // 兵卒：正前（红向上 / 黑向下）与过河后的两侧
  if (bySide === RED) {
    if (r + 1 < ROWS && board[idx(r + 1, c)] === PAWN) return true;
    if (r <= 4) {
      if (c > 0 && board[idx(r, c - 1)] === PAWN) return true;
      if (c < COLS - 1 && board[idx(r, c + 1)] === PAWN) return true;
    }
  } else {
    if (r - 1 >= 0 && board[idx(r - 1, c)] === -PAWN) return true;
    if (r >= 5) {
      if (c > 0 && board[idx(r, c - 1)] === -PAWN) return true;
      if (c < COLS - 1 && board[idx(r, c + 1)] === -PAWN) return true;
    }
  }

  // 仕（士）：九宫内斜一格
  for (let d = 0; d < 4; d += 1) {
    const sr = r + DIAG_DIRS[d][0];
    const sc = c + DIAG_DIRS[d][1];
    if (!inBounds(sr, sc)) continue;
    const piece = board[idx(sr, sc)];
    if (piece !== 0 && sideOf(piece) === bySide && typeOf(piece) === ADVISOR && inPalace(bySide, sr, sc)) {
      return true;
    }
  }

  // 相（象）：斜二格、象眼无子、目标在其可活动半场
  for (let d = 0; d < 4; d += 1) {
    const dr = DIAG_DIRS[d][0] * 2;
    const dc = DIAG_DIRS[d][1] * 2;
    const sr = r + dr;
    const sc = c + dc;
    if (!inBounds(sr, sc)) continue;
    const piece = board[idx(sr, sc)];
    if (piece === 0 || sideOf(piece) !== bySide || typeOf(piece) !== ELEPHANT) continue;
    if (!ownHalf(bySide, r)) continue;
    if (board[idx(r + dr / 2, c + dc / 2)] !== 0) continue;
    return true;
  }

  return false;
}

export function inCheck(board, side) {
  const g = generalIndex(board, side);
  if (g < 0) return true; // 无将视为已被将死（防御性口径）
  return isAttacked(board, g, other(side));
}

// ─── 走法生成 ─────────────────────────────────────────────────────
export function pseudoMoves(board, side) {
  const moves = [];
  const push = (from, to) => moves.push({ from, to });

  for (let i = 0; i < CELLS; i += 1) {
    const piece = board[i];
    if (piece === 0 || sideOf(piece) !== side) continue;
    const r = rowOf(i);
    const c = colOf(i);
    const type = typeOf(piece);

    if (type === GENERAL) {
      for (let d = 0; d < 4; d += 1) {
        const nr = r + ORTHO_DIRS[d][0];
        const nc = c + ORTHO_DIRS[d][1];
        if (!inPalace(side, nr, nc)) continue;
        if (sameSidePiece(board[idx(nr, nc)], side)) continue;
        push(i, idx(nr, nc));
      }
    } else if (type === ADVISOR) {
      for (let d = 0; d < 4; d += 1) {
        const nr = r + DIAG_DIRS[d][0];
        const nc = c + DIAG_DIRS[d][1];
        if (!inPalace(side, nr, nc)) continue;
        if (sameSidePiece(board[idx(nr, nc)], side)) continue;
        push(i, idx(nr, nc));
      }
    } else if (type === ELEPHANT) {
      for (let d = 0; d < 4; d += 1) {
        const nr = r + DIAG_DIRS[d][0] * 2;
        const nc = c + DIAG_DIRS[d][1] * 2;
        if (!inBounds(nr, nc) || !ownHalf(side, nr)) continue;
        if (board[idx(r + DIAG_DIRS[d][0], c + DIAG_DIRS[d][1])] !== 0) continue; // 塞象眼
        if (sameSidePiece(board[idx(nr, nc)], side)) continue;
        push(i, idx(nr, nc));
      }
    } else if (type === HORSE) {
      for (let j = 0; j < 8; j += 1) {
        const dr = HORSE_JUMPS[j][0];
        const dc = HORSE_JUMPS[j][1];
        const nr = r + dr;
        const nc = c + dc;
        if (!inBounds(nr, nc)) continue;
        const legR = Math.abs(dr) === 2 ? r + dr / 2 : r;
        const legC = Math.abs(dc) === 2 ? c + dc / 2 : c;
        if (board[idx(legR, legC)] !== 0) continue; // 蹩马腿
        if (sameSidePiece(board[idx(nr, nc)], side)) continue;
        push(i, idx(nr, nc));
      }
    } else if (type === CHARIOT) {
      for (let d = 0; d < 4; d += 1) {
        const dr = ORTHO_DIRS[d][0];
        const dc = ORTHO_DIRS[d][1];
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          const target = board[idx(nr, nc)];
          if (target === 0) {
            push(i, idx(nr, nc));
          } else {
            if (sideOf(target) !== side) push(i, idx(nr, nc));
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    } else if (type === CANNON) {
      for (let d = 0; d < 4; d += 1) {
        const dr = ORTHO_DIRS[d][0];
        const dc = ORTHO_DIRS[d][1];
        let nr = r + dr;
        let nc = c + dc;
        let screen = false;
        while (inBounds(nr, nc)) {
          const target = board[idx(nr, nc)];
          if (!screen) {
            if (target === 0) push(i, idx(nr, nc));
            else screen = true;
          } else if (target !== 0) {
            if (sideOf(target) !== side) push(i, idx(nr, nc)); // 炮打隔子
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    } else if (type === PAWN) {
      const fwd = side === RED ? -1 : 1;
      const nr = r + fwd;
      if (inBounds(nr, c) && !sameSidePiece(board[idx(nr, c)], side)) push(i, idx(nr, c));
      if (crossedRiver(side, r)) {
        if (c > 0 && !sameSidePiece(board[idx(r, c - 1)], side)) push(i, idx(r, c - 1));
        if (c < COLS - 1 && !sameSidePiece(board[idx(r, c + 1)], side)) push(i, idx(r, c + 1));
      }
    }
  }
  return moves;
}

// 盘面内联走/回走（搜索用，O(1) 撤销）。
export function makeMove(board, move) {
  const captured = board[move.to];
  board[move.to] = board[move.from];
  board[move.from] = 0;
  return captured;
}
export function unmakeMove(board, move, captured) {
  board[move.from] = board[move.to];
  board[move.to] = captured;
}

// 合法着法 = 伪合法 且 走后己方将不被攻击（含照面）。
export function legalMoves(board, side) {
  const out = [];
  const pseudo = pseudoMoves(board, side);
  const foe = other(side);
  for (let m = 0; m < pseudo.length; m += 1) {
    const move = pseudo[m];
    const captured = makeMove(board, move);
    const g = generalIndex(board, side);
    const ok = g >= 0 && !isAttacked(board, g, foe);
    unmakeMove(board, move, captured);
    if (ok) out.push(move);
  }
  return out;
}

export function isLegalMove(board, side, move) {
  if (!move || !Number.isInteger(move.from) || !Number.isInteger(move.to)) return false;
  if (!inBounds(rowOf(move.from), colOf(move.from)) || !inBounds(rowOf(move.to), colOf(move.to))) return false;
  if (!sameSidePiece(board[move.from], side)) return false;
  const moves = legalMoves(board, side);
  return moves.some((m) => m.from === move.from && m.to === move.to);
}

// 双方均无车马炮兵 → 判和。
export function isBareBoard(board) {
  for (let i = 0; i < CELLS; i += 1) {
    const type = typeOf(board[i]);
    if (board[i] !== 0 && (type === CHARIOT || type === HORSE || type === CANNON || type === PAWN)) {
      return false;
    }
  }
  return true;
}

// ─── 状态机 ───────────────────────────────────────────────────────
function cloneCounts(source) {
  const out = {};
  for (const key of Object.keys(source)) out[key] = source[key];
  return out;
}

export function createState(options = {}) {
  const board = parseBoard(options.board ?? START_BOARD);
  if (!board) return null;
  const turn = options.turn === BLACK ? BLACK : RED;
  const meta = options.meta && typeof options.meta === "object" ? { ...options.meta } : {};
  const state = {
    board,
    turn,
    status: STATUS_PLAYING,
    result: null,
    checkStreak: { [RED]: 0, [BLACK]: 0 },
    posCounts: { [positionKey(board, turn)]: 1 },
    history: [],
    lastMove: null,
    moveCount: 0,
    meta,
    fx: { clock: 0, acc: 0, moveFlash: 0, captureFlash: 0, checkFlash: 0, checkAt: -1 },
  };
  return state;
}

// 非法意图原样返回同一引用（UI 层据此判定"静默忽略"）。
export function applyMove(state, move) {
  if (!state || state.status !== STATUS_PLAYING) return state;
  if (!move || !Number.isInteger(move.from) || !Number.isInteger(move.to)) return state;
  if (!sameSidePiece(state.board[move.from], state.turn)) return state;

  const moves = legalMoves(state.board, state.turn);
  const found = moves.find((m) => m.from === move.from && m.to === move.to);
  if (!found) return state;

  // 悔棋快照（完整快照，恢复零推理）
  const snapshot = {
    board: state.board.slice(),
    turn: state.turn,
    status: state.status,
    result: state.result,
    checkStreak: { [RED]: state.checkStreak[RED], [BLACK]: state.checkStreak[BLACK] },
    posCounts: cloneCounts(state.posCounts),
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    moveCount: state.moveCount,
  };

  const board = state.board.slice();
  const mover = state.turn;
  const captured = board[move.to];
  board[move.to] = board[move.from];
  board[move.from] = 0;

  const nextTurn = other(mover);
  const opponentStuck = legalMoves(board, nextTurn).length === 0;
  const opponentChecked = inCheck(board, nextTurn);
  const key = positionKey(board, nextTurn);
  const repeatCount = (state.posCounts[key] ?? 0) + 1;

  let status = STATUS_PLAYING;
  let result = null;
  if (opponentStuck) {
    status = STATUS_OVER;
    result = { kind: opponentChecked ? RESULT_MATE : RESULT_STALEMATE, winner: mover };
  } else if (repeatCount >= 3) {
    status = STATUS_OVER;
    // 长将判负：连续将军 streak>=2 的行棋方输；否则三次重复判和
    result = state.checkStreak[mover] >= 2
      ? { kind: RESULT_PERPETUAL, winner: nextTurn }
      : { kind: RESULT_REPETITION, winner: null };
  } else if (isBareBoard(board)) {
    status = STATUS_OVER;
    result = { kind: RESULT_BARE, winner: null };
  }

  const checkStreak = { ...state.checkStreak };
  checkStreak[mover] = opponentChecked ? checkStreak[mover] + 1 : 0;

  const fx = { ...state.fx };
  fx.moveFlash = 1;
  fx.captureFlash = captured !== 0 ? 1 : 0;
  if (opponentChecked) {
    fx.checkFlash = 1;
    fx.checkAt = generalIndex(board, nextTurn);
  } else {
    fx.checkFlash = 0;
    fx.checkAt = -1;
  }

  const posCounts = cloneCounts(state.posCounts);
  posCounts[key] = repeatCount;

  return {
    board,
    turn: nextTurn,
    status,
    result,
    checkStreak,
    posCounts,
    history: state.history.concat([snapshot]),
    lastMove: { from: move.from, to: move.to, captured },
    moveCount: state.moveCount + 1,
    meta: state.meta,
    fx,
  };
}

// 悔一手（快照回滚）。无历史时原样返回。
export function undoMove(state) {
  if (!state || state.history.length === 0) return state;
  const snap = state.history[state.history.length - 1];
  return {
    board: snap.board,
    turn: snap.turn,
    status: snap.status,
    result: snap.result,
    checkStreak: snap.checkStreak,
    posCounts: snap.posCounts,
    history: state.history.slice(0, -1),
    lastMove: snap.lastMove,
    moveCount: snap.moveCount,
    meta: state.meta,
    fx: { ...state.fx, moveFlash: 0, captureFlash: 0, checkFlash: 0, checkAt: -1 },
  };
}

// 固定步长帧步进：推进 fx 时钟并衰减闪烁强度。纯函数，返回新状态（board 共享）。
export function stepFrame(state, dt) {
  if (!state || !(dt >= 0)) return state;
  let acc = state.fx.acc + dt;
  const fx = { ...state.fx };
  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    fx.clock += STEP_MS;
    fx.moveFlash = Math.max(0, fx.moveFlash - STEP_MS / 500);
    fx.captureFlash = Math.max(0, fx.captureFlash - STEP_MS / 600);
    fx.checkFlash = Math.max(0, fx.checkFlash - STEP_MS / 1100);
  }
  fx.acc = acc;
  return { ...state, fx };
}
