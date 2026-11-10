import test from "node:test";
import assert from "node:assert/strict";

import {
  CHAPTERS, LEVELS, LEVEL_COUNT, getLevel, buildLevel, starsFor,
} from "../js/levels.mjs";
import {
  compileLevel, runProgram, normalizeProgram, countInstructions,
  parseInstruction, checkInvariants, STATUS,
} from "../js/engine.mjs";
import { verifyLevel } from "../js/solver.mjs";

const EXEC = { maxSteps: 160, maxFrames: 40, loopGuard: true };

test("the campaign has 21 levels in five chapters of 4/5/4/5/3", () => {
  assert.equal(LEVEL_COUNT, 21);
  assert.equal(LEVELS.length, 21);
  assert.deepEqual(CHAPTERS.map((c) => c.count), [4, 5, 4, 5, 3]);
  assert.deepEqual(LEVELS.map((l) => l.id), Array.from({ length: 21 }, (_, i) => i + 1));
  for (const chapter of CHAPTERS) {
    const count = LEVELS.filter((l) => l.chapter === chapter.id).length;
    assert.equal(count, chapter.count, `chapter ${chapter.id}`);
  }
  assert.equal(getLevel(0), null);
  assert.equal(getLevel(99), null);
  assert.equal(getLevel(7).id, 7);
});

test("every level has a valid palette, slot budget and compact gold program", () => {
  for (const entry of LEVELS) {
    assert.ok(entry.palette.length >= 2, `palette empty on ${entry.id}`);
    for (const code of entry.palette) {
      assert.ok(parseInstruction(code), `bad palette code ${code} on ${entry.id}`);
    }
    const level = buildLevel(entry);
    assert.ok(level.lamps.length > 0, `no lamps on ${entry.id}`);
    assert.ok(level.slots.main > 0, `no MAIN slots on ${entry.id}`);
    assert.ok(entry.gold.main.length <= level.slots.main, `MAIN overflow on ${entry.id}`);
    assert.ok(entry.gold.proc1.length <= level.slots.proc1, `PROC1 overflow on ${entry.id}`);
    assert.equal(countInstructions(entry.gold), entry.par, `par mismatch on ${entry.id}`);
    assert.equal(entry.steps >= entry.par, true, `step count on ${entry.id}`);
    for (const code of [...entry.gold.main, ...entry.gold.proc1]) {
      if (code !== "") {
        assert.ok(entry.palette.includes(code), `gold uses locked tile ${code} on ${entry.id}`);
      }
    }
    assert.deepEqual(checkInvariants(level, runProgram(level, entry.gold, EXEC).finalState), []);
  }
});

test("21 official gold solutions replay to a clear with the recorded step count", () => {
  for (const entry of LEVELS) {
    const level = buildLevel(entry);
    const replay = runProgram(level, normalizeProgram(entry.gold, level.slots), EXEC);
    assert.equal(replay.won, true, `level ${entry.id} did not clear`);
    assert.equal(replay.status, STATUS.WON, `level ${entry.id} status`);
    assert.equal(replay.lit, level.lamps.length, `level ${entry.id} lamps`);
    assert.equal(replay.steps, entry.steps, `level ${entry.id} steps`);
    assert.equal(replay.error, null, `level ${entry.id} error`);
    for (const frame of replay.frames) {
      assert.deepEqual(checkInvariants(level, frame.state), [], `level ${entry.id} frame ${frame.index}`);
    }
  }
});

test("no level has a shorter solution inside its own palette and slots", () => {
  for (const entry of LEVELS) {
    const level = buildLevel(entry);
    const verdict = verifyLevel(level, entry.gold, entry.palette, {
      maxNodes: 600000,
      exec: EXEC,
    });
    assert.equal(verdict.ok, true, `level ${entry.id}: ${JSON.stringify(verdict)}`);
    assert.equal(verdict.par, entry.par, `level ${entry.id} par`);
    // A level with N lamps may legitimately report 0 nodes: every shorter
    // layer is rejected outright by the "one ACT per lamp" lower bound.
    assert.ok(verdict.nodes <= 600000, `level ${entry.id} nodes`);
  }
});

test("mechanics unlock chapter by chapter", () => {
  const has = (entry, op) => entry.palette.some((code) => parseInstruction(code)?.op === op);
  const colored = (entry) => entry.palette.some((code) => (parseInstruction(code)?.color ?? 0) > 0);
  for (const entry of LEVELS) {
    if (entry.chapter === 1) {
      assert.equal(has(entry, "J"), false, `jump leaked into ${entry.id}`);
      assert.equal(has(entry, "P"), false, `PROC1 leaked into ${entry.id}`);
      assert.equal(colored(entry), false, `color leaked into ${entry.id}`);
    }
    if (entry.chapter === 2) assert.equal(has(entry, "P"), false, `PROC1 leaked into ${entry.id}`);
    if (entry.chapter < 5) {
      const level = buildLevel(entry);
      assert.equal(level.boxes.length, 0, `crate leaked into ${entry.id}`);
      assert.equal(level.gates.length, 0, `gate leaked into ${entry.id}`);
    }
    if (entry.chapter === 5) {
      const level = buildLevel(entry);
      assert.ok(level.boxes.length > 0, `missing crate on ${entry.id}`);
      assert.ok(level.gates.length > 0, `missing gate on ${entry.id}`);
      assert.ok(level.switches.length > 0, `missing switch on ${entry.id}`);
    }
  }
  const chapter3 = LEVELS.filter((l) => l.chapter === 3);
  assert.ok(chapter3.every((l) => has(l, "P")));
  const chapter4 = LEVELS.filter((l) => l.chapter === 4);
  assert.ok(chapter4.every((l) => colored(l)));
});

test("Code Golf stars use the double-track tolerance", () => {
  for (const entry of LEVELS) {
    assert.equal(starsFor(entry, entry.par), 3);
    assert.equal(starsFor(entry, entry.par + 1), 2);
    assert.equal(starsFor(entry, entry.par + 2), 2);
    assert.equal(starsFor(entry, entry.par + 3), 1);
    assert.equal(starsFor(entry, entry.par + 99), 1);
    assert.equal(starsFor(entry, 0), 0);
    assert.equal(starsFor(entry, -1), 0);
    assert.equal(starsFor(entry, null), 0);
  }
});

test("level compilation is deterministic and isolated from the source data", () => {
  for (const entry of LEVELS) {
    const a = buildLevel(entry);
    const b = compileLevel(entry.spec);
    assert.deepEqual(a, b, `level ${entry.id}`);
    assert.notEqual(a.heights, b.heights, `level ${entry.id} shares arrays`);
  }
  const snapshot = JSON.stringify(LEVELS);
  const level = buildLevel(getLevel(19));
  runProgram(level, getLevel(19).gold, EXEC);
  assert.equal(JSON.stringify(LEVELS), snapshot, "running a level mutated the campaign data");
});
