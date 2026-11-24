// Nine Rings rules: pure functions, strictly DOM-free.
// Ring index 0 is the first ring at the handle head; 1 = on the handle, 0 = off.
// Move rule (authoritative): ring 1 always; ring 2 needs ring 1 on;
// ring k (k>=3) needs ring k-1 on AND rings 1..k-2 all off.
// Failure of PRD wording "only ring k-2 off" would give 41 instead of 341 moves.

export const MODES = Object.freeze(["unlink", "link"]);

export function isMode(value) {
  return MODES.includes(value);
}

// True when ring i may be toggled in this state.
export function canMove(state, i) {
  if (!Array.isArray(state) || !Number.isInteger(i) || i < 0 || i >= state.length) return false;
  if (i === 0) return true;
  if (i === 1) return state[0] === 1;
  if (state[i - 1] !== 1) return false;
  for (let k = 0; k <= i - 2; k += 1) {
    if (state[k] !== 0) return false;
  }
  return true;
}

// Indices of every currently legal ring (for hint highlighting).
export function movableRings(state) {
  const out = [];
  if (!Array.isArray(state)) return out;
  for (let i = 0; i < state.length; i += 1) {
    if (canMove(state, i)) out.push(i);
  }
  return out;
}

// Pure move. Returns { ok, state, ring }; illegal moves leave state untouched.
export function applyMove(state, i) {
  if (!canMove(state, i)) return { ok: false, state, ring: i };
  const next = state.slice();
  next[i] = next[i] === 1 ? 0 : 1;
  return { ok: true, state: next, ring: i };
}

function goalOf(n, mode) {
  const value = mode === "link" ? 1 : 0;
  return Array(n).fill(value);
}

export function isSolved(state, mode) {
  const goal = mode === "link" ? 1 : 0;
  return Array.isArray(state) && state.every((v) => v === goal);
}

// Deterministic BFS over the 2^n state graph (n<=9 => <=512 nodes).
// Neighbours are visited in ascending ring index so the path is reproducible.
const solveCache = new Map();

export function solve(state, mode) {
  if (!Array.isArray(state) || !isMode(mode)) return { optimal: 0, moves: [] };
  const n = state.length;
  const target = goalOf(n, mode).join("");
  const start = state.join("");
  if (start === target) return { optimal: 0, moves: [] };
  const cacheKey = `${n}|${mode}|${start}`;
  const cached = solveCache.get(cacheKey);
  if (cached) return { optimal: cached.length, moves: cached.slice() };

  const queue = [start];
  const head = new Map([[start, -1]]); // node -> { prev, ring }
  let found = false;
  for (let q = 0; q < queue.length && !found; q += 1) {
    const node = queue[q];
    const values = node.split("").map(Number);
    for (let i = 0; i < n; i += 1) {
      if (!canMove(values, i)) continue;
      const next = values.slice();
      next[i] = next[i] === 1 ? 0 : 1;
      const key = next.join("");
      if (head.has(key)) continue;
      head.set(key, { prev: node, ring: i });
      if (key === target) {
        found = true;
        break;
      }
      queue.push(key);
    }
  }

  if (!head.has(target)) return { optimal: 0, moves: [] };
  const path = [];
  let cursor = target;
  while (cursor !== start) {
    const step = head.get(cursor);
    if (!step) return { optimal: 0, moves: [] };
    path.push(step.ring);
    cursor = step.prev;
  }
  path.reverse();
  solveCache.set(cacheKey, path.slice());
  return { optimal: path.length, moves: path };
}

export function optimalMoves(state, mode) {
  return solve(state, mode).optimal;
}

// A mid-game position taken from a fixed fraction of a shortest solution path.
// Walking along solve() guarantees the state is legal and the remaining optimal
// distance is exact. Deterministic: the BFS neighbour order is fixed.
export function stateAtProgress(n, mode, fraction) {
  if (!Number.isInteger(n) || n < 1 || n > 9 || !isMode(mode)) return null;
  const opposite = goalOf(n, mode === "unlink" ? "link" : "unlink");
  const total = optimalMoves(opposite, mode);
  const steps = Math.max(0, Math.min(total, Math.round(total * fraction)));
  const { moves } = solve(opposite, mode);
  let state = opposite;
  for (let s = 0; s < steps; s += 1) {
    const result = applyMove(state, moves[s]);
    if (!result.ok) break;
    state = result.state;
  }
  return state;
}

export function clearCache() {
  solveCache.clear();
}
