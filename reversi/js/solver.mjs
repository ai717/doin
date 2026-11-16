// 完美终局求解器（Perfect Endgame Solver）：纯函数、零依赖、确定性。
//
// 本模块是黑白棋领域三十年算法积累的标准落地：
//   Negamax 全深度穷举 + Alpha-Beta 剪枝 + 置换表（Zobrist 式字符串键）+ 机动性着法排序。
//
// 用途有三，全部是硬依赖，不可省略：
//   1. 残局题库的权威 —— 逐题穷举出 "bestDiff" 与全部达到最优的首手，题库正确性由它背书；
//   2. "无谬" 档 AI —— 空位 ≤ 14 时直接给出精确终局与最优着法；
//   3. 「终局预报」铜牌 —— 独立于 AI 档位，向玩家展示真实的终局比分。
//
// 确定性铁律：同一盘面在同一输入下必须给出完全相同的结果。
// 严禁 Math.random；着法排序的比较器必须带稳定次序（索引升序）兜底。

import {
  BLACK, WHITE, EMPTY, CELL_COUNT,
  other, legalMoves, flipLines, placeDisc, finalScore, isCorner,
} from "./engine.mjs";

export const INF = 1_000_000;

// 完美求解的推荐上限。空位数超过该值时不建议调用 solveExact（指数代价）。
export const PERFECT_LIMIT = 14;

// 从某一方视角看的终局子差（已按 WOF 把余空判给胜方）。
export function finalDiff(board, player) {
  const { black, white } = finalScore(board);
  return player === BLACK ? black - white : white - black;
}

// 该盘面的空位数（求解代价的唯一决定量）。
export function emptyCount(board) {
  let count = 0;
  for (let i = 0; i < CELL_COUNT; i += 1) if (board[i] === EMPTY) count += 1;
  return count;
}

// ─── 着法排序 ─────────────────────────────────────────────────────
// 排序质量直接决定剪枝效率，是本题能否在网页端跑得动的关键：
//   1. 角位优先（角永不丢失，任何深度下都是最强着法）；
//   2. 其次按"走完之后对手的合法着法数"升序 —— 机动性压制，黑白棋尾声的第一性原理；
//   3. 最后按索引升序，保证排序结果确定（严禁依赖 sort 的稳定性以外的随机因素）。
// 导出给 AI 层复用：着法排序的质量决定剪枝效率，两处各写一份必然漂移。
// 实测教训（2026-09-28）：AI 曾试过"开局/中局改用静态棋格表排序以省掉每节点的
// legalMoves 开销"，单节点确实便宜了一个数量级，但中局 depth-10 搜索整体慢 6 倍 ——
// **排序质量对剪枝的影响远大于单节点成本**。这条结论固化为共享实现，别再各写一份。
export function orderedMoves(board, player, moves) {
  if (moves.length <= 1) {
    return moves.map((move) => {
      const child = placeDisc(board, move, player);
      return { move, child, key: child === null ? null : `${child.join("")}|${other(player)}` };
    });
  }
  const foe = other(player);
  const scored = moves.map((move) => {
    const child = placeDisc(board, move, player);
    // 对手机动性：走完之后对手还剩几个合法着法 —— 黑白棋尾声的第一性原理
    const mobility = child === null ? 99 : legalMoves(child, foe).length;
    return {
      move,
      child,
      key: child === null ? null : `${child.join("")}|${foe}`,
      mobility,
      corner: isCorner(move) ? 0 : 1,
    };
  });
  scored.sort((a, b) => {
    if (a.corner !== b.corner) return a.corner - b.corner;
    if (a.mobility !== b.mobility) return a.mobility - b.mobility;
    return a.move - b.move;
  });
  return scored;
}

// ─── 置换表 ───────────────────────────────────────────────────────
export const FLAG_EXACT = 0;
export const FLAG_LOWER = 1; // 值 ≥ 记录值（fail-high）
export const FLAG_UPPER = 2; // 值 ≤ 记录值（fail-low）

function createTable() {
  return { map: new Map(), hits: 0, stores: 0 };
}

function probe(table, key) {
  const entry = table.map.get(key);
  if (entry) table.hits += 1;
  return entry ?? null;
}

function store(table, key, value, flag, move) {
  table.stores += 1;
  table.map.set(key, { value, flag, move });
}

// ─── 核心搜索 ─────────────────────────────────────────────────────
function negamax(board, player, alpha, beta, table, budget, key) {
  budget.nodes += 1;

  const nodeKey = key ?? `${board.join("")}|${player}`;
  const hit = probe(table, nodeKey);
  let hintedMove = null;
  if (hit) {
    if (hit.flag === FLAG_EXACT) return hit.value;
    if (hit.flag === FLAG_LOWER && hit.value >= beta) return hit.value;
    if (hit.flag === FLAG_UPPER && hit.value <= alpha) return hit.value;
    hintedMove = hit.move;
  }

  const moves = legalMoves(board, player);
  if (moves.length === 0) {
    // 自己无子可下：对手也无可下 → 终局；否则让位给对手（盘面不变，必然产生进展）
    if (legalMoves(board, other(player)).length === 0) {
      return finalDiff(board, player);
    }
    return -negamax(board, other(player), -beta, -alpha, table, budget, null);
  }

  const alphaOrig = alpha;
  const ordered = orderedMoves(board, player, moves);
  // 置换表里的最佳着法提到最前（剪枝命中的主要来源）
  if (hintedMove !== null) {
    const at = ordered.findIndex((item) => item.move === hintedMove);
    if (at > 0) ordered.unshift(ordered.splice(at, 1)[0]);
  }

  let best = -INF;
  let bestChildMove = ordered[0].move;

  for (const item of ordered) {
    if (item.child === null) continue;
    const value = -negamax(item.child, other(player), -beta, -alpha, table, budget, item.key);
    if (value > best) {
      best = value;
      bestChildMove = item.move;
    }
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // 剪枝
  }

  const flag = best <= alphaOrig ? FLAG_UPPER : best >= beta ? FLAG_LOWER : FLAG_EXACT;
  store(table, nodeKey, best, flag, bestChildMove);
  return best;
}

// ─── 对外入口 ─────────────────────────────────────────────────────
// 精确求解：返回该盘面在 player 视角的终局最优子差，以及全部达到该值的首手（升序）。
//   score  正数代表 player 最终赢这么多子
//   moves  达到最优的全部首手索引；若 player 无子可下则为空数组
export function solveExact(board, player) {
  const table = createTable();
  const budget = { nodes: 0 };
  const moves = legalMoves(board, player);

  if (moves.length === 0) {
    const foeMoves = legalMoves(board, other(player));
    if (foeMoves.length === 0) {
      return { score: finalDiff(board, player), moves: [], nodes: 0, exact: true, table };
    }
    // 让位：分数由对手行动后决定
    const score = -negamax(board, other(player), -INF, INF, table, budget, null);
    return { score, moves: [], nodes: budget.nodes, exact: true, table };
  }

  const ordered = orderedMoves(board, player, moves);

  // 第一趟：逐步抬高 alpha，拿到最优分数
  let alpha = -INF;
  let best = -INF;
  for (const item of ordered) {
    if (item.child === null) continue;
    const value = -negamax(item.child, other(player), -INF, -alpha, table, budget, item.key);
    if (value > best) {
      best = value;
      alpha = value;
    }
  }
  // 第二趟：空窗复检，收集全部并列最优的首手（整数分数下空窗可精确判别）
  const winners = [];
  for (const item of ordered) {
    if (item.child === null) continue;
    const value = -negamax(item.child, other(player), -best, -(best - 1), table, budget, item.key);
    if (value >= best) winners.push(item.move);
  }
  winners.sort((a, b) => a - b);
  return { score: best, moves: winners, nodes: budget.nodes, exact: true, table };
}

// 便捷封装：只要分数与最优首手，不暴露置换表（避免调用方误用内部结构）。
export function solve(board, player) {
  const result = solveExact(board, player);
  return {
    score: result.score,
    moves: result.moves,
    nodes: result.nodes,
    unique: result.moves.length === 1,
  };
}

// 判定某手是否为最优首手之一（残局模式逐手校验 / AI 提示 / 摆盘求助共用）。
export function isOptimalMove(board, player, move) {
  const { moves } = solveExact(board, player);
  return moves.includes(move);
}

// 从给定着法出发精确推演终局子差（用于"错着反馈"告诉玩家这一手会输多少）。
export function diffAfterMove(board, player, move) {
  const child = placeDisc(board, move, player);
  if (child === null) return null;
  if (emptyCount(child) === 0) return finalDiff(child, player);
  const result = solveExact(child, other(player));
  return -result.score;
}

// 是否可在可接受代价内完美求解。
export function canSolvePerfectly(board) {
  return emptyCount(board) <= PERFECT_LIMIT;
}

// 棋盘胜负倾向的粗粒度描述，供 UI 选文案（具体文案由 i18n 提供）。
export function leadSide(board) {
  const { black, white } = finalScore(board);
  if (black > white) return BLACK;
  if (white > black) return WHITE;
  return EMPTY;
}
