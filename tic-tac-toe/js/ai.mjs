// AI 博弈层：Minimax + α-β 剪枝，带迭代加深与时间预算。
// 设计要点：
// 1) 难度不是"算力开关"，而是 ε-greedy 失误率 + 是否开启「能赢就赢 / 对手将赢就堵」兜底。
//    轻松档不开兜底，所以它会漏掉必胜手、也会漏堵，输得自然，不像刻意放水。
// 2) 失误时从"次优候选"里挑，而不是纯随机落子 —— 保证失误看起来像人，不像坏掉。
// 3) 3x3 大师档搜满全树（不可战胜，玩家最好结果是平局）；4x4 靠深度上限 + 启发式兜底。

import {
  EMPTY,
  STATUS_DRAW,
  STATUS_WON,
  applyMove,
  legalMoves,
  other,
  winLinesFor,
} from "./engine.mjs";

export const DIFFICULTY_EASY = "easy";
export const DIFFICULTY_NORMAL = "normal";
export const DIFFICULTY_MASTER = "master";
export const DIFFICULTIES = [DIFFICULTY_EASY, DIFFICULTY_NORMAL, DIFFICULTY_MASTER];

export const DIFFICULTY_META = {
  [DIFFICULTY_EASY]: { label: "轻松", mistakeRate: 0.45, maxDepth: 3, guard: false, budgetMs: 60, factor: 0.6 },
  [DIFFICULTY_NORMAL]: { label: "普通", mistakeRate: 0.15, maxDepth: 6, guard: true, budgetMs: 140, factor: 1 },
  [DIFFICULTY_MASTER]: { label: "大师", mistakeRate: 0, maxDepth: 9, guard: true, budgetMs: 420, factor: 1.6 },
};

const WIN_SCORE = 100000;
const now =
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();

// 找让 player 立刻连成一条线的空位；没有则返回 -1。
export function findImmediateWin(state, player) {
  for (const line of winLinesFor(state.size, state.winLength)) {
    let count = 0;
    let hole = -1;
    let blocked = false;
    for (const index of line) {
      const cell = state.board[index];
      if (cell === player) count += 1;
      else if (cell === EMPTY) hole = index;
      else blocked = true;
    }
    if (!blocked && hole >= 0 && count === state.winLength - 1) return hole;
  }
  return -1;
}

// 深度耗尽时的局面评估：逐条连线计分，混合线（双方都有子）是死线记 0。
// 子数取平方，让"三缺一"远重于"孤子"。从 aiPlayer 视角返回。
export function evaluate(state, aiPlayer) {
  const opponent = other(aiPlayer);
  let score = 0;
  for (const line of winLinesFor(state.size, state.winLength)) {
    let mine = 0;
    let theirs = 0;
    for (const index of line) {
      const cell = state.board[index];
      if (cell === aiPlayer) mine += 1;
      else if (cell === opponent) theirs += 1;
    }
    if (mine > 0 && theirs > 0) continue;
    if (mine > 0) score += mine * mine;
    else if (theirs > 0) score -= theirs * theirs;
  }
  return score;
}

// 中心优先的排序，让 α-β 更早剪枝。中心天然参与更多连线，本身就是好棋。
function orderMoves(moves, size) {
  const center = (size - 1) / 2;
  const key = (index) => Math.abs((index % size) - center) + Math.abs(Math.floor(index / size) - center);
  return moves.slice().sort((a, b) => key(a) - key(b));
}

function minimax(state, depth, alpha, beta, aiPlayer, maxDepth, ctx) {
  if (state.status === STATUS_WON) {
    return state.winner === aiPlayer ? WIN_SCORE - depth : -WIN_SCORE + depth;
  }
  if (state.status === STATUS_DRAW) return 0;

  ctx.nodes += 1;
  if ((ctx.nodes & 511) === 0 && now() > ctx.deadline) ctx.aborted = true;
  if (depth >= maxDepth || ctx.aborted) return evaluate(state, aiPlayer);

  const maximizing = state.current === aiPlayer;
  const moves = orderMoves(legalMoves(state), state.size);
  let best = maximizing ? -Infinity : Infinity;

  for (const move of moves) {
    const score = minimax(applyMove(state, move), depth + 1, alpha, beta, aiPlayer, maxDepth, ctx);
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
    if (ctx.aborted) break;
  }
  return best;
}

// 迭代加深：每次加深一层都留下完整排序结果，超时则沿用上一层结论，永不返回空手。
export function rankMoves(state, aiPlayer, options = {}) {
  const maxDepth = options.maxDepth ?? DIFFICULTY_META[DIFFICULTY_NORMAL].maxDepth;
  const budgetMs = options.budgetMs ?? DIFFICULTY_META[DIFFICULTY_NORMAL].budgetMs;
  const moves = orderMoves(legalMoves(state), state.size);
  if (moves.length === 0) return [];

  const ctx = { deadline: now() + budgetMs, aborted: false, nodes: 0 };
  let ranked = moves.map((move) => ({ move, score: 0 }));

  for (let depth = 2; depth <= maxDepth; depth += 1) {
    const scored = moves.map((move) => ({
      move,
      score: minimax(applyMove(state, move), 1, -Infinity, Infinity, aiPlayer, depth, ctx),
    }));
    if (ctx.aborted) break;
    scored.sort((a, b) => b.score - a.score);
    ranked = scored;
    if (Math.abs(scored[0].score) >= WIN_SCORE - maxDepth - 1) break;
  }
  return ranked;
}

export function chooseMove(state, options = {}) {
  const difficulty = DIFFICULTY_META[options.difficulty] ? options.difficulty : DIFFICULTY_NORMAL;
  const profile = DIFFICULTY_META[difficulty];
  const aiPlayer = options.aiPlayer ?? state.current;
  const rng = options.rng ?? Math.random;

  if (!aiPlayer || state.status !== "playing") return -1;
  const moves = legalMoves(state);
  if (moves.length === 0) return -1;
  if (moves.length === 1) return moves[0];

  if (profile.guard) {
    const winning = findImmediateWin(state, aiPlayer);
    if (winning >= 0) return winning;
    const blocking = findImmediateWin(state, other(aiPlayer));
    if (blocking >= 0) return blocking;
  }

  const ranked = rankMoves(state, aiPlayer, profile);
  if (!ranked.length) return moves[0];
  if (rng() >= profile.mistakeRate) return ranked[0].move;

  const rest = ranked.slice(1);
  if (!rest.length) return ranked[0].move;
  return rest[Math.min(rest.length - 1, Math.floor(rng() * rest.length))].move;
}
