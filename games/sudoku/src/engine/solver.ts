import {
  SIZE,
  FULL,
  bitOf,
  popcount,
  onlyDigit,
  PEERS,
  UNITS_OF,
  emptyBoard,
} from "./grid.ts";

function cloneCands(c: Uint16Array): Uint16Array {
  return new Uint16Array(c);
}

/** Eliminate digit d from cell i. Constraint propagation (Norvig). */
function eliminate(cands: Uint16Array, i: number, d: number): boolean {
  const bit = bitOf(d);
  if (!(cands[i]! & bit)) return true;
  cands[i] = (cands[i]! & ~bit) as number;
  if (cands[i] === 0) return false;
  if (popcount(cands[i]!) === 1) {
    const v = onlyDigit(cands[i]!);
    for (const p of PEERS[i]!) {
      if (!eliminate(cands, p, v)) return false;
    }
  }
  for (const unit of UNITS_OF[i]!) {
    const places: number[] = [];
    for (const j of unit) if (cands[j]! & bit) places.push(j);
    if (places.length === 0) return false;
    if (places.length === 1) {
      if (!assign(cands, places[0]!, d)) return false;
    }
  }
  return true;
}

function assign(cands: Uint16Array, i: number, d: number): boolean {
  const bit = bitOf(d);
  if (!(cands[i]! & bit)) return false;
  const toClear = cands[i]! & ~bit;
  for (let k = 1; k <= 9; k++) {
    if (toClear & bitOf(k)) {
      if (!eliminate(cands, i, k)) return false;
    }
  }
  return true;
}

export function candsFromGivens(givens: number[]): Uint16Array | null {
  const cands = new Uint16Array(SIZE);
  cands.fill(FULL);
  for (let i = 0; i < SIZE; i++) {
    const v = givens[i]!;
    if (v && !assign(cands, i, v)) return null;
  }
  return cands;
}

function search(cands: Uint16Array, limit: number, acc: { n: number; sol?: number[] }): void {
  if (acc.n >= limit) return;
  let best = -1;
  let bestCount = 10;
  for (let i = 0; i < SIZE; i++) {
    const c = popcount(cands[i]!);
    if (c === 0) return;
    if (c > 1 && c < bestCount) {
      bestCount = c;
      best = i;
      if (c === 2) break;
    }
  }
  if (best === -1) {
    acc.n += 1;
    if (!acc.sol) {
      const sol = emptyBoard();
      for (let i = 0; i < SIZE; i++) sol[i] = onlyDigit(cands[i]!);
      acc.sol = sol;
    }
    return;
  }
  const mask = cands[best]!;
  for (let d = 1; d <= 9; d++) {
    if (!(mask & bitOf(d))) continue;
    const next = cloneCands(cands);
    if (assign(next, best, d)) search(next, limit, acc);
    if (acc.n >= limit) return;
  }
}

export function countSolutions(givens: number[], limit = 2): number {
  const cands = candsFromGivens(givens);
  if (!cands) return 0;
  const acc = { n: 0 };
  search(cands, limit, acc);
  return acc.n;
}

export function solve(givens: number[]): number[] | null {
  const cands = candsFromGivens(givens);
  if (!cands) return null;
  const acc: { n: number; sol?: number[] } = { n: 0 };
  search(cands, 1, acc);
  return acc.sol ?? null;
}

export function hasUniqueSolution(givens: number[]): boolean {
  return countSolutions(givens, 2) === 1;
}
