import type { Difficulty, Puzzle } from "./types.ts";
import { rngFromSeed, shuffle } from "./rng.ts";
import { SIZE, emptyBoard, cloneBoard } from "./grid.ts";
import { hasUniqueSolution, solve } from "./solver.ts";
import { ratePuzzle } from "./techniques.ts";

const GIVEN_BAND: Record<Difficulty, [number, number]> = {
  intro: [42, 48],
  easy: [34, 40],
  medium: [28, 34],
  hard: [24, 30],
  expert: [21, 26],
};

const ATTEMPT_BUDGET_MS: Record<Difficulty, number> = {
  intro: 350,
  easy: 500,
  medium: 900,
  hard: 1400,
  expert: 1600,
};

function pattern(r: number, c: number): number {
  return (3 * (r % 3) + ((r / 3) | 0) + c) % 9;
}

function completeGrid(rng: () => number): number[] {
  const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const rowBands = shuffle([0, 1, 2], rng);
  const rows: number[] = [];
  for (const b of rowBands) {
    for (const i of shuffle([0, 1, 2], rng)) rows.push(b * 3 + i);
  }
  const colStacks = shuffle([0, 1, 2], rng);
  const cols: number[] = [];
  for (const s of colStacks) {
    for (const i of shuffle([0, 1, 2], rng)) cols.push(s * 3 + i);
  }
  const board = emptyBoard();
  const transpose = rng() < 0.5;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const v = digits[pattern(r, c)]!;
      const rr = rows[r]!;
      const cc = cols[c]!;
      if (transpose) board[cc * 9 + rr] = v;
      else board[rr * 9 + cc] = v;
    }
  }
  return board;
}

function givenCount(board: number[]): number {
  let n = 0;
  for (let i = 0; i < SIZE; i++) if (board[i]) n += 1;
  return n;
}

/** Remove cells until `target` givens remain, keeping uniqueness. */
function carve(full: number[], target: number, rng: () => number): number[] {
  const board = cloneBoard(full);
  const order = shuffle(
    Array.from({ length: SIZE }, (_, i) => i),
    rng,
  );
  let left = SIZE;
  for (const i of order) {
    if (left <= target) break;
    const saved = board[i]!;
    board[i] = 0;
    if (hasUniqueSolution(board)) left -= 1;
    else board[i] = saved;
  }
  return board;
}

function addBack(board: number[], full: number[], add: number, rng: () => number): void {
  const holes = shuffle(
    Array.from({ length: SIZE }, (_, i) => i).filter((i) => board[i] === 0),
    rng,
  );
  for (let k = 0; k < add && k < holes.length; k++) {
    const i = holes[k]!;
    board[i] = full[i]!;
  }
}

function rankOf(d: Difficulty): number {
  return { intro: 0, easy: 1, medium: 2, hard: 3, expert: 4 }[d];
}

function pack(seed: string, difficulty: Difficulty, board: number[], full: number[]): Puzzle {
  const solution = solve(board) ?? full;
  return { seed, difficulty, givens: board, solution };
}

export function generatePuzzle(difficulty: Difficulty, seed: string): Puzzle {
  const rng = rngFromSeed(`${seed}:${difficulty}`);
  const [minG, maxG] = GIVEN_BAND[difficulty];
  const budget = ATTEMPT_BUDGET_MS[difficulty];
  const t0 = Date.now();
  let best: { board: number[]; full: number[]; rating: Difficulty } | null = null;

  let attempt = 0;
  while (Date.now() - t0 < budget && attempt < 20) {
    attempt += 1;
    const full = completeGrid(rng);
    const target = minG + Math.floor(rng() * (maxG - minG + 1));
    const board = carve(full, target, rng);
    const count = givenCount(board);
    if (count < minG - 2) continue;

    let rating = ratePuzzle(board);
    let guard = 0;
    while (
      rating !== "invalid" &&
      rankOf(rating) > rankOf(difficulty) &&
      givenCount(board) < maxG &&
      guard++ < 8
    ) {
      addBack(board, full, 2, rng);
      rating = ratePuzzle(board);
    }

    if (rating === difficulty) {
      return pack(seed, difficulty, board, full);
    }
    if (rating !== "invalid" && rankOf(rating) <= rankOf(difficulty)) {
      if (!best || rankOf(rating) > rankOf(best.rating)) {
        best = { board, full, rating };
      }
      // intro/easy: a same-or-easier unique puzzle is good enough
      if (difficulty === "intro" || difficulty === "easy") {
        return pack(seed, difficulty, board, full);
      }
    }
  }

  if (best) return pack(seed, difficulty, best.board, best.full);

  const full = completeGrid(rng);
  const board = carve(full, minG, rng);
  if (hasUniqueSolution(board)) return pack(seed, difficulty, board, full);
  return pack(seed, difficulty, full, full);
}

export function randomSeed(): string {
  const a = new Uint32Array(2);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(a);
  } else {
    a[0] = Math.floor(Math.random() * 0xffffffff);
    a[1] = Math.floor(Math.random() * 0xffffffff);
  }
  return `${a[0]!.toString(16)}-${a[1]!.toString(16)}`;
}
