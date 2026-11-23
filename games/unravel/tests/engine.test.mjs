import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGame,
  findStrand,
  freeStrands,
  generateBoard,
  hint,
  isFree,
  mulberry32,
  resolveMerges,
  SLOT_CAP_LEVEL,
  solveBoard,
  tryCollect,
  tryUntie,
} from "../js/engine.mjs";
import { getLevel, LEVELS, levelSeed, RELAX_PARAMS } from "../js/levels.mjs";

function playSolution(board) {
  let state = createGame(board);
  for (const id of board.solution) {
    const strand = findStrand(board, id);
    if (strand.knot && !state.untied[id]) {
      const res = tryUntie(board, state, id);
      assert.ok(res.event, `untie failed for ${id}`);
      state = res.state;
    }
    const res = tryCollect(board, state, id);
    assert.ok(res.event, `collect failed for ${id} in ${board.id}`);
    state = res.state;
  }
  return state;
}

function chipsOfColored(board, state, color) {
  let n = state.slots.filter((c) => c === color).length;
  for (const id of state.collected) {
    const s = findStrand(board, id);
    if (s.color === color) n++;
    if (s.dual === color) n++;
  }
  return n;
}

function assertInvariants(board, state) {
  assert.ok(state.slots.length <= board.cap, "slot overflow");
  assert.ok(state.stats.slotPeak <= board.cap, "slot peak overflow");
  const unique = new Set(state.collected);
  assert.equal(unique.size, state.collected.length, "duplicate collected");
  for (const color of board.colors) {
    let collectedChips = 0;
    for (const id of state.collected) {
      const s = findStrand(board, id);
      if (s.color === color) collectedChips++;
      if (s.dual === color) collectedChips++;
    }
    const slotChips = state.slots.filter((c) => c === color).length;
    const diff = ((collectedChips - slotChips) % 3 + 3) % 3;
    assert.equal(diff, 0, `color ${color} collected-minus-slots mod 3 violated`);
  }
  if (state.status === "won") {
    assert.equal(state.collected.length, board.strands.length, "won but strands remain");
    assert.equal(state.slots.length, 0, "won with chips in slots");
  }
  if (state.status === "lost") {
    assert.equal(state.slots.length, board.cap, "lost without full slots");
  }
}

function syntheticBoard() {
  const colors = ["red", "amber", "teal"];
  const strands = [];
  const solution = [];
  let layer = 0;
  for (let round = 0; round < 3; round++) {
    for (const color of colors) {
      const id = `${color}${round}`;
      strands.push({
        id,
        color,
        dual: null,
        knot: false,
        layer: layer++,
        coveredBy: [],
        path: { x1: 10 + layer * 2, y1: 10, x2: 40 + layer, y2: 30, bow: 5 },
      });
      solution.push(id);
    }
  }
  return {
    id: 0,
    mode: "level",
    cap: 6,
    object: "yarnball",
    colors,
    parMs: 30000,
    strands,
    solution,
  };
}

test("board generation is deterministic per seed", () => {
  const a = generateBoard(getLevel(7), levelSeed(7), "level");
  const b = generateBoard(getLevel(7), levelSeed(7), "level");
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("generated solution is executable and solver agrees on every level", () => {
  for (const level of LEVELS) {
    const board = generateBoard(level, levelSeed(level.id), "level");
    const end = playSolution(board);
    assert.equal(end.status, "won", `level ${level.id} solution did not win`);
    assertInvariants(board, end);
    const moves = solveBoard(board);
    assert.ok(moves && moves.length, `solver failed on level ${level.id}`);
  }
});

test("solver returns an executable move list", () => {
  const board = generateBoard(getLevel(15), levelSeed(15), "level");
  let state = createGame(board);
  for (const id of solveBoard(board)) {
    const s = findStrand(board, id);
    if (s.knot && !state.untied[id]) state = tryUntie(board, state, id).state;
    const res = tryCollect(board, state, id);
    assert.ok(res.event, `solver move ${id} rejected`);
    state = res.state;
  }
  assert.equal(state.status, "won");
});

test("merge rule clears three same-color chips", () => {
  const res = resolveMerges(["red", "amber", "red", "red", "amber"]);
  assert.deepEqual(res.slots, ["amber", "amber"]);
  assert.equal(res.merges.length, 1);
  assert.equal(res.merges[0].color, "red");
});

test("blocked strands cannot be collected", () => {
  const board = generateBoard(getLevel(5), levelSeed(5), "level");
  const state = createGame(board);
  const blocked = board.strands.find((s) => s.coveredBy.length > 0);
  assert.ok(blocked, "expected a covered strand");
  assert.equal(isFree(board, state, blocked.id), false);
  const res = tryCollect(board, state, blocked.id);
  assert.equal(res.event, null);
});

test("knotted strands require untie first", () => {
  const board = generateBoard(getLevel(11), levelSeed(11), "level");
  let state = createGame(board);
  const target = board.solution.find((id) => findStrand(board, id).knot);
  assert.ok(target, "level 11 should carry knots");
  for (const id of board.solution) {
    if (id === target) break;
    const s = findStrand(board, id);
    if (s.knot && !state.untied[id]) state = tryUntie(board, state, id).state;
    state = tryCollect(board, state, id).state;
  }
  assert.equal(tryCollect(board, state, target).event, null);
  const res = tryUntie(board, state, target);
  assert.equal(res.event.type, "untie");
  const collect = tryCollect(board, res.state, target);
  assert.ok(collect.event, "collect after untie should succeed");
});

test("dual strands deposit two chips", () => {
  const board = generateBoard(getLevel(21), levelSeed(21), "level");
  const dual = board.strands.find((s) => s.dual);
  assert.ok(dual, "level 21 should carry a dual strand");
  let state = createGame(board);
  for (const id of board.solution) {
    const s = findStrand(board, id);
    if (s.knot && !state.untied[id]) state = tryUntie(board, state, id).state;
    const res = tryCollect(board, state, id);
    state = res.state;
    if (id === dual.id) {
      assert.equal(res.event.chips.length, 2);
      break;
    }
  }
});

test("terminal states ignore further intents", () => {
  const board = syntheticBoard();
  let state = createGame(board);
  for (const id of board.solution.slice(0, 6)) {
    state = tryCollect(board, state, id).state;
  }
  assert.equal(state.status, "lost");
  const after = tryCollect(board, state, board.solution[6]);
  assert.equal(after.event, null);

  const winBoard = syntheticBoard();
  winBoard.strands = winBoard.strands.slice(0, 3);
  winBoard.solution = winBoard.solution.slice(0, 3);
  let wstate = createGame(winBoard);
  for (const id of winBoard.solution) wstate = tryCollect(winBoard, wstate, id).state;
  assert.equal(wstate.status, "won");
  assert.equal(tryCollect(winBoard, wstate, winBoard.solution[0]).event, null);
  assert.equal(tryUntie(winBoard, wstate, winBoard.solution[0]).event, null);
});

test("hint returns a legal move or null only when nothing is free", () => {
  const board = generateBoard(getLevel(3), levelSeed(3), "level");
  const state = createGame(board);
  const h = hint(board, state);
  assert.ok(h, "hint expected on fresh board");
  if (h.kind === "collect") {
    assert.equal(isFree(board, state, h.id), true);
  }
  const wonState = playSolution(board);
  assert.equal(hint(board, wonState), null);
});

test("relax boards never lose", () => {
  const board = generateBoard(RELAX_PARAMS, 2026, "relax");
  assert.equal(board.cap, 99);
  const moves = solveBoard(board);
  assert.ok(moves && moves.length, "relax board must be solvable");
  let state = createGame(board);
  for (const id of moves) {
    const strand = findStrand(board, id);
    if (strand.knot && !state.untied[id]) state = tryUntie(board, state, id).state;
    state = tryCollect(board, state, id).state;
    assert.ok(state.status !== "lost", "relax mode must never lose");
  }
  assert.equal(state.status, "won");
});

test("1000+ step random walk keeps invariants on every mode", () => {
  const raw = mulberry32(20261123);
  const rng = { next: raw, int: (n) => Math.floor(raw() * n) };
  const scenarios = [
    { level: 1, mode: "level" },
    { level: 15, mode: "level" },
    { level: 25, mode: "level" },
    { level: 40, mode: "level" },
    { level: null, mode: "relax" },
  ];
  let steps = 0;
  for (const scenario of scenarios) {
    const board = scenario.mode === "relax"
      ? generateBoard(RELAX_PARAMS, rng.int(2 ** 30), "relax")
      : generateBoard(getLevel(scenario.level), levelSeed(scenario.level), "level");
    let state = createGame(board);
    const snapshots = [];
    for (let i = 0; i < 260; i++) {
      steps++;
      if (state.status !== "playing") {
        assertInvariants(board, state);
        state = createGame(board);
        snapshots.length = 0;
        continue;
      }
      const roll = rng.next();
      if (roll < 0.2 && snapshots.length > 0) {
        state = JSON.parse(snapshots.pop());
        assertInvariants(board, state);
        continue;
      }
      const free = freeStrands(board, state);
      if (!free.length) continue;
      const target = free[rng.int(free.length)];
      snapshots.push(JSON.stringify(state));
      let res;
      if (target.knot && !state.untied[target.id]) {
        res = tryUntie(board, state, target.id);
      } else {
        res = tryCollect(board, state, target.id);
      }
      if (res.event) state = res.state;
      else snapshots.pop();
      assertInvariants(board, state);
      if (scenario.mode === "relax") {
        assert.ok(state.status !== "lost", "relax never loses");
      }
    }
  }
  assert.ok(steps >= 1000, `random walk steps ${steps} < 1000`);
});

test("free strands count respects coverage", () => {
  const board = generateBoard(getLevel(8), levelSeed(8), "level");
  const state = createGame(board);
  const free = freeStrands(board, state);
  assert.ok(free.length >= 2, "at least two strands free on open board");
  const blocked = board.strands.find(
    (s) => !free.includes(s) && s.coveredBy.length > 0,
  );
  if (blocked) {
    const pending = blocked.coveredBy.filter((c) => !state.collected.includes(c));
    assert.ok(pending.length > 0, "blocked strand must have an uncollected blocker");
  }
});

test("collecting a dual strand without slot room is a silent no-op", () => {
  const mk = (id, color, dual, layer) => ({
    id,
    color,
    dual,
    knot: false,
    layer,
    coveredBy: [],
    path: { x1: 10 + layer * 3, y1: 10, x2: 40 + layer * 2, y2: 30, bow: 4 },
  });
  const board = {
    id: 0,
    mode: "level",
    cap: 4,
    object: "yarnball",
    colors: ["red", "amber", "teal"],
    parMs: 30000,
    strands: [
      mk("r1", "red", null, 0),
      mk("r2", "red", null, 1),
      mk("b1", "amber", null, 2),
      mk("t1", "teal", null, 3),
      mk("t2", "teal", null, 4),
      mk("d", "red", "amber", 5),
      mk("d2", "teal", "amber", 6),
    ],
    solution: ["r1", "r2", "d", "b1", "d2", "t1", "t2"],
  };
  assert.ok(solveBoard(board), "solver must find the merge-aware order");
  let state = createGame(board);
  for (const id of ["r1", "b1", "t1"]) state = tryCollect(board, state, id).state;
  assert.equal(state.slots.length, 3);
  assert.equal(state.status, "playing");
  assert.equal(tryCollect(board, state, "d").event, null, "dual needs 2 free slots");
  const won = playSolution(board);
  assert.equal(won.status, "won");
  assert.equal(won.slots.length, 0);
});

test("slot cap for level mode is 6", () => {
  assert.equal(SLOT_CAP_LEVEL, 6);
});
