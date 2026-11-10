import test from "node:test";
import assert from "node:assert/strict";

import {
  DIR, OP, COLOR, STATUS, DEFAULT_LIMITS,
  parseInstruction, encodeInstruction, normalizeProgram, countInstructions,
  compileLevel, indexOf, inBounds, heightAt, colorAt,
  gatesOpen, isWon, createState, cloneState,
  stepInstruction, runProgram, checkInvariants,
} from "../js/engine.mjs";

function flat(grid = null) {
  return compileLevel({
    grid: grid ?? [
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
    ],
    lamps: [[7, 7]],
    start: [1, 1, DIR.EAST],
    slots: { main: 12, proc1: 8 },
  });
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------

test("instruction codec is strict, case-insensitive and lossless", () => {
  assert.deepEqual(parseInstruction("F"), { op: OP.FORWARD, color: COLOR.ANY });
  assert.deepEqual(parseInstruction("f:r"), { op: OP.FORWARD, color: COLOR.RED });
  assert.deepEqual(parseInstruction(" P:g "), { op: OP.PROC, color: COLOR.GREEN });
  assert.deepEqual(parseInstruction("A:b"), { op: OP.ACT, color: COLOR.BLUE });
  for (const bad of ["", "X", "F:z", "FF", "F:r:b", null, undefined, 7, {}]) {
    assert.equal(parseInstruction(bad), null);
  }
  assert.equal(encodeInstruction({ op: "F", color: COLOR.RED }), "F:r");
  assert.equal(encodeInstruction({ op: "R", color: COLOR.ANY }), "R");
  assert.equal(encodeInstruction(null), "");
  assert.equal(encodeInstruction({ op: "Z", color: COLOR.ANY }), "");
});

test("normalizeProgram pads slots, truncates overflow and drops invalid codes", () => {
  const p = normalizeProgram({ main: ["F", "f:b", "BAD", "R"], proc1: ["P"] }, { main: 5, proc1: 2 });
  assert.deepEqual(p.main, ["F", "F:b", "", "R", ""]);
  assert.deepEqual(p.proc1, ["P", ""]);
  assert.equal(countInstructions(p), 4);
  const capped = normalizeProgram({ main: Array(30).fill("F") }, { main: 12, proc1: 8 });
  assert.equal(capped.main.length, 12);
  assert.equal(countInstructions(capped), 12);
  assert.equal(countInstructions({ main: null, proc1: null }), 0);
});

test("compileLevel maps tile glyphs and filters out-of-range entities", () => {
  const level = compileLevel({
    grid: ["..1.", "_r..", "..B."],
    lamps: [[0, 0], [99, 99], [2, 2]],
    boxes: [[-1, 0], [1, 1]],
    start: [0, 0, DIR.NORTH],
  });
  assert.equal(level.cols, 4);
  assert.equal(level.rows, 3);
  assert.equal(heightAt(level, 2, 0), 1);
  assert.equal(heightAt(level, 0, 1), -1);
  assert.equal(colorAt(level, 1, 1), COLOR.RED);
  assert.equal(colorAt(level, 2, 2), COLOR.BLUE);
  assert.equal(heightAt(level, 2, 2), 1);
  assert.deepEqual(level.lamps, [indexOf(level, 0, 0), indexOf(level, 2, 2)]);
  assert.deepEqual(level.boxes, [indexOf(level, 1, 1)]);
  assert.deepEqual(level.start, { x: 0, y: 0, dir: DIR.NORTH });
  assert.equal(inBounds(level, 4, 0), false);
  assert.equal(heightAt(level, -1, 0), -1);
  assert.deepEqual(level.slots, { main: 12, proc1: 8 });
});

test("forward and turns are deterministic; z always tracks the tile height", () => {
  const level = flat();
  const run = runProgram(level, { main: ["F", "R", "F", "L", "F"] });
  assert.equal(run.steps, 5);
  assert.equal(run.status, STATUS.HALTED);
  assert.equal(run.error, null);
  assert.deepEqual(
    run.frames.slice(1, 6).map((f) => [f.state.x, f.state.y, f.state.dir, f.state.z, f.meta.event]),
    [
      [2, 1, DIR.EAST, 0, "move"],
      [2, 1, DIR.SOUTH, 0, "turn"],
      [2, 2, DIR.SOUTH, 0, "move"],
      [2, 2, DIR.EAST, 0, "turn"],
      [3, 2, DIR.EAST, 0, "move"],
    ],
  );
  assert.equal(run.frames.at(-1).meta.event, "halted");
  assert.equal(run.frames.at(-1).meta.executed, false);
});

test("lighting the last lamp wins mid-program; an unfinished program halts", () => {
  const level = flat();
  level.lamps = [indexOf(level, 2, 1)];
  const win = runProgram(level, { main: ["F", "A"] });
  assert.equal(win.won, true);
  assert.equal(win.status, STATUS.WON);
  assert.equal(win.steps, 2);
  assert.equal(win.lit, 1);
  assert.equal(win.total, 1);
  assert.equal(win.frames[1].meta.won, false);
  assert.equal(win.frames[2].meta.event, "light");
  assert.equal(win.frames[2].meta.won, true);
  assert.equal(win.frames.length, 3, "no extra tick after a win");
  assert.equal(isWon(level, win.finalState), true);

  const miss = runProgram(level, { main: ["F"] });
  assert.equal(miss.status, STATUS.HALTED);
  assert.equal(miss.won, false);
  assert.equal(miss.error, null);
  assert.equal(miss.lit, 0);
});

test("a blocked move errors in place, points at the failing slot and locks the state", () => {
  const level = flat();
  level.start = { x: 0, y: 0, dir: DIR.WEST };
  const program = normalizeProgram({ main: ["F"] }, level.slots);
  const run = runProgram(level, program);
  assert.equal(run.status, STATUS.ERROR);
  assert.deepEqual(run.error, { code: "blocked", at: { proc: "main", ip: 0 } });
  assert.equal(run.finalState.x, 0);
  assert.equal(run.finalState.y, 0);
  assert.equal(run.steps, 1);
  const again = stepInstruction(level, run.finalState, program);
  assert.equal(again.state, run.finalState, "terminal states must be returned unchanged");
  assert.equal(again.meta.event, "locked");
});

test("jump is strictly one level up or down; walking over a height gap is blocked", () => {
  const up = compileLevel({
    grid: ["....", ".123", "...."],
    lamps: [[3, 1]],
    start: [0, 1, DIR.EAST],
  });
  const climb = runProgram(up, { main: ["J", "J", "J", "A"] });
  assert.equal(climb.won, true);
  assert.deepEqual(
    climb.frames.slice(1, 5).map((f) => [f.state.x, f.state.z, f.meta.event]),
    [[1, 1, "jump"], [2, 2, "jump"], [3, 3, "jump"], [3, 3, "light"]],
  );

  const steep = compileLevel({ grid: ["....", ".13.", "...."], start: [0, 1, DIR.EAST] });
  const tooHigh = runProgram(steep, { main: ["J", "J"] });
  assert.equal(tooHigh.error.code, "blocked");
  assert.deepEqual(tooHigh.error.at, { proc: "main", ip: 1 });
  assert.equal(tooHigh.finalState.x, 1);
  assert.equal(runProgram(steep, { main: ["F"] }).error.code, "blocked");

  const down = compileLevel({ grid: ["....", ".23.", "...."], start: [2, 1, DIR.WEST] });
  const fall = runProgram(down, { main: ["J"] });
  assert.equal(fall.frames[1].meta.event, "jump");
  assert.equal(fall.finalState.z, 2);

  const gap = compileLevel({ grid: ["....", "._..", "...."], start: [0, 1, DIR.EAST] });
  assert.equal(runProgram(gap, { main: ["F"] }).error.code, "blocked");
  assert.equal(runProgram(gap, { main: ["J"] }).error.code, "blocked");
});

test("ACT lights the tile under the bot, else pushes one crate without moving the bot", () => {
  const level = flat();
  level.start = { x: 1, y: 1, dir: DIR.EAST };
  level.boxes = [indexOf(level, 3, 1)];
  const run = runProgram(level, { main: ["F", "A", "A"] });
  assert.equal(run.frames[2].meta.event, "push");
  assert.deepEqual(run.finalState.boxes, [indexOf(level, 4, 1)]);
  assert.equal(run.finalState.x, 2, "pushing does not advance the bot");
  assert.equal(run.frames[3].meta.event, "noop");

  const edge = flat();
  edge.start = { x: 5, y: 1, dir: DIR.EAST };
  edge.boxes = [indexOf(edge, 7, 1)];
  const stuck = runProgram(edge, { main: ["F", "A"] });
  assert.equal(stuck.frames[2].meta.event, "push-blocked");
  assert.deepEqual(stuck.finalState.boxes, edge.boxes);
  assert.equal(stuck.status, STATUS.HALTED, "a failed push is not a crash");
});

test("gravity switches open gates only while held by a crate or the bot", () => {
  const spec = {
    switches: [[2, 2]],
    gates: [[4, 1]],
    start: [3, 1, DIR.EAST],
  };
  const held = flat();
  held.switches = [indexOf(held, 2, 2)];
  held.gates = [indexOf(held, 4, 1)];
  held.boxes = [indexOf(held, 2, 2)];
  held.start = { x: 3, y: 1, dir: DIR.EAST };
  assert.equal(gatesOpen(held, createState(held)), true);
  assert.equal(runProgram(held, { main: ["F"] }).finalState.x, 4);

  const free = flat();
  free.switches = [indexOf(free, 2, 2)];
  free.gates = [indexOf(free, 4, 1)];
  free.start = { x: 3, y: 1, dir: DIR.EAST };
  assert.equal(gatesOpen(free, createState(free)), false);
  assert.equal(runProgram(free, { main: ["F"] }).error.code, "blocked");
  assert.ok(Array.isArray(spec.switches));
});

test("color conditions silently skip unmatched slots without consuming a step", () => {
  const level = compileLevel({
    grid: ["....", ".r..", "...."],
    lamps: [[3, 1]],
    start: [1, 1, DIR.EAST],
  });
  const run = runProgram(level, { main: ["F:r", "F:b", "F", "A"] });
  assert.equal(run.won, true);
  assert.equal(run.steps, 3);
  assert.equal(run.finalState.x, 3);
  assert.deepEqual(run.frames[2].meta.skipped, [
    { proc: "main", ip: 1, code: "F:b", reason: "color" },
  ]);

  const skipped = runProgram(level, { main: ["F:b"] });
  assert.equal(skipped.steps, 0);
  assert.equal(skipped.status, STATUS.HALTED);
  assert.equal(skipped.frames[1].meta.skipped[0].reason, "color");
  assert.equal(skipped.frames[0].meta.skipped.length, 0);
});

test("PROC1 call/return unwinds to the main slot after the call", () => {
  const level = flat();
  level.lamps = [indexOf(level, 3, 1)];
  level.start = { x: 0, y: 1, dir: DIR.EAST };
  const run = runProgram(level, { main: ["P", "F", "A"], proc1: ["F", "F"] });
  assert.deepEqual(
    run.frames.slice(1).map((f) => f.meta.proc),
    ["main", "proc1", "proc1", "main", "main"],
  );
  assert.equal(run.frames[1].meta.event, "call");
  assert.equal(run.won, true);
  assert.equal(run.steps, 5);
  assert.equal(run.finalState.x, 3);
  assert.equal(run.finalState.frames[0].ip, 3);
});

test("recursion is bounded by loop detection, frame depth and step budget", () => {
  const level = flat();
  const loop = runProgram(level, { main: ["P"], proc1: ["P"] });
  assert.equal(loop.error.code, "loop");
  assert.equal(loop.steps, 2);

  const stack = runProgram(
    level,
    { main: ["P"], proc1: ["R", "P"] },
    { maxFrames: 4, maxSteps: 50, loopGuard: false },
  );
  assert.equal(stack.error.code, "stack");
  assert.ok(stack.finalState.frames.length <= 4);

  const long = compileLevel({
    grid: Array(8).fill("........"),
    lamps: [[7, 7]],
    start: [1, 1, DIR.EAST],
    slots: { main: 64, proc1: 8 },
  });
  const limit = runProgram(long, { main: Array(64).fill("R") }, { maxSteps: 10 });
  assert.equal(limit.error.code, "limit");
  assert.equal(limit.steps, 10);
  assert.equal(limit.finalState.dir, 2);
  assert.equal(limit.frames.length, 12);
  assert.equal(DEFAULT_LIMITS.maxSteps, 1000);
});

test("the interpreter is pure and replays identical input frame for frame", () => {
  const level = flat();
  level.lamps = [indexOf(level, 3, 1)];
  const program = { main: ["F", "L", "A", "P"], proc1: ["R", "F"] };
  const before = JSON.stringify({ level, program, state: createState(level) });
  const a = runProgram(level, program);
  const b = runProgram(level, program);
  assert.equal(JSON.stringify({ level, program, state: createState(level) }), before);
  assert.deepEqual(a.frames, b.frames);
  assert.equal(JSON.stringify(a.frames), JSON.stringify(b.frames));

  const state = createState(level);
  const result = stepInstruction(level, state, normalizeProgram(program, level.slots));
  assert.notEqual(result.state, state);
  assert.equal(state.steps, 0);
  assert.equal(state.frames[0].ip, 0);
  const copy = cloneState(result.state);
  assert.deepEqual(copy, result.state);
  assert.notEqual(copy.lit, result.state.lit);
});

test("checkInvariants reports the exact broken field", () => {
  const level = flat();
  const good = createState(level);
  assert.deepEqual(checkInvariants(level, good), []);
  const bad = cloneState(good);
  bad.x = 99;
  bad.lit = [indexOf(level, 0, 0)];
  bad.boxes = [4, 4];
  bad.z = 7;
  const problems = checkInvariants(level, bad);
  for (const p of ["position", "lamp-set", "box-duplicate", "height"]) {
    assert.ok(problems.includes(p), `missing ${p}`);
  }
});

test("1000-step run plus random walk keep every state invariant", () => {
  const level = compileLevel({
    grid: [
      "........",
      "..11....",
      "..1r....",
      "...b....",
      ".._.....",
      "...2....",
      "........",
      "........",
    ],
    lamps: [[0, 0], [7, 7], [5, 5]],
    boxes: [[6, 6]],
    switches: [[6, 6]],
    gates: [[4, 4]],
    start: [3, 3, DIR.EAST],
    slots: { main: 12, proc1: 8 },
  });

  // A stable recursive loop that walks one cell forth and back forever.
  const marathon = runProgram(
    level,
    { main: ["P"], proc1: ["F", "R", "R", "F", "R", "R", "P"] },
    { maxSteps: 1000, maxFrames: 1000, loopGuard: false },
  );
  assert.equal(marathon.steps, 1000);
  assert.equal(marathon.error.code, "limit");
  for (const frame of marathon.frames) {
    assert.deepEqual(checkInvariants(level, frame.state, { maxFrames: 1000 }), [], `frame ${frame.index}`);
  }

  const rng = mulberry32(0x5eedb07);
  const alphabet = ["F", "L", "R", "J", "A", "P", "", "F:r", "A:b", "R:g", "J:r", "A:g"];
  const pick = () => alphabet[Math.floor(rng() * alphabet.length)];
  const programs = [];
  let walked = marathon.steps;
  for (let n = 0; n < 200; n += 1) {
    const program = {
      main: Array.from({ length: 12 }, pick),
      proc1: Array.from({ length: 8 }, pick),
    };
    programs.push(program);
    const run = runProgram(level, program);
    walked += run.steps;
    assert.ok(
      [STATUS.WON, STATUS.HALTED, STATUS.ERROR].includes(run.status),
      `unexpected status ${run.status}`,
    );
    for (const frame of run.frames) {
      assert.deepEqual(checkInvariants(level, frame.state), [], `program ${n} frame ${frame.index}`);
    }
  }
  assert.ok(walked >= 1000, `random walk only covered ${walked} steps`);

  // Same seed, same programs, same frames: the whole thing is replayable.
  const replay = runProgram(level, programs[0]);
  assert.equal(
    JSON.stringify(replay.frames),
    JSON.stringify(runProgram(level, programs[0]).frames),
  );
});
