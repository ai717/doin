// ai.mjs - four-tier heuristic opponent for Chinese Checkers.
// DOM-free, zero dependencies. Follows the portal convention: difficulty is
// expressed as mistakeRate + search depth + time budget, not as a raw switch.
//
// Chinese Checkers has a far larger branching factor than gomoku (every
// marble can reach dozens of chain-hop landings), so the search uses:
//   - a static move ordering by progress toward the target camp
//   - top-K pruning at root and at every inner node
//   - iterative deepening with a hard deadline (aborted searches keep the
//     last fully completed depth)
//   - a lightweight board transition that skips rule re-validation for moves
//     already produced by legalMoves()

import {
  RED, BLUE, EMPTY, HOLES, HOLE_COUNT,
  legalMoves, otherPlayer, targetOf, detectWinner,
} from "./engine.mjs";

export const DIFFICULTY_BEGINNER = "beginner";
export const DIFFICULTY_INTERMEDIATE = "intermediate";
export const DIFFICULTY_ADVANCED = "advanced";
export const DIFFICULTY_MASTER = "master";

export const DIFFICULTIES = [
  DIFFICULTY_BEGINNER,
  DIFFICULTY_INTERMEDIATE,
  DIFFICULTY_ADVANCED,
  DIFFICULTY_MASTER,
];

// Labels live in i18n, never here (runtime source must stay free of Chinese).
export const DIFFICULTY_META = {
  [DIFFICULTY_BEGINNER]: {
    mistakeRate: 0.38, maxDepth: 1, topK: 8, childK: 0,
    budgetMs: 40, guard: false, minThinkMs: 350, maxThinkMs: 700,
  },
  [DIFFICULTY_INTERMEDIATE]: {
    mistakeRate: 0.14, maxDepth: 1, topK: 16, childK: 0,
    budgetMs: 140, guard: false, minThinkMs: 500, maxThinkMs: 1000,
  },
  [DIFFICULTY_ADVANCED]: {
    mistakeRate: 0.04, maxDepth: 2, topK: 24, childK: 10,
    budgetMs: 320, guard: true, minThinkMs: 700, maxThinkMs: 1400,
  },
  [DIFFICULTY_MASTER]: {
    mistakeRate: 0, maxDepth: 3, topK: 32, childK: 10,
    budgetMs: 700, guard: true, minThinkMs: 900, maxThinkMs: 1800,
  },
};

const WIN_SCORE = 100000;

const now = typeof performance !== "undefined" && typeof performance.now === "function"
  ? () => performance.now()
  : () => Date.now();

function yieldTick() {
  return new Promise((resolve) => {
    if (typeof setTimeout !== "undefined") setTimeout(resolve, 0);
    else resolve();
  });
}

function resolveProfile(difficulty) {
  return DIFFICULTY_META[difficulty] || DIFFICULTY_META[DIFFICULTY_INTERMEDIATE];
}

const cubeDistance = (a, b) => Math.max(
  Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])
);

const ORIGIN = [0, 0, 0];

// The tip farthest from the centre is the camp anchor: filling the deep holes
// first is the only way to occupy all ten without blocking the entrance.
function campAnchor(player) {
  let best = ORIGIN;
  let bestD = -1;
  for (const h of targetOf(player)) {
    const d = cubeDistance(HOLES[h], ORIGIN);
    if (d > bestD) { bestD = d; best = HOLES[h]; }
  }
  return best;
}

const ANCHOR = { [RED]: campAnchor(RED), [BLUE]: campAnchor(BLUE) };
const DIST = {
  [RED]: HOLES.map((c) => cubeDistance(c, ANCHOR[RED])),
  [BLUE]: HOLES.map((c) => cubeDistance(c, ANCHOR[BLUE])),
};
const TARGET_SET = {
  [RED]: new Set(targetOf(RED)),
  [BLUE]: new Set(targetOf(BLUE)),
};

export const distanceToCamp = (player, hole) => DIST[player][hole];

// Negative total distance + a penalty for the single furthest marble (so the
// AI does not sprint one marble forward and abandon the rest) + camp bonus.
function positionScore(board, player) {
  const dist = DIST[player];
  const camp = TARGET_SET[player];
  let sum = 0;
  let furthest = 0;
  let inCamp = 0;
  for (let h = 0; h < HOLE_COUNT; h++) {
    if (board[h] !== player) continue;
    if (camp.has(h)) { inCamp += 1; continue; }
    const d = dist[h];
    sum += d;
    if (d > furthest) furthest = d;
  }
  return -(sum + 0.35 * furthest) + 4 * inCamp;
}

// Zero-sum evaluation from the AI player's point of view.
export function evaluate(state, aiPlayer) {
  return positionScore(state.board, aiPlayer)
    - positionScore(state.board, otherPlayer(aiPlayer));
}

// Search-only transition. `move` is trusted (it came from legalMoves), so the
// BFS rule re-validation done by engine.applyMove is unnecessary here.
function applyFast(state, move, player) {
  const board = state.board.slice();
  board[move.from] = EMPTY;
  board[move.to] = player;
  const opponent = otherPlayer(player);
  const winner = detectWinner(board, player) ? player
    : detectWinner(board, opponent) ? opponent : 0;
  return {
    board,
    turn: opponent,
    status: winner ? "won" : "playing",
    winner,
  };
}

function orderMoves(state, moves, player) {
  const dist = DIST[player];
  const scored = moves.map((m) => ({
    m,
    gain: dist[m.from] - dist[m.to] + m.hops * 0.75,
  }));
  scored.sort((a, b) => b.gain - a.gain);
  return scored.map((s) => s.m);
}

function minimax(state, depth, alpha, beta, aiPlayer, maxDepth, ctx) {
  if (state.status === "won") {
    return state.winner === aiPlayer ? WIN_SCORE - depth : -WIN_SCORE + depth;
  }
  ctx.nodes += 1;
  if ((ctx.nodes & 255) === 0 && now() > ctx.deadline) ctx.aborted = true;
  if (depth >= maxDepth || ctx.aborted) return evaluate(state, aiPlayer);

  const maximizing = state.turn === aiPlayer;
  let moves = orderMoves(state, legalMoves(state), state.turn);
  if (ctx.childK > 0 && moves.length > ctx.childK) moves = moves.slice(0, ctx.childK);
  if (moves.length === 0) return evaluate(state, aiPlayer);

  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const next = applyFast(state, move, state.turn);
    const score = minimax(next, depth + 1, alpha, beta, aiPlayer, maxDepth, ctx);
    if (maximizing) {
      if (score > best) best = score;
      if (best > alpha) alpha = best;
    } else {
      if (score < best) best = score;
      if (best < beta) beta = best;
    }
    if (beta <= alpha || ctx.aborted) break;
  }
  return best;
}

// A generator lets the sync and async entry points share one search loop:
// the async consumer awaits a tick between root candidates.
function* searchRoot(state, aiPlayer, profile, options) {
  const deadline = options.deadline ?? (now() + profile.budgetMs);
  const ctx = { deadline, aborted: false, nodes: 0, childK: profile.childK };
  const all = legalMoves(state, aiPlayer);
  if (all.length === 0) return [];

  const root = orderMoves(state, all, aiPlayer).slice(0, profile.topK);
  let ranked = root.map((m) => ({
    move: m,
    score: evaluate(applyFast(state, m, aiPlayer), aiPlayer),
  }));
  ranked.sort((a, b) => b.score - a.score);
  yield ranked;

  for (let depth = 1; depth <= profile.maxDepth; depth += 1) {
    const scored = [];
    for (const move of root) {
      const next = applyFast(state, move, aiPlayer);
      scored.push({
        move,
        score: minimax(next, 1, -Infinity, Infinity, aiPlayer, depth, ctx),
      });
      yield ranked;
      if (ctx.aborted) break;
    }
    // Keep a completed depth only; a truncated one would rank unseen moves
    // against stale scores.
    if (scored.length === root.length) ranked = scored;
    ranked.sort((a, b) => b.score - a.score);
    yield ranked;
    if (ctx.aborted || now() >= deadline) break;
    if (Math.abs(ranked[0].score) >= WIN_SCORE - 16) break;
  }
  return ranked;
}

export function rankMoves(state, aiPlayer = state.turn, options = {}) {
  if (state.status !== "playing") return [];
  const profile = resolveProfile(options.difficulty);
  let result = [];
  for (const snapshot of searchRoot(state, aiPlayer, profile, options)) result = snapshot;
  return result;
}

function findImmediateWin(state, aiPlayer, moves) {
  for (const move of moves) {
    const next = applyFast(state, move, aiPlayer);
    if (next.status === "won" && next.winner === aiPlayer) return move;
  }
  return null;
}

function pick(ranked, moves, profile, rng) {
  if (!ranked.length) return moves[0];
  if (rng() >= profile.mistakeRate) return ranked[0].move;
  const rest = ranked.slice(1);
  if (!rest.length) return ranked[0].move;
  return rest[Math.min(rest.length - 1, Math.floor(rng() * rest.length))].move;
}

export function chooseMove(state, options = {}) {
  const profile = resolveProfile(options.difficulty);
  const aiPlayer = options.aiPlayer ?? state.turn;
  const rng = options.rng ?? Math.random;
  if (state.status !== "playing") return null;

  const moves = legalMoves(state, aiPlayer);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  if (profile.guard) {
    const win = findImmediateWin(state, aiPlayer, moves);
    if (win) return win;
  }
  return pick(rankMoves(state, aiPlayer, options), moves, profile, rng);
}

export async function chooseMoveAsync(state, options = {}) {
  const profile = resolveProfile(options.difficulty);
  const aiPlayer = options.aiPlayer ?? state.turn;
  const rng = options.rng ?? Math.random;
  const onProgress = options.onProgress ?? (() => {});
  if (state.status !== "playing") return null;

  const moves = legalMoves(state, aiPlayer);
  if (!moves.length) return null;
  if (moves.length === 1) {
    onProgress([{ move: moves[0], score: 0 }]);
    return moves[0];
  }
  if (profile.guard) {
    const win = findImmediateWin(state, aiPlayer, moves);
    if (win) {
      onProgress([{ move: win, score: WIN_SCORE }]);
      return win;
    }
  }

  let ranked = [];
  let lastYield = now();
  for (const snapshot of searchRoot(state, aiPlayer, profile, options)) {
    ranked = snapshot;
    onProgress(ranked.slice(0, 5));
    if (now() - lastYield >= 10) {
      await yieldTick();
      lastYield = now();
    }
  }
  return pick(ranked, moves, profile, rng);
}
