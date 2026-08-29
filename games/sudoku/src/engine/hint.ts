import type { Hint, HintStep } from "./types.ts";
import {
  SIZE,
  candidatesFromBoard,
  hasConflictAt,
  conflictCells,
  rowOf,
  colOf,
  popcount,
  onlyDigit,
} from "./grid.ts";
import { nextTechnique, cloneCands } from "./techniques.ts";
import { t } from "../i18n/core.ts";

function conflictHint(board: number[]): HintStep {
  const flags = conflictCells(board);
  const cells: number[] = [];
  let digit = 0;
  let idx = 0;
  for (let i = 0; i < SIZE; i++) {
    if (flags[i]) {
      cells.push(i);
      digit = board[i]!;
      idx = i;
    }
  }
  const kind = "row" as const;
  return {
    technique: "conflict",
    message: t("hint.conflictRow", { d: digit }),
    units: [{ kind, index: rowOf(idx) }],
    cells,
    focusCell: idx,
    digit,
    placements: [],
  };
}

function wrongCellHint(board: number[], solution: number[]): HintStep | null {
  for (let i = 0; i < SIZE; i++) {
    const v = board[i]!;
    if (v && v !== solution[i]) {
      return {
        technique: "conflict",
        message: t("hint.wrongCell", { row: rowOf(i) + 1, col: colOf(i) + 1 }),
        units: [{ kind: "row", index: rowOf(i) }],
        cells: [i],
        focusCell: i,
        digit: v,
        placements: [],
      };
    }
  }
  return null;
}

export function nextHint(board: number[], solution: number[]): Hint | null {
  if (board.some((_, i) => hasConflictAt(board, i))) {
    return { step: conflictHint(board), level: 1 };
  }
  const wrong = wrongCellHint(board, solution);
  if (wrong) return { step: wrong, level: 1 };

  const cands = candidatesFromBoard(board);
  for (let i = 0; i < SIZE; i++) {
    if (board[i]) continue;
    if (popcount(cands[i]!) === 1) {
      const d = onlyDigit(cands[i]!);
      return {
        step: {
          technique: "naked-single",
          message: t("hint.nakedSingle", { d }),
          units: [{ kind: "row", index: rowOf(i) }],
          cells: [i],
          focusCell: i,
          digit: d,
          placements: [{ cell: i, digit: d }],
        },
        level: 1,
      };
    }
  }

  const working = cloneCands(cands);
  let step = nextTechnique(working);
  // If first step only eliminates, keep going until a placement (for level 3)
  let first = step;
  let guard = 0;
  while (step && step.placements.length === 0 && guard++ < 12) {
    step = nextTechnique(working);
  }
  const placeStep = step && step.placements.length ? step : first;
  if (!placeStep) return null;

  // Prefer describing the first technique, but fill using a later placement
  const described = first ?? placeStep;
  const filled: HintStep = {
    ...described,
    placements:
      placeStep.placements.length > 0 ? placeStep.placements : described.placements,
    focusCell: placeStep.focusCell ?? described.focusCell,
    digit: placeStep.digit ?? described.digit,
    message: described.message || placeStep.message,
  };

  if (!filled.message && filled.digit && filled.focusCell != null) {
    filled.message = t("hint.nakedSingle", { d: filled.digit });
    filled.units = [{ kind: "row", index: rowOf(filled.focusCell) }];
  }

  if (!filled.units.length && filled.focusCell != null) {
    filled.units = [{ kind: "row", index: rowOf(filled.focusCell) }];
  }

  return { step: filled, level: 1 };
}

export function promoteHint(hint: Hint): Hint {
  if (hint.level >= 3) return hint;
  return { ...hint, level: (hint.level + 1) as 1 | 2 | 3 };
}
