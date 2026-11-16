// engine.mjs - Chinese Checkers (Sternhalma) rules.
// Pure functions, DOM-free, zero dependencies.
//
// Board: 121 holes in cube coordinates (x + y + z = 0), addressed by id 0..120.
//   - central hexagon of radius 4           -> 61 holes
//   - six triangular star tips, 10 each     -> 60 holes
// Six unit directions. A step moves one hole; a jump travels two holes along
// one direction, requiring an occupied middle hole and an empty landing hole.
// Jumps may chain; every hop landing is a legal place to stop (one-click hop).

export const EMPTY = 0;
export const RED = 1;
export const BLUE = 2;

export const DIRS = Object.freeze([
  Object.freeze([1, -1, 0]),
  Object.freeze([1, 0, -1]),
  Object.freeze([0, 1, -1]),
  Object.freeze([-1, 1, 0]),
  Object.freeze([-1, 0, 1]),
  Object.freeze([0, -1, 1]),
]);

const cubeKey = (x, y, z) => `${x},${y},${z}`;
const rot60 = (c) => [-c[2], -c[0], -c[1]];

function buildBoard() {
  const holes = [];
  const triangles = [];

  for (let x = -4; x <= 4; x++) {
    for (let y = -4; y <= 4; y++) {
      const z = -x - y;
      if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) <= 4) holes.push([x, y, z]);
    }
  }

  // Base tip: z >= 5, x/y in [-4,-1], x+y <= -5 -> exactly 10 holes.
  const tip = [];
  for (let x = -4; x <= -1; x++) {
    for (let y = -4; y <= -1; y++) {
      if (x + y <= -5) tip.push([x, y, -x - y]);
    }
  }

  let seed = tip;
  for (let k = 0; k < 6; k++) {
    const ids = [];
    for (const c of seed) {
      ids.push(holes.length);
      holes.push(c);
    }
    triangles.push(Object.freeze(ids));
    seed = seed.map(rot60);
  }
  return { holes, triangles };
}

const BUILT = buildBoard();

export const HOLES = Object.freeze(BUILT.holes.map((c) => Object.freeze(c)));
export const HOLE_COUNT = HOLES.length;
export const TRIANGLES = Object.freeze(BUILT.triangles);

const INDEX = new Map(HOLES.map((c, i) => [cubeKey(c[0], c[1], c[2]), i]));

export function holeIndex(x, y, z) {
  const id = INDEX.get(cubeKey(x, y, z));
  return id === undefined ? -1 : id;
}

// With the standard cube-to-pixel projection, tip 0 (z >= 5) renders at the
// bottom and its 180-degree counterpart (tip 3, z <= -5) renders at the top.
export const RED_HOME = TRIANGLES[0];
export const BLUE_HOME = TRIANGLES[3];

export const homeOf = (p) => (p === RED ? RED_HOME : BLUE_HOME);
export const targetOf = (p) => (p === RED ? BLUE_HOME : RED_HOME);

const HOME_SET = { [RED]: new Set(RED_HOME), [BLUE]: new Set(BLUE_HOME) };
const TARGET_SET = { [RED]: new Set(BLUE_HOME), [BLUE]: new Set(RED_HOME) };

// Precomputed tables, one entry per hole. A jump is valid only when BOTH the
// middle hole and the landing hole exist: the star is concave, so a straight
// line can leave the board and re-enter it.
export const NEIGHBORS = Object.freeze(HOLES.map((c) => Object.freeze(
  DIRS.map((d) => holeIndex(c[0] + d[0], c[1] + d[1], c[2] + d[2])).filter((i) => i >= 0)
)));

export const JUMPS = Object.freeze(HOLES.map((c) => Object.freeze(
  DIRS.map((d) => {
    const mid = holeIndex(c[0] + d[0], c[1] + d[1], c[2] + d[2]);
    const to = holeIndex(c[0] + 2 * d[0], c[1] + 2 * d[1], c[2] + 2 * d[2]);
    return mid >= 0 && to >= 0 ? Object.freeze({ mid, to }) : null;
  }).filter(Boolean)
)));

export function otherPlayer(p) {
  return p === RED ? BLUE : RED;
}

export function createInitialState() {
  const board = Array(HOLE_COUNT).fill(EMPTY);
  for (const h of RED_HOME) board[h] = RED;
  for (const h of BLUE_HOME) board[h] = BLUE;
  return {
    board,
    turn: RED,
    status: "playing",
    winner: 0,
    moveCount: 0,
    history: [],
  };
}

// Build a state from an explicit board (puzzles, replay, tests).
export function createState(board, turn = RED) {
  const clean = Array(HOLE_COUNT).fill(EMPTY);
  for (let i = 0; i < HOLE_COUNT; i++) {
    const v = board[i];
    clean[i] = v === RED || v === BLUE ? v : EMPTY;
  }
  return {
    board: clean,
    turn: turn === BLUE ? BLUE : RED,
    status: "playing",
    winner: 0,
    moveCount: 0,
    history: [],
  };
}

// Anti-stalling victory (non-spoiling rule):
// a player wins when every hole of the target camp NOT still occupied by the
// opponent is filled with their own marble. mine > 0 blocks the vacuous case.
export function detectWinner(board, player) {
  const opponent = otherPlayer(player);
  let mine = 0;
  for (const h of targetOf(player)) {
    const v = board[h];
    if (v === player) mine++;
    else if (v === opponent) continue;
    else return false;
  }
  return mine > 0;
}

export function campCount(board, player) {
  let n = 0;
  for (const h of targetOf(player)) if (board[h] === player) n++;
  return n;
}

// Movement patches that make stalling impossible:
//  1. a marble may never land in its own starting camp (no camping / blocking)
//  2. a marble already inside its target camp may not leave it again
function canLand(player, from, to) {
  if (HOME_SET[player].has(to)) return false;
  if (TARGET_SET[player].has(from) && !TARGET_SET[player].has(to)) return false;
  return true;
}

function stepMoves(state, from, player) {
  const out = [];
  for (const n of NEIGHBORS[from]) {
    if (state.board[n] !== EMPTY) continue;
    if (!canLand(player, from, n)) continue;
    out.push({ from, to: n, kind: "step", hops: 0, path: [from, n], via: [] });
  }
  return out;
}

// BFS over landing holes. The set of jumpable marbles is constant during a
// chain (only the moving marble changes position), so a hole id is enough for
// state; visited also prevents hopping back to the origin or looping.
// Move: { from, to, kind, hops, path, via }
//   path = landing sequence including the origin,  via = jumped-over holes
function jumpMoves(state, from, player) {
  const { board } = state;
  const home = HOME_SET[player];
  const target = TARGET_SET[player];
  const leaveForbidden = target.has(from);
  const out = [];
  const visited = new Set([from]);
  const queue = [{ hole: from, path: [from], via: [], hops: 0 }];

  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    for (const { mid, to } of JUMPS[cur.hole]) {
      if (visited.has(to)) continue;
      if (board[mid] === EMPTY || board[to] !== EMPTY) continue;
      if (home.has(to)) continue;
      if (leaveForbidden && !target.has(to)) continue;
      visited.add(to);
      const next = {
        hole: to,
        path: [...cur.path, to],
        via: [...cur.via, mid],
        hops: cur.hops + 1,
      };
      out.push({ from, to, kind: "jump", hops: next.hops, path: next.path, via: next.via });
      queue.push(next);
    }
  }
  return out;
}

export function legalMovesFrom(state, from) {
  if (state.status !== "playing") return [];
  const player = state.board[from];
  if (player !== RED && player !== BLUE) return [];
  return [...stepMoves(state, from, player), ...jumpMoves(state, from, player)];
}

export function legalMoves(state, player = state.turn) {
  if (state.status !== "playing") return [];
  const out = [];
  for (let h = 0; h < HOLE_COUNT; h++) {
    if (state.board[h] === player) out.push(...legalMovesFrom(state, h));
  }
  return out;
}

export function applyMove(state, move) {
  if (state.status !== "playing" || !move) return state;
  const player = state.turn;
  if (state.board[move.from] !== player) return state;
  // Re-derive the move so a caller cannot forge a jump path.
  // Step and jump landings never overlap, so `to` identifies a move uniquely.
  const found = legalMovesFrom(state, move.from).find((m) => m.to === move.to);
  if (!found) return state;

  const board = state.board.slice();
  board[found.from] = EMPTY;
  board[found.to] = player;

  const next = {
    board,
    turn: otherPlayer(player),
    status: "playing",
    winner: 0,
    moveCount: state.moveCount + 1,
    history: [...state.history, { ...found, player }],
  };

  const opponent = otherPlayer(player);
  const winner = detectWinner(board, player) ? player
    : detectWinner(board, opponent) ? opponent : 0;
  if (winner) {
    next.status = "won";
    next.winner = winner;
  }
  return next;
}

// Solo mode (chain-hop puzzles): opponent marbles are static bridges, so the
// turn never alternates and no camp victory is evaluated. The move is still
// re-derived from legalMovesFrom, exactly like applyMove, so a forged jump
// path cannot be injected by the caller.
export function applySoloMove(state, move, player = RED) {
  if (!state || state.status !== "playing" || !move) return state;
  if (state.board[move.from] !== player) return state;
  const found = legalMovesFrom(state, move.from).find((m) => m.to === move.to);
  if (!found) return state;

  const board = state.board.slice();
  board[found.from] = EMPTY;
  board[found.to] = player;
  return {
    board,
    turn: player,
    status: "playing",
    winner: 0,
    moveCount: state.moveCount + 1,
    history: [...state.history, { ...found, player }],
  };
}
