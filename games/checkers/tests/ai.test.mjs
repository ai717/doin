// ai.test.mjs - opponent decision tests for games/checkers/js/ai.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";
import * as A from "../js/ai.mjs";

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
const isLegal = (state, move) => E.legalMoves(state, state.turn)
  .some((m) => m.from === move.from && m.to === move.to && m.kind === move.kind);

function randomState(plies, seed) {
  let s = E.createInitialState();
  const rng = mulberry32(seed);
  for (let i = 0; i < plies; i++) {
    if (s.status !== "playing") break;
    const moves = E.legalMoves(s);
    if (!moves.length) break;
    s = E.applyMove(s, moves[Math.floor(rng() * moves.length)]);
  }
  return s;
}

// Straight 7-hole ladder, with the far end closer to RED's target camp.
function findLadder() {
  const home = new Set(E.RED_HOME);
  const target = new Set(E.BLUE_HOME);
  for (let h = 0; h < E.HOLE_COUNT; h++) {
    const c = E.HOLES[h];
    for (const d of E.DIRS) {
      const ids = [h];
      for (let i = 1; i <= 6; i++) {
        ids.push(E.holeIndex(c[0] + i * d[0], c[1] + i * d[1], c[2] + i * d[2]));
      }
      const usable = ids.every((id) => id >= 0)
        && [2, 4, 6].every((k) => !home.has(ids[k]))
        && !target.has(ids[0])
        && A.distanceToCamp(E.RED, ids[6]) < A.distanceToCamp(E.RED, ids[0]) - 3;
      if (usable) return ids;
    }
  }
  return null;
}

test("four tiers are ordered and the master stays within a realistic depth", () => {
  assert.equal(A.DIFFICULTIES.length, 4);
  const metas = A.DIFFICULTIES.map((k) => A.DIFFICULTY_META[k]);
  for (let i = 1; i < metas.length; i++) {
    assert.ok(metas[i].mistakeRate <= metas[i - 1].mistakeRate);
    assert.ok(metas[i].maxDepth >= metas[i - 1].maxDepth);
    assert.ok(metas[i].topK >= metas[i - 1].topK);
    assert.ok(metas[i].budgetMs >= metas[i - 1].budgetMs);
  }
  assert.equal(metas[3].mistakeRate, 0);
  assert.ok(metas[3].maxDepth <= 3, "Halma depth 4 is not interactive in a browser");
  assert.ok(metas.every((m) => m.maxDepth >= 1 && m.budgetMs > 0 && m.topK > 0));
});

test("distanceToCamp is anchored on the far tip of the target camp", () => {
  const target = E.targetOf(E.RED);
  assert.equal(Math.min(...target.map((h) => A.distanceToCamp(E.RED, h))), 0);
  assert.ok(A.distanceToCamp(E.RED, E.RED_HOME[0]) > A.distanceToCamp(E.RED, E.BLUE_HOME[0]));
  assert.equal(A.distanceToCamp(E.RED, E.RED_HOME[0]), A.distanceToCamp(E.BLUE, E.BLUE_HOME[0]));
});

test("evaluate is zero-sum and rewards forward progress", () => {
  const s = E.createInitialState();
  assert.equal(A.evaluate(s, E.RED), 0, "symmetric opening is equal");
  assert.ok(Math.abs(A.evaluate(s, E.RED) + A.evaluate(s, E.BLUE)) < 1e-9);
  const jump = E.legalMoves(s).find((m) => m.kind === "jump");
  assert.ok(jump);
  const next = E.applyMove(s, jump);
  assert.ok(A.evaluate(next, E.RED) > 0, "a forward jump must improve the score");
  assert.ok(Math.abs(A.evaluate(next, E.RED) + A.evaluate(next, E.BLUE)) < 1e-9);
});

test("rankMoves returns legal, descending, bounded results without mutating state", () => {
  const s = E.createInitialState();
  const before = JSON.stringify(s);
  const legal = E.legalMoves(s, E.RED);
  for (const d of A.DIFFICULTIES) {
    const ranked = A.rankMoves(s, E.RED, { difficulty: d });
    assert.ok(ranked.length > 0);
    assert.ok(ranked.length <= A.DIFFICULTY_META[d].topK);
    for (let i = 1; i < ranked.length; i++) {
      assert.ok(ranked[i - 1].score >= ranked[i].score);
    }
    for (const r of ranked) {
      assert.ok(Number.isFinite(r.score));
      assert.ok(legal.some((m) => m.from === r.move.from && m.to === r.move.to && m.kind === r.move.kind));
    }
  }
  assert.equal(JSON.stringify(s), before);
});

test("every tier returns a legal opening move", () => {
  const s = E.createInitialState();
  const rng = mulberry32(42);
  for (const d of A.DIFFICULTIES) {
    const move = A.chooseMove(s, { difficulty: d, rng });
    assert.ok(move, `${d} must return a move`);
    assert.ok(isLegal(s, move));
  }
});

test("same seed + same state + same tier is deterministic", () => {
  const s = randomState(14, 20261110);
  for (const d of A.DIFFICULTIES) {
    const a = A.chooseMove(s, { difficulty: d, rng: mulberry32(7) });
    const b = A.chooseMove(s, { difficulty: d, rng: mulberry32(7) });
    assert.ok(a);
    assert.deepEqual(a, b, `${d} must be reproducible`);
  }
  const before = JSON.stringify(s);
  A.chooseMove(s, { difficulty: A.DIFFICULTY_MASTER, rng: () => 0.5 });
  assert.equal(JSON.stringify(s), before, "decision must not mutate the state");
});

test("master tier takes the long chain hop when it clearly advances", () => {
  const line = findLadder();
  assert.ok(line, "need a 7-hole line heading toward the target camp");
  const board = blank();
  board[line[0]] = E.RED;
  board[line[1]] = E.BLUE;
  board[line[3]] = E.BLUE;
  board[line[5]] = E.BLUE;
  const s = E.createState(board, E.RED);
  const move = A.chooseMove(s, { difficulty: A.DIFFICULTY_MASTER, rng: () => 0.5 });
  assert.ok(move);
  assert.equal(move.to, line[6], "the 3-hop landing must be preferred");
  assert.equal(move.kind, "jump");
  assert.equal(move.hops, 3);
});

test("master tier never misses an immediate win", () => {
  const target = E.targetOf(E.RED);
  const camp = new Set(target);
  let hole = -1;
  let from = -1;
  for (const t of target) {
    const n = E.NEIGHBORS[t].find((x) => !camp.has(x));
    if (n !== undefined) { hole = t; from = n; break; }
  }
  assert.ok(hole >= 0 && from >= 0);
  const board = blank();
  for (const t of target) board[t] = E.RED;
  board[hole] = E.EMPTY;
  board[from] = E.RED;
  const s = E.createState(board, E.RED);
  assert.equal(E.detectWinner(s.board, E.RED), false);
  const move = A.chooseMove(s, { difficulty: A.DIFFICULTY_MASTER, rng: () => 0.5 });
  assert.equal(move.to, hole);
  assert.equal(E.detectWinner(E.applyMove(s, move).board, E.RED), true);
});

test("search respects its time budget on a busy mid-game board", () => {
  const s = randomState(24, 5150);
  const profile = A.DIFFICULTY_META[A.DIFFICULTY_MASTER];
  const t0 = performance.now();
  const move = A.chooseMove(s, { difficulty: A.DIFFICULTY_MASTER, rng: () => 0.5 });
  const elapsed = performance.now() - t0;
  assert.ok(move && isLegal(s, move));
  assert.ok(elapsed < profile.budgetMs * 3, `search took ${elapsed.toFixed(0)}ms`);
});

test("AI self-play 40 plies keeps every invariant", () => {
  let s = E.createInitialState();
  const rng = mulberry32(999);
  for (let i = 0; i < 40; i++) {
    if (s.status !== "playing") break;
    const difficulty = i % 2 === 0 ? A.DIFFICULTY_BEGINNER : A.DIFFICULTY_INTERMEDIATE;
    const move = A.chooseMove(s, { difficulty, rng });
    assert.ok(move, `ply ${i}: AI must return a move`);
    assert.ok(isLegal(s, move), `ply ${i}: move must be legal`);
    const next = E.applyMove(s, move);
    assert.notEqual(next, s);
    assert.equal(count(next.board, E.RED), 10);
    assert.equal(count(next.board, E.BLUE), 10);
    assert.equal(next.moveCount, i + 1);
    s = next;
  }
});

test("async entry reports progress and returns a legal move", async () => {
  const s = E.createInitialState();
  let calls = 0;
  const move = await A.chooseMoveAsync(s, {
    difficulty: A.DIFFICULTY_ADVANCED,
    rng: () => 0.5,
    onProgress: (candidates) => {
      calls += 1;
      assert.ok(Array.isArray(candidates));
      assert.ok(candidates.length <= 5);
      assert.ok(candidates.every((c) => Number.isFinite(c.score)));
    },
  });
  assert.ok(move && isLegal(s, move));
  assert.ok(calls > 0, "progress must be reported");
});

test("terminal and marble-less states return null instead of throwing", async () => {
  const s = E.createInitialState();
  const won = { ...s, status: "won", winner: E.RED };
  assert.equal(A.chooseMove(won, { difficulty: A.DIFFICULTY_MASTER }), null);
  assert.deepEqual(A.rankMoves(won, E.RED, {}), []);

  const board = blank();
  board[E.RED_HOME[0]] = E.BLUE;
  const empty = E.createState(board, E.RED);
  assert.equal(A.chooseMove(empty, { difficulty: A.DIFFICULTY_MASTER, rng: () => 0.5 }), null);
  assert.deepEqual(A.rankMoves(empty, E.RED, {}), []);
  assert.equal(await A.chooseMoveAsync(won, {}), null);
});
