// Deterministic instruction interpreter for the programming-robot puzzles.
// Pure functions only: no DOM, no timers, no randomness, no I/O.
//
// A level is immutable world data; a state is the mutable-at-the-edge snapshot
// of one execution. stepInstruction() is a pure transfer function:
//   nextState = stepInstruction(level, state, program, options)
// runProgram() simply folds it into a full trace that the UI can replay,
// pause, single-step or speed up without ever re-running the rules.

export const DIR = Object.freeze({ EAST: 0, SOUTH: 1, WEST: 2, NORTH: 3 });
export const OP = Object.freeze({
  FORWARD: "F",
  LEFT: "L",
  RIGHT: "R",
  JUMP: "J",
  ACT: "A",
  PROC: "P",
});
export const COLOR = Object.freeze({ ANY: 0, RED: 1, BLUE: 2, GREEN: 3 });
export const STATUS = Object.freeze({
  RUNNING: "running",
  WON: "won",
  HALTED: "halted",
  ERROR: "error",
});
export const DEFAULT_SLOTS = Object.freeze({ main: 12, proc1: 8 });
export const DEFAULT_LIMITS = Object.freeze({
  maxSteps: 1000,
  maxFrames: 100,
  loopGuard: true,
});

const VECTORS = Object.freeze([[1, 0], [0, 1], [-1, 0], [0, -1]]);
const COLOR_CODES = Object.freeze({ r: COLOR.RED, b: COLOR.BLUE, g: COLOR.GREEN });
const COLOR_LETTERS = Object.freeze({ [COLOR.RED]: "r", [COLOR.BLUE]: "b", [COLOR.GREEN]: "g" });
const OPS = new Set(Object.values(OP));
const CODE_RE = /^([FLRJAP])(?::([RBG]))?$/i;
const STATUSES = new Set(Object.values(STATUS));

// grid characters: floor, void, raised floors, colored floors (low / high)
const TILE_CHARS = Object.freeze({
  ".": [0, COLOR.ANY],
  "_": [-1, COLOR.ANY],
  "1": [1, COLOR.ANY],
  "2": [2, COLOR.ANY],
  "3": [3, COLOR.ANY],
  r: [0, COLOR.RED],
  b: [0, COLOR.BLUE],
  g: [0, COLOR.GREEN],
  R: [1, COLOR.RED],
  B: [1, COLOR.BLUE],
  G: [1, COLOR.GREEN],
});

function clampInt(value, lo, hi, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= lo && n <= hi ? n : fallback;
}

function sorted(list) {
  return [...new Set(list)].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Instruction codec. A program is two fixed-size slot arrays; empty strings
// are blank slots. A trailing ":r" / ":b" / ":g" is a color condition: the
// instruction is silently skipped unless the bot stands on that tile color.
// ---------------------------------------------------------------------------

export function parseInstruction(code) {
  if (typeof code !== "string" || code === "") return null;
  const m = CODE_RE.exec(code.trim());
  if (!m) return null;
  return {
    op: m[1].toUpperCase(),
    color: m[2] ? COLOR_CODES[m[2].toLowerCase()] : COLOR.ANY,
  };
}

export function encodeInstruction(ins) {
  if (!ins || !OPS.has(ins.op)) return "";
  const suffix = COLOR_LETTERS[ins.color];
  return suffix ? `${ins.op}:${suffix}` : ins.op;
}

export function normalizeProgram(raw, slots = DEFAULT_SLOTS) {
  const mainCap = clampInt(slots?.main, 0, 64, DEFAULT_SLOTS.main);
  const procCap = clampInt(slots?.proc1, 0, 64, DEFAULT_SLOTS.proc1);
  const fill = (list, cap) => {
    const out = Array(cap).fill("");
    if (!Array.isArray(list)) return out;
    for (let i = 0; i < Math.min(list.length, cap); i += 1) {
      out[i] = encodeInstruction(parseInstruction(list[i]));
    }
    return out;
  };
  return { main: fill(raw?.main, mainCap), proc1: fill(raw?.proc1, procCap) };
}

export function countInstructions(program) {
  const count = (list) => (Array.isArray(list) ? list.filter((c) => c !== "").length : 0);
  return count(program?.main) + count(program?.proc1);
}

// ---------------------------------------------------------------------------
// Level compilation. Specs use compact character rows so level data stays
// readable; the compiled level is plain numeric arrays consumed by the rules.
// ---------------------------------------------------------------------------

export function compileLevel(spec) {
  const grid = Array.isArray(spec?.grid) ? spec.grid : [];
  const rows = clampInt(spec?.rows ?? grid.length, 1, 32, grid.length || 8);
  const widest = grid.reduce((n, line) => Math.max(n, String(line).length), 0);
  const cols = clampInt(spec?.cols ?? widest, 1, 32, widest || 8);
  const heights = [];
  const colors = [];
  for (let y = 0; y < rows; y += 1) {
    const line = String(grid[y] ?? "");
    for (let x = 0; x < cols; x += 1) {
      const tile = TILE_CHARS[line[x]] ?? [-1, COLOR.ANY];
      heights.push(tile[0]);
      colors.push(tile[1]);
    }
  }
  const level = { cols, rows, heights, colors };
  const toIndices = (list) => {
    if (!Array.isArray(list)) return [];
    return sorted(list.map((p) => {
      const x = Array.isArray(p) ? Number(p[0]) : Number(p?.x);
      const y = Array.isArray(p) ? Number(p[1]) : Number(p?.y);
      return inBounds(level, x, y) ? indexOf(level, x, y) : -1;
    }).filter((i) => i >= 0));
  };
  const start = Array.isArray(spec?.start) ? spec.start : (spec?.start ?? {});
  const sx = Array.isArray(start) ? start[0] : start.x;
  const sy = Array.isArray(start) ? start[1] : start.y;
  const sd = Array.isArray(start) ? start[2] : start.dir;
  return {
    cols,
    rows,
    heights,
    colors,
    lamps: toIndices(spec?.lamps),
    boxes: toIndices(spec?.boxes),
    switches: toIndices(spec?.switches),
    gates: toIndices(spec?.gates),
    start: {
      x: clampInt(sx, 0, cols - 1, 0),
      y: clampInt(sy, 0, rows - 1, 0),
      dir: clampInt(sd, 0, 3, DIR.EAST),
    },
    slots: {
      main: clampInt(spec?.slots?.main, 0, 64, DEFAULT_SLOTS.main),
      proc1: clampInt(spec?.slots?.proc1, 0, 64, DEFAULT_SLOTS.proc1),
    },
  };
}

export function indexOf(level, x, y) {
  return y * level.cols + x;
}

export function inBounds(level, x, y) {
  return Number.isInteger(x) && Number.isInteger(y)
    && x >= 0 && y >= 0 && x < level.cols && y < level.rows;
}

export function heightAt(level, x, y) {
  return inBounds(level, x, y) ? level.heights[indexOf(level, x, y)] : -1;
}

export function colorAt(level, x, y) {
  return inBounds(level, x, y) ? (level.colors[indexOf(level, x, y)] ?? COLOR.ANY) : COLOR.ANY;
}

function frontOf(state) {
  const v = VECTORS[state.dir];
  return { x: state.x + v[0], y: state.y + v[1] };
}

// Gravity switches are held by a crate or by the bot itself. Gates recompute
// every instruction: standing on a switch only opens them while standing there.
export function gatesOpen(level, state) {
  if (level.switches.length === 0) return false;
  const here = indexOf(level, state.x, state.y);
  return level.switches.every((s) => s === here || state.boxes.includes(s));
}

function gateBlocks(level, state, cell) {
  return level.gates.includes(cell) && !gatesOpen(level, state);
}

export function isWon(level, state) {
  return level.lamps.length > 0 && level.lamps.every((l) => state.lit.includes(l));
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export function createState(level) {
  const { x, y, dir } = level.start;
  return {
    x,
    y,
    z: Math.max(0, heightAt(level, x, y)),
    dir,
    lit: [],
    boxes: [...level.boxes],
    seen: [],
    frames: [{ proc: "main", ip: 0 }],
    steps: 0,
    status: STATUS.RUNNING,
    error: null,
  };
}

export function cloneState(s) {
  return {
    x: s.x,
    y: s.y,
    z: s.z,
    dir: s.dir,
    lit: [...s.lit],
    boxes: [...s.boxes],
    seen: [...s.seen],
    frames: s.frames.map((f) => ({ ...f })),
    steps: s.steps,
    status: s.status,
    error: s.error ? { code: s.error.code, at: s.error.at ? { ...s.error.at } : null } : null,
  };
}

function fingerprint(state, proc) {
  return `${proc}|${state.x},${state.y},${state.dir}|${state.lit.join(".")}|${state.boxes.join(".")}`;
}

function withError(state, code, at) {
  const next = cloneState(state);
  next.status = STATUS.ERROR;
  next.error = { code, at: at ? { ...at } : null };
  return next;
}

function baseMeta(event, extra = {}) {
  return {
    proc: null,
    ip: null,
    code: null,
    skipped: [],
    executed: false,
    event,
    won: false,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// One step = one executed instruction. Blank slots and unmet color conditions
// are consumed inside the same step and reported in meta.skipped, so the
// debugger's line pointer always lands on a real instruction.
// ---------------------------------------------------------------------------

export function stepInstruction(level, state, program, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options };
  if (state.status !== STATUS.RUNNING) {
    return { state, meta: baseMeta("locked") };
  }
  if (state.steps >= limits.maxSteps) {
    return { state: withError(state, "limit", null), meta: baseMeta("limit") };
  }

  const frames = state.frames.map((f) => ({ ...f }));
  const skipped = [];
  let slot = null;
  let guard = 0;
  const guardCap = (program.main.length + program.proc1.length + 2) * (limits.maxFrames + 1);

  while (guard < guardCap) {
    guard += 1;
    while (frames.length) {
      const top = frames[frames.length - 1];
      if (top.ip < (program[top.proc]?.length ?? 0)) break;
      frames.pop();
    }
    if (!frames.length) {
      const next = cloneState(state);
      next.frames = [];
      next.status = STATUS.HALTED;
      return { state: next, meta: baseMeta("halted", { skipped }) };
    }
    const top = frames[frames.length - 1];
    const list = program[top.proc] ?? [];
    const code = list[top.ip] ?? "";
    const at = { proc: top.proc, ip: top.ip };
    const ins = parseInstruction(code);
    if (!ins) {
      skipped.push({ ...at, code, reason: "empty" });
      top.ip += 1;
      continue;
    }
    if (ins.color !== COLOR.ANY && colorAt(level, state.x, state.y) !== ins.color) {
      skipped.push({ ...at, code, reason: "color" });
      top.ip += 1;
      continue;
    }
    slot = { at, ins, code };
    break;
  }
  if (!slot) {
    return { state: withError(state, "limit", null), meta: baseMeta("limit", { skipped }) };
  }

  const next = cloneState(state);
  next.frames = frames;
  next.steps = state.steps + 1;
  const { at, ins, code } = slot;
  const meta = baseMeta("noop", {
    proc: at.proc, ip: at.ip, code, skipped, executed: true,
  });
  const advance = () => { next.frames[next.frames.length - 1].ip += 1; };
  const fail = (reason) => {
    next.status = STATUS.ERROR;
    next.error = { code: reason, at: { ...at } };
    meta.event = reason;
  };

  switch (ins.op) {
    case OP.LEFT:
      next.dir = (next.dir + 3) % 4;
      meta.event = "turn";
      advance();
      break;
    case OP.RIGHT:
      next.dir = (next.dir + 1) % 4;
      meta.event = "turn";
      advance();
      break;
    case OP.FORWARD: {
      const f = frontOf(next);
      const cell = indexOf(level, f.x, f.y);
      const h = heightAt(level, f.x, f.y);
      const ok = inBounds(level, f.x, f.y) && h >= 0 && h === heightAt(level, next.x, next.y)
        && !next.boxes.includes(cell) && !gateBlocks(level, next, cell);
      if (!ok) { fail("blocked"); break; }
      next.x = f.x;
      next.y = f.y;
      next.z = h;
      meta.event = "move";
      advance();
      break;
    }
    case OP.JUMP: {
      const f = frontOf(next);
      const cell = indexOf(level, f.x, f.y);
      const h = heightAt(level, f.x, f.y);
      const current = heightAt(level, next.x, next.y);
      // Strictly one level up or one level down, per the design brief.
      const ok = inBounds(level, f.x, f.y) && h >= 0 && Math.abs(h - current) === 1
        && !next.boxes.includes(cell) && !gateBlocks(level, next, cell);
      if (!ok) { fail("blocked"); break; }
      next.x = f.x;
      next.y = f.y;
      next.z = h;
      meta.event = "jump";
      advance();
      break;
    }
    case OP.ACT: {
      const here = indexOf(level, next.x, next.y);
      if (level.lamps.includes(here) && !next.lit.includes(here)) {
        next.lit = sorted([...next.lit, here]);
        meta.event = "light";
      } else {
        const f = frontOf(next);
        const cell = indexOf(level, f.x, f.y);
        const v = VECTORS[next.dir];
        const beyond = { x: f.x + v[0], y: f.y + v[1] };
        const beyondCell = indexOf(level, beyond.x, beyond.y);
        if (inBounds(level, f.x, f.y) && next.boxes.includes(cell)) {
          const bh = heightAt(level, beyond.x, beyond.y);
          const ok = inBounds(level, beyond.x, beyond.y) && bh >= 0
            && bh === heightAt(level, f.x, f.y)
            && !next.boxes.includes(beyondCell)
            && !gateBlocks(level, next, beyondCell);
          if (ok) {
            next.boxes = sorted([...next.boxes.filter((b) => b !== cell), beyondCell]);
            meta.event = "push";
          } else {
            meta.event = "push-blocked";
          }
        } else {
          meta.event = "noop";
        }
      }
      advance();
      break;
    }
    case OP.PROC: {
      if (frames.length >= limits.maxFrames) { fail("stack"); break; }
      const recursive = frames.some((f) => f.proc === "proc1");
      const key = fingerprint(next, "proc1");
      if (recursive && limits.loopGuard && next.seen.includes(key)) { fail("loop"); break; }
      advance();
      next.seen.push(key);
      next.frames.push({ proc: "proc1", ip: 0 });
      meta.event = "call";
      break;
    }
    default:
      meta.event = "noop";
      advance();
      break;
  }

  if (next.status === STATUS.RUNNING && isWon(level, next)) {
    next.status = STATUS.WON;
  }
  meta.won = next.status === STATUS.WON;
  return { state: next, meta };
}

// ---------------------------------------------------------------------------
// Full deterministic trace. frames[0] is the untouched starting position;
// each later frame carries the state AFTER one instruction plus the pointer
// metadata needed by the debugger. Nothing here depends on wall-clock time.
// ---------------------------------------------------------------------------

export function runProgram(level, rawProgram, options = {}) {
  const limits = { ...DEFAULT_LIMITS, ...options };
  const program = normalizeProgram(rawProgram, level.slots ?? DEFAULT_SLOTS);
  let state = createState(level);
  const frames = [{
    index: 0,
    meta: baseMeta("start"),
    state: cloneState(state),
  }];
  while (state.status === STATUS.RUNNING && frames.length <= limits.maxSteps + 8) {
    const result = stepInstruction(level, state, program, limits);
    frames.push({
      index: frames.length,
      meta: result.meta,
      state: cloneState(result.state),
    });
    state = result.state;
  }
  return {
    frames,
    program,
    status: state.status,
    won: state.status === STATUS.WON,
    steps: state.steps,
    lit: state.lit.length,
    total: level.lamps.length,
    error: state.error ? { code: state.error.code, at: state.error.at } : null,
    finalState: cloneState(state),
    instructionCount: countInstructions(program),
  };
}

// Invariant helper shared by tests and the offline level verifier.
export function checkInvariants(level, state, options = {}) {
  const problems = [];
  const maxFrames = options.maxFrames ?? DEFAULT_LIMITS.maxFrames;
  if (!STATUSES.has(state.status)) problems.push("status");
  if (!inBounds(level, state.x, state.y)) problems.push("position");
  if (heightAt(level, state.x, state.y) < 0) problems.push("void-tile");
  if (state.z !== Math.max(0, heightAt(level, state.x, state.y))) problems.push("height");
  if (!Number.isInteger(state.dir) || state.dir < 0 || state.dir > 3) problems.push("direction");
  if (state.lit.some((l) => !level.lamps.includes(l))) problems.push("lamp-set");
  if (new Set(state.lit).size !== state.lit.length) problems.push("lamp-duplicate");
  if (new Set(state.boxes).size !== state.boxes.length) problems.push("box-duplicate");
  if (state.boxes.some((b) => b < 0 || b >= level.cols * level.rows)) problems.push("box-range");
  if (state.frames.length > maxFrames + 1) problems.push("frames");
  return problems;
}
