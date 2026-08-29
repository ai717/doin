import type { Difficulty, HintStep, TechniqueId, UnitKind } from "./types.ts";
import { RANK_TO_DIFFICULTY, TECHNIQUE_RANK } from "./types.ts";
import {
  SIZE,
  bitOf,
  popcount,
  onlyDigit,
  digitsOf,
  ROWS,
  COLS,
  BOXES,
  UNITS,
  PEERS,
  rowOf,
  colOf,
  boxOf,
  unitLabel,
  candidatesFromBoard,
} from "./grid.ts";
import { t } from "../i18n/core.ts";

function cloneCands(c: Uint16Array): Uint16Array {
  return new Uint16Array(c);
}

function unitKind(unitIndex: number): { kind: UnitKind; index: number } {
  if (unitIndex < 9) return { kind: "row", index: unitIndex };
  if (unitIndex < 18) return { kind: "col", index: unitIndex - 9 };
  return { kind: "box", index: unitIndex - 18 };
}

function place(
  cands: Uint16Array,
  cell: number,
  digit: number,
  technique: TechniqueId,
  extra: Partial<HintStep> = {},
): HintStep {
  const bit = bitOf(digit);
  cands[cell] = bit;
  for (const p of PEERS[cell]!) cands[p] = (cands[p]! & ~bit) as number;
  return {
    technique,
    message: extra.message ?? "",
    units: extra.units ?? [],
    cells: extra.cells ?? [cell],
    focusCell: cell,
    digit,
    placements: [{ cell, digit }],
  };
}

function tryNakedSingle(cands: Uint16Array): HintStep | null {
  for (let i = 0; i < SIZE; i++) {
    if (popcount(cands[i]!) === 1) {
      // already placed if peers don't have it — skip filled
      const d = onlyDigit(cands[i]!);
      const bit = bitOf(d);
      const needs = PEERS[i]!.some((p) => (cands[p]! & bit) !== 0);
      if (!needs && popcount(cands[i]!) === 1) {
        // treat as unfilled if any peer still has candidates implying this isn't propagated
        // A cell is "unfilled" for rating if we consider popcount==1 as a placement to apply
        // We need to distinguish already-applied singles. If all peers already eliminated, skip.
        continue;
      }
      if (needs) {
        return place(cands, i, d, "naked-single", {
          message: t("hint.nakedSingle", { d }),
          units: [{ kind: "row", index: rowOf(i) }],
        });
      }
    }
  }
  // First visit: cells with 1 candidate that we haven't "locked" — after init, givens have 1 cand and peers already cleared.
  // Remaining popcount==1 cells are naked singles to place (needs should be true if init didn't assign).
  for (let i = 0; i < SIZE; i++) {
    if (popcount(cands[i]!) === 1) {
      const d = onlyDigit(cands[i]!);
      const bit = bitOf(d);
      if (PEERS[i]!.some((p) => cands[p]! & bit)) {
        return place(cands, i, d, "naked-single", {
          message: t("hint.nakedSingle", { d }),
          units: [{ kind: "row", index: rowOf(i) }],
        });
      }
    }
  }
  return null;
}

function tryHiddenSingle(cands: Uint16Array): HintStep | null {
  for (let u = 0; u < UNITS.length; u++) {
    const unit = UNITS[u]!;
    const { kind, index } = unitKind(u);
    for (let d = 1; d <= 9; d++) {
      const bit = bitOf(d);
      const places: number[] = [];
      for (const i of unit) if (cands[i]! & bit) places.push(i);
      if (places.length === 1) {
        const cell = places[0]!;
        if (popcount(cands[cell]!) > 1) {
          return place(cands, cell, d, "hidden-single", {
            message: t("hint.hiddenSingle", { unit: unitLabel(kind, index), d }),
            units: [{ kind, index }],
            cells: [cell],
          });
        }
      }
    }
  }
  return null;
}

function tryNakedSubset(cands: Uint16Array, size: 2 | 3): HintStep | null {
  const tech: TechniqueId = size === 2 ? "naked-pair" : "naked-triple";
  for (let u = 0; u < UNITS.length; u++) {
    const unit = UNITS[u]!;
    const { kind, index } = unitKind(u);
    const cells = unit.filter((i) => {
      const n = popcount(cands[i]!);
      return n >= 2 && n <= size;
    });
    const n = cells.length;
    if (n < size) continue;
    const pick = (start: number, chosen: number[]): HintStep | null => {
      if (chosen.length === size) {
        let mask = 0;
        for (const idx of chosen) mask |= cands[cells[idx]!]!;
        if (popcount(mask) !== size) return null;
        const chosenCells = chosen.map((idx) => cells[idx]!);
        const ds = digitsOf(mask);
        const elims: number[] = [];
        for (const i of unit) {
          if (chosenCells.includes(i)) continue;
          if (cands[i]! & mask) {
            cands[i] = (cands[i]! & ~mask) as number;
            elims.push(i);
          }
        }
        if (elims.length === 0) return null;
        const [a, b, c] = ds;
        const msg =
          size === 2
            ? t("hint.nakedPair", {
                a: a!,
                b: b!,
                house: t(`unit.house.${kind}`),
              })
            : t("hint.nakedTriple", { a: a!, b: b!, c: c! });
        return {
          technique: tech,
          message: msg,
          units: [{ kind, index }],
          cells: chosenCells,
          focusCell: elims[0] ?? chosenCells[0]!,
          digit: a!,
          placements: [],
        } satisfies HintStep;
      }
      for (let i = start; i < n; i++) {
        const r = pick(i + 1, [...chosen, i]);
        if (r) return r;
      }
      return null;
    };
    const step = pick(0, []);
    if (step) return step;
  }
  return null;
}

function tryHiddenSubset(cands: Uint16Array, size: 2 | 3): HintStep | null {
  const tech: TechniqueId = size === 2 ? "hidden-pair" : "hidden-triple";
  for (let u = 0; u < UNITS.length; u++) {
    const unit = UNITS[u]!;
    const { kind, index } = unitKind(u);
    const digitPlaces: number[][] = Array.from({ length: 10 }, () => []);
    for (let d = 1; d <= 9; d++) {
      const bit = bitOf(d);
      for (const i of unit) if (cands[i]! & bit) digitPlaces[d]!.push(i);
    }
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => {
      const p = digitPlaces[d]!.length;
      return p >= 1 && p <= size;
    });
    const n = digits.length;
    if (n < size) continue;
    const pick = (start: number, chosen: number[]): HintStep | null => {
      if (chosen.length === size) {
        const ds = chosen.map((i) => digits[i]!);
        const set = new Set<number>();
        for (const d of ds) for (const c of digitPlaces[d]!) set.add(c);
        if (set.size !== size) return null;
        const cells = [...set];
        let mask = 0;
        for (const d of ds) mask |= bitOf(d);
        let changed = false;
        for (const i of cells) {
          const next = cands[i]! & mask;
          if (next !== cands[i]!) {
            cands[i] = next;
            changed = true;
          }
        }
        if (!changed) return null;
        const [a, b, c] = ds;
        const msg =
          size === 2
            ? t("hint.hiddenPair", { unit: unitLabel(kind, index), a: a!, b: b! })
            : t("hint.hiddenTriple", {
                unit: unitLabel(kind, index),
                a: a!,
                b: b!,
                c: c!,
              });
        return {
          technique: tech,
          message: msg,
          units: [{ kind, index }],
          cells,
          focusCell: cells[0]!,
          digit: a!,
          placements: [],
        };
      }
      for (let i = start; i < n; i++) {
        const r = pick(i + 1, [...chosen, i]);
        if (r) return r;
      }
      return null;
    };
    const step = pick(0, []);
    if (step) return step;
  }
  return null;
}

function tryPointing(cands: Uint16Array): HintStep | null {
  for (let b = 0; b < 9; b++) {
    const box = BOXES[b]!;
    for (let d = 1; d <= 9; d++) {
      const bit = bitOf(d);
      const places = box.filter((i) => cands[i]! & bit);
      if (places.length < 2) continue;
      const rows = new Set(places.map(rowOf));
      const cols = new Set(places.map(colOf));
      if (rows.size === 1) {
        const r = [...rows][0]!;
        const elims: number[] = [];
        for (const i of ROWS[r]!) {
          if (boxOf(i) === b) continue;
          if (cands[i]! & bit) {
            cands[i] = (cands[i]! & ~bit) as number;
            elims.push(i);
          }
        }
        if (elims.length) {
          return {
            technique: "pointing",
            message: t("hint.pointingRow", { d }),
            units: [
              { kind: "box", index: b },
              { kind: "row", index: r },
            ],
            cells: [...places, ...elims],
            focusCell: elims[0]!,
            digit: d,
            placements: [],
          };
        }
      }
      if (cols.size === 1) {
        const c = [...cols][0]!;
        const elims: number[] = [];
        for (const i of COLS[c]!) {
          if (boxOf(i) === b) continue;
          if (cands[i]! & bit) {
            cands[i] = (cands[i]! & ~bit) as number;
            elims.push(i);
          }
        }
        if (elims.length) {
          return {
            technique: "pointing",
            message: t("hint.pointingCol", { d }),
            units: [
              { kind: "box", index: b },
              { kind: "col", index: c },
            ],
            cells: [...places, ...elims],
            focusCell: elims[0]!,
            digit: d,
            placements: [],
          };
        }
      }
    }
  }
  // claiming: line → box
  for (let r = 0; r < 9; r++) {
    for (let d = 1; d <= 9; d++) {
      const bit = bitOf(d);
      const places = ROWS[r]!.filter((i) => cands[i]! & bit);
      const boxes = new Set(places.map(boxOf));
      if (places.length >= 2 && boxes.size === 1) {
        const b = [...boxes][0]!;
        const elims: number[] = [];
        for (const i of BOXES[b]!) {
          if (rowOf(i) === r) continue;
          if (cands[i]! & bit) {
            cands[i] = (cands[i]! & ~bit) as number;
            elims.push(i);
          }
        }
        if (elims.length) {
          return {
            technique: "pointing",
            message: t("hint.boxLineRow", { d, n: r + 1 }),
            units: [
              { kind: "row", index: r },
              { kind: "box", index: b },
            ],
            cells: [...places, ...elims],
            focusCell: elims[0]!,
            digit: d,
            placements: [],
          };
        }
      }
    }
  }
  for (let c = 0; c < 9; c++) {
    for (let d = 1; d <= 9; d++) {
      const bit = bitOf(d);
      const places = COLS[c]!.filter((i) => cands[i]! & bit);
      const boxes = new Set(places.map(boxOf));
      if (places.length >= 2 && boxes.size === 1) {
        const b = [...boxes][0]!;
        const elims: number[] = [];
        for (const i of BOXES[b]!) {
          if (colOf(i) === c) continue;
          if (cands[i]! & bit) {
            cands[i] = (cands[i]! & ~bit) as number;
            elims.push(i);
          }
        }
        if (elims.length) {
          return {
            technique: "pointing",
            message: t("hint.boxLineCol", { d, n: c + 1 }),
            units: [
              { kind: "col", index: c },
              { kind: "box", index: b },
            ],
            cells: [...places, ...elims],
            focusCell: elims[0]!,
            digit: d,
            placements: [],
          };
        }
      }
    }
  }
  return null;
}

function tryXWing(cands: Uint16Array): HintStep | null {
  for (let d = 1; d <= 9; d++) {
    const bit = bitOf(d);
    const rowCols: number[][] = [];
    for (let r = 0; r < 9; r++) {
      rowCols.push(ROWS[r]!.filter((i) => cands[i]! & bit).map(colOf));
    }
    for (let r1 = 0; r1 < 8; r1++) {
      if (rowCols[r1]!.length !== 2) continue;
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        if (
          rowCols[r2]!.length === 2 &&
          rowCols[r1]![0] === rowCols[r2]![0] &&
          rowCols[r1]![1] === rowCols[r2]![1]
        ) {
          const [c1, c2] = rowCols[r1]!;
          const elims: number[] = [];
          for (let r = 0; r < 9; r++) {
            if (r === r1 || r === r2) continue;
            for (const c of [c1!, c2!]) {
              const i = r * 9 + c;
              if (cands[i]! & bit) {
                cands[i] = (cands[i]! & ~bit) as number;
                elims.push(i);
              }
            }
          }
          if (elims.length) {
            const corners = [r1 * 9 + c1!, r1 * 9 + c2!, r2 * 9 + c1!, r2 * 9 + c2!];
            return {
              technique: "x-wing",
              message: t("hint.xwingRow", {
                d,
                r1: r1 + 1,
                r2: r2 + 1,
                c1: c1! + 1,
                c2: c2! + 1,
              }),
              units: [
                { kind: "row", index: r1 },
                { kind: "row", index: r2 },
              ],
              cells: [...corners, ...elims],
              focusCell: elims[0]!,
              digit: d,
              placements: [],
            };
          }
        }
      }
    }
    const colRows: number[][] = [];
    for (let c = 0; c < 9; c++) {
      colRows.push(COLS[c]!.filter((i) => cands[i]! & bit).map(rowOf));
    }
    for (let c1 = 0; c1 < 8; c1++) {
      if (colRows[c1]!.length !== 2) continue;
      for (let c2 = c1 + 1; c2 < 9; c2++) {
        if (
          colRows[c2]!.length === 2 &&
          colRows[c1]![0] === colRows[c2]![0] &&
          colRows[c1]![1] === colRows[c2]![1]
        ) {
          const [r1, r2] = colRows[c1]!;
          const elims: number[] = [];
          for (let c = 0; c < 9; c++) {
            if (c === c1 || c === c2) continue;
            for (const r of [r1!, r2!]) {
              const i = r * 9 + c;
              if (cands[i]! & bit) {
                cands[i] = (cands[i]! & ~bit) as number;
                elims.push(i);
              }
            }
          }
          if (elims.length) {
            const corners = [r1! * 9 + c1, r1! * 9 + c2, r2! * 9 + c1, r2! * 9 + c2];
            return {
              technique: "x-wing",
              message: t("hint.xwingCol", {
                d,
                c1: c1 + 1,
                c2: c2 + 1,
                r1: r1! + 1,
                r2: r2! + 1,
              }),
              units: [
                { kind: "col", index: c1 },
                { kind: "col", index: c2 },
              ],
              cells: [...corners, ...elims],
              focusCell: elims[0]!,
              digit: d,
              placements: [],
            };
          }
        }
      }
    }
  }
  return null;
}

function trySwordfish(cands: Uint16Array): HintStep | null {
  for (let d = 1; d <= 9; d++) {
    const bit = bitOf(d);
    const rowCols: number[][] = [];
    for (let r = 0; r < 9; r++) {
      const cols = ROWS[r]!.filter((i) => cands[i]! & bit).map(colOf);
      rowCols.push(cols.length >= 2 && cols.length <= 3 ? cols : []);
    }
    for (let r1 = 0; r1 < 7; r1++) {
      if (!rowCols[r1]!.length) continue;
      for (let r2 = r1 + 1; r2 < 8; r2++) {
        if (!rowCols[r2]!.length) continue;
        for (let r3 = r2 + 1; r3 < 9; r3++) {
          if (!rowCols[r3]!.length) continue;
          const union = new Set([
            ...rowCols[r1]!,
            ...rowCols[r2]!,
            ...rowCols[r3]!,
          ]);
          if (union.size !== 3) continue;
          const cols = [...union];
          const elims: number[] = [];
          for (let r = 0; r < 9; r++) {
            if (r === r1 || r === r2 || r === r3) continue;
            for (const c of cols) {
              const i = r * 9 + c;
              if (cands[i]! & bit) {
                cands[i] = (cands[i]! & ~bit) as number;
                elims.push(i);
              }
            }
          }
          if (elims.length) {
            return {
              technique: "swordfish",
              message: t("hint.swordfish", {
                d,
                r1: r1 + 1,
                r2: r2 + 1,
                r3: r3 + 1,
              }),
              units: [
                { kind: "row", index: r1 },
                { kind: "row", index: r2 },
                { kind: "row", index: r3 },
              ],
              cells: elims,
              focusCell: elims[0]!,
              digit: d,
              placements: [],
            };
          }
        }
      }
    }
  }
  return null;
}

function sees(a: number, b: number): boolean {
  return PEERS[a]!.includes(b);
}

function tryXYWing(cands: Uint16Array): HintStep | null {
  const bivalue: number[] = [];
  for (let i = 0; i < SIZE; i++) if (popcount(cands[i]!) === 2) bivalue.push(i);
  for (const pivot of bivalue) {
    const [x, y] = digitsOf(cands[pivot]!);
    const pincers = bivalue.filter((j) => j !== pivot && sees(pivot, j));
    for (let a = 0; a < pincers.length; a++) {
      for (let b = a + 1; b < pincers.length; b++) {
        const p1 = pincers[a]!;
        const p2 = pincers[b]!;
        if (p1 === p2 || sees(p1, p2) === false && true) {
          const m1 = cands[p1]!;
          const m2 = cands[p2]!;
          const hasX1 = m1 & bitOf(x!);
          const hasY1 = m1 & bitOf(y!);
          const hasX2 = m2 & bitOf(x!);
          const hasY2 = m2 & bitOf(y!);
          let z: number | null = null;
          if (hasX1 && !hasY1 && hasY2 && !hasX2) {
            const extra1 = digitsOf(m1).find((d) => d !== x);
            const extra2 = digitsOf(m2).find((d) => d !== y);
            if (extra1 && extra1 === extra2) z = extra1;
          } else if (hasY1 && !hasX1 && hasX2 && !hasY2) {
            const extra1 = digitsOf(m1).find((d) => d !== y);
            const extra2 = digitsOf(m2).find((d) => d !== x);
            if (extra1 && extra1 === extra2) z = extra1;
          }
          if (!z) continue;
          const bit = bitOf(z);
          const elims: number[] = [];
          for (let i = 0; i < SIZE; i++) {
            if (i === pivot || i === p1 || i === p2) continue;
            if (sees(i, p1) && sees(i, p2) && cands[i]! & bit) {
              cands[i] = (cands[i]! & ~bit) as number;
              elims.push(i);
            }
          }
          if (elims.length) {
            return {
              technique: "xy-wing",
              message: t("hint.xywing", { z }),
              units: [{ kind: "row", index: rowOf(pivot) }],
              cells: [pivot, p1, p2, ...elims],
              focusCell: elims[0]!,
              digit: z,
              placements: [],
            };
          }
        }
      }
    }
  }
  return null;
}

const PIPELINE: ((c: Uint16Array) => HintStep | null)[] = [
  tryNakedSingle,
  tryHiddenSingle,
  (c) => tryNakedSubset(c, 2),
  (c) => tryHiddenSubset(c, 2),
  tryPointing,
  (c) => tryNakedSubset(c, 3),
  (c) => tryHiddenSubset(c, 3),
  tryXWing,
  tryXYWing,
  trySwordfish,
];

export function nextTechnique(cands: Uint16Array): HintStep | null {
  for (const fn of PIPELINE) {
    const before = cloneCands(cands);
    const step = fn(cands);
    if (step) return step;
    cands.set(before);
  }
  return null;
}

export function applyStep(cands: Uint16Array, step: HintStep): void {
  for (const { cell, digit } of step.placements) {
    const bit = bitOf(digit);
    cands[cell] = bit;
    for (const p of PEERS[cell]!) cands[p] = (cands[p]! & ~bit) as number;
  }
}

function isSolved(cands: Uint16Array): boolean {
  for (let i = 0; i < SIZE; i++) if (popcount(cands[i]!) !== 1) return false;
  return true;
}

export function ratePuzzle(givens: number[]): Difficulty | "invalid" {
  const cands = candidatesFromBoard(givens);
  let maxRank = 0;
  let guard = 0;
  while (!isSolved(cands) && guard++ < 200) {
    const step = nextTechnique(cands);
    if (!step) return "invalid";
    maxRank = Math.max(maxRank, TECHNIQUE_RANK[step.technique]);
  }
  if (!isSolved(cands)) return "invalid";
  return RANK_TO_DIFFICULTY[maxRank] ?? "expert";
}

export { cloneCands };
