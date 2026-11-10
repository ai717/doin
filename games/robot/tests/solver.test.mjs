import test from "node:test";
import assert from "node:assert/strict";

import {
  compileLevel, runProgram, normalizeProgram, countInstructions, DIR,
} from "../js/engine.mjs";
import {
  solveLevel, verifyLevel, DEFAULT_SEARCH,
} from "../js/solver.mjs";
import { LEVELS, getLevel, buildLevel } from "../js/levels.mjs";

const EXEC = { maxSteps: 160, maxFrames: 40, loopGuard: true };

// Independent brute-force reference: enumerate every compact program without
// any pruning, then compare the shallowest winning layer with the solver.
function bruteShortest(level, palette, maxLines) {
  const slots = level.slots;
  const cartesian = (length, cb) => {
    const out = Array(length).fill(palette[0]);
    const walk = (i) => {
      if (i === length) { cb([...out]); return; }
      for (const code of palette) { out[i] = code; walk(i + 1); }
    };
    if (length === 0) cb([]);
    else walk(0);
  };
  for (let lines = 1; lines <= maxLines; lines += 1) {
    for (let m = 1; m <= Math.min(lines, slots.main); m += 1) {
      const p = lines - m;
      if (p > slots.proc1) continue;
      cartesian(m, (main) => {
        cartesian(p, (proc1) => {
          if (runProgram(level, { main, proc1 }, EXEC).won) {
            throw { found: lines };
          }
        });
      });
    }
  }
  return null;
}

function brute(level, palette, maxLines) {
  try { bruteShortest(level, palette, maxLines); return null; }
  catch (e) { return e.found ?? null; }
}

test("solver agrees with unpruned brute force on small levels", () => {
  const samples = LEVELS.filter((l) => l.par <= 6 && l.palette.length <= 3);
  assert.ok(samples.length >= 6);
  for (const entry of samples) {
    const level = buildLevel(entry);
    const cap = entry.par;
    const solved = solveLevel(level, {
      alphabet: entry.palette, maxLines: cap, maxNodes: 300000, exec: EXEC,
    });
    const reference = brute(level, entry.palette, cap);
    assert.equal(solved.shortest, reference, `level ${entry.id}`);
    assert.equal(solved.shortest, entry.par, `par mismatch on level ${entry.id}`);
  }
});

test("solver refuses to claim a result when the node budget is exhausted", () => {
  const level = buildLevel(getLevel(21));
  const starved = solveLevel(level, {
    alphabet: getLevel(21).palette, maxLines: 10, maxNodes: 5, exec: EXEC,
  });
  assert.equal(starved.aborted, true);
  assert.equal(starved.shortest, null);
  const verdict = verifyLevel(level, getLevel(21).gold, getLevel(21).palette, {
    maxNodes: 5, exec: EXEC,
  });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.reason, "budget-exhausted");
});

test("solver reports exact failure reasons for bad gold lines", () => {
  const level = buildLevel(getLevel(1));
  const palette = getLevel(1).palette;
  const broken = verifyLevel(level, { main: ["F", "F"] }, palette, { exec: EXEC });
  assert.equal(broken.ok, false);
  assert.equal(broken.reason, "gold-does-not-win");

  const padded = { main: ["F", "F", "A", "R"] };
  const wasteful = verifyLevel(level, padded, palette, { exec: EXEC });
  assert.equal(wasteful.ok, false);
  assert.equal(wasteful.reason, "shorter-solution-exists");
  assert.equal(wasteful.shorter, 3);
  assert.equal(countInstructions(normalizeProgram(padded, level.slots)), 4);
});

test("empty palettes, lamp-less worlds and shallow caps return no solution", () => {
  const level = buildLevel(getLevel(1));
  assert.equal(solveLevel(level, { alphabet: [], maxLines: 5 }).shortest, null);
  const noLamps = compileLevel({
    grid: ["....", "....", "...."], start: [0, 0, DIR.EAST], slots: { main: 6, proc1: 0 },
  });
  assert.equal(solveLevel(noLamps, { alphabet: ["F", "A"], maxLines: 5 }).shortest, null);
  const shallow = solveLevel(level, { alphabet: ["F", "A"], maxLines: 2, exec: EXEC });
  assert.equal(shallow.shortest, null);
  assert.equal(shallow.layers, 2);
  assert.equal(DEFAULT_SEARCH.exec.maxSteps, 160);
});

test("solver is deterministic and its solutions actually win", () => {
  const entry = getLevel(15);
  const level = buildLevel(entry);
  const options = { alphabet: entry.palette, maxLines: entry.par, maxNodes: 300000, exec: EXEC };
  const a = solveLevel(level, options);
  const b = solveLevel(level, options);
  assert.deepEqual(a, b);
  assert.equal(a.shortest, entry.par);
  assert.ok(a.solutions.length > 0);
  for (const solution of a.solutions) {
    assert.equal(runProgram(level, solution, EXEC).won, true);
  }
});
