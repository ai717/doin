// 四档 AI：试剑童子（贪心）/ 棋馆门生（一层因果）/ 战术宗师（深搜）/ 终极天网（MCTS）。
// 全部是纯函数式决策，接注入的 PRNG 可完全复现；不碰 DOM / 存储 / 定时器。

import {
  EMPTY, MARK_X, MARK_O, LINES, STATUS_DRAW, STATUS_WON,
  applyMove, isClosed, legalMoves, other, smallOf,
} from "./engine.mjs";

export const TIER_NOVICE = "novice";
export const TIER_DUELIST = "duelist";
export const TIER_MASTER = "master";
export const TIER_INFALLIBLE = "infallible";

export const TIERS = Object.freeze([TIER_NOVICE, TIER_DUELIST, TIER_MASTER, TIER_INFALLIBLE]);

export const TIER_META = Object.freeze({
  [TIER_NOVICE]: { candidates: 1, depth: 0, iterations: 0 },
  [TIER_DUELIST]: { candidates: 6, depth: 1, iterations: 0 },
  [TIER_MASTER]: { candidates: 10, depth: 3, iterations: 0 },
  [TIER_INFALLIBLE]: { candidates: 12, depth: 3, iterations: 1500 },
});

export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandom(items, rng) {
  return items[Math.floor(rng() * items.length)];
}

function terminalScore(state, me) {
  if (state.status === STATUS_DRAW) return 0;
  if (state.status === STATUS_WON) return state.winner === me ? 100000 : -100000;
  return null;
}

// 静态评估：大格归属、大九宫连线潜力、小格连线潜力、行动力。
export function evaluate(state, me) {
  const terminal = terminalScore(state, me);
  if (terminal !== null) return terminal;

  const foe = other(me);
  let score = 0;

  for (const value of state.bigs) {
    if (value === me) score += 160;
    else if (value === foe) score -= 160;
  }

  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const big of line) {
      if (state.bigs[big] === me) mine += 1;
      else if (state.bigs[big] === foe) theirs += 1;
      else if (!isClosed(state.bigs, state.cells, big)) mine += 0.001;
    }
    if (theirs === 0 && mine >= 2) score += mine === 3 ? 5000 : 110;
    if (mine === 0 && theirs >= 2) score -= theirs === 3 ? 5000 : 130;
  }

  for (let big = 0; big < 9; big += 1) {
    if (isClosed(state.bigs, state.cells, big)) continue;
    const base = big * 9;
    for (const line of LINES) {
      let mine = 0;
      let theirs = 0;
      let gaps = 0;
      for (const small of line) {
        const value = state.cells[base + small];
        if (value === me) mine += 1;
        else if (value === foe) theirs += 1;
        else gaps += 1;
      }
      if (gaps === 1 && theirs === 0) {
        const bonus = mine === 2 ? 6 : 1.5;
        score += bonus;
        if (state.active === -1 || state.active === big) score += bonus * 0.5;
      }
      if (gaps === 1 && mine === 0) score -= theirs === 2 ? 7 : 1.6;
    }
  }

  const moves = legalMoves(state);
  score += moves.length * (state.current === me ? 0.25 : -0.25);
  return score;
}

// 单步局部收益：不搜树，只看这一手在「当前大格 + 下一个战场」上的即时价值。
export function scoreMove(state, index, me) {
  const foe = other(me);
  const next = applyMove(state, index);
  if (next === state) return -Infinity;

  const terminal = terminalScore(next, me);
  if (terminal !== null) return terminal;

  let score = 0;
  const big = (index / 9) | 0;
  const gainedBoard = state.bigs[big] === EMPTY && next.bigs[big] === me;
  const lostBoard = state.bigs[big] === EMPTY && next.bigs[big] === foe;

  if (gainedBoard) {
    score += 120;
    for (const line of LINES) {
      let mine = 0;
      let theirs = 0;
      for (const b of line) {
        if (next.bigs[b] === me) mine += 1;
        else if (next.bigs[b] === foe) theirs += 1;
      }
      if (mine === 3) score += 9000;
      else if (mine === 2 && theirs === 0) score += 70;
    }
  }
  if (lostBoard) score -= 140;

  const base = big * 9;
  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    let gaps = 0;
    for (const small of line) {
      const value = next.cells[base + small];
      if (value === me) mine += 1;
      else if (value === foe) theirs += 1;
      else gaps += 1;
    }
    if (theirs === 0 && gaps > 0) score += mine * mine * 1.6;
    if (mine === 0 && gaps > 0) score -= theirs * theirs * 1.9;
  }

  const slot = smallOf(index);
  if (isClosed(next.bigs, next.cells, slot)) {
    // 把对手送进死格：对手获得全盘自由权，通常是亏的
    score -= 26;
  } else {
    score -= bestReplyGain(next, slot, foe, me);
  }
  return score;
}

// 对手被送进 slot 大格后，一步能拿到的最大局部收益（用于避免送羊入虎口）。
function bestReplyGain(next, slot, foe, me) {
  if (next.status !== "playing" || next.current !== foe) return 0;
  let worst = 0;
  const base = slot * 9;
  for (let small = 0; small < 9; small += 1) {
    const index = base + small;
    if (next.cells[index] !== EMPTY) continue;
    const reply = applyMove(next, index);
    if (reply.status === STATUS_WON && reply.winner === foe) return 9000;
    let gain = 0;
    if (next.bigs[slot] === EMPTY && reply.bigs[slot] === foe) gain += 90;
    for (const line of LINES) {
      let theirs = 0;
      let mine = 0;
      let gaps = 0;
      for (const s of line) {
        const value = reply.cells[base + s];
        if (value === foe) theirs += 1;
        else if (value === me) mine += 1;
        else gaps += 1;
      }
      if (mine === 0 && gaps === 1 && theirs === 2) gain += 24;
      if (mine === 0 && gaps > 0) gain += theirs * theirs * 0.8;
    }
    if (gain > worst) worst = gain;
  }
  return worst;
}

function orderedMoves(state, me, limit) {
  const moves = legalMoves(state);
  if (limit <= 1 || moves.length <= limit) return moves;
  const scored = moves.map((index) => ({ index, score: scoreMove(state, index, me) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.index);
}

function findImmediateWin(state, me) {
  for (const index of legalMoves(state)) {
    const next = applyMove(state, index);
    if (next.status === STATUS_WON && next.winner === me) return index;
  }
  return -1;
}

// 对手是否存在「一手定胜负」的威胁；有则返回需要封堵的落点（若多路则返回 -2）。
export function immediateThreats(state, me) {
  if (state.status !== "playing" || state.current !== me) return [];
  const foe = other(me);
  const answer = [];
  for (const index of legalMoves(state)) {
    const next = applyMove(state, index);
    if (next.status === STATUS_WON && next.winner === foe) continue;
    let dangerous = false;
    for (const reply of legalMoves(next)) {
      const after = applyMove(next, reply);
      if (after.status === STATUS_WON && after.winner === foe) {
        dangerous = true;
        break;
      }
    }
    if (!dangerous) answer.push(index);
  }
  return answer;
}

function negamax(state, me, depth, alpha, beta) {
  const terminal = terminalScore(state, me);
  if (terminal !== null || depth <= 0) {
    return terminal !== null ? terminal : evaluate(state, me);
  }
  const moves = orderedMoves(state, state.current, depth >= 2 ? 9 : 12);
  if (!moves.length) return evaluate(state, me);

  if (state.current === me) {
    let best = -Infinity;
    for (const index of moves) {
      const value = negamax(applyMove(state, index), me, depth - 1, alpha, beta);
      if (value > best) best = value;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const index of moves) {
    const value = negamax(applyMove(state, index), me, depth - 1, alpha, beta);
    if (value < best) best = value;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

function searchBestMove(state, me, meta, rng) {
  const moves = orderedMoves(state, me, meta.candidates);
  let best = -Infinity;
  let pool = [];
  for (const index of moves) {
    const score = negamax(applyMove(state, index), me, meta.depth, -Infinity, Infinity);
    if (score > best + 0.001) {
      best = score;
      pool = [index];
    } else if (Math.abs(score - best) <= 0.001) {
      pool.push(index);
    }
  }
  return pool.length ? pickRandom(pool, rng) : moves[0] ?? -1;
}

// ── MCTS（终极天网）────────────────────────────────────────────────
function makeNode(state, move = -1) {
  return {
    state,
    move,
    untried: legalMoves(state),
    children: [],
    visits: 0,
    value: 0,
  };
}

function uctValue(node, parentVisits) {
  if (node.visits === 0) return Infinity;
  return node.value / node.visits + 1.25 * Math.sqrt(Math.log(parentVisits) / node.visits);
}

function rollout(state, me, rng) {
  let current = state;
  for (let ply = 0; ply < 220; ply += 1) {
    if (current.status !== "playing") break;
    const moves = legalMoves(current);
    if (!moves.length) break;
    let chosen = -1;
    // 有立即致命的一手就直接落，避免随机 rollout 漏杀
    for (const index of moves) {
      const next = applyMove(current, index);
      if (next.status === STATUS_WON) {
        chosen = index;
        break;
      }
    }
    if (chosen < 0) {
      if (rng() < 0.35) {
        let bestScore = -Infinity;
        for (const index of moves) {
          const value = scoreMove(current, index, current.current) + rng() * 12;
          if (value > bestScore) {
            bestScore = value;
            chosen = index;
          }
        }
      } else {
        chosen = pickRandom(moves, rng);
      }
    }
    current = applyMove(current, chosen);
  }
  if (current.status === STATUS_WON) return current.winner === me ? 1 : -1;
  return 0;
}

function mctsMove(state, me, iterations, rng) {
  const root = makeNode(state);
  if (!root.untried.length) return -1;
  for (let i = 0; i < iterations; i += 1) {
    let node = root;
    const path = [node];
    while (!node.untried.length && node.children.length) {
      let bestNode = null;
      let bestValue = -Infinity;
      for (const child of node.children) {
        const value = uctValue(child, node.visits + 1);
        if (value > bestValue) {
          bestValue = value;
          bestNode = child;
        }
      }
      node = bestNode;
      path.push(node);
    }
    if (node.untried.length) {
      const index = node.untried.splice(Math.floor(rng() * node.untried.length), 1)[0];
      const child = makeNode(applyMove(node.state, index), index);
      node.children.push(child);
      path.push(child);
      node = child;
    }
    const reward = rollout(node.state, me, rng);
    for (const item of path) {
      item.visits += 1;
      item.value += reward;
    }
  }
  let best = null;
  for (const child of root.children) {
    if (!best || child.visits > best.visits) best = child;
  }
  if (best && best.move >= 0) return best.move;
  return root.untried.length ? root.untried[0] : -1;
}

export function chooseMove(state, options = {}) {
  if (!state || state.status !== "playing") return -1;
  const tier = TIERS.includes(options.tier) ? options.tier : TIER_DUELIST;
  const meta = TIER_META[tier];
  const rng = options.rng ?? mulberry32(0x9e3779b9);
  const me = options.aiMark === MARK_X || options.aiMark === MARK_O ? options.aiMark : state.current;

  const moves = legalMoves(state);
  if (!moves.length) return -1;
  if (moves.length === 1) return moves[0];

  const winNow = findImmediateWin(state, me);
  if (winNow >= 0) return winNow;

  if (tier === TIER_NOVICE) {
    const scored = moves.map((index) => ({ index, score: scoreMove(state, index, me) + rng() * 18 }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].index;
  }

  if (tier === TIER_DUELIST) {
    // 先堵对手的一步杀，再按「下个战场安全度」选最优
    const safe = immediateThreats(state, me);
    const pool = safe.length ? safe : moves;
    const scored = pool.map((index) => ({ index, score: scoreMove(state, index, me) + rng() * 6 }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0].index;
  }

  if (tier === TIER_MASTER) {
    return searchBestMove(state, me, meta, rng);
  }

  const iterations = Math.max(60, Math.trunc(options.budget ?? meta.iterations));
  const best = mctsMove(state, me, iterations, rng);
  return best >= 0 ? best : searchBestMove(state, me, { ...meta, candidates: 8 }, rng);
}

// 自适应：给 UI 的「思考中」提示与测试用的固定预算。
export function tierLabelKey(tier) {
  return `tier_${TIERS.includes(tier) ? tier : TIER_DUELIST}`;
}
