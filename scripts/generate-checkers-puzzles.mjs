// generate-checkers-puzzles.mjs - offline authoring tool for games/checkers.
// Usage: node scripts/generate-checkers-puzzles.mjs [--dry]
// Builds a jump ladder, adds noise bridges, then keeps a layout only when an
// exhaustive depth-3 search finds exactly one first-contact line to the goal.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HOLE_COUNT, JUMPS, RED, BLUE, EMPTY, RED_HOME, BLUE_HOME,
} from "../games/checkers/js/engine.mjs";
import { solveBoard } from "../games/checkers/js/solver.mjs";

const CENTER = 61; // holes 0..60 form the central hexagon
const HOME = new Set([...RED_HOME, ...BLUE_HOME]);

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

const rng = mulberry32(0x5eedc0de);
const int = (n) => Math.floor(rng() * n);
const pick = (arr) => arr[int(arr.length)];

function shuffled(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = int(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A ladder is a chain of `hops` jumps. Every middle hole gets a blue bridge;
// landing holes stay empty. board[start] is the red marble to fly.
function makeLadder(hops) {
  const start = int(CENTER);
  const board = Array(HOLE_COUNT).fill(EMPTY);
  board[start] = RED;
  const landings = [start];
  const mids = [];
  const used = new Set([start]);
  let cur = start;

  for (let i = 0; i < hops; i += 1) {
    const options = JUMPS[cur].filter(({ mid, to }) => (
      mid < CENTER && to < CENTER && !used.has(mid) && !used.has(to)
    ));
    if (!options.length) return null;
    const { mid, to } = pick(options);
    board[mid] = BLUE;
    mids.push(mid);
    landings.push(to);
    used.add(mid);
    used.add(to);
    cur = to;
  }
  return { board, start, goal: cur, landings, mids };
}

function freeCenterHoles(board, excluded = new Set()) {
  const out = [];
  for (let h = 0; h < CENTER; h += 1) {
    if (board[h] === EMPTY && !HOME.has(h) && !excluded.has(h)) out.push(h);
  }
  return out;
}

function addNoise(board, count, excluded) {
  const free = shuffled(freeCenterHoles(board, excluded));
  for (let i = 0; i < Math.min(count, free.length); i += 1) board[free[i]] = BLUE;
}

// Find a legal one-jump landing into `gap` from an empty hole, using an
// already occupied hole as the bridge. Returns {from, via} or null.
function findGapFiller(board, gap, excluded) {
  for (let from = 0; from < CENTER; from += 1) {
    if (board[from] !== EMPTY || excluded.has(from)) continue;
    for (const { mid, to } of JUMPS[from]) {
      if (to === gap && board[mid] !== EMPTY && mid !== from) return { from, via: mid };
    }
  }
  return null;
}

function entriesOf(board) {
  const out = [];
  for (let h = 0; h < HOLE_COUNT; h += 1) if (board[h] !== EMPTY) out.push([h, board[h]]);
  return out;
}

function evaluate(board, goal, maxDepth = 3) {
  return solveBoard(board, goal, maxDepth, { maxNodes: 250000, maxSolutions: 5 });
}

function makeOneStep(hops, noise) {
  const ladder = makeLadder(hops);
  if (!ladder) return null;
  const { board, start, goal, landings, mids } = ladder;
  const protectedHoles = new Set([...landings, ...mids, goal, start]);
  addNoise(board, noise, protectedHoles);
  const report = evaluate(board, goal, 3);
  if (report.aborted || report.count !== 1 || report.shortest !== 1) return null;
  if (report.hops < 2 || report.hops < hops) return null;
  return {
    board: entriesOf(board),
    goal,
    par: 1,
    hops: report.hops,
    solution: report.solutions[0],
  };
}

// Cut one bridge out of the ladder and add a second red marble that can
// restore it in a single jump. The only line is then [fill, fly].
function makeTwoStep(hops, noise) {
  const ladder = makeLadder(hops);
  if (!ladder) return null;
  const { board, start, goal, landings, mids } = ladder;
  if (mids.length < 2) return null;
  const protectedHoles = new Set([...landings, ...mids, goal, start]);
  addNoise(board, noise, protectedHoles);

  const gap = pick(mids.slice(1)); // never cut the very first bridge
  board[gap] = EMPTY;
  const filler = findGapFiller(board, gap, new Set([start, goal, ...landings]));
  if (!filler) return null;
  board[filler.from] = RED;

  const report = evaluate(board, goal, 3);
  if (report.aborted || report.count !== 1 || report.shortest !== 2) return null;
  if (report.hops < 3) return null;
  return {
    board: entriesOf(board),
    goal,
    par: 2,
    hops: report.hops,
    solution: report.solutions[0],
  };
}

const PLAN = [
  { chapter: 1, count: 5, build: () => makeOneStep(2 + int(2), int(4)) },
  { chapter: 2, count: 5, build: () => makeOneStep(4 + int(2), 2 + int(5)) },
  { chapter: 3, count: 5, build: () => makeOneStep(6 + int(3), 1 + int(4)) },
  { chapter: 4, count: 5, build: () => makeTwoStep(5 + int(4), 1 + int(4)) },
];

function generate(maxAttempts) {
  const levels = [];
  let id = 0;
  const stats = { one: 0, two: 0, tries: 0 };
  for (const group of PLAN) {
    const seen = new Set();
    let found = 0;
    for (let attempt = 0; attempt < maxAttempts && found < group.count; attempt += 1) {
      stats.tries += 1;
      const level = group.build();
      if (!level) continue;
      const key = `${level.goal}:${level.par}:${JSON.stringify(level.board)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      level.id = ++id;
      level.chapter = group.chapter;
      levels.push(level);
      found += 1;
      stats[level.par === 1 ? "one" : "two"] += 1;
    }
    console.log(`chapter ${group.chapter}: ${found}/${group.count} after ${stats.tries} tries`);
  }
  return { levels, stats };
}

function render(levels) {
  const rows = levels.map((l) => (
    `  { id: ${l.id}, chapter: ${l.chapter}, par: ${l.par}, goal: ${l.goal}, hops: ${l.hops},\n`
    + `    board: ${JSON.stringify(l.board)},\n`
    + `    solution: ${JSON.stringify(l.solution)} },`
  ));
  return `// puzzles.mjs - 20 solver-verified chain-hop studies.
// GENERATED by scripts/generate-checkers-puzzles.mjs - do not hand-edit.
// Each layout has exactly one first-contact line to the goal within par.
import { HOLE_COUNT, EMPTY, RED, BLUE } from "./engine.mjs";

export const PUZZLE_COUNT = ${levels.length};

export const CHAPTERS = Object.freeze([
  Object.freeze({ id: 1, from: 1, to: 5 }),
  Object.freeze({ id: 2, from: 6, to: 10 }),
  Object.freeze({ id: 3, from: 11, to: 15 }),
  Object.freeze({ id: 4, from: 16, to: 20 }),
]);

export const PUZZLES = Object.freeze([
${rows.join("\n")}
]);

export function getPuzzle(id) {
  return PUZZLES.find((level) => level.id === id) ?? null;
}

export function puzzleBoard(level) {
  const board = Array(HOLE_COUNT).fill(EMPTY);
  if (!level) return board;
  for (const [hole, player] of level.board) {
    if (Number.isInteger(hole) && hole >= 0 && hole < HOLE_COUNT
      && (player === RED || player === BLUE)) board[hole] = player;
  }
  return board;
}
`;
}

const dry = process.argv.includes("--dry");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const maxAttempts = limitArg ? Number(limitArg.slice(8)) : 60000;
const started = Date.now();
const { levels, stats } = generate(maxAttempts);
console.log(`generated ${levels.length} levels in ${((Date.now() - started) / 1000).toFixed(1)}s`, stats);
for (const l of levels) {
  console.log(`  #${String(l.id).padStart(2)} ch${l.chapter} par${l.par} hops${l.hops} goal${l.goal} marbles${l.board.length}`);
}
if (!dry) {
  const target = resolve(import.meta.dirname, "../games/checkers/js/puzzles.mjs");
  writeFileSync(target, render(levels), "utf8");
  console.log(`wrote ${target}`);
}
