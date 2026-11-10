// game.mjs - DOM-free session controller for the robot puzzles.
//
// The engine turns a program into a complete frame trace; this layer owns the
// player's program, the playback cursor and the stage lifecycle. It never
// renders and never touches storage, so every rule here is unit-testable.

import {
  STATUS, countInstructions, createState, gatesOpen, normalizeProgram, runProgram,
} from "./engine.mjs";
import { LEVELS, buildLevel, getLevel, starsFor } from "./levels.mjs";

export const SPEEDS = Object.freeze([1, 2, 4]);
export const TICK_MS = 340;
export const PLAY_LIMITS = Object.freeze({ maxSteps: 600, maxFrames: 80 });

// A stage unlocks when the previous one has been cleared.
export function isUnlocked(progress, id) {
  if (!Number.isInteger(id) || id < 1) return false;
  if (id === 1) return true;
  const cleared = progress && typeof progress === "object" ? progress.cleared : null;
  return Boolean(cleared && cleared[id - 1]);
}

function timerApi(schedule, cancel) {
  const fallback = (fn, ms) => setTimeout(fn, ms);
  const clear = (id) => clearTimeout(id);
  return {
    set: typeof schedule === "function" ? schedule : fallback,
    clear: typeof cancel === "function" ? cancel : clear,
  };
}

export function createGameController(options = {}) {
  const { onChange } = options;
  const timer = timerApi(options.schedule, options.cancel);

  let entry = LEVELS[0];
  let level = buildLevel(entry);
  let program = normalizeProgram({}, entry.spec.slots);
  let frames = [];
  let cursor = 0;
  let status = "idle";
  let speedIndex = 0;
  let handle = null;
  let destroyed = false;

  function emit() {
    if (!destroyed) onChange?.(view());
  }

  function stopTimer() {
    if (handle !== null) {
      timer.clear(handle);
      handle = null;
    }
  }

  function currentState() {
    if (frames.length) return frames[Math.min(cursor, frames.length - 1)].state;
    return createState(level);
  }

  function currentMeta() {
    return frames.length ? frames[Math.min(cursor, frames.length - 1)].meta : null;
  }

  function lines() {
    return countInstructions(program);
  }

  function dropTrace() {
    stopTimer();
    frames = [];
    cursor = 0;
    status = "idle";
  }

  function finish() {
    const final = frames[frames.length - 1]?.state;
    const code = final?.status;
    stopTimer();
    if (code === STATUS.WON) status = "won";
    else if (code === STATUS.ERROR) status = "error";
    else if (code === STATUS.HALTED) status = "halted";
    else status = "paused";
  }

  // Builds the full trace for the current program. Returns false for an empty
  // program so callers can nudge instead of showing a dead board.
  function buildTrace() {
    if (lines() === 0) return false;
    const run = runProgram(level, program, PLAY_LIMITS);
    frames = run.frames;
    cursor = 0;
    status = "idle";
    if (frames.length <= 1) {
      finish();
      return true;
    }
    return true;
  }

  function delay() {
    return Math.round(TICK_MS / SPEEDS[speedIndex]);
  }

  function scheduleTick() {
    stopTimer();
    handle = timer.set(() => {
      handle = null;
      if (destroyed || status !== "running") return;
      advanceOne();
      if (status === "running") scheduleTick();
    }, delay());
  }

  function advanceOne() {
    if (cursor >= frames.length - 1) {
      finish();
      emit();
      return false;
    }
    cursor += 1;
    if (cursor >= frames.length - 1) finish();
    emit();
    return true;
  }

  function run() {
    if (status === "running") return false;
    if (lines() === 0) return false;
    const atEnd = frames.length > 0 && cursor >= frames.length - 1;
    if (!frames.length || atEnd) {
      if (!buildTrace()) return false;
      cursor = 0;
    }
    status = "running";
    emit();
    scheduleTick();
    return true;
  }

  function pause() {
    if (status !== "running") return false;
    stopTimer();
    status = cursor > 0 ? "paused" : "idle";
    emit();
    return true;
  }

  function step() {
    if (status === "running") pause();
    if (lines() === 0) return false;
    if (!frames.length) {
      if (!buildTrace()) return false;
      cursor = 0;
      status = "paused";
      // First press shows the first executed instruction, not the start frame.
      return advanceOne();
    }
    if (cursor >= frames.length - 1) return false;
    status = "paused";
    return advanceOne();
  }

  function reset() {
    dropTrace();
    emit();
    return true;
  }

  function cycleSpeed() {
    speedIndex = (speedIndex + 1) % SPEEDS.length;
    emit();
    return SPEEDS[speedIndex];
  }

  function start(id, opts = {}) {
    const next = getLevel(id) ?? LEVELS[0];
    entry = next;
    level = buildLevel(next);
    const seed = opts && typeof opts === "object" && opts.program ? opts.program : {};
    program = normalizeProgram(seed, next.spec.slots);
    dropTrace();
    emit();
    return view();
  }

  const PROC_KEYS = new Set(["main", "proc1"]);

  function capacity(proc) {
    return proc === "proc1" ? program.proc1.length : program.main.length;
  }

  function slotList(proc) {
    return proc === "proc1" ? program.proc1 : program.main;
  }

  function place(proc, index, code) {
    if (!PROC_KEYS.has(proc)) return false;
    if (!Number.isInteger(index) || index < 0 || index >= capacity(proc)) return false;
    if (typeof code !== "string" || code === "") return false;
    if (!entry.palette.includes(code)) return false;
    if (slotList(proc)[index] === code) return false;
    slotList(proc)[index] = code;
    dropTrace();
    emit();
    return true;
  }

  function erase(proc, index) {
    if (!PROC_KEYS.has(proc)) return false;
    if (!Number.isInteger(index) || index < 0 || index >= capacity(proc)) return false;
    if (slotList(proc)[index] === "") return false;
    slotList(proc)[index] = "";
    dropTrace();
    emit();
    return true;
  }

  // Moves a filled slot into another slot, shifting the rest of that row.
  // Crossing between MAIN and PROC1 swaps the two values instead of shifting,
  // because the target row may be a different length.
  function move(from, to) {
    if (!from || !to) return false;
    if (!PROC_KEYS.has(from.proc) || !PROC_KEYS.has(to.proc)) return false;
    if (!Number.isInteger(from.slot) || !Number.isInteger(to.slot)) return false;
    if (from.slot < 0 || from.slot >= capacity(from.proc)) return false;
    if (to.slot < 0 || to.slot >= capacity(to.proc)) return false;
    const source = slotList(from.proc);
    if (!source[from.slot]) return false;
    if (from.proc === to.proc && from.slot === to.slot) return false;
    const target = slotList(to.proc);
    const value = source[from.slot];
    if (from.proc === to.proc) {
      const next = [...source];
      next.splice(from.slot, 1);
      next.splice(to.slot, 0, value);
      const cap = capacity(from.proc);
      const filled = next.filter((c) => c !== "");
      for (let i = 0; i < cap; i += 1) source[i] = filled[i] ?? "";
    } else {
      source[from.slot] = target[to.slot] || "";
      target[to.slot] = value;
    }
    dropTrace();
    emit();
    return true;
  }

  function clear() {
    const empty = countInstructions(program) === 0;
    program = normalizeProgram({}, entry.spec.slots);
    dropTrace();
    if (!empty) emit();
    return !empty;
  }

  function nextEmpty(proc) {
    if (!PROC_KEYS.has(proc)) return -1;
    return slotList(proc).indexOf("");
  }

  function view() {
    const state = currentState();
    const meta = currentMeta();
    const count = lines();
    const finalised = status === "won" || status === "error" || status === "halted";
    return {
      levelId: entry.id,
      chapter: entry.chapter,
      chapterCount: LEVELS.filter((l) => l.chapter === entry.chapter).length,
      par: entry.par,
      palette: [...entry.palette],
      slots: { ...entry.spec.slots },
      lamps: level.lamps.length,
      level,
      program: { main: [...program.main], proc1: [...program.proc1] },
      lines: count,
      stars: status === "won" ? starsFor(entry, count) : 0,
      bestPossibleStars: starsFor(entry, count),
      status,
      speed: SPEEDS[speedIndex],
      frameCount: frames.length,
      cursor,
      state,
      meta,
      gateOpen: gatesOpen(level, state),
      litCount: state.lit.length,
      canRun: count > 0 && status !== "running",
      canStep: count > 0 && status !== "running"
        && (frames.length === 0 ? true : cursor < frames.length - 1),
      canUndoFrame: frames.length > 0 && cursor > 0,
      settled: finalised,
    };
  }

  function destroy() {
    stopTimer();
    destroyed = true;
  }

  start(LEVELS[0].id);

  return {
    start,
    restart: () => start(entry.id),
    place,
    erase,
    move,
    clear,
    run,
    pause,
    step,
    reset,
    cycleSpeed,
    nextEmpty,
    view,
    // Read-only access for the trace panel; the UI never mutates these.
    frames: () => frames,
    destroy,
    get levelId() { return entry.id; },
    get entry() { return entry; },
  };
}
