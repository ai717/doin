// 计分与残局星级：纯函数，零依赖。
// 残局模式：三星制 —— 一星（解出）/ 二星（≤ X+2 手解出）/ 三星（首次正解无错着重选）
// 对弈模式：无得分，只统计胜负战绩。

export const OUTCOME_WIN = "win";
export const OUTCOME_LOSS = "loss";
export const OUTCOME_DRAW = "draw";

export function outcomeOf(state, humanPlayer) {
  if (state.status === "won" || state.status === "forbidden") {
    return state.winner === humanPlayer ? OUTCOME_WIN : OUTCOME_LOSS;
  }
  if (state.status === "draw") return OUTCOME_DRAW;
  return null;
}

// 残局星级计算
// stars: 1 = 解出, 2 = 解出且步数 ≤ par+2, 3 = 解出且首次正解且无错着重选
export function tsumegoStars(solved, movesUsed, par, hadWrongRetry) {
  if (!solved) return 0;
  if (movesUsed <= par && !hadWrongRetry) return 3;
  if (movesUsed <= par + 2) return 2;
  return 1;
}

// 残局是否解出
export function isTsumegoSolved(state, tsumego) {
  if (!tsumego) return false;
  if (state.status === "won" && state.winner === tsumego.firstPlayer) {
    return state.moves.length - tsumego.presetMovesCount <= tsumego.parMoves;
  }
  if (state.status === "forbidden" && tsumego.firstPlayer === 1 && state.winner === 2) {
    // 黑方走出禁手负 = 白方胜；若题目标是"白先活"或"黑先 X 手和"则不同
    return false;
  }
  return false;
}

export function emptyCount(state) {
  let n = 0;
  for (let i = 0; i < state.board.length; i += 1) {
    if (state.board[i] === 0) n += 1;
  }
  return n;
}

export function movesPlayed(state) {
  return state.moves.length;
}
