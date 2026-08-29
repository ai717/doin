import { conflictCells, rowOf, colOf, boxOf } from "@/engine/grid";
import type { Cell } from "@/game/types";
import type { Hint } from "@/engine/types";
import { NotePad, useCellNotePad } from "@/components/note-pad";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { useEffect, useRef } from "react";

interface Props {
  board: Cell[];
  selected: number | null;
  hint: Hint | null;
  autoCheck: boolean;
  highlightSame: boolean;
  sameDigit?: number | null;
  reveal?: number[] | null;
  onSelect: (i: number) => void;
  onSelectOnly: (i: number) => void;
  onNote: (d: number) => void;
  disabled?: boolean;
}

export function SudokuBoard({
  board,
  selected,
  hint,
  autoCheck,
  highlightSame,
  sameDigit,
  reveal,
  onSelect,
  onSelectOnly,
  onNote,
  disabled,
}: Props) {
  const t = useT();
  const values = board.map((c) => c.value ?? 0);
  const conflicts = autoCheck ? conflictCells(values) : values.map(() => false);
  const sel = selected;
  const selRow = sel != null ? rowOf(sel) : -1;
  const selCol = sel != null ? colOf(sel) : -1;
  const selBox = sel != null ? boxOf(sel) : -1;
  const selVal = sel != null ? board[sel]?.value : null;
  const matchDigit = selVal ?? sameDigit ?? null;
  const frameRef = useRef<HTMLDivElement>(null);
  const padRef = useRef<HTMLDivElement>(null);
  const { pad, closePad, cellHandlers, pickAndClose } = useCellNotePad({
    board,
    disabled: disabled || Boolean(reveal),
    frameRef,
    padRef,
    onSelect,
    onSelectOnly,
    onNote,
  });

  useEffect(() => {
    if (disabled || reveal) closePad();
  }, [disabled, reveal, closePad]);

  const hintUnits = hint
    ? hint.step.units.map((u) => {
        if (u.kind === "row") return { type: "row" as const, i: u.index };
        if (u.kind === "col") return { type: "col" as const, i: u.index };
        return { type: "box" as const, i: u.index };
      })
    : [];
  const hintCells = new Set(hint && hint.level >= 2 ? hint.step.cells : []);
  const hintFocus = hint && hint.level >= 2 ? hint.step.focusCell : null;
  const padCell = pad ? board[pad.cell] : null;

  return (
    <div
      ref={frameRef}
      className="sudoku-board-frame relative touch-none rounded-lg bg-board p-1.5 shadow-[var(--shadow)]"
      role="grid"
      aria-label={t("board.label")}
    >
      <div className="grid h-full w-full grid-cols-9 grid-rows-9 overflow-hidden rounded-sm">
        {board.map((cell, i) => {
          const r = rowOf(i);
          const c = colOf(i);
          const b = boxOf(i);
          const inHouse = sel != null && (r === selRow || c === selCol || b === selBox);
          const shown = reveal && !cell.given ? reveal[i]! : cell.value;
          const revealed = Boolean(reveal && !cell.given);
          const same =
            highlightSame &&
            matchDigit != null &&
            shown === matchDigit &&
            i !== sel &&
            shown != null;
          const sameNote =
            highlightSame &&
            matchDigit != null &&
            !shown &&
            cell.notes.includes(matchDigit);
          const inHintUnit = hintUnits.some((u) => {
            if (u.type === "row") return r === u.i;
            if (u.type === "col") return c === u.i;
            return b === u.i;
          });
          const thickR = c === 2 || c === 5;
          const thickB = r === 2 || r === 5;
          const isConflict = conflicts[i] && !cell.given && !reveal;
          const handlers = cellHandlers(i);
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              aria-selected={sel === i}
              aria-label={t("board.rowCol", {
                row: r + 1,
                col: c + 1,
                state: cell.given
                  ? t("board.given", { d: cell.value ?? "" })
                  : revealed
                    ? t("board.reveal", { d: shown ?? "" })
                    : cell.value
                      ? t("board.filled", { d: cell.value })
                      : cell.notes.length
                        ? t("board.notes", { notes: cell.notes.join(" ") })
                        : t("board.empty"),
              })}
              disabled={disabled}
              onPointerDown={handlers.onPointerDown}
              onContextMenu={handlers.onContextMenu}
              onClick={handlers.onClick}
              className={cn(
                "relative flex items-center justify-center border-line-soft text-center tabular-nums",
                "border-r border-b",
                c === 8 && "border-r-0",
                r === 8 && "border-b-0",
                thickR && "border-r-line border-r-2",
                thickB && "border-b-line border-b-2",
                inHouse && "bg-wash",
                inHintUnit && hint?.level === 1 && "bg-wash",
                same && "bg-same",
                sameNote && "bg-same/50",
                hintCells.has(i) && hint && hint.level >= 2 && "bg-same",
                sel === i && "z-[1] ring-2 ring-inset ring-accent",
                hintFocus === i && "ring-2 ring-inset ring-accent",
                isConflict && "text-conflict underline decoration-conflict decoration-2",
              )}
            >
              {shown ? (
                <span
                  className={cn(
                    "leading-none",
                    cell.given ? "font-bold text-fg" : "font-semibold text-player",
                    revealed && !cell.given && "text-player",
                    isConflict && "text-conflict",
                    "text-[clamp(1.35rem,7.4cqi,2.7rem)]",
                  )}
                >
                  {shown}
                </span>
              ) : cell.notes.length > 0 ? (
                <span className="grid size-full grid-cols-3 grid-rows-3 p-[6%] text-[clamp(0.58rem,2.5cqi,0.9rem)] font-medium leading-none text-note">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span
                      key={n}
                      className={cn(
                        "flex items-center justify-center",
                        highlightSame && matchDigit === n && "font-semibold text-player",
                      )}
                    >
                      {cell.notes.includes(n) ? n : ""}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {pad && padCell && (
        <NotePad
          padRef={padRef}
          notes={padCell.notes}
          hover={pad.hover}
          mode={pad.mode}
          coarse={pad.coarse}
          onPick={pickAndClose}
          style={{
            left: pad.left,
            top: pad.top,
            width: pad.size,
            height: pad.size,
          }}
        />
      )}
    </div>
  );
}