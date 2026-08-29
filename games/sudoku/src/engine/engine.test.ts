import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePuzzle } from "./generate.ts";
import { nextHint } from "./hint.ts";
import { ratePuzzle } from "./techniques.ts";
import { countSolutions, hasUniqueSolution, solve } from "./solver.ts";
import { conflictCells, hasConflictAt } from "./grid.ts";

describe("generatePuzzle", () => {
  it("is deterministic for a seed", () => {
    const a = generatePuzzle("easy", "daily-2026-08-28");
    const b = generatePuzzle("easy", "daily-2026-08-28");
    assert.deepEqual(a.givens, b.givens);
    assert.deepEqual(a.solution, b.solution);
    assert.equal(a.seed, "daily-2026-08-28");
  });

  it("emits a unique solution", () => {
    const p = generatePuzzle("intro", "uniq-intro");
    assert.equal(hasUniqueSolution(p.givens), true);
    assert.equal(countSolutions(p.givens, 2), 1);
    assert.deepEqual(solve(p.givens), p.solution);
    assert.equal(p.givens.filter((n) => n === 0).length > 0, true);
  });

  it("daily seed is unique and medium-or-easier", () => {
    const p = generatePuzzle("medium", "daily-2026-08-28");
    assert.equal(hasUniqueSolution(p.givens), true);
    const rating = ratePuzzle(p.givens);
    assert.notEqual(rating, "invalid");
  });
});

describe("ratePuzzle / nextHint", () => {
  it("a single hole is a naked single intro", () => {
    const p = generatePuzzle("intro", "hint-hole");
    const board = p.solution.slice();
    board[40] = 0;
    assert.equal(ratePuzzle(board), "intro");
    const hint = nextHint(board, p.solution);
    assert.ok(hint);
    assert.equal(hint!.level, 1);
    assert.equal(hint!.step.technique, "naked-single");
    assert.equal(hint!.step.digit, p.solution[40]);
    assert.equal(hint!.step.placements[0]?.cell, 40);
    assert.ok(hint!.step.units.length >= 1);
  });

  it("points at a duplicate before filling", () => {
    const p = generatePuzzle("intro", "conflict");
    const board = p.solution.slice();
    board[1] = board[0]!;
    const hint = nextHint(board, p.solution);
    assert.ok(hint);
    assert.equal(hint!.step.technique, "conflict");
  });
});

describe("conflicts", () => {
  it("marks both cells in a row duplicate", () => {
    const board = Array.from({ length: 81 }, () => 0);
    board[0] = 5;
    board[1] = 5;
    assert.equal(hasConflictAt(board, 0), true);
    assert.equal(hasConflictAt(board, 1), true);
    const flags = conflictCells(board);
    assert.equal(flags[0], true);
    assert.equal(flags[1], true);
    assert.equal(flags[10], false);
  });
});
