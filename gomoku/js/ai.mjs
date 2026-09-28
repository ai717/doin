// AI 博弈层：四档 Minimax + α-β 剪枝 + 模式评估表 + VCF/VCT 逼胜搜索。
// 核心优化：
// 1) 真正时间片异步分块（每 10ms await 让出主线程），UI 永不卡顿
// 2) 迭代加深过程中实时派发 Top 3~5 候选着法与评估权重，实现"思考之环"可视化
// 3) 四档难度梯度与失误率 ε-greedy

import {
  BLACK,
  CELL_COUNT,
  EMPTY,
  SIZE,
  STATUS_DRAW,
  STATUS_FORBIDDEN,
  STATUS_PLAYING,
  STATUS_WON,
  WHITE,
  applyMove,
  candidateMoves,
  checkLineAt,
  classifyShape,
  evaluateBoard,
  isForbidden,
  other,
  rc,
} from "./engine.mjs";

export const DIFFICULTY_BEGINNER = "beginner"; // 启蒙
export const DIFFICULTY_INTERMEDIATE = "intermediate"; // 进阶
export const DIFFICULTY_ADVANCED = "advanced"; // 高手
export const DIFFICULTY_MASTER = "master"; // 大师
export const DIFFICULTIES = [
  DIFFICULTY_BEGINNER,
  DIFFICULTY_INTERMEDIATE,
  DIFFICULTY_ADVANCED,
  DIFFICULTY_MASTER,
];

export const DIFFICULTY_META = {
  [DIFFICULTY_BEGINNER]: {
    label: "启蒙",
    mistakeRate: 0.30,
    maxDepth: 1,
    guard: false,
    vcf: false,
    vct: false,
    budgetMs: 60,
    factor: 0.6,
    minThinkMs: 400,
    maxThinkMs: 800,
  },
  [DIFFICULTY_INTERMEDIATE]: {
    label: "进阶",
    mistakeRate: 0.12,
    maxDepth: 2,
    guard: true,
    vcf: false,
    vct: false,
    budgetMs: 200,
    factor: 1,
    minThinkMs: 600,
    maxThinkMs: 1200,
  },
  [DIFFICULTY_ADVANCED]: {
    label: "高手",
    mistakeRate: 0.04,
    maxDepth: 4,
    guard: true,
    vcf: true,
    vcfDepth: 5,
    vct: false,
    budgetMs: 500,
    factor: 1.4,
    minThinkMs: 800,
    maxThinkMs: 1600,
  },
  [DIFFICULTY_MASTER]: {
    label: "大师",
    mistakeRate: 0.005,
    maxDepth: 5,
    guard: true,
    vcf: true,
    vcfDepth: 7,
    vct: true,
    vctDepth: 5,
    budgetMs: 900,
    factor: 1.8,
    minThinkMs: 1200,
    maxThinkMs: 2200,
  },
};

const now =
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? () => performance.now()
    : () => Date.now();

const WIN_SCORE = 1000000;

function yieldTick() {
  return new Promise((resolve) => {
    if (typeof setTimeout !== "undefined") {
      setTimeout(resolve, 0);
    } else {
      resolve();
    }
  });
}

// ─── 立即胜负检测 ────────────────────────────────────────────────
export function findImmediateWin(state, player) {
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (state.board[i] !== EMPTY) continue;
    const board = state.board.slice();
    board[i] = player;
    const [r, c] = rc(i);
    const result = checkLineAt(board, r, c, player);
    if (result.win) return i;
    if (result.overline && player === WHITE) return i;
  }
  return -1;
}

export function findForcedBlock(state, player) {
  return findImmediateWin(state, other(player));
}

export function isBlackForbiddenMove(state, index) {
  if (state.board[index] !== EMPTY) return true;
  const board = state.board.slice();
  board[index] = BLACK;
  const [r, c] = rc(index);
  return isForbidden(board, r, c, BLACK);
}

// ─── 候选着法排序 ────────────────────────────────────────────────
export function orderMoves(moves, board) {
  const cx = (SIZE - 1) / 2;
  const cy = (SIZE - 1) / 2;
  const scored = moves.map((index) => {
    const [r, c] = rc(index);
    const centerDist = Math.abs(r - cx) + Math.abs(c - cy);
    let neighborCount = 0;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
          const ni = nr * SIZE + nc;
          if (board[ni] !== EMPTY) neighborCount += 1;
        }
      }
    }
    return { index, score: neighborCount * 3 - centerDist };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.index);
}

// ─── Minimax + α-β 剪枝 ──────────────────────────────────────────
function minimax(state, depth, alpha, beta, aiPlayer, maxDepth, ctx) {
  if (state.status === STATUS_WON || state.status === STATUS_FORBIDDEN) {
    const won = state.winner === aiPlayer;
    return won ? WIN_SCORE - depth : -WIN_SCORE + depth;
  }
  if (state.status === STATUS_DRAW) return 0;

  ctx.nodes += 1;
  if ((ctx.nodes & 127) === 0 && now() > ctx.deadline) {
    ctx.aborted = true;
  }
  if (depth >= maxDepth || ctx.aborted) {
    return evaluateBoard(state.board, aiPlayer);
  }

  const maximizing = state.current === aiPlayer;
  let moves = candidateMoves(state);
  if (moves.length === 0) return 0;
  moves = orderMoves(moves, state.board);

  if (state.current === BLACK) {
    moves = moves.filter((m) => !isBlackForbiddenMove(state, m));
    if (moves.length === 0) return -WIN_SCORE + depth;
  }

  let best = maximizing ? -Infinity : Infinity;
  for (const move of moves) {
    const next = applyMove(state, move);
    const score = minimax(next, depth + 1, alpha, beta, aiPlayer, maxDepth, ctx);
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

export function rankMoves(state, aiPlayer, options = {}) {
  const maxDepth = options.maxDepth ?? 4;
  const budgetMs = options.budgetMs ?? 400;
  const movesRaw = candidateMoves(state);
  if (movesRaw.length === 0) return [];

  let moves = movesRaw;
  if (aiPlayer === BLACK) {
    moves = moves.filter((m) => !isBlackForbiddenMove(state, m));
  }
  if (moves.length === 0) return [];
  moves = orderMoves(moves, state.board);

  const ctx = { deadline: now() + budgetMs, aborted: false, nodes: 0 };
  let ranked = moves.map((m) => ({ move: m, score: 0 }));

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

// ─── VCF（连续冲四逼胜）求解器 ────────────────────────────────────
export function solveVCF(state, player, vcfDepth = 7) {
  if (state.status !== STATUS_PLAYING) return -1;
  if (state.current !== player) return -1;
  return vcfSearch(state, player, vcfDepth, 0, new Set());
}

function vcfSearch(state, player, maxDepth, depth, visited) {
  if (depth >= maxDepth) return -1;
  if (state.status !== STATUS_PLAYING) return -1;
  if (state.current !== player) return -1;

  const candidates = candidateMoves(state);
  let best = -1;
  for (const move of candidates) {
    if (player === BLACK && isBlackForbiddenMove(state, move)) continue;
    const next = applyMove(state, move);
    if (next === state) continue;

    if (next.status === STATUS_WON && next.winner === player) return move;
    if (next.status === STATUS_FORBIDDEN && next.winner === player) return move;

    const [r, c] = rc(move);
    const shape = classifyShape(next.board, r, c, player);
    if (shape.fours < 1) continue;

    const opp = other(player);
    if (next.current !== opp) continue;

    const blockMoves = findForcedBlockSet(next, player);
    if (blockMoves.length === 0) continue;

    let allWin = true;
    for (const block of blockMoves) {
      const after = applyMove(next, block);
      if (after === next) { allWin = false; break; }
      const key = after.board.join("");
      if (visited.has(key)) { allWin = false; break; }
      visited.add(key);
      const sub = vcfSearch(after, player, maxDepth, depth + 1, visited);
      visited.delete(key);
      if (sub < 0) { allWin = false; break; }
    }
    if (allWin) {
      best = move;
      break;
    }
  }
  return best;
}

function findForcedBlockSet(state, fourPlayer) {
  const opp = other(fourPlayer);
  const result = new Set();
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (state.board[i] !== EMPTY) continue;
    const board = state.board.slice();
    board[i] = fourPlayer;
    const [r, c] = rc(i);
    const line = checkLineAt(board, r, c, fourPlayer);
    if (line.win || (line.overline && fourPlayer === WHITE)) {
      result.add(i);
    }
  }
  if (opp === BLACK) {
    return [...result].filter((m) => {
      const board = state.board.slice();
      board[m] = BLACK;
      const [r, c] = rc(m);
      return !isForbidden(board, r, c, BLACK);
    });
  }
  return [...result];
}

// ─── VCT（连续活三逼胜）求解器 ────────────────────────────────────
export function solveVCT(state, player, vctDepth = 5) {
  if (state.status !== STATUS_PLAYING) return -1;
  if (state.current !== player) return -1;
  return vctSearch(state, player, vctDepth, 0, new Set());
}

function vctSearch(state, player, maxDepth, depth, visited) {
  if (depth >= maxDepth) return -1;
  if (state.status !== STATUS_PLAYING) return -1;
  if (state.current !== player) return -1;

  const candidates = candidateMoves(state);
  const threats = [];
  for (const move of candidates) {
    if (player === BLACK && isBlackForbiddenMove(state, move)) continue;
    const next = applyMove(state, move);
    if (next === state) continue;
    if (next.status === STATUS_WON && next.winner === player) return move;
    if (next.status === STATUS_FORBIDDEN && next.winner === player) return move;
    const [r, c] = rc(move);
    const shape = classifyShape(next.board, r, c, player);
    if (shape.fours >= 1 || shape.openThrees >= 1) {
      threats.push({ move, next, shape });
    }
  }

  for (const t of threats) {
    const oppResponses = generateDefensiveMoves(t.next, player);
    if (oppResponses.length === 0) continue;
    let allWin = true;
    for (const resp of oppResponses) {
      const after = applyMove(t.next, resp);
      if (after === t.next) { allWin = false; break; }
      const key = after.board.join("");
      if (visited.has(key)) { allWin = false; break; }
      visited.add(key);
      const sub = vctSearch(after, player, maxDepth, depth + 1, visited);
      visited.delete(key);
      if (sub < 0) { allWin = false; break; }
    }
    if (allWin) return t.move;
  }
  return -1;
}

function generateDefensiveMoves(state, threatPlayer) {
  const opp = other(threatPlayer);
  if (state.current !== opp) return [];
  const moves = new Set();
  for (let i = 0; i < CELL_COUNT; i += 1) {
    if (state.board[i] !== EMPTY) continue;
    const board = state.board.slice();
    board[i] = threatPlayer;
    const [r, c] = rc(i);
    const line = checkLineAt(board, r, c, threatPlayer);
    if (line.win || (line.overline && threatPlayer === WHITE)) {
      moves.add(i);
    }
  }
  if (opp === BLACK) {
    return [...moves].filter((m) => !isBlackForbiddenMove(state, m));
  }
  return [...moves];
}

// ─── 同步决策主入口 ──────────────────────────────────────────────
export function chooseMove(state, options = {}) {
  const difficulty = DIFFICULTY_META[options.difficulty] ? options.difficulty : DIFFICULTY_INTERMEDIATE;
  const profile = DIFFICULTY_META[difficulty];
  const aiPlayer = options.aiPlayer ?? state.current;
  const rng = options.rng ?? Math.random;

  if (!aiPlayer || state.status !== STATUS_PLAYING) return -1;
  let moves = candidateMoves(state);
  if (moves.length === 0) return -1;
  if (moves.length === 1) return moves[0];

  if (aiPlayer === BLACK) {
    moves = moves.filter((m) => !isBlackForbiddenMove(state, m));
    if (moves.length === 0) return -1;
  }

  if (profile.guard) {
    const winning = findImmediateWin(state, aiPlayer);
    if (winning >= 0) return winning;
    const blocking = findForcedBlock(state, aiPlayer);
    if (blocking >= 0) return blocking;
  }

  if (profile.vcf) {
    const vcf = solveVCF(state, aiPlayer, profile.vcfDepth);
    if (vcf >= 0) return vcf;
  }
  if (profile.vct) {
    const vct = solveVCT(state, aiPlayer, profile.vctDepth);
    if (vct >= 0) return vct;
  }

  const ranked = rankMoves(state, aiPlayer, profile);
  if (!ranked.length) return moves[0];
  if (rng() >= profile.mistakeRate) return ranked[0].move;

  const rest = ranked.slice(1);
  if (!rest.length) return ranked[0].move;
  return rest[Math.min(rest.length - 1, Math.floor(rng() * rest.length))].move;
}

// ─── 异步分块决策入口（保证 60fps + 思考之环）──────────────────────
export async function chooseMoveAsync(state, options = {}) {
  const difficulty = DIFFICULTY_META[options.difficulty] ? options.difficulty : DIFFICULTY_INTERMEDIATE;
  const profile = DIFFICULTY_META[difficulty];
  const aiPlayer = options.aiPlayer ?? state.current;
  const rng = options.rng ?? Math.random;
  const onProgress = options.onProgress ?? (() => {});

  if (!aiPlayer || state.status !== STATUS_PLAYING) return -1;
  let moves = candidateMoves(state);
  if (moves.length === 0) return -1;
  if (moves.length === 1) {
    onProgress({ candidates: [{ move: moves[0], score: 0 }] });
    return moves[0];
  }

  if (aiPlayer === BLACK) {
    moves = moves.filter((m) => !isBlackForbiddenMove(state, m));
    if (moves.length === 0) return -1;
  }

  // 1. 立即成五或必堵活四
  if (profile.guard) {
    const winning = findImmediateWin(state, aiPlayer);
    if (winning >= 0) {
      onProgress({ candidates: [{ move: winning, score: 999999 }] });
      return winning;
    }
    const blocking = findForcedBlock(state, aiPlayer);
    if (blocking >= 0) {
      onProgress({ candidates: [{ move: blocking, score: 900000 }] });
      return blocking;
    }
  }

  // 2. 初始快速粗排（用于立刻呈现候选光点）
  const ordered = orderMoves(moves, state.board);
  let candidates = ordered.slice(0, 5).map((m) => ({
    move: m,
    score: evaluateBoard(applyMove(state, m).board, aiPlayer),
  }));
  candidates.sort((a, b) => b.score - a.score);
  onProgress({ candidates });
  await yieldTick();

  // 3. VCF / VCT 逼胜检测（每层让出时间片）
  if (profile.vcf) {
    const vcf = solveVCF(state, aiPlayer, profile.vcfDepth);
    if (vcf >= 0) {
      onProgress({ candidates: [{ move: vcf, score: 800000 }] });
      return vcf;
    }
    await yieldTick();
  }
  if (profile.vct) {
    const vct = solveVCT(state, aiPlayer, profile.vctDepth);
    if (vct >= 0) {
      onProgress({ candidates: [{ move: vct, score: 700000 }] });
      return vct;
    }
    await yieldTick();
  }

  // 4. 异步时间片迭代加深搜索
  const startTime = now();
  const deadline = startTime + profile.budgetMs;
  let ranked = candidates;
  let lastYield = startTime;

  for (let depth = 2; depth <= profile.maxDepth; depth += 1) {
    const currentScored = [];
    const ctx = { deadline, aborted: false, nodes: 0 };

    for (const move of ordered) {
      const next = applyMove(state, move);
      const score = minimax(next, 1, -Infinity, Infinity, aiPlayer, depth, ctx);
      currentScored.push({ move, score });

      // 每 10ms 让出一次主线程，保证 60fps 丝滑动画
      if (now() - lastYield >= 10) {
        await yieldTick();
        lastYield = now();
      }
      if (ctx.aborted) break;
    }

    if (currentScored.length > 0) {
      currentScored.sort((a, b) => b.score - a.score);
      ranked = currentScored;
      // 动态向 UI 派发最新的 Top 候选点
      onProgress({ candidates: ranked.slice(0, 5) });
    }

    if (ctx.aborted || now() >= deadline) break;
    if (Math.abs(ranked[0].score) >= WIN_SCORE - profile.maxDepth - 1) break;
  }

  // 5. 失误率判定
  if (rng() >= profile.mistakeRate) return ranked[0].move;

  const rest = ranked.slice(1);
  if (!rest.length) return ranked[0].move;
  return rest[Math.min(rest.length - 1, Math.floor(rng() * rest.length))].move;
}
