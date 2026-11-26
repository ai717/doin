// 象棋阶梯 AI：minimax + alpha-beta + 失误率分档。纯函数、DOM-free、确定性（随机只来自注入 rng）。
//
// 分档（PRD §3.3）：
//   ai_1 新手   depth 1，失误率 30%
//   ai_2 入门   depth 1，失误率 10%
//   ai_3 进阶   depth 2，失误率 5%
//   ai_4 高手   depth 3，零失误
//   ai_5 大师   depth 3 + 静默延伸（吃子思考），零失误
// 失误走子由确定性种子 PRNG 注入（reversi 的 applyBlunder 范式），同种子可重放。
// 另有 TIER_DEFENDER（残局黑方最佳防守，depth 2 零失误）。
//
// 杀棋距离计分（MATE - ply）与求解器同口径：防守方在败势下自动选择"拖得最久"的应着，
// 进攻方优先最速杀。搜索写成生成器，根着法之间是切片边界，异步驱动保持界面 60fps。

import {
  RED, BLACK, CELLS, COLS,
  sideOf, typeOf, other, crossedRiver,
  legalMoves, pseudoMoves, makeMove, unmakeMove, inCheck,
  rowOf, colOf,
} from "./engine.mjs";
import { MATE, INF } from "./solver.mjs";

export const AI_1 = "ai_1";
export const AI_2 = "ai_2";
export const AI_3 = "ai_3";
export const AI_4 = "ai_4";
export const AI_5 = "ai_5";

export const TIERS = Object.freeze([
  { key: AI_1, depth: 1, blunderRate: 0.30, quiescence: false, thinkMin: 300, thinkMax: 700 },
  { key: AI_2, depth: 1, blunderRate: 0.10, quiescence: false, thinkMin: 450, thinkMax: 900 },
  { key: AI_3, depth: 2, blunderRate: 0.05, quiescence: false, thinkMin: 600, thinkMax: 1300 },
  { key: AI_4, depth: 3, blunderRate: 0, quiescence: false, thinkMin: 900, thinkMax: 2000 },
  { key: AI_5, depth: 3, blunderRate: 0, quiescence: true, thinkMin: 1200, thinkMax: 2600 },
]);

export const TIER_DEFENDER = Object.freeze({
  key: "defender", depth: 2, blunderRate: 0, quiescence: false, thinkMin: 200, thinkMax: 500,
});

export const TIER_KEYS = TIERS.map((tier) => tier.key);

export function tierConfig(key) {
  return TIERS.find((tier) => tier.key === key) ?? TIERS[0];
}

// ─── 评估函数 ─────────────────────────────────────────────────────
const VALUE_BY_TYPE = [0, 0, 200, 200, 400, 900, 450, 100];

function pieceBonus(piece, index) {
  const side = sideOf(piece);
  const type = typeOf(piece);
  const row = rowOf(index);
  const col = colOf(index);
  const rrow = side === RED ? row : 9 - row; // 归一到红方视角（0 为黑方底线方向）
  const center = Math.abs(col - 4);
  switch (type) {
    case 4: // 马：中路与过河加分
      return 14 - center * 2 + (crossedRiver(side, row) ? 8 : 0);
    case 6: // 炮：占中路与推进加分
      return 10 - center * 2 + (rrow <= 6 ? 4 : 0);
    case 7: // 兵卒：过河大涨、越深越高、中心微调
      if (!crossedRiver(side, row)) return rrow <= 5 ? 4 : 0;
      return 20 + Math.max(0, 5 - rrow) * 4 - center;
    default:
      return 0;
  }
}

export function evaluate(board, side) {
  let score = 0;
  let mobilitySelf = 0;
  let mobilityFoe = 0;
  for (let i = 0; i < CELLS; i += 1) {
    const piece = board[i];
    if (piece === 0) continue;
    const s = sideOf(piece);
    const type = typeOf(piece);
    let value = VALUE_BY_TYPE[type];
    if (type === 7 && crossedRiver(s, rowOf(i))) value += 100; // 过河兵价值跃升
    value += pieceBonus(piece, i);
    score += s === side ? value : -value;
  }
  mobilitySelf = pseudoMoves(board, side).length;
  mobilityFoe = pseudoMoves(board, other(side)).length;
  score += Math.round((mobilitySelf - mobilityFoe) * 2);
  return score;
}

// ─── 着法排序：将军 > 吃子（按被吃子力）> 其余 ────────────────────
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

// ─── 静默延伸（吃子线收尾，大师档专用）────────────────────────────
const QUIESCENCE_MAX = 4;

function quiescence(board, side, alpha, beta, ply, depth, ctx) {
  ctx.nodes += 1;
  const stand = evaluate(board, side);
  if (depth <= 0) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;

  const captures = pseudoMoves(board, side).filter((move) => board[move.to] !== 0);
  captures.sort((a, b) => VALUE_BY_TYPE[typeOf(board[b.to])] - VALUE_BY_TYPE[typeOf(board[a.to])]);
  let best = stand;
  for (const move of captures) {
    const captured = makeMove(board, move);
    const score = -quiescence(board, other(side), -beta, -alpha, ply + 1, depth - 1, ctx);
    unmakeMove(board, move, captured);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// ─── Negamax + Alpha-Beta ─────────────────────────────────────────
function negamax(board, side, depth, alpha, beta, ply, tier, ctx) {
  ctx.nodes += 1;
  const moves = legalMoves(board, side);
  if (moves.length === 0) return -(MATE - ply); // 杀棋/困毙同判
  if (depth <= 0) {
    return tier.quiescence
      ? quiescence(board, side, alpha, beta, ply, QUIESCENCE_MAX, ctx)
      : evaluate(board, side);
  }
  const ordered = orderMoves(board, side, moves);
  let best = -INF;
  for (const move of ordered) {
    const captured = makeMove(board, move);
    const score = -negamax(board, other(side), depth - 1, -beta, -alpha, ply + 1, tier, ctx);
    unmakeMove(board, move, captured);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

// ─── 根节点搜索（生成器：根着法之间让步）──────────────────────────
function* rootSteps(board, side, tier, ctx) {
  const moves = legalMoves(board, side);
  if (moves.length === 0) return { move: -1, score: -(MATE - 0), scored: [], passed: true };
  const ordered = orderMoves(board, side, moves);
  let alpha = -INF;
  let best = -INF;
  let bestMove = ordered[0];
  const scored = [];
  for (const move of ordered) {
    yield null; // 切片边界
    const captured = makeMove(board, move);
    const score = -negamax(board, other(side), tier.depth - 1, -INF, -alpha, 1, tier, ctx);
    unmakeMove(board, move, captured);
    scored.push({ move, score });
    if (score > best) {
      best = score;
      bestMove = move;
      alpha = score;
    }
  }
  // 并列最优取最小坐标（确定性，无 rng 时稳定）
  const top = scored.filter((item) => item.score === best);
  if (top.length > 1) {
    top.sort((a, b) => a.move.from - b.move.from || a.move.to - b.move.to);
    bestMove = top[0].move;
  }
  scored.sort((a, b) => a.move.from - b.move.from || a.move.to - b.move.to);
  return { move: bestMove, score: best, scored, passed: false };
}

// ─── 失误注入（抽样顺序写死：先判失误，再抽候选）──────────────────
function applyBlunder(result, tier, rng) {
  if (!rng || tier.blunderRate <= 0) return result;
  if (result.passed || result.move < 0) return result;
  if (result.score <= -(MATE - 1) || result.score >= MATE - 1) return result; // 杀/被杀线不失误
  const suboptimal = result.scored.filter((item) => item.move !== result.move && item.score < result.score);
  if (suboptimal.length === 0) return result;
  if (!(rng() < tier.blunderRate)) return result;
  const index = Math.floor(rng() * suboptimal.length);
  return { ...result, move: suboptimal[index].move, blundered: true };
}

// ─── 对外入口 ─────────────────────────────────────────────────────
// 同步：用于测试与离线校验。与异步版在未让步时逐位相同。
export function chooseMove(board, side, tierKey, options = {}) {
  const tier = typeof tierKey === "string" && tierKey === TIER_DEFENDER.key
    ? TIER_DEFENDER
    : tierConfig(tierKey);
  const rng = options.rng ?? null;
  const ctx = { nodes: 0 };
  const driver = rootSteps(board.slice(), side, tier, ctx);
  let step = driver.next();
  while (!step.done) step = driver.next();
  return applyBlunder({ ...step.value, nodes: ctx.nodes, tier: tier.key }, tier, rng);
}

// 异步分块：切片之间让出主线程，界面动画保持流畅。
export async function think(board, side, tierKey, options = {}) {
  const tier = typeof tierKey === "string" && tierKey === TIER_DEFENDER.key
    ? TIER_DEFENDER
    : tierConfig(tierKey);
  const rng = options.rng ?? null;
  const ctx = { nodes: 0 };
  const yielder = options.yielder ?? (() => new Promise((resolve) => setTimeout(resolve, 0)));
  const yieldMs = options.yieldMs ?? 12;
  const now = options.now ?? (() => Date.now());
  const started = now();
  const driver = rootSteps(board.slice(), side, tier, ctx);
  let step = driver.next();
  while (!step.done) {
    if (now() - started >= yieldMs) {
      await yielder();
    }
    step = driver.next();
  }
  return applyBlunder({ ...step.value, nodes: ctx.nodes, tier: tier.key }, tier, rng);
}
