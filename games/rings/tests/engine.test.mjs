import test from "node:test";
import assert from "node:assert/strict";
import {
  canMove, movableRings, applyMove, isSolved, solve, optimalMoves, stateAtProgress, clearCache,
} from "../js/engine.mjs";
import { LEVELS, LEVEL_IDS, levelById, nextLevelId } from "../js/levels.mjs";

test("authoritative move rule: ring1 free, ring2 needs ring1, ring k>=3 needs k-1 on and all earlier off", () => {
  const s = [0, 1, 0, 0, 0];
  assert.equal(canMove(s, 0), true);
  assert.equal(canMove(s, 1), false);
  assert.equal(canMove([1, 0, 0, 0, 0], 1), true);
  assert.equal(canMove([0, 1, 0, 0, 0], 2), true);
  assert.equal(canMove([1, 1, 0, 0, 0], 2), false); // ring1 on => illegal
  assert.equal(canMove([0, 0, 1, 1, 0], 3), true); // earlier two rings off, ring3 on => legal
  assert.equal(canMove([0, 0, 1, 0, 0], 3), true); // ring3 on, earlier off => legal
  assert.equal(canMove([0, 0, 0, 1, 0], 3), false); // ring3 off => illegal
});

test("move rule exact vector check against reference implementation", () => {
  const reference = (s, i) => {
    if (i === 0) return true;
    if (i === 1) return s[0] === 1;
    if (s[i - 1] !== 1) return false;
    for (let k = 0; k <= i - 2; k += 1) if (s[k] !== 0) return false;
    return true;
  };
  // exhaustive over up to 6 rings (64 states x 6 rings)
  for (let n = 2; n <= 6; n += 1) {
    for (let mask = 0; mask < 2 ** n; mask += 1) {
      const s = Array.from({ length: n }, (_, i) => (mask >> i) & 1);
      for (let i = 0; i < n; i += 1) assert.equal(canMove(s, i), reference(s, i));
    }
  }
});

test("classic optimal move counts incl. 341 for nine rings", () => {
  clearCache();
  const expected = [1, 2, 5, 10, 21, 42, 85, 170, 341];
  for (let n = 1; n <= 9; n += 1) {
    const start = Array(n).fill(1);
    assert.equal(optimalMoves(start, "unlink"), expected[n - 1], `n=${n}`);
  }
});

test("solve path replays exactly to the goal in optimal moves", () => {
  for (const level of LEVELS) {
    const { moves } = solve(level.start, level.mode);
    assert.equal(moves.length, level.optimal, level.id);
    let state = level.start.slice();
    for (const ring of moves) {
      const result = applyMove(state, ring);
      assert.equal(result.ok, true, `${level.id} illegal hint ring ${ring}`);
      state = result.state;
    }
    assert.equal(isSolved(state, level.mode), true, level.id);
  }
});

test("mid-game levels stay legal and keep exact remaining optimum", () => {
  for (const level of LEVELS.filter((lv) => lv.kind === "mid")) {
    assert.equal(level.start.length, level.rings);
    assert.equal(level.start.every((v) => v === 0 || v === 1), true);
    assert.equal(isSolved(level.start, level.mode), false, `${level.id} starts solved`);
    assert.ok(level.optimal > 0 && level.optimal < solve(Array(level.rings).fill(level.mode === "link" ? 0 : 1), level.mode).optimal);
  }
});

test("applyMove is pure and rejects illegal rings without mutation", () => {
  const s = [0, 0, 1, 0, 0];
  const before = s.slice();
  const bad = applyMove(s, 1);
  assert.equal(bad.ok, false);
  assert.deepEqual(s, before);
  const good = applyMove(s, 0);
  assert.equal(good.ok, true);
  assert.deepEqual(s, before, "input untouched");
  assert.deepEqual(good.state, [1, 0, 1, 0, 0]);
});

test("1000-step random walk keeps invariants on every legal branch", () => {
  let seed = 0x9e3779b9;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let trial = 0; trial < 4; trial += 1) {
    const n = 3 + trial * 2;
    let state = Array(n).fill(1);
    for (let step = 0; step < 1000; step += 1) {
      const legal = movableRings(state);
      assert.ok(legal.length > 0, `dead-end at ${n}/${step}`);
      const pick = legal[Math.floor(rand() * legal.length)];
      const result = applyMove(state, pick);
      assert.equal(result.ok, true);
      assert.equal(result.state.length, n);
      assert.equal(result.state.every((v) => v === 0 || v === 1), true);
      state = result.state;
    }
  }
});

test("level catalogue has four chapters, twelve unique levels and a finite next chain", () => {
  assert.equal(LEVELS.length, 12);
  assert.equal(new Set(LEVEL_IDS).size, 12);
  assert.equal(new Set(LEVELS.map((lv) => lv.chapter)).size, 4);
  assert.deepEqual([...new Set(LEVELS.map((lv) => lv.rings))].sort(), [3, 5, 7, 9]);
  assert.equal(levelById("missing").id, LEVEL_IDS[0]);
  assert.equal(nextLevelId(LEVEL_IDS[LEVEL_IDS.length - 1]), null);
  let id = LEVEL_IDS[0];
  let hops = 0;
  while (nextLevelId(id) && hops < 100) { id = nextLevelId(id); hops += 1; }
  assert.equal(hops, 11);
});
