// 残局求解器：negamax + 杀棋距离计分（MATE - ply）。
// 口径与 engine 一致：无子可动（杀棋或困毙）恒为行棋方输。
// 求解目标：给定红先残局，在 par 步内是否存在强制杀棋、唯一首着是哪一手。
//
// 全窗口逐根着法搜索保证每个根着法的杀棋距离精确（唯一首着判定的前提）。
// 节点预算 abort：超限返回 unknown，生成器据此淘汰候选，保证产线运行时间有界。

import {
  RED, BLACK, CELLS, EMPTY,
  sideOf, typeOf, other, inCheck,
  legalMoves, makeMove, unmakeMove,
} from "./engine.mjs";

export const MATE = 100000;
export const INF = 1000000;

// 子力价值（求解器地平线评估用，与 ai.mjs 的对弈评估各自独立）。
const VALUE_BY_TYPE = [0, 0, 200, 200, 400, 900, 450, 100];

function materialEval(board, side) {
  let score = 0;
  for (let i = 0; i < CELLS; i += 1) {
    const piece = board[i];
    if (piece === 0) continue;
    const value = VALUE_BY_TYPE[typeOf(piece)];
    score += sideOf(piece) === side ? value : -value;
  }
  return score;
}

// 着法排序：将军 > 吃子（按被吃子力降序）> 其余。杀法搜索的最大提速点。
function orderMoves(board, side, moves) {
  const foe = other(side);
  const scored = moves.map((move) => {
    const victim = board[move.to];
    let score = 0;
    if (victim !== 0) score += 1000 + VALUE_BY_TYPE[typeOf(victim)];
    const captured = makeMove(board, move);
    if (inCheck(board, foe)) score += 5000;
    unmakeMove(board, move, captured);
    return { move, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((item) => item.move);
}

function search(board, side, depth, ply, alpha, beta, ctx) {
  ctx.nodes += 1;
  if (ctx.nodes > ctx.nodeBudget) {
    ctx.exceeded = true;
    return 0;
  }
  const moves = legalMoves(board, side);
  if (moves.length === 0) return -(MATE - ply); // 杀棋/困毙同判：行棋方输
  if (depth <= 0) return materialEval(board, side);

  const ordered = orderMoves(board, side, moves);
  let best = -INF;
  for (let m = 0; m < ordered.length; m += 1) {
    const move = ordered[m];
    const captured = makeMove(board, move);
    const score = -search(board, other(side), depth - 1, ply + 1, -beta, -alpha, ctx);
    unmakeMove(board, move, captured);
    if (ctx.exceeded) return 0;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// 求解单局：返回 { solvable, mateIn, winningMoves, first, nodes, exceeded }。
// maxPar 为红方步数上限；搜索深度 = 2*maxPar - 1 层。
//
// 渐进探测：maxPar>=3 时先以 2..maxPar-1 窄窗求解，浅层可解即为最短杀距，
// 避免浅杀局面在深窗下全宽爆炸；真深局（par=maxPar）才跑满深度。
//
// 根节点采用 aspiration window [-(MATE-maxPly), MATE-maxPly]：
//   fail-high → 强制杀线（再全窗精搜杀距）；fail-low → 与杀棋无关，直接淘汰。
// 唯一首着判定依赖精确杀距，仅对少量候选精搜，比逐根全窗快数倍。
export function solve(board, turn = RED, maxPar = 5, options = {}) {
  const budget = options.nodeBudget ?? 600000;

  if (maxPar >= 3) {
    let spent = 0;
    for (let cap = 2; cap <= maxPar - 1; cap += 1) {
      const shallow = solve(board, turn, cap, { nodeBudget: Math.max(1000, budget - spent) });
      spent += shallow.nodes ?? 0;
      if (shallow.exceeded) {
        return { solvable: false, mateIn: 0, winningMoves: [], first: null, nodes: spent, exceeded: true };
      }
      if (shallow.solvable) return { ...shallow, nodes: spent };
    }
  }

  const ctx = { nodes: 0, nodeBudget: budget, exceeded: false };
  const work = board.slice();
  const maxPly = 2 * maxPar - 1;
  const mateThreshold = MATE - maxPly;

  const rootMoves = legalMoves(work, turn);
  if (rootMoves.length === 0) {
    return { solvable: false, mateIn: 0, winningMoves: [], first: null, nodes: ctx.nodes, exceeded: false };
  }

  const scored = [];
  const candidates = [];
  for (const move of rootMoves) {
    const captured = makeMove(work, move);
    const score = -search(work, other(turn), maxPly - 1, 1, -mateThreshold, mateThreshold, ctx);
    unmakeMove(work, move, captured);
    if (ctx.exceeded) {
      return { solvable: false, mateIn: 0, winningMoves: [], first: null, nodes: ctx.nodes, exceeded: true };
    }
    scored.push({ move, score });
    if (score >= mateThreshold) candidates.push(move);
  }

  // 精搜候选（全窗口拿精确杀距）
  const exact = [];
  for (const move of candidates) {
    const captured = makeMove(work, move);
    const score = -search(work, other(turn), maxPly - 1, 1, -INF, INF, ctx);
    unmakeMove(work, move, captured);
    if (ctx.exceeded) {
      return { solvable: false, mateIn: 0, winningMoves: [], first: null, nodes: ctx.nodes, exceeded: true };
    }
    if (score >= mateThreshold) exact.push({ move, score });
  }

  if (exact.length === 0) {
    return { solvable: false, mateIn: 0, winningMoves: [], first: null, nodes: ctx.nodes, exceeded: false };
  }

  // 精确杀距：plies = MATE - score；红方步数 = floor(plies/2)+1（红方收尾，plies 为奇数）。
  const distance = (item) => Math.floor((MATE - item.score) / 2) + 1;
  const par = Math.min(...exact.map(distance));
  const winningMoves = exact.filter((item) => distance(item) === par).map((item) => item.move);
  winningMoves.sort((a, b) => a.from - b.from || a.to - b.to);

  return {
    solvable: true,
    mateIn: par,
    winningMoves,
    first: winningMoves[0] ?? null,
    nodes: ctx.nodes,
    exceeded: false,
  };
}
