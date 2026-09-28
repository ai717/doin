import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveLineClues,
  deriveGridClues,
  getAllPlacements,
  getValidPlacements,
  solveLine,
  solveGrid,
  isLineSatisfied,
  createGame,
  applyAction,
  checkVictory,
  calculateStars,
  mulberry32,
  CELL_EMPTY,
  CELL_PAINT,
  CELL_CROSS,
} from "../js/engine.mjs";

describe("Picross Engine Unit Tests", () => {
  it("deriveLineClues: correctly generates run lengths", () => {
    assert.deepEqual(deriveLineClues([0, 1, 1, 0, 1]), [2, 1]);
    assert.deepEqual(deriveLineClues([1, 1, 1, 1, 1]), [5]);
    assert.deepEqual(deriveLineClues([0, 0, 0]), []);
    assert.deepEqual(deriveLineClues([1, 0, 1, 0, 1]), [1, 1, 1]);
  });

  it("deriveGridClues: generates row and col clues", () => {
    const grid = [
      [1, 0, 1],
      [1, 1, 0],
      [0, 1, 1],
    ];
    const { rowClues, colClues } = deriveGridClues(grid);
    assert.deepEqual(rowClues, [[1, 1], [2], [2]]);
    assert.deepEqual(colClues, [[2], [2], [1, 1]]);
  });

  it("getAllPlacements: generates and memoizes line arrangements", () => {
    const p1 = getAllPlacements(5, [2, 1]);
    assert.equal(p1.length, 3);
    assert.deepEqual(p1[0], [1, 1, 0, 1, 0]);
    assert.deepEqual(p1[1], [1, 1, 0, 0, 1]);
    assert.deepEqual(p1[2], [0, 1, 1, 0, 1]);

    // Check empty line placement
    const pEmpty = getAllPlacements(4, []);
    assert.equal(pEmpty.length, 1);
    assert.deepEqual(pEmpty[0], [0, 0, 0, 0]);
  });

  it("solveLine: correctly deduces forced paint and cross cells", () => {
    // 5 cells, clue [4]: middle 3 cells (1, 2, 3) must be paint
    const res1 = solveLine(5, [4], [0, 0, 0, 0, 0]);
    assert.equal(res1.possible, true);
    assert.deepEqual(res1.mustPaint, [1, 2, 3]);

    // 5 cells, clue [1]: cell 0 is 1, so rest must be cross
    const res2 = solveLine(5, [1], [1, 0, 0, 0, 0]);
    assert.equal(res2.possible, true);
    assert.deepEqual(res2.mustCross, [1, 2, 3, 4]);

    // Contradiction: line has two 1s but clue is only [1]
    const res3 = solveLine(5, [1], [1, 0, 1, 0, 0]);
    assert.equal(res3.possible, false);
  });

  it("isLineSatisfied: accurately verifies line completion", () => {
    assert.equal(isLineSatisfied([CELL_PAINT, CELL_PAINT, CELL_EMPTY, CELL_PAINT], [2, 1]), true);
    assert.equal(isLineSatisfied([CELL_PAINT, CELL_CROSS, CELL_PAINT, CELL_PAINT], [1, 2]), true);
    assert.equal(isLineSatisfied([CELL_CROSS, CELL_CROSS], []), true);
    assert.equal(isLineSatisfied([CELL_PAINT, CELL_PAINT], [1]), false);
  });

  it("solveGrid: solves heart 5x5 uniquely", () => {
    const heart = [
      [0, 1, 0, 1, 0],
      [1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 1, 0],
      [0, 0, 1, 0, 0],
    ];
    const { rowClues, colClues } = deriveGridClues(heart);
    const res = solveGrid(rowClues, colClues, 5, 5);
    assert.equal(res.count, 1);
    assert.equal(res.unique, true);
    assert.deepEqual(res.solution, heart);
  });

  it("calculateStars: correct star tiering", () => {
    assert.equal(calculateStars(0), 3);
    assert.equal(calculateStars(1), 2);
    assert.equal(calculateStars(3), 2);
    assert.equal(calculateStars(4), 1);
    assert.equal(calculateStars(10), 1);
  });

  it("Random walk test: >= 1000 steps without invariant breakage", () => {
    const rng = mulberry32(12345);
    const dummyLevel = {
      id: "test_walk",
      chapterKey: "chapter_prologue",
      titleKey: "level_heart",
      rows: 5,
      cols: 5,
      target: [
        [0, 1, 0, 1, 0],
        [1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1],
        [0, 1, 1, 1, 0],
        [0, 0, 1, 0, 0],
      ],
      rowClues: [[1, 1], [5], [5], [3], [1]],
      colClues: [[2], [4], [4], [4], [2]],
    };

    let state = createGame(dummyLevel);

    for (let step = 0; step < 1200; step++) {
      const op = Math.floor(rng() * 4);
      const r = Math.floor(rng() * 5);
      const c = Math.floor(rng() * 5);
      const val = Math.floor(rng() * 3);

      if (op === 0) {
        state = applyAction(state, { type: "SET_CELL", row: r, col: c, val });
      } else if (op === 1) {
        state = applyAction(state, { type: "UNDO" });
      } else if (op === 2) {
        state = applyAction(state, { type: "HINT" });
      } else {
        state = applyAction(state, {
          type: "BATCH_SET",
          changes: [
            { row: r, col: c, val },
            { row: (r + 1) % 5, col: (c + 1) % 5, val: (val + 1) % 3 },
          ],
        });
      }

      // Assert invariant holds
      assert.ok(Array.isArray(state.grid), "grid must be array");
      assert.equal(state.grid.length, 5);
      assert.ok(state.mistakes >= 0, "mistakes non-negative");
      assert.ok(Array.isArray(state.history), "history is array");

      if (checkVictory(state)) {
        assert.equal(state.status, "won");
        // Reset and keep walking
        state = applyAction(state, { type: "RESTART" });
        assert.equal(state.status, "playing");
      }
    }
  });
});
