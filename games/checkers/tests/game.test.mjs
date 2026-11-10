// game.test.mjs - controller tests for games/checkers/js/game.mjs
import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";
import * as A from "../js/ai.mjs";
import { createGameController, MODES, OUTCOME } from "../js/game.mjs";

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
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness(overrides = {}) {
  let nextId = 1;
  const tasks = new Map();
  const schedule = (fn, ms) => {
    const id = nextId++;
    tasks.set(id, { fn, ms });
    return id;
  };
  const cancel = (id) => tasks.delete(id);
  const flush = () => {
    const list = [...tasks.values()];
    tasks.clear();
    for (const task of list) task.fn();
  };
  const rng = overrides.rng ?? mulberry32(20261110);
  const ai = overrides.ai ?? ((s, opts) => A.chooseMove(s, { ...opts, rng }));
  const changes = [];
  const controller = createGameController({
    ai, rng, schedule, cancel,
    onChange: (v) => changes.push(v),
  });
  return { controller, tasks, flush, changes, rng };
}

async function settle(h) {
  await tick();
  h.flush();
  await tick();
}

// Board with one empty target hole and a red marble able to fill it.
function oneMoveFromWin() {
  const target = E.targetOf(E.RED);
  const camp = new Set(target);
  let hole = -1;
  let from = -1;
  for (const t of target) {
    const n = E.NEIGHBORS[t].find((x) => !camp.has(x));
    if (n !== undefined) { hole = t; from = n; break; }
  }
  const board = blank();
  for (const t of target) board[t] = E.RED;
  board[hole] = E.EMPTY;
  board[from] = E.RED;
  return { state: E.createState(board, E.RED), hole, from };
}

test("start: instant play with sane defaults and no pending AI timer", () => {
  const h = harness();
  const v = h.controller.start();
  assert.equal(v.config.mode, MODES.PVE);
  assert.equal(v.config.difficulty, A.DIFFICULTY_INTERMEDIATE);
  assert.equal(v.config.humanSide, E.RED);
  assert.equal(v.state.turn, E.RED);
  assert.equal(v.thinking, false);
  assert.equal(v.canUndo, false);
  assert.equal(v.finished, null);
  assert.ok(h.controller.currentMoves().length > 0, "board is playable on first paint");
  assert.equal(h.tasks.size, 0, "red moves first, so no AI is scheduled");
  assert.ok(h.changes.length > 0);
});

test("targetsFrom only exposes the current human side's marbles", () => {
  const h = harness();
  h.controller.start();
  const first = h.controller.currentMoves()[0];
  assert.ok(h.controller.targetsFrom(first.from).length > 0);
  assert.deepEqual(h.controller.targetsFrom(E.BLUE_HOME[0]), []);
  const empty = h.controller.view().state.board.findIndex((v) => v === 0);
  assert.deepEqual(h.controller.targetsFrom(empty), []);
  assert.deepEqual(h.controller.targetsFrom(-1), []);
  assert.deepEqual(h.controller.targetsFrom(999), []);
});

test("play accepts legal moves, silently ignores illegal ones", async () => {
  const h = harness();
  h.controller.start();
  const moves = h.controller.currentMoves();
  const move = moves[0];
  assert.equal(h.controller.play(move), true);
  assert.equal(h.controller.view().state.moveCount, 1);
  assert.equal(h.controller.view().thinking, true, "AI must start thinking");
  assert.equal(h.controller.play(moves[1] ?? move), false, "no input while AI thinks");
  assert.equal(h.controller.targetsFrom(move.to).length, 0);
  await settle(h);
  assert.equal(h.controller.view().thinking, false);
  assert.equal(h.controller.view().state.moveCount, 2);
  assert.equal(h.controller.view().humanTurn, true);

  assert.equal(h.controller.play(null), false);
  assert.equal(h.controller.play({ from: move.from }), false);
  assert.equal(h.controller.play({ from: -1, to: 0 }), false);
  assert.equal(h.controller.play({ from: E.BLUE_HOME[0], to: move.to }), false);
});

test("AI reply respects the minimum think time and reports progress", async () => {
  let progressed = 0;
  const h = harness({
    ai: async (s, opts) => {
      opts.onProgress([{ move: 1, score: 2 }]);
      progressed += 1;
      return A.chooseMove(s, { ...opts, rng: mulberry32(5) });
    },
  });
  h.controller.start({ difficulty: A.DIFFICULTY_INTERMEDIATE });
  h.controller.play(h.controller.currentMoves()[0]);
  await tick();
  assert.ok(progressed > 0);
  assert.ok([...h.tasks.values()].some((t) => t.ms > 0), "min think time must be applied");
  assert.ok(h.changes.some((v) => v.thinking && Array.isArray(v.thinkingProgress)));
  h.flush();
  assert.equal(h.controller.view().thinking, false);
  assert.equal(h.controller.view().state.moveCount, 2);
});

test("stale AI result is discarded after a restart (aiToken race)", async () => {
  let resolveAI;
  const h = harness({ ai: () => new Promise((r) => { resolveAI = r; }) });
  h.controller.start({ humanSide: E.BLUE, mode: MODES.PVE });
  await tick();
  assert.equal(h.controller.view().thinking, true, "AI opens when human plays blue");
  const fresh = h.controller.start({ humanSide: E.RED, mode: MODES.PVE });
  assert.equal(fresh.state.moveCount, 0);
  resolveAI(null);
  await settle(h);
  assert.equal(h.controller.view().state.moveCount, 0, "old AI must not move");
  assert.equal(h.controller.view().thinking, false);
});

test("undo cancels a pending AI and removes the player's last move", async () => {
  let resolveAI;
  const h = harness({ ai: () => new Promise((r) => { resolveAI = r; }) });
  h.controller.start();
  h.controller.play(h.controller.currentMoves()[0]);
  await tick();
  assert.equal(h.controller.view().thinking, true);
  assert.equal(h.controller.undo(), true);
  assert.equal(h.controller.view().state.moveCount, 0);
  assert.equal(h.controller.view().thinking, false);
  resolveAI(null);
  await settle(h);
  assert.equal(h.controller.view().state.moveCount, 0);
});

test("PVE undo rolls back player + AI reply; PVP undo rolls back one ply", async () => {
  const h = harness();
  h.controller.start({ mode: MODES.PVE });
  h.controller.play(h.controller.currentMoves()[0]);
  await settle(h);
  assert.equal(h.controller.view().state.moveCount, 2);
  assert.equal(h.controller.view().canUndo, true);
  assert.equal(h.controller.undo(), true);
  assert.equal(h.controller.view().state.moveCount, 0);
  assert.equal(h.controller.view().canUndo, false);
  assert.equal(h.controller.undo(), false);

  const pvp = harness();
  pvp.controller.start({ mode: MODES.PVP });
  pvp.controller.play(pvp.controller.currentMoves()[0]);
  pvp.controller.play(pvp.controller.currentMoves()[0]);
  assert.equal(pvp.controller.view().state.moveCount, 2);
  assert.equal(pvp.controller.undo(), true);
  assert.equal(pvp.controller.view().state.moveCount, 1);
});

test("difficulty can change without touching the live board", () => {
  const h = harness();
  h.controller.start();
  h.controller.play(h.controller.currentMoves()[0]);
  const before = JSON.stringify(h.controller.view().state);
  assert.equal(h.controller.setDifficulty(A.DIFFICULTY_MASTER), true);
  assert.equal(h.controller.setDifficulty("nope"), false);
  assert.equal(JSON.stringify(h.controller.view().state), before);
  assert.equal(h.controller.view().config.difficulty, A.DIFFICULTY_MASTER);
});

test("restore replays a saved move list without desync", async () => {
  const source = harness();
  source.controller.start({ mode: MODES.PVP });
  const moves = [];
  for (let i = 0; i < 6; i++) {
    const m = source.controller.currentMoves()[0];
    moves.push({ from: m.from, to: m.to });
    assert.equal(source.controller.play(m), true);
  }
  const expected = JSON.stringify(source.controller.view().state.board);

  const target = harness();
  const v = target.controller.restore({
    mode: MODES.PVP,
    difficulty: A.DIFFICULTY_ADVANCED,
    moves: [...moves, { from: -1, to: -1 }],
  });
  assert.equal(JSON.stringify(v.state.board), expected, "a corrupt tail entry is dropped");
  assert.equal(v.state.moveCount, 6);
  assert.equal(target.controller.getMoveLog().length, 6);
  assert.equal(target.controller.restore(null), null);
});

test("one-move win: result, terminal lock, and no undo after settlement", async () => {
  const { state, hole, from } = oneMoveFromWin();
  const h = harness();
  h.controller.start({ mode: MODES.PVP, engineState: state });
  assert.equal(h.controller.result(), null);
  assert.equal(h.controller.play({ from, to: hole }), true);
  const result = h.controller.result();
  assert.ok(result);
  assert.equal(result.winner, E.RED);
  assert.equal(result.humanOutcome, null, "PVP has no human win/loss outcome");
  assert.equal(result.plies, 1);
  assert.equal(E.detectWinner(h.controller.view().state.board, E.RED), true);
  assert.equal(h.controller.view().canUndo, false);
  assert.equal(h.controller.undo(), false, "a settled game is never reopened");
  assert.equal(h.controller.play({ from, to: hole }), false);
  assert.deepEqual(h.controller.currentMoves(), []);
  await settle(h);
});

test("PVE result carries the human outcome", async () => {
  const { state, hole, from } = oneMoveFromWin();
  const h = harness();
  h.controller.start({ mode: MODES.PVE, humanSide: E.RED, engineState: state });
  assert.equal(h.controller.play({ from, to: hole }), true);
  assert.equal(h.controller.result().humanOutcome, OUTCOME.WIN);
  assert.equal(h.controller.result().difficulty, A.DIFFICULTY_INTERMEDIATE);
  await settle(h);
});

test("move log and stats expose chain-hop details for replay", async () => {
  const home = new Set(E.RED_HOME);
  let line = null;
  for (let hole = 0; hole < E.HOLE_COUNT && !line; hole++) {
    const c = E.HOLES[hole];
    for (const d of E.DIRS) {
      const ids = [hole];
      for (let i = 1; i <= 6; i++) {
        ids.push(E.holeIndex(c[0] + i * d[0], c[1] + i * d[1], c[2] + i * d[2]));
      }
      if (ids.every((id) => id >= 0) && [2, 4, 6].every((k) => !home.has(ids[k]))) {
        line = ids;
        break;
      }
    }
  }
  assert.ok(line);
  const board = blank();
  board[line[0]] = E.RED;
  board[line[1]] = E.BLUE;
  board[line[3]] = E.BLUE;
  board[line[5]] = E.BLUE;
  const h = harness();
  h.controller.start({ mode: MODES.PVP, engineState: E.createState(board, E.RED) });
  assert.equal(h.controller.play({ from: line[0], to: line[6] }), true);
  const log = h.controller.getMoveLog();
  assert.equal(log.length, 1);
  assert.equal(log[0].ply, 1);
  assert.equal(log[0].hops, 3);
  assert.deepEqual(log[0].path, [line[0], line[2], line[4], line[6]]);
  assert.deepEqual(log[0].via, [line[1], line[3], line[5]]);
  assert.equal(h.controller.view().stats.maxHops, 3);
  assert.equal(h.controller.view().stats.lastHops, 3);
  assert.equal(h.controller.view().lastMove.to, line[6]);
});

test("destroy cancels pending timers", async () => {
  const h = harness();
  h.controller.start({ humanSide: E.BLUE });
  await tick();
  assert.ok(h.tasks.size > 0 || h.controller.view().thinking);
  h.controller.destroy();
  assert.equal(h.tasks.size, 0);
  assert.equal(h.controller.view().thinking, false);
});

test("200-ply local self-play never throws or desyncs", () => {
  const h = harness();
  h.controller.start({ mode: MODES.PVP });
  const rng = mulberry32(777);
  for (let i = 0; i < 200; i++) {
    const v = h.controller.view();
    if (v.state.status !== "playing") break;
    const moves = h.controller.currentMoves();
    assert.ok(moves.length > 0, `ply ${i}: a legal move must exist`);
    const move = moves[Math.floor(rng() * moves.length)];
    assert.equal(h.controller.play(move), true);
    assert.equal(h.controller.view().state.moveCount, i + 1);
  }
});
