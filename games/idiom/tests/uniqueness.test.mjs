// Provable solvability + uniqueness for all 160 shipped puzzles.
import test from "node:test";
import assert from "node:assert/strict";
import { BOARDS, MAX_GRID_ZH, MAX_GRID_EN, entriesFor } from "../js/boards.mjs";
import { allPuzzles, buildLevel, getPuzzle, resetPuzzleCacheForTests } from "../js/puzzles.mjs";
import {
  allEntries, clueDomains, countCluedSolutions, countSolutions,
  lexiconFor, puzzleToLevel, verifyPuzzle, wordOf,
} from "./solver.mjs";

const LANGS = ["zh", "en"];

function allBoards() {
  const out = [];
  for (const lang of LANGS) {
    for (const { boardId, levelIndex, puzzle } of allPuzzles(lang)) {
      out.push({ lang, boardId, levelIndex, puzzle });
    }
  }
  return out;
}

test("lexicon: 8 boards x 16 entries, well formed and duplicate free", () => {
  for (const lang of LANGS) {
    const entries = allEntries(lang);
    const lexicon = lexiconFor(lang);
    assert.equal(entries.length, 128, `${lang} entry count`);
    assert.equal(new Set(entries.map((entry) => entry.boardId)).size, BOARDS.length);
    assert.equal(lexicon.length, 128, `${lang} lexicon must be duplicate free`);
    for (const entry of entries) {
      const word = wordOf(entry, lang);
      assert.ok(word, `${lang} ${entry.id} missing word`);
      if (lang === "zh") assert.match(word, /^[\u4e00-\u9fa5]{4}$/u, `four Han characters: ${word}`);
      else assert.match(word, /^[A-Z]+$/, `uppercase Latin word: ${word}`);
    }
  }
});

test("all 160 puzzles: solvable invariants (no dead grid, crossings agree, rack complete)", () => {
  let checked = 0;
  for (const { lang, boardId, levelIndex, puzzle } of allBoards()) {
    const result = verifyPuzzle(puzzle, lang);
    assert.ok(result.ok, `${lang}/${boardId}/${levelIndex}: ${result.issues.slice(0, 3).join(" | ")}`);
    assert.equal(puzzle.entries.length, entriesFor(lang, levelIndex));
    const max = lang === "en" ? MAX_GRID_EN : MAX_GRID_ZH;
    assert.ok(puzzle.rows <= max && puzzle.cols <= max);
    assert.ok(puzzle.cells.length > 0 && puzzle.rack.length > 0);
    checked += 1;
  }
  assert.equal(checked, 160);
});

test("all 160 puzzles: full Cartesian enumeration under printed clues gives exactly one solution", () => {
  let checked = 0;
  for (const { lang, boardId, levelIndex, puzzle } of allBoards()) {
    const count = countCluedSolutions(puzzle, lang, 3);
    assert.equal(count, 1, `${lang}/${boardId}/${levelIndex} has ${count} solutions`);
    checked += 1;
  }
  assert.equal(checked, 160);
});

test("every printed clue maps to exactly one word in the full lexicon", () => {
  for (const { lang, boardId, levelIndex, puzzle } of allBoards()) {
    clueDomains(puzzle, lang).forEach((domain, i) => {
      assert.deepEqual(domain, [puzzle.entries[i].answer], `${lang}/${boardId}/${levelIndex} entry ${i}`);
    });
  }
});

test("strict no-clue enumeration is recorded as a diagnostic (crossword is clue-driven)", (t) => {
  for (const lang of LANGS) {
    const lexicon = lexiconFor(lang);
    let strictUnique = 0;
    for (const { puzzle } of allPuzzles(lang)) {
      if (countSolutions(puzzle, lexicon, 2) === 1) strictUnique += 1;
    }
    t.diagnostic(`${lang}: ${strictUnique}/80 puzzles unique even when all clues are ignored`);
    assert.ok(strictUnique >= 0 && strictUnique <= 80);
  }
});

test("level generation is deterministic for the same (lang, board, level)", () => {
  for (const lang of LANGS) {
    for (const boardId of [BOARDS[0].id, BOARDS[3].id, BOARDS[7].id]) {
      for (const levelIndex of [0, 4, 9]) {
        const a = buildLevel(lang, boardId, levelIndex);
        const b = buildLevel(lang, boardId, levelIndex);
        assert.deepEqual(puzzleToLevel(a), puzzleToLevel(b), `${lang}/${boardId}/${levelIndex}`);
      }
    }
  }
  resetPuzzleCacheForTests();
  const first = getPuzzle("zh", BOARDS[0].id, 0);
  resetPuzzleCacheForTests();
  const second = getPuzzle("zh", BOARDS[0].id, 0);
  assert.deepEqual(puzzleToLevel(first), puzzleToLevel(second));
});
