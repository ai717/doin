// puzzles.test.mjs - bank integrity, BFS uniqueness, answer replay and
// star persistence for the 20 chain-hop studies.
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  PUZZLES, PUZZLE_COUNT, CHAPTERS, getPuzzle, puzzleBoard,
} from "../js/puzzles.mjs";
import { verifyPuzzle, solveBoard } from "../js/solver.mjs";
import {
  RED, BLUE, EMPTY, HOLE_COUNT, createState, applySoloMove,
} from "../js/engine.mjs";
import {
  emptyMeta, loadMeta, loadPuzzleProgress, normalizeMeta, recordPuzzle,
  resetBackendForTests, saveMeta,
} from "../js/storage.mjs";

const chapterOf = (id) => CHAPTERS.find((c) => id >= c.from && id <= c.to);

describe("puzzles: bank integrity", () => {
  it("contains 20 stages across four continuous chapters", () => {
    assert.equal(PUZZLE_COUNT, 20);
    assert.equal(PUZZLES.length, 20);
    assert.deepEqual(PUZZLES.map((l) => l.id), Array.from({ length: 20 }, (_, i) => i + 1));
    for (const level of PUZZLES) {
      const chapter = chapterOf(level.id);
      assert.ok(chapter, `stage ${level.id} is outside every chapter`);
      assert.equal(level.chapter, chapter.id);
    }
    assert.deepEqual(CHAPTERS.map((c) => c.to - c.from + 1), [5, 5, 5, 5]);
  });

  it("every board is well formed and the goal starts empty", () => {
    for (const level of PUZZLES) {
      const seen = new Set();
      let reds = 0;
      for (const [hole, player] of level.board) {
        assert.ok(Number.isInteger(hole) && hole >= 0 && hole < HOLE_COUNT);
        assert.ok(player === RED || player === BLUE);
        assert.ok(!seen.has(hole), `stage ${level.id} has a duplicate hole ${hole}`);
        seen.add(hole);
        if (player === RED) reds += 1;
      }
      const board = puzzleBoard(level);
      assert.equal(board.length, HOLE_COUNT);
      assert.equal(board[level.goal], EMPTY, `stage ${level.id} starts solved`);
      assert.ok(reds >= 1 && reds <= 3, `stage ${level.id} has ${reds} red marbles`);
      assert.ok(level.par >= 1 && level.par <= 3);
      assert.equal(level.solution.length, level.par);
      assert.ok(level.hops >= 2, `stage ${level.id} is not a chain hop`);
    }
  });

  it("getPuzzle resolves ids and rejects unknown ones", () => {
    assert.equal(getPuzzle(7).chapter, 2);
    assert.equal(getPuzzle(20).chapter, 4);
    assert.equal(getPuzzle(0), null);
    assert.equal(getPuzzle(21), null);
    assert.equal(getPuzzle("3"), null);
  });
});

describe("puzzles: exhaustive uniqueness", () => {
  it("every stage has exactly one optimal line (BFS over all legal moves)", () => {
    for (const level of PUZZLES) {
      const report = verifyPuzzle(level);
      assert.equal(report.count, 1, `stage ${level.id} has ${report.count} optimal lines`);
      assert.equal(report.shortest, level.par, `stage ${level.id} is not par=${level.par}`);
      assert.equal(report.aborted, false, `stage ${level.id} hit the node cap`);
      assert.equal(report.ok, true, `stage ${level.id} failed verification`);
    }
  });

  it("no shorter line exists and the recorded answer is the unique line", () => {
    for (const level of PUZZLES) {
      const board = puzzleBoard(level);
      for (let depth = 1; depth < level.par; depth += 1) {
        const earlier = solveBoard(board, level.goal, depth);
        assert.equal(earlier.count, 0, `stage ${level.id} is solvable in ${depth} move(s)`);
      }
      const report = verifyPuzzle(level);
      assert.deepEqual(
        report.solutions[0].map((m) => [m.from, m.to]),
        level.solution.map((m) => [m.from, m.to]),
        `stage ${level.id} answer mismatch`,
      );
    }
  });

  it("replaying the answer through the engine lands on the goal", () => {
    for (const level of PUZZLES) {
      let state = createState(puzzleBoard(level), RED);
      for (const move of level.solution) {
        const next = applySoloMove(state, move, RED);
        assert.notEqual(next, state, `stage ${level.id} answer has an illegal move`);
        assert.equal(next.turn, RED, "solo mode must never hand the turn to blue");
        state = next;
      }
      assert.equal(state.board[level.goal], RED, `stage ${level.id} answer does not solve`);
      assert.equal(state.history.length, level.par);
    }
  });

  it("difficulty rises: later chapters never use shorter chains", () => {
    const avg = (ch) => {
      const levels = PUZZLES.filter((l) => l.chapter === ch);
      return levels.reduce((n, l) => n + l.hops, 0) / levels.length;
    };
    assert.ok(avg(2) > avg(1), "chapter 2 must be harder than chapter 1");
    assert.ok(avg(3) > avg(2), "chapter 3 must be harder than chapter 2");
    assert.ok(PUZZLES.filter((l) => l.par === 2).length >= 5, "bridge-building studies are missing");
    assert.ok(PUZZLES.some((l) => l.hops >= 7), "no long-chain showpiece stage");
  });
});

describe("puzzles: star progress", () => {
  beforeEach(() => resetBackendForTests());

  it("starts empty and is separate from the duel record book", () => {
    assert.deepEqual(loadPuzzleProgress().cleared, {});
    assert.equal(loadPuzzleProgress().clearedCount, 0);
    assert.equal(loadPuzzleProgress().maxStars, 60);
    assert.deepEqual(loadMeta().best, emptyMeta().best);
  });

  it("records only genuine improvements and ignores invalid input", () => {
    assert.equal(recordPuzzle(3, 2).improved, true);
    assert.equal(recordPuzzle(3, 1).improved, false);
    assert.equal(recordPuzzle(3, 3).improved, true);
    assert.equal(recordPuzzle(0, 3).improved, false);
    assert.equal(recordPuzzle(21, 3).improved, false);
    assert.equal(recordPuzzle(4, 9).improved, false);
    assert.equal(recordPuzzle(4, 2.5).improved, false);
    const progress = loadPuzzleProgress();
    assert.deepEqual(progress.cleared, { 3: 3 });
    assert.equal(progress.clearedCount, 1);
    assert.equal(progress.totalStars, 3);
    assert.deepEqual(loadMeta().best, emptyMeta().best);
  });

  it("normalisation drops forged cleared entries but keeps sound/best/save", () => {
    saveMeta({
      ...emptyMeta(),
      sound: false,
      save: { moves: [] },
      puzzle: { cleared: { 1: 3, 2: 9, 99: 2, "-1": 1, 3: "3", 4: 0, 5: 2.5 } },
    });
    const meta = loadMeta();
    assert.deepEqual(meta.puzzle, { cleared: { 1: 3 } });
    assert.equal(meta.sound, false);
    assert.deepEqual(meta.save, { moves: [] });
    assert.deepEqual(normalizeMeta({ puzzle: "bad" }).puzzle, { cleared: {} });
  });
});
