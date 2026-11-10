// Bounded program-space solver for the robot levels.
//
// The search space is exactly the set of programs a player can compose on a
// level: the level's unlocked palette, its two fixed slot arrays, and the
// interpreter's own execution limits. Programs are enumerated by total
// non-empty slot count (Code Golf metric), shallowest layer first, so the
// first solution found is the shortest one within that space.
//
// Pruning is conservative and never removes a valid solution:
//   - a prefix that ends in ERROR stays locked forever, so no suffix can win;
//   - with no PROC1 slots, each remaining instruction can light at most one
//     lamp, so a prefix that is too far behind is dead;
//   - every lamp needs at least one ACT, hence lines < lampCount is pointless.
// A node budget guards the last chapters; an exhausted budget is reported as
// `aborted` instead of being silently treated as "no shorter solution".

import { runProgram, normalizeProgram, countInstructions, STATUS } from "./engine.mjs";

export const DEFAULT_SEARCH = Object.freeze({
  maxLines: 10,
  maxNodes: 300000,
  exec: { maxSteps: 160, maxFrames: 40, loopGuard: true },
});

export function solveLevel(level, options = {}) {
  const alphabet = Array.isArray(options.alphabet) ? options.alphabet : [];
  const maxLines = options.maxLines ?? DEFAULT_SEARCH.maxLines;
  const maxNodes = options.maxNodes ?? DEFAULT_SEARCH.maxNodes;
  const exec = { ...DEFAULT_SEARCH.exec, ...(options.exec ?? {}) };
  const slotMain = level.slots?.main ?? 12;
  const slotProc = level.slots?.proc1 ?? 8;
  const lampCount = level.lamps.length;

  let nodes = 0;
  let aborted = false;
  let shortest = null;
  const solutions = [];

  if (!alphabet.length || maxLines < 1 || lampCount === 0) {
    return { shortest: null, solutions, nodes, aborted: false, layers: 0 };
  }

  const hasProcCall = alphabet.some((code) => code.toUpperCase().startsWith("P"));
  let layers = 0;
  for (let lines = 1; lines <= maxLines && shortest === null && !aborted; lines += 1) {
    if (lines < lampCount) continue;
    layers += 1;
    for (let m = 1; m <= Math.min(lines, slotMain) && shortest === null && !aborted; m += 1) {
      const p = lines - m;
      if (p > slotProc) continue;
      // Without a PROC1 call tile the subroutine is unreachable, so any
      // program that spends lines there is strictly dominated.
      if (!hasProcCall && p > 0) continue;

      const main = Array(m).fill("");
      const proc = Array(p).fill("");

      function fillMain(i) {
        if (aborted || shortest !== null) return;
        nodes += 1;
        if (nodes > maxNodes) { aborted = true; return; }

        const result = runProgram(level, { main, proc1: proc }, exec);
        if (result.won) {
          shortest = lines;
          solutions.push({ main: main.slice(0, i), proc1: proc.slice() });
          return;
        }
        if (result.status === STATUS.ERROR) return;
        if (i === m) return;
        if (p === 0 && lampCount - result.lit > m - i) return;
        if (p === 0 && i > 0) {
          // Redundant prefixes: a no-op ACT and mutually cancelling turns can
          // both be deleted to obtain a strictly shorter, behaviour-identical
          // program. Such a branch can never hold the shortest solution.
          const executed = result.frames.slice(1).filter((f) => f.meta.executed);
          const last = executed.at(-1);
          const prev = executed.at(-2);
          if (last && (last.meta.event === "noop" || last.meta.event === "push-blocked")) return;
          if (last && prev && (
            (last.meta.code === "L" && prev.meta.code === "R")
            || (last.meta.code === "R" && prev.meta.code === "L")
          )) return;
        }

        for (const code of alphabet) {
          main[i] = code;
          fillMain(i + 1);
          main[i] = "";
          if (shortest !== null || aborted) return;
        }
      }

      function fillProc(i) {
        if (aborted || shortest !== null) return;
        if (i === p) { fillMain(0); return; }
        for (const code of alphabet) {
          proc[i] = code;
          fillProc(i + 1);
          proc[i] = "";
          if (shortest !== null || aborted) return;
        }
      }

      fillProc(0);
    }
  }

  return { shortest, solutions, nodes, aborted, layers };
}

// Verify a generated level: the gold program must win, and no program using
// fewer lines may win. Returns a machine-readable verdict for the test suite.
export function verifyLevel(level, gold, palette, options = {}) {
  const normalized = normalizeProgram(gold, level.slots);
  const par = countInstructions(normalized);
  const replay = runProgram(level, normalized, options.exec ?? DEFAULT_SEARCH.exec);
  if (!replay.won) {
    return { ok: false, reason: "gold-does-not-win", par, steps: replay.steps, status: replay.status };
  }
  const shorter = solveLevel(level, {
    alphabet: palette,
    maxLines: par - 1,
    maxNodes: options.maxNodes ?? DEFAULT_SEARCH.maxNodes,
    exec: options.exec ?? DEFAULT_SEARCH.exec,
  });
  if (shorter.aborted) {
    return { ok: false, reason: "budget-exhausted", par, steps: replay.steps, nodes: shorter.nodes };
  }
  if (shorter.shortest !== null) {
    return {
      ok: false,
      reason: "shorter-solution-exists",
      par,
      shorter: shorter.shortest,
      solution: shorter.solutions[0],
      steps: replay.steps,
    };
  }
  return { ok: true, par, steps: replay.steps, nodes: shorter.nodes, layers: shorter.layers };
}
