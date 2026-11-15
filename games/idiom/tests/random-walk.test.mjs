// 1000+ step random walk on the real controller, plus a full replay of every
// puzzle using only legal player actions (proves no dead grid in the live engine).
import test from "node:test";
import assert from "node:assert/strict";
import { BOARDS, HINTS_PER_LEVEL } from "../js/boards.mjs";
import { allPuzzles, getPuzzle } from "../js/puzzles.mjs";
import {
  createSession, selectCell, selectEntry, fillCell, eraseCell, useHint,
  tick, drainEvents, summarize, isTerminal, cellAt, selectedCellKey, STATUS,
} from "../js/engine.mjs";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function assertInvariants(state, label) {
  const rack = new Set(state.rack);
  for (const cell of state.cells.values()) {
    if (cell.value === null) {
      assert.equal(cell.locked, false, `${label}: empty locked cell`);
      continue;
    }
    assert.equal(typeof cell.value, "string", `${label}: cell value must be a string`);
    assert.ok(rack.has(cell.value) || cell.value === cell.answer, `${label}: value outside rack`);
    if (cell.locked) assert.equal(cell.value, cell.answer, `${label}: locked cell changed`);
  }
  assert.ok(state.status === STATUS.PLAYING || state.status === STATUS.CLEARED, `${label}: bad status`);
  assert.equal(state.hintsLeft + state.hintsUsed, HINTS_PER_LEVEL, `${label}: hint budget`);
  assert.ok(state.stars >= 0 && state.stars <= 3, `${label}: star range`);
  assert.ok(Number.isFinite(state.elapsed) && state.elapsed >= 0, `${label}: elapsed`);
  assert.ok(Array.isArray(state.events), `${label}: events`);
  const summary = summarize(state);
  assert.ok(summary.solved >= 0 && summary.solved <= summary.total, `${label}: solved count`);
}

test("random walk: 1200 legal/illegal actions never throw and preserve invariants", () => {
  const cases = [
    ["zh", BOARDS[0].id, 0, 400, 12345],
    ["zh", BOARDS[5].id, 7, 400, 67890],
    ["en", BOARDS[2].id, 3, 400, 24680],
  ];
  let total = 0;
  for (const [lang, boardId, levelIndex, steps, seed] of cases) {
    const puzzle = getPuzzle(lang, boardId, levelIndex);
    const state = createSession({ puzzle });
    const rand = mulberry32(seed);
    const rack = puzzle.rack;
    let terminalSteps = 0;

    for (let step = 0; step < steps; step += 1) {
      const label = `${lang}/${boardId}/${levelIndex}@${step}`;
      const roll = rand();
      if (isTerminal(state)) {
        terminalSteps += 1;
        assert.equal(fillCell(state, rack[0]).action, null, `${label}: terminal fill must be no-op`);
        assert.equal(eraseCell(state).action, null, `${label}: terminal erase must be no-op`);
        assert.equal(useHint(state).action, null, `${label}: terminal hint must be no-op`);
        assert.equal(selectCell(state, 0, 0).action, null, `${label}: terminal select must be no-op`);
        assertInvariants(state, label);
        drainEvents(state);
        continue;
      }
      if (roll < 0.3) {
        const cell = puzzle.cells[Math.floor(rand() * puzzle.cells.length)];
        selectCell(state, cell.r, cell.c);
      } else if (roll < 0.42) {
        selectEntry(state, Math.floor(rand() * state.entries.length));
      } else if (roll < 0.78) {
        fillCell(state, rack[Math.floor(rand() * rack.length)]);
      } else if (roll < 0.9) {
        eraseCell(state);
      } else if (roll < 0.96) {
        useHint(state);
      } else {
        tick(state, 16 + Math.floor(rand() * 100));
      }
      if (step % 25 === 0) assertInvariants(state, label);
      drainEvents(state);
      total += 1;
    }
    assertInvariants(state, `${lang}/${boardId}/${levelIndex}/final`);
    assert.ok(terminalSteps >= 0);
  }
  assert.ok(total >= 1000, `expected >= 1000 active steps, got ${total}`);
});

test("full replay: every one of the 160 puzzles clears with zero hints and three stars", () => {
  for (const lang of ["zh", "en"]) {
    for (const { boardId, levelIndex, puzzle } of allPuzzles(lang)) {
      const state = createSession({ puzzle });
      for (const cell of puzzle.cells) {
        if (cell.locked || isTerminal(state)) continue;
        const picked = selectCell(state, cell.r, cell.c);
        assert.equal(picked.action, "select", `${lang}/${boardId}/${levelIndex}: cannot select ${cell.r},${cell.c}`);
        assert.equal(selectedCellKey(state), `${cell.r},${cell.c}`);
        const filled = fillCell(state, cell.answer);
        assert.ok(filled.action === "fill" || filled.action === "cleared",
          `${lang}/${boardId}/${levelIndex}: cannot fill ${cell.r},${cell.c} (got ${filled.action})`);
      }
      assert.ok(isTerminal(state), `${lang}/${boardId}/${levelIndex}: replay did not clear`);
      const summary = summarize(state);
      assert.equal(summary.stars, 3);
      assert.equal(summary.hintsUsed, 0);
      assert.equal(summary.solved, summary.total);
      for (const cell of state.cells.values()) {
        assert.equal(cell.value, cell.answer);
      }
      assert.equal(fillCell(state, puzzle.rack[0]).action, null);
    }
  }
});

test("wrong characters are recoverable: fill wrong, erase, then fill correct", () => {
  const puzzle = getPuzzle("zh", BOARDS[0].id, 0);
  const state = createSession({ puzzle });
  const target = puzzle.cells.find((cell) => !cell.locked);
  const wrong = puzzle.rack.find((char) => char !== target.answer);
  assert.ok(wrong, "rack must contain a decoy");
  selectCell(state, target.r, target.c);
  assert.equal(fillCell(state, wrong).action, "wrong");
  assert.equal(cellAt(state, target.r, target.c).value, wrong);
  assert.equal(eraseCell(state).action, "erase");
  assert.equal(cellAt(state, target.r, target.c).value, null);
  assert.equal(fillCell(state, target.answer).action, "fill");
  assert.equal(cellAt(state, target.r, target.c).value, target.answer);
});
