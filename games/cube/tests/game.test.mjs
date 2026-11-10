import test from "node:test";
import assert from "node:assert/strict";

import { createSolved, invertMove, isSolved, movesToText, stateKey } from "../js/engine.mjs";
import {
  STATUS,
  createAcademyGame,
  createDailyGame,
  createFreeGame,
  elapsedOf,
  pauseTimer,
  playMove,
  requestHint,
  resetGame,
  resumeTimer,
  scrambleGame,
  undo,
} from "../js/game.mjs";
import { LEVEL_BY_ID } from "../js/levels.mjs";

function solveByInverse(state, now = 1000) {
  const rewind = state.scramble.slice().reverse().map(invertMove);
  let current = state;
  let clock = now;
  for (const move of rewind) {
    clock += 1000;
    current = playMove(current, move, clock).state;
  }
  return { state: current, clock };
}

test("a 2x2 game boots ready with a real scramble", () => {
  const game = createFreeGame({ size: 2, seed: 99 });
  assert.equal(game.size, 2);
  assert.equal(game.mode, "free");
  assert.equal(game.status, STATUS.READY);
  assert.equal(game.moveCount, 0);
  assert.equal(game.scramble.length, 11);
  assert.equal(elapsedOf(game, 5000), 0);
  assert.equal(isSolved(game.cube), false);
  assert.ok(movesToText(game.scramble).length > 0);
});

test("seeded games are deterministic", () => {
  const a = createFreeGame({ size: 3, seed: 4242 });
  const b = createFreeGame({ size: 3, seed: 4242 });
  assert.equal(a.scrambleText, b.scrambleText);
  assert.equal(stateKey(a.cube), stateKey(b.cube));

  const dailyA = createDailyGame(3, "20261110");
  const dailyB = createDailyGame(3, "20261110");
  assert.equal(dailyA.scrambleText, dailyB.scrambleText);
  assert.equal(dailyA.dailyKey, "20261110");
  assert.equal(dailyA.scramble.length, 20);
});

test("first move starts the timer and solving stops it", () => {
  const game = createFreeGame({ size: 2, seed: 7 });
  const first = playMove(game, game.scramble[0], 1000);
  assert.equal(first.state.status, STATUS.RUNNING);
  assert.equal(first.state.moveCount, 1);
  assert.equal(elapsedOf(first.state, 3000), 2000);

  const { state, clock } = solveByInverse(game, 1000);
  assert.equal(state.status, STATUS.SOLVED);
  assert.equal(state.history.length, game.scramble.length);
  assert.equal(elapsedOf(state, clock + 99999), state.elapsedMs);
  assert.ok(state.elapsedMs > 0);
});

test("timer pauses on demand and resumes without leaking time", () => {
  let game = createFreeGame({ size: 2, seed: 11 });
  game = playMove(game, game.scramble[0], 1000).state;
  assert.equal(elapsedOf(game, 3000), 2000);

  game = pauseTimer(game, 3000);
  assert.equal(game.paused, true);
  assert.equal(elapsedOf(game, 9000), 2000);

  game = resumeTimer(game, 9000);
  assert.equal(elapsedOf(game, 11000), 4000);
  assert.equal(elapsedOf(game, 12000), 5000);
});

test("undo rewinds the last turn and returns to ready when emptied", () => {
  let game = createFreeGame({ size: 2, seed: 21 });
  const initialKey = stateKey(game.cube);
  const empty = undo(game, 500);
  assert.equal(empty.event, "ignored");

  game = playMove(game, game.scramble[0], 1000).state;
  game = playMove(game, game.scramble[1], 2000).state;
  assert.equal(game.moveCount, 2);

  const once = undo(game, 3000);
  assert.equal(once.event, "undo");
  assert.equal(once.state.moveCount, 1);
  assert.equal(once.state.status, STATUS.RUNNING);

  const twice = undo(once.state, 4000);
  assert.equal(twice.state.moveCount, 0);
  assert.equal(twice.state.status, STATUS.READY);
  assert.equal(elapsedOf(twice.state, 9000), 0);
  assert.equal(stateKey(twice.state.cube), initialKey);
});

test("reset returns to the same scramble with a clean timer", () => {
  let game = createFreeGame({ size: 2, seed: 31 });
  const scrambledKey = stateKey(game.cube);
  game = playMove(game, game.scramble[0], 1000).state;
  const reset = resetGame(game);
  assert.equal(stateKey(reset.cube), scrambledKey);
  assert.equal(reset.moveCount, 0);
  assert.equal(reset.status, STATUS.READY);
  assert.equal(reset.scrambleText, game.scrambleText);
});

test("a fresh scramble changes the position and clears progress", () => {
  let game = createFreeGame({ size: 3, seed: 41 });
  game = playMove(game, game.scramble[0], 1000).state;
  const before = game.scrambleText;
  const next = scrambleGame(game, { size: 3, seed: 999 });
  assert.notEqual(next.scrambleText, before);
  assert.equal(next.moveCount, 0);
  assert.equal(next.status, STATUS.READY);
});

test("academy stages load their own scramble", () => {
  const game = createAcademyGame("c07");
  const level = LEVEL_BY_ID.c07;
  assert.equal(game.mode, "academy");
  assert.equal(game.size, 3);
  assert.equal(game.levelId, "c07");
  assert.equal(game.scrambleText, level.scramble);
  assert.equal(isSolved(game.cube), false);
});

test("hint is available while unsolved and absent once solved", () => {
  const game = createFreeGame({ size: 2, seed: 55 });
  const hinted = requestHint(game);
  assert.ok(hinted.hint);
  assert.ok(hinted.hint.move.face.length === 1);

  const solved = requestHint({ ...game, cube: createSolved(3), status: STATUS.READY });
  assert.equal(solved.hint, null);
});
