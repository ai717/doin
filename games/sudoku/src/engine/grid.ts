import { unitLabelI18n } from "../i18n/core.ts";

export const SIZE = 81;
export const FULL = 0x1ff;

export function bitOf(d: number): number {
  return 1 << (d - 1);
}

export function popcount(n: number): number {
  n = n - ((n >> 1) & 0x55555555);
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24;
}

export function onlyDigit(mask: number): number {
  return 31 - Math.clz32(mask & -mask) + 1;
}

export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bitOf(d)) out.push(d);
  return out;
}

export function rowOf(i: number): number {
  return (i / 9) | 0;
}
export function colOf(i: number): number {
  return i % 9;
}
export function boxOf(i: number): number {
  return ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);
}

function buildUnits() {
  const rows: number[][] = Array.from({ length: 9 }, () => []);
  const cols: number[][] = Array.from({ length: 9 }, () => []);
  const boxes: number[][] = Array.from({ length: 9 }, () => []);
  for (let i = 0; i < SIZE; i++) {
    rows[rowOf(i)]!.push(i);
    cols[colOf(i)]!.push(i);
    boxes[boxOf(i)]!.push(i);
  }
  const units = [...rows, ...cols, ...boxes];
  const unitsOf: number[][][] = Array.from({ length: SIZE }, () => []);
  const peers: number[][] = Array.from({ length: SIZE }, () => []);
  for (let i = 0; i < SIZE; i++) {
    const set = new Set<number>();
    const my = [rows[rowOf(i)]!, cols[colOf(i)]!, boxes[boxOf(i)]!];
    unitsOf[i] = my;
    for (const u of my) for (const j of u) if (j !== i) set.add(j);
    peers[i] = [...set];
  }
  return { rows, cols, boxes, units, unitsOf, peers };
}

const BUILT = buildUnits();
export const ROWS = BUILT.rows;
export const COLS = BUILT.cols;
export const BOXES = BUILT.boxes;
export const UNITS = BUILT.units;
export const UNITS_OF = BUILT.unitsOf;
export const PEERS = BUILT.peers;

export function emptyBoard(): number[] {
  return Array.from({ length: SIZE }, () => 0);
}

export function cloneBoard(b: number[]): number[] {
  return b.slice();
}

export function isValidPlacement(board: number[], i: number, d: number): boolean {
  for (const p of PEERS[i]!) if (board[p] === d) return false;
  return true;
}

export function hasConflictAt(board: number[], i: number): boolean {
  const v = board[i]!;
  if (!v) return false;
  for (const p of PEERS[i]!) if (board[p] === v) return true;
  return false;
}

export function conflictCells(board: number[]): boolean[] {
  const out = Array.from({ length: SIZE }, () => false);
  for (let i = 0; i < SIZE; i++) {
    if (hasConflictAt(board, i)) out[i] = true;
  }
  return out;
}

export function isComplete(board: number[]): boolean {
  for (let i = 0; i < SIZE; i++) if (!board[i]) return false;
  for (let i = 0; i < SIZE; i++) if (hasConflictAt(board, i)) return false;
  return true;
}

export function candidatesFromBoard(board: number[]): Uint16Array {
  const cands = new Uint16Array(SIZE);
  cands.fill(FULL);
  for (let i = 0; i < SIZE; i++) {
    const v = board[i]!;
    if (v) {
      cands[i] = bitOf(v);
      const bit = bitOf(v);
      for (const p of PEERS[i]!) cands[p] = (cands[p]! & ~bit) as number;
    }
  }
  for (let i = 0; i < SIZE; i++) {
    if (!board[i] && cands[i] === 0) cands[i] = 0;
  }
  return cands;
}

export function remainingCounts(board: number[]): number[] {
  const counts = [0, 9, 9, 9, 9, 9, 9, 9, 9, 9];
  for (let i = 0; i < SIZE; i++) {
    const v = board[i]!;
    if (v) counts[v]!--;
  }
  return counts;
}

export function unitLabel(kind: "row" | "col" | "box", index: number): string {
  return unitLabelI18n(kind, index);
}
