// Generates games/robot/js/levels.mjs from 21 hand-designed world specs.
//
// The gold solution of every level is NOT hand-written: solveLevel searches
// the level's own palette / slot constraint and the first (shortest) winning
// program becomes the gold line. verifyLevel then re-checks that no shorter
// program wins. Run:
//   node scripts/generate-robot-levels.mjs --dry [--limit=21]
//   node scripts/generate-robot-levels.mjs
//
// World glyphs: '.' floor, '_' void, '1'..'3' raised floors,
// 'r'/'b'/'g' colored floors, 'R'/'B'/'G' colored raised floors.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import {
  DIR, compileLevel, runProgram, normalizeProgram, countInstructions,
} from "../games/robot/js/engine.mjs";
import { solveLevel, verifyLevel } from "../games/robot/js/solver.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../games/robot/js/levels.mjs");

const VOID3 = ["______", "______", "______"];

const SPECS = [
  // Chapter 1 - Novice Assembly: forward, turn, light.
  {
    id: 1, chapter: 1, palette: ["F", "A"], slots: { main: 8, proc1: 0 },
    grid: ["______", "......", "______"],
    lamps: [[2, 1]], start: [0, 1, DIR.EAST], maxLines: 6,
  },
  {
    id: 2, chapter: 1, palette: ["F", "L", "A"], slots: { main: 8, proc1: 0 },
    grid: ["___.___", ".......", "_______"],
    lamps: [[3, 0]], start: [0, 1, DIR.EAST], maxLines: 8,
  },
  {
    id: 3, chapter: 1, palette: ["F", "A"], slots: { main: 10, proc1: 0 },
    grid: ["______", "......", "______"],
    lamps: [[1, 1], [4, 1]], start: [0, 1, DIR.EAST], maxLines: 8,
  },
  {
    id: 4, chapter: 1, palette: ["F", "L", "A"], slots: { main: 10, proc1: 0 },
    grid: ["___.___", ".......", "_______"],
    lamps: [[1, 1], [3, 1], [3, 0]], start: [0, 1, DIR.EAST], maxLines: 10,
  },

  // Chapter 2 - Vertical Stride: one-level jumps up and down.
  {
    id: 5, chapter: 2, palette: ["F", "J", "A"], slots: { main: 8, proc1: 0 },
    grid: ["______", ".11...", "______"],
    lamps: [[2, 1]], start: [0, 1, DIR.EAST], maxLines: 6,
  },
  {
    id: 6, chapter: 2, palette: ["F", "J", "A"], slots: { main: 10, proc1: 0 },
    grid: ["________", ".11..11.", "________"],
    lamps: [[2, 1], [6, 1]], start: [0, 1, DIR.EAST], maxLines: 9,
  },
  {
    id: 7, chapter: 2, palette: ["F", "J", "A"], slots: { main: 10, proc1: 0 },
    grid: ["________", ".11.11..", "________"],
    lamps: [[2, 1], [5, 1], [7, 1]], start: [0, 1, DIR.EAST], maxLines: 10,
  },
  {
    id: 8, chapter: 2, palette: ["F", "L", "J", "A"], slots: { main: 10, proc1: 0 },
    grid: ["___.___", ".11.1..", "_______"],
    lamps: [[2, 1], [3, 0]], start: [0, 1, DIR.EAST], maxLines: 9,
  },
  {
    id: 9, chapter: 2, palette: ["F", "J", "A"], slots: { main: 14, proc1: 0 },
    grid: ["__________", ".11..1.1..", "__________"],
    lamps: [[2, 1], [5, 1], [7, 1], [9, 1]], start: [0, 1, DIR.EAST], maxLines: 13,
  },

  // Chapter 3 - Subroutine Loops: PROC1 reuse and recursion beat raw lines.
  {
    id: 10, chapter: 3, palette: ["F", "A", "P"], slots: { main: 8, proc1: 4 },
    grid: ["__________", "..........", "__________"],
    lamps: [[2, 1], [4, 1]], start: [0, 1, DIR.EAST], maxLines: 7,
  },
  {
    id: 11, chapter: 3, palette: ["F", "A", "P"], slots: { main: 8, proc1: 4 },
    grid: ["__________", "..........", "__________"],
    lamps: [[2, 1], [4, 1], [6, 1]], start: [0, 1, DIR.EAST], maxLines: 7,
  },
  {
    id: 12, chapter: 3, palette: ["F", "A", "P"], slots: { main: 8, proc1: 4 },
    grid: ["____________", "............", "____________"],
    lamps: [[2, 1], [4, 1], [6, 1], [8, 1]], start: [0, 1, DIR.EAST], maxLines: 7,
  },
  {
    id: 13, chapter: 3, palette: ["F", "J", "A", "P"], slots: { main: 8, proc1: 5 },
    grid: ["____________", ".1..1..1..1.", "____________"],
    lamps: [[1, 1], [4, 1], [7, 1], [10, 1]], start: [0, 1, DIR.EAST], maxLines: 8,
  },

  // Chapter 4 - Conditional Logic: colored modifiers plus recursion.
  {
    id: 14, chapter: 4, palette: ["F", "A:b", "P"], slots: { main: 8, proc1: 4 },
    grid: ["__________", ".b.b.b....", "__________"],
    lamps: [[1, 1], [3, 1], [5, 1]], start: [0, 1, DIR.EAST], maxLines: 7,
  },
  {
    id: 15, chapter: 4, palette: ["F", "A:r", "A:b", "P"], slots: { main: 8, proc1: 5 },
    grid: ["__________", ".b.r.b.r..", "__________"],
    lamps: [[1, 1], [3, 1], [5, 1], [7, 1]], start: [0, 1, DIR.EAST], maxLines: 7,
  },
  {
    id: 16, chapter: 4, palette: ["F", "A:g", "P"], slots: { main: 8, proc1: 4 },
    grid: ["____________", ".g..g..g..g.", "____________"],
    lamps: [[1, 1], [4, 1], [7, 1], [10, 1]], start: [0, 1, DIR.EAST], maxLines: 8,
  },
  {
    id: 17, chapter: 4, palette: ["F", "J", "A:r", "P"], slots: { main: 8, proc1: 5 },
    grid: ["__________", ".R..R..R..", "__________"],
    lamps: [[1, 1], [4, 1], [7, 1]], start: [0, 1, DIR.EAST], maxLines: 8,
  },
  {
    id: 18, chapter: 4, palette: ["F", "A:r", "A:b", "A:g", "P"], slots: { main: 8, proc1: 6 },
    grid: ["____________", ".r.b.g.r.b.g.", "____________"],
    lamps: [[1, 1], [3, 1], [5, 1], [7, 1], [9, 1], [11, 1]], start: [0, 1, DIR.EAST], maxLines: 8,
  },

  // Chapter 5 - Turing Finales: crate pushes gravity switches that open gates.
  {
    id: 19, chapter: 5, palette: ["F", "L", "R", "A"], slots: { main: 10, proc1: 0 },
    grid: ["__...__", ".......", "_______"],
    boxes: [[3, 0]], switches: [[4, 0]], gates: [[5, 1]],
    lamps: [[6, 1]], start: [2, 0, DIR.EAST], maxLines: 10,
  },
  {
    id: 20, chapter: 5, palette: ["F", "L", "R", "A"], slots: { main: 12, proc1: 0 },
    grid: ["__...____", ".........", "_________"],
    boxes: [[3, 0]], switches: [[4, 0]], gates: [[6, 1]],
    lamps: [[7, 1], [8, 1]], start: [2, 0, DIR.EAST], maxLines: 12,
    maxNodes: 600000,
  },
  {
    id: 21, chapter: 5, palette: ["F", "L", "R", "A", "A:b"], slots: { main: 12, proc1: 0 },
    grid: ["__...___", "....b...", "________"],
    boxes: [[3, 0]], switches: [[4, 0]], gates: [[5, 1]],
    lamps: [[4, 1], [7, 1]], start: [2, 0, DIR.EAST], maxLines: 12,
    maxNodes: 600000,
  },
];

const CHAPTER_COUNTS = [4, 5, 4, 5, 3];

function buildSpec(spec) {
  return {
    grid: spec.grid,
    lamps: spec.lamps,
    boxes: spec.boxes ?? [],
    switches: spec.switches ?? [],
    gates: spec.gates ?? [],
    start: spec.start,
    slots: spec.slots,
  };
}

function generate(dry, limit) {
  const entries = [];
  const failures = [];
  const started = Date.now();
  for (const spec of SPECS.slice(0, limit)) {
    const level = compileLevel(buildSpec(spec));
    const t = Date.now();
    const search = solveLevel(level, {
      alphabet: spec.palette,
      maxLines: spec.maxLines,
      maxNodes: spec.maxNodes ?? 250000,
      exec: { maxSteps: 160, maxFrames: 40, loopGuard: true },
    });
    const ms = Date.now() - t;
    if (search.shortest === null) {
      failures.push({ id: spec.id, reason: search.aborted ? "budget" : "no-solution", nodes: search.nodes });
      console.log(`L${String(spec.id).padStart(2)} FAIL ${search.aborted ? "budget" : "no-solution"} nodes=${search.nodes} ${ms}ms`);
      continue;
    }
    const gold = search.solutions[0];
    const normalized = normalizeProgram(gold, level.slots);
    const par = countInstructions(normalized);
    const replay = runProgram(level, normalized, { maxSteps: 160, maxFrames: 40 });
    const check = verifyLevel(level, normalized, spec.palette, {
      maxNodes: spec.maxNodes ?? 250000,
      exec: { maxSteps: 160, maxFrames: 40, loopGuard: true },
    });
    if (!replay.won || !check.ok) {
      failures.push({ id: spec.id, reason: check.reason, par });
      console.log(`L${String(spec.id).padStart(2)} FAIL verify=${check.reason} par=${par} ${ms}ms`);
      continue;
    }
    entries.push({
      id: spec.id,
      chapter: spec.chapter,
      spec: buildSpec(spec),
      palette: spec.palette,
      gold: normalized,
      par,
      steps: replay.steps,
      lamps: level.lamps.length,
    });
    console.log(
      `L${String(spec.id).padStart(2)} ch${spec.chapter} par=${String(par).padStart(2)} steps=${String(replay.steps).padStart(3)} ` +
      `lamps=${level.lamps.length} nodes=${String(search.nodes).padStart(7)} ${String(ms).padStart(5)}ms ` +
      `gold=${JSON.stringify(normalized)}`,
    );
  }
  console.log(`generated ${entries.length}/${SPECS.slice(0, limit).length} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (failures.length) console.log("failures:", JSON.stringify(failures));
  return { entries, failures };
}

function render(entries) {
  const chapters = CHAPTER_COUNTS.map((count, i) => ({ id: i + 1, count }));
  return `// GENERATED by scripts/generate-robot-levels.mjs - do not hand-edit.
// Every gold line is the shortest winning program inside that level's own
// palette and slot limits, found by the bounded program-space solver.
import { compileLevel } from "./engine.mjs";

export const CHAPTERS = Object.freeze(${JSON.stringify(chapters, null, 2)});

export const LEVELS = Object.freeze(${JSON.stringify(entries, null, 2)});

export const LEVEL_COUNT = LEVELS.length;

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) ?? null;
}

export function buildLevel(entry) {
  return compileLevel(entry.spec);
}

// Code Golf stars: three for the proven optimum, two within +2 lines,
// one for any clear at all.
export function starsFor(entry, lines) {
  if (!Number.isInteger(lines) || lines <= 0) return 0;
  if (lines <= entry.par) return 3;
  if (lines <= entry.par + 2) return 2;
  return 1;
}
`;
}

const dry = process.argv.includes("--dry");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : SPECS.length;
const { entries, failures } = generate(dry, limit);
if (!dry && failures.length === 0 && entries.length === SPECS.length) {
  writeFileSync(OUT, render(entries), "utf8");
  console.log(`wrote ${OUT}`);
} else if (!dry) {
  console.log("refusing to write a partial level set");
  process.exitCode = 1;
}
