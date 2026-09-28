import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LEVELS, CHAPTERS } from "../js/levels.mjs";
import { solveGrid } from "../js/engine.mjs";

describe("Picross Levels Validation Suite", () => {
  it("contains 40 total levels across 5 chapters", () => {
    assert.equal(LEVELS.length, 40);
    assert.equal(CHAPTERS.length, 5);

    const chapterIds = new Set(CHAPTERS.map((ch) => ch.key));
    LEVELS.forEach((lvl) => {
      assert.ok(chapterIds.has(lvl.chapterKey), `Invalid chapterKey: ${lvl.chapterKey}`);
    });
  });

  it("every level has valid metadata and non-empty target", () => {
    LEVELS.forEach((lvl) => {
      assert.ok(lvl.id, "Level must have id");
      assert.ok(lvl.titleKey, "Level must have titleKey");
      assert.ok(lvl.rows >= 5 && lvl.rows <= 15, "Rows between 5 and 15");
      assert.ok(lvl.cols >= 5 && lvl.cols <= 15, "Cols between 5 and 15");
      assert.equal(lvl.target.length, lvl.rows);
      assert.equal(lvl.target[0].length, lvl.cols);
      assert.ok(lvl.stampColor, "Level must have stampColor");
    });
  });

  it("every single level has EXACTLY 1 unique solution matching its target", () => {
    LEVELS.forEach((lvl) => {
      const res = solveGrid(lvl.rowClues, lvl.colClues, lvl.rows, lvl.cols, 2);
      assert.equal(
        res.count,
        1,
        `Level ${lvl.id} (${lvl.titleKey}) failed uniqueness check: count=${res.count}`
      );
      assert.deepEqual(
        res.solution,
        lvl.target,
        `Level ${lvl.id} solution did not match target pixel art`
      );
    });
  });
});
