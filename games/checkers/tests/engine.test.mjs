// engine.test.mjs - rule-level tests for games/checkers/js/engine.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const blank = () => Array(E.HOLE_COUNT).fill(E.EMPTY);
const count = (board, v) => board.reduce((n, x) => n + (x === v ? 1 : 0), 0);

function assertInvariants(state, previous, step) {
  assert.equal(state.board.length, 121);
  assert.equal(count(state.board, E.RED), 10, `red marble count at step ${step}`);
  assert.equal(count(state.board, E.BLUE), 10, `blue marble count at step ${step}`);
  assert.ok(state.board.every((v) => v === 0 || v === 1 || v === 2));
  assert.equal(state.moveCount, previous.moveCount + 1);
  assert.equal(state.history.length, state.moveCount);
  assert.ok(state.status === "playing" || state.status === "won");
  assert.ok(state.turn === E.RED || state.turn === E.BLUE);
  if (state.status === "won") assert.ok(state.winner === E.RED || state.winner === E.BLUE);
  else assert.equal(state.winner, 0);
}

// One deterministic random walk. Returns a per-frame signature so two runs
// with the same seed can be compared frame by frame.
function walk(seed, steps) {
  const rng = mulberry32(seed);
  let state = E.createInitialState();
  const log = [];
  let restarts = 0;
  let stuck = 0;

  for (let i = 0; i < steps; i++) {
    if (state.status !== "playing") {
      state = E.createInitialState();
      restarts++;
      log.push("restart");
      continue;
    }
    const moves = E.legalMoves(state);
    if (moves.length === 0) {
      state = E.createInitialState();
      stuck++;
      log.push("stuck");
      continue;
    }
    const move = moves[Math.floor(rng() * moves.length)];
    const next = E.applyMove(state, move);
    assert.notEqual(next, state, `step ${i}: a legal move must execute`);
    assertInvariants(next, state, i);
    assert.equal(state.board[move.from], E.RED === state.turn ? E.RED : E.BLUE,
      "input board must stay untouched");
    log.push(`${state.turn}:${move.from}>${move.to}:${move.kind}:${move.hops}`);
    state = next;
  }
  log.push(state.board.join(""));
  log.push(`restarts=${restarts}`);
  log.push(`stuck=${stuck}`);
  return log;
}

test("board topology: 121 cube holes, 61 centre + 6x10 tips", () => {
  assert.equal(E.HOLE_COUNT, 121);
  const keys = new Set();
  for (const [x, y, z] of E.HOLES) {
    assert.equal(x + y + z, 0);
    keys.add(`${x},${y},${z}`);
  }
  assert.equal(keys.size, 121, "no duplicate holes");
  assert.equal(E.TRIANGLES.length, 6);
  for (const t of E.TRIANGLES) assert.equal(t.length, 10);
  assert.equal(new Set(E.TRIANGLES.flat()).size, 60, "tips must not overlap");
  const centre = E.HOLES.filter((c) => Math.max(Math.abs(c[0]), Math.abs(c[1]), Math.abs(c[2])) <= 4);
  assert.equal(centre.length, 61);
  assert.equal(new Set([...E.RED_HOME, ...E.BLUE_HOME]).size, 20);
  for (const h of E.RED_HOME) {
    const [x, y, z] = E.HOLES[h];
    assert.ok(E.holeIndex(-x, -y, -z) >= 0, "opposite tip must exist");
  }
  assert.equal(E.holeIndex(99, 99, -198), -1);
});

test("adjacency and jump tables stay on the concave star", () => {
  for (let h = 0; h < E.HOLE_COUNT; h++) {
    for (const n of E.NEIGHBORS[h]) {
      assert.ok(n >= 0 && n < E.HOLE_COUNT);
      assert.ok(E.NEIGHBORS[n].includes(h), "adjacency must be symmetric");
    }
    for (const { mid, to } of E.JUMPS[h]) {
      assert.ok(mid >= 0 && mid < E.HOLE_COUNT);
      assert.ok(to >= 0 && to < E.HOLE_COUNT);
      assert.ok(E.NEIGHBORS[h].includes(mid));
      assert.ok(E.NEIGHBORS[mid].includes(to));
      assert.notEqual(mid, to);
    }
  }
});

test("initial state: instant play, 10 vs 10, no premature winner", () => {
  const s = E.createInitialState();
  assert.equal(count(s.board, E.RED), 10);
  assert.equal(count(s.board, E.BLUE), 10);
  assert.equal(s.turn, E.RED);
  assert.equal(s.status, "playing");
  assert.equal(E.detectWinner(s.board, E.RED), false);
  assert.equal(E.detectWinner(s.board, E.BLUE), false);
  assert.equal(E.campCount(s.board, E.RED), 0);

  const moves = E.legalMoves(s);
  assert.ok(moves.length > 0, "the first move must be available immediately");
  const home = new Set(E.RED_HOME);
  for (const m of moves) {
    assert.equal(s.board[m.from], E.RED);
    assert.equal(s.board[m.to], E.EMPTY);
    assert.ok(m.path[0] === m.from && m.path[m.path.length - 1] === m.to);
    assert.equal(m.path.length - 1, m.kind === "step" ? 1 : m.hops);
    assert.equal(m.via.length, m.hops);
    assert.equal(home.has(m.to), false, "no landing in own starting camp");
  }
  assert.ok(moves.some((m) => m.kind === "step"), "adjacent steps must exist");
  // The tip's second row can already hop over the base row into the empty
  // central hexagon, so jumps are legal from move one.
  const jumps = moves.filter((m) => m.kind === "jump");
  assert.ok(jumps.length > 0);
  for (const j of jumps) {
    assert.equal(j.hops, 1);
    assert.ok(j.via.every((v) => s.board[v] !== E.EMPTY));
    assert.ok(E.NEIGHBORS[j.from].includes(j.via[0]));
  }
});

test("BFS chain hop: 3-hop ladder, one-click landing, path and via", () => {
  const home = new Set(E.RED_HOME);
  const target = new Set(E.BLUE_HOME);
  let line = null;
  for (let h = 0; h < E.HOLE_COUNT && !line; h++) {
    const c = E.HOLES[h];
    for (const d of E.DIRS) {
      const ids = [h];
      for (let i = 1; i <= 6; i++) {
        ids.push(E.holeIndex(c[0] + i * d[0], c[1] + i * d[1], c[2] + i * d[2]));
      }
      const usable = ids.every((id) => id >= 0)
        && [2, 4, 6].every((k) => !home.has(ids[k]))
        && !target.has(ids[0]);
      if (usable) { line = ids; break; }
    }
  }
  assert.ok(line, "need a straight line of 7 holes");

  const board = blank();
  board[line[0]] = E.RED;                       // moving marble
  board[line[1]] = E.BLUE;                      // jump board 1
  board[line[3]] = E.BLUE;                      // jump board 2
  board[line[5]] = E.BLUE;                      // jump board 3
  const s = E.createState(board, E.RED);
  const moves = E.legalMovesFrom(s, line[0]);

  const far = moves.find((m) => m.to === line[6]);
  assert.ok(far, "the 3-hop landing must be reachable in one click");
  assert.equal(far.kind, "jump");
  assert.equal(far.hops, 3);
  assert.deepEqual(far.path, [line[0], line[2], line[4], line[6]]);
  assert.deepEqual(far.via, [line[1], line[3], line[5]]);
  for (const h of [line[2], line[4]]) {
    const stop = moves.find((m) => m.to === h);
    assert.ok(stop, "a player may stop at any hop node");
    assert.equal(stop.kind, "jump");
  }
  assert.equal(moves.some((m) => m.to === line[0]), false, "cannot hop back to origin");
  assert.equal(moves.some((m) => m.kind === "jump" && m.hops > 3), false);
  assert.equal(E.applyMove(s, far).board[line[6]], E.RED);
  assert.equal(E.applyMove(s, far).board[line[0]], E.EMPTY);
});

test("anti-stalling victory rule", () => {
  const target = E.targetOf(E.RED);
  const b = blank();
  target.forEach((h, i) => { b[h] = i < 3 ? E.BLUE : E.RED; });
  assert.equal(E.detectWinner(b, E.RED), true, "3 opponent squatters are tolerated");
  assert.equal(E.campCount(b, E.RED), 7);

  b[target[9]] = E.EMPTY;
  assert.equal(E.detectWinner(b, E.RED), false, "an empty target hole blocks victory");

  const full = blank();
  for (const h of target) full[h] = E.RED;
  assert.equal(E.detectWinner(full, E.RED), true);

  const squat = blank();
  for (const h of target) squat[h] = E.BLUE;
  assert.equal(E.detectWinner(squat, E.RED), false, "vacuous truth must not win");
  assert.equal(E.detectWinner(E.createInitialState().board, E.BLUE), false);
});

test("camp patches: no landing in own home, no leaving target camp", () => {
  const home = new Set(E.RED_HOME);
  let h = -1;
  let outside = -1;
  for (const t of E.RED_HOME) {
    const n = E.NEIGHBORS[t].find((x) => !home.has(x));
    if (n !== undefined) { h = t; outside = n; break; }
  }
  assert.ok(h >= 0 && outside >= 0, "tip base must touch the central hexagon");

  const b = blank();
  for (const t of E.RED_HOME) b[t] = E.RED;
  b[outside] = E.RED;
  b[h] = E.EMPTY;
  const s = E.createState(b, E.RED);
  const moves = E.legalMovesFrom(s, outside);
  assert.ok(moves.length > 0);
  assert.equal(moves.some((m) => m.to === h), false, "own starting camp is off limits");

  const target = E.targetOf(E.RED);
  const b2 = blank();
  b2[target[0]] = E.RED;
  const s2 = E.createState(b2, E.RED);
  const inCamp = E.legalMovesFrom(s2, target[0]);
  assert.ok(inCamp.length > 0, "a marble inside the target camp can still reposition");
  const targetSet = new Set(target);
  for (const m of inCamp) {
    assert.ok(targetSet.has(m.to), "a landed marble may not leave the target camp");
  }
});

test("applyMove is pure, rejects illegal moves, locks terminal state", () => {
  const s = E.createInitialState();
  const m = E.legalMoves(s)[0];
  const next = E.applyMove(s, m);
  assert.notEqual(next, s);
  assert.equal(next.board[m.from], E.EMPTY);
  assert.equal(next.board[m.to], E.RED);
  assert.equal(next.turn, E.BLUE);
  assert.equal(next.moveCount, 1);
  assert.equal(next.history.length, 1);
  assert.equal(s.moveCount, 0, "input state is untouched");
  assert.equal(s.board[m.from], E.RED, "input board is untouched");
  assert.equal(s.history.length, 0);

  assert.equal(E.applyMove(s, { from: m.from, to: m.from }), s);
  assert.equal(E.applyMove(s, { from: m.from, to: -1 }), s);
  assert.equal(E.applyMove(s, { from: 0, to: m.to }), s);
  assert.equal(E.applyMove(s, null), s);

  const forged = E.applyMove(s, { from: m.from, to: m.to, path: [1, 2, 3], via: [4] });
  assert.deepEqual(forged.history[0].path, m.path, "forged paths are ignored");

  const won = { ...next, status: "won", winner: E.RED };
  assert.equal(E.applyMove(won, { from: m.from, to: m.to }), won);
  assert.deepEqual(E.legalMoves(won), []);
});

test("1000+ step random walk: no crash, no deadlock, invariants hold", () => {
  const log = walk(20261110, 1000);
  assert.equal(log[log.length - 1], "stuck=0", "the state machine must never deadlock");
});

test("same seed + same input sequence is frame-by-frame identical", () => {
  const a = walk(7788, 1000);
  const b = walk(7788, 1000);
  assert.deepEqual(a, b);
  const c = walk(7789, 1000);
  assert.notDeepEqual(a, c, "a different seed must produce a different game");
});
