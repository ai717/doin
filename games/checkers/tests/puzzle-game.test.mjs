// puzzle-game.test.mjs - PUZZLE mode controller flow: solo turns, par,
// success/failure, undo-driven star rating, restart and mode isolation.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RED, HOLE_COUNT, createState, legalMovesFrom,
} from "../js/engine.mjs";
import { createGameController, MODES, OUTCOME } from "../js/game.mjs";
import { DIFFICULTY_MASTER } from "../js/ai.mjs";
import { PUZZLES, puzzleBoard } from "../js/puzzles.mjs";

const ONE = PUZZLES.find((level) => level.par === 1);
const TWO = PUZZLES.find((level) => level.par === 2);

function open(level, options = {}) {
  const changes = [];
  const controller = createGameController({
    ...options,
    onChange: (v) => changes.push(v),
  });
  controller.start({
    mode: MODES.PUZZLE,
    engineState: createState(puzzleBoard(level), RED),
    puzzle: { id: level.id, chapter: level.chapter, par: level.par, goal: level.goal },
  });
  return { controller, changes };
}

function solutionMove(controller, level, index) {
  const answer = level.solution[index];
  return controller.currentMoves().find((m) => m.from === answer.from && m.to === answer.to);
}

function otherMove(controller, level) {
  const answer = level.solution[0];
  const move = controller.currentMoves().find((m) => !(m.from === answer.from && m.to === answer.to));
  assert.ok(move, "the study should offer a wrong move");
  return move;
}

describe("puzzle controller: opening state", () => {
  it("starts solo, with no AI turn and no pending timer", () => {
    const { controller } = open(ONE);
    const view = controller.view();
    assert.equal(view.config.mode, MODES.PUZZLE);
    assert.equal(view.state.turn, RED);
    assert.equal(view.humanTurn, true);
    assert.equal(view.thinking, false);
    assert.equal(view.canUndo, false);
    assert.equal(view.finished, null);
    assert.equal(view.puzzle.id, ONE.id);
    assert.equal(view.puzzle.par, 1);
    assert.equal(view.puzzle.left, 1);
    assert.equal(view.puzzle.goal, ONE.goal);
    assert.ok(view.currentMoves === undefined);
    assert.ok(controller.currentMoves().length > 1);
  });

  it("exposes only red marbles through targetsFrom", () => {
    const { controller } = open(TWO);
    const board = controller.view().state.board;
    const red = board.findIndex((v) => v === RED);
    const blue = board.findIndex((v) => v === 2);
    assert.ok(controller.targetsFrom(red).length > 0);
    assert.deepEqual(controller.targetsFrom(blue), []);
    assert.deepEqual(controller.targetsFrom(-1), []);
    assert.deepEqual(controller.targetsFrom(HOLE_COUNT), []);
    for (const move of controller.currentMoves()) {
      assert.equal(board[move.from], RED);
      assert.equal(legalMovesFrom(controller.view().state, move.from).some((m) => m.to === move.to), true);
    }
  });

  it("a malformed study config degrades to a normal duel instead of crashing", () => {
    const { controller } = open(ONE);
    const view = controller.start({ mode: MODES.PUZZLE, puzzle: { id: 1, par: 9, goal: 2 } });
    assert.equal(view.config.mode, MODES.PVE);
    assert.equal(view.config.puzzle, null);
    assert.equal(view.puzzle, null);
    assert.equal(view.state.board.filter((v) => v === RED).length, 10);
    controller.destroy();
  });
});

describe("puzzle controller: clearing and failing", () => {
  it("the unique answer clears the study with three stars and locks input", () => {
    const { controller } = open(TWO);
    assert.equal(controller.play(solutionMove(controller, TWO, 0)), true);
    assert.equal(controller.view().state.turn, RED, "blue must never get a turn");
    assert.equal(controller.view().puzzle.left, 1);
    assert.equal(controller.view().finished, null);

    assert.equal(controller.play(solutionMove(controller, TWO, 1)), true);
    const view = controller.view();
    assert.equal(view.state.board[TWO.goal], RED);
    assert.equal(view.humanTurn, false);
    assert.equal(view.puzzle.solved, true);
    assert.equal(view.puzzle.stars, 3);
    assert.equal(view.finished.mode, MODES.PUZZLE);
    assert.equal(view.finished.humanOutcome, OUTCOME.WIN);
    assert.equal(view.finished.puzzle.id, TWO.id);
    assert.equal(controller.play(solutionMove(controller, TWO, 0)), false, "a solved board is locked");
  });

  it("a wrong move exhausts par and reports failure", () => {
    const { controller } = open(ONE);
    assert.equal(controller.play(otherMove(controller, ONE)), true);
    const view = controller.view();
    assert.equal(view.state.board[ONE.goal], 0);
    assert.equal(view.puzzle.failed, true);
    assert.equal(view.puzzle.solved, false);
    assert.equal(view.puzzle.stars, 0);
    assert.equal(view.humanTurn, false);
    assert.equal(view.finished.humanOutcome, OUTCOME.LOSS);
    assert.equal(controller.result().puzzle.used, 1);
  });

  it("undo reopens a failed study and permanently lowers the star rating", () => {
    const { controller } = open(ONE);
    controller.play(otherMove(controller, ONE));
    assert.equal(controller.undo(), true);
    assert.equal(controller.view().finished, null);
    assert.equal(controller.view().humanTurn, true);
    assert.equal(controller.view().puzzle.undoCount, 1);

    controller.play(solutionMove(controller, ONE, 0));
    assert.equal(controller.view().puzzle.stars, 2);

    controller.undo();
    controller.play(otherMove(controller, ONE));
    controller.undo();
    controller.play(solutionMove(controller, ONE, 0));
    assert.equal(controller.view().puzzle.stars, 1, "stars are floored at 1, never 0 on a win");
  });

  it("undo is available even after a finished study, but not before any move", () => {
    const { controller } = open(ONE);
    assert.equal(controller.undo(), false);
    controller.play(solutionMove(controller, ONE, 0));
    assert.equal(controller.view().canUndo, true);
    assert.equal(controller.undo(), true);
    assert.equal(controller.view().state.history.length, 0);
  });
});

describe("puzzle controller: isolation from the duel", () => {
  it("forged moves are rejected by engine re-derivation", () => {
    const { controller } = open(ONE);
    const from = controller.view().state.board.findIndex((v) => v === RED);
    assert.equal(controller.play(null), false);
    assert.equal(controller.play({ from: -1, to: 5 }), false);
    assert.equal(controller.play({ from, to: from }), false);
    assert.equal(controller.play({ from, to: -1, hops: 99, path: [from, -1] }), false);
    assert.equal(controller.view().state.history.length, 0);
  });

  it("difficulty is refused in a study but still hot-swappable in a duel", () => {
    const { controller } = open(ONE);
    assert.equal(controller.setDifficulty(DIFFICULTY_MASTER), false);
    assert.equal(controller.view().config.difficulty, "intermediate");
    controller.start({ mode: MODES.PVE });
    assert.equal(controller.setDifficulty(DIFFICULTY_MASTER), true);
    assert.equal(controller.view().config.difficulty, DIFFICULTY_MASTER);
    controller.destroy();
  });

  it("restart replays the same study from its original board", () => {
    const { controller } = open(TWO);
    const initial = controller.view().state.board.join("");
    controller.play(solutionMove(controller, TWO, 0));
    const view = controller.restart();
    assert.equal(view.config.mode, MODES.PUZZLE);
    assert.equal(view.config.puzzle.id, TWO.id);
    assert.equal(view.state.board.join(""), initial);
    assert.equal(view.puzzle.left, TWO.par);
    assert.equal(view.puzzle.undoCount, 0);
    assert.equal(view.finished, null);
    assert.equal(view.canUndo, false);
  });

  it("every commit emits a view with a monotonically decreasing move budget", () => {
    const { controller, changes } = open(TWO);
    const before = changes.length;
    controller.play(solutionMove(controller, TWO, 0));
    controller.play(solutionMove(controller, TWO, 1));
    const emitted = changes.slice(before).map((v) => v.puzzle.left);
    assert.deepEqual(emitted, [1, 0]);
    assert.equal(controller.getMoveLog().length, 2);
    assert.ok(controller.getMoveLog()[0].hops >= 0);
  });
});
