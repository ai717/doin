import type { Cell } from "@/game/types";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

const SLIDE_MOUSE = 12;
const SLIDE_TOUCH = 28;
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export type PadMode = "slide" | "menu";

export interface PadState {
  cell: number;
  mode: PadMode;
  left: number;
  top: number;
  size: number;
  hover: number | null;
  coarse: boolean;
}

interface Gesture {
  pointerId: number;
  cell: number;
  x: number;
  y: number;
  opened: boolean;
  coarse: boolean;
  target: HTMLElement;
  unbind: () => void;
}

export function isCoarsePointer(e?: { pointerType?: string }): boolean {
  if (typeof window !== "undefined") {
    if (window.matchMedia("(pointer: coarse)").matches) return true;
    if (window.innerWidth < 1024) return true;
  }
  return e?.pointerType === "touch";
}

export function digitAtPoint(rect: DOMRect, x: number, y: number): number | null {
  const px = (x - rect.left) / rect.width;
  const py = (y - rect.top) / rect.height;
  if (px < 0 || px > 1 || py < 0 || py > 1) return null;
  const col = Math.min(2, Math.max(0, Math.floor(px * 3)));
  const row = Math.min(2, Math.max(0, Math.floor(py * 3)));
  return row * 3 + col + 1;
}

export function placePad(
  frame: DOMRect,
  cell: DOMRect,
  coarse: boolean,
): { left: number; top: number; size: number } {
  const size = coarse
    ? Math.min(frame.width - 8, Math.max(240, Math.min(280, cell.width * 6)))
    : Math.max(132, Math.min(168, cell.width * 2.8));
  const gap = coarse ? 16 : 8;
  const cellCx = cell.left + cell.width / 2 - frame.left;
  const cellTop = cell.top - frame.top;
  const cellBottom = cell.bottom - frame.top;
  const cellMidY = cellTop + cell.height / 2;
  const preferAbove = cellMidY > frame.height * 0.36;

  let left = cellCx - size / 2;
  let top = preferAbove ? cellTop - size - gap : cellBottom + gap;

  if (top < 4) top = cellBottom + gap;
  if (top + size > frame.height - 4) top = cellTop - size - gap;

  if (top < 4 || top + size > frame.height - 4) {
    top = Math.max(4, Math.min(frame.height - size - 4, (frame.height - size) / 2));
    const right = cell.right - frame.left + gap;
    const leftAlt = cell.left - frame.left - gap - size;
    if (right + size <= frame.width - 4) left = right;
    else if (leftAlt >= 4) left = leftAlt;
  }

  const maxL = Math.max(4, frame.width - size - 4);
  const maxT = Math.max(4, frame.height - size - 4);
  return {
    size,
    left: Math.min(maxL, Math.max(4, left)),
    top: Math.min(maxT, Math.max(4, top)),
  };
}

export function NotePad({
  notes,
  hover,
  mode,
  coarse,
  style,
  padRef,
  onPick,
}: {
  notes: number[];
  hover: number | null;
  mode: PadMode;
  coarse?: boolean;
  style: CSSProperties;
  padRef: RefObject<HTMLDivElement | null>;
  onPick?: (d: number) => void;
}) {
  const t = useT();
  return (
    <div
      ref={padRef}
      role="dialog"
      aria-label={t("board.note")}
      className={cn(
        "absolute z-30 grid grid-cols-3 grid-rows-3 rounded-md border border-border-strong bg-bg-elevated shadow-[var(--shadow)]",
        coarse ? "gap-1.5 p-1.5" : "gap-0.5 p-1",
      )}
      style={style}
    >
      {DIGITS.map((d) => {
        const on = notes.includes(d);
        const hot = hover === d;
        return (
          <button
            key={d}
            type="button"
            tabIndex={mode === "menu" ? 0 : -1}
            aria-pressed={on}
            aria-label={t("board.noteDigit", { d })}
            disabled={mode === "slide"}
            onPointerDown={(e) => {
              if (mode !== "menu") return;
              e.preventDefault();
              e.stopPropagation();
              onPick?.(d);
            }}
            className={cn(
              "flex items-center justify-center rounded-sm font-sans tabular-nums",
              coarse ? "text-3xl font-medium" : "text-lg",
              on ? "bg-wash text-accent" : "text-fg",
              hot && "bg-wash ring-2 ring-inset ring-accent",
            )}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

export function useCellNotePad({
  board,
  disabled,
  frameRef,
  padRef,
  onSelect,
  onSelectOnly,
  onNote,
}: {
  board: Cell[];
  disabled?: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
  padRef: RefObject<HTMLDivElement | null>;
  onSelect: (i: number) => void;
  onSelectOnly: (i: number) => void;
  onNote: (d: number) => void;
}) {
  const [pad, setPad] = useState<PadState | null>(null);
  const padState = useRef<PadState | null>(null);
  padState.current = pad;
  const gesture = useRef<Gesture | null>(null);

  const canNote = useCallback(
    (i: number) => {
      if (disabled) return false;
      const cell = board[i];
      return Boolean(cell && !cell.given && cell.value == null);
    },
    [board, disabled],
  );

  const openPad = useCallback(
    (
      cellIndex: number,
      el: HTMLElement,
      mode: PadMode,
      hover: number | null,
      coarse: boolean,
    ) => {
      const frame = frameRef.current?.getBoundingClientRect();
      if (!frame) return;
      const placed = placePad(frame, el.getBoundingClientRect(), coarse);
      setPad({ cell: cellIndex, mode, hover, coarse, ...placed });
    },
    [frameRef],
  );

  const closePad = useCallback(() => setPad(null), []);

  useEffect(() => {
    if (!pad || pad.mode !== "menu") return;
    const onDoc = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (padRef.current?.contains(t)) return;
      closePad();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePad();
    };
    document.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [pad, closePad, padRef]);

  const updateHover = useCallback(
    (x: number, y: number) => {
      const cur = padState.current;
      const node = padRef.current;
      if (!cur || !node) return;
      const d = digitAtPoint(node.getBoundingClientRect(), x, y);
      if (d !== cur.hover) setPad({ ...cur, hover: d });
    },
    [padRef],
  );

  const pickAndClose = useCallback(
    (d: number) => {
      onNote(d);
      closePad();
    },
    [onNote, closePad],
  );

  const cellHandlers = useCallback(
    (i: number) => {
      const finish = (commit: boolean) => {
        const g = gesture.current;
        if (!g || g.cell !== i) return;
        g.unbind();
        const cur = padState.current;
        const opened = g.opened;
        gesture.current = null;
        if (cur?.mode === "slide") {
          if (commit && cur.hover) onNote(cur.hover);
          closePad();
          return;
        }
        if (cur?.mode === "menu") return;
        if (!opened && commit) onSelect(i);
      };

      const moveGesture = (ev: PointerEvent) => {
        const g = gesture.current;
        if (!g || g.pointerId !== ev.pointerId || g.cell !== i) return;
        if (padState.current) {
          ev.preventDefault();
          updateHover(ev.clientX, ev.clientY);
          return;
        }
        if (!canNote(i)) return;
        const dx = ev.clientX - g.x;
        const dy = ev.clientY - g.y;
        const need = g.coarse ? SLIDE_TOUCH : SLIDE_MOUSE;
        if (dx * dx + dy * dy < need * need) return;
        ev.preventDefault();
        g.opened = true;
        openPad(i, g.target, "slide", null, g.coarse);
      };

      return {
        onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
          if (e.button === 2) return;
          if (disabled) return;
          gesture.current?.unbind();
          const target = e.currentTarget;
          const coarse = isCoarsePointer(e);
          const g: Gesture = {
            pointerId: e.pointerId,
            cell: i,
            x: e.clientX,
            y: e.clientY,
            opened: false,
            coarse,
            target,
            unbind: () => {},
          };
          const nativeMove = (ev: PointerEvent) => moveGesture(ev);
          const nativeUp = (ev: PointerEvent) => {
            if (ev.pointerId !== g.pointerId) return;
            finish(true);
          };
          const nativeCancel = (ev: PointerEvent) => {
            if (ev.pointerId !== g.pointerId) return;
            finish(false);
          };
          g.unbind = () => {
            window.removeEventListener("pointermove", nativeMove);
            window.removeEventListener("pointerup", nativeUp);
            window.removeEventListener("pointercancel", nativeCancel);
          };
          gesture.current = g;
          window.addEventListener("pointermove", nativeMove, { passive: false });
          window.addEventListener("pointerup", nativeUp);
          window.addEventListener("pointercancel", nativeCancel);
          onSelectOnly(i);
          if (!canNote(i)) return;
          try {
            target.setPointerCapture(e.pointerId);
          } catch {
            /* untrusted / unsupported */
          }
        },
        onContextMenu: (e: ReactMouseEvent<HTMLButtonElement>) => {
          if (!canNote(i)) return;
          e.preventDefault();
          onSelectOnly(i);
          openPad(i, e.currentTarget, "menu", null, isCoarsePointer());
        },
        onClick: (e: ReactMouseEvent<HTMLButtonElement>) => {
          if (padState.current || gesture.current?.opened) {
            e.preventDefault();
            return;
          }
          onSelect(i);
        },
      };
    },
    [
      canNote,
      closePad,
      disabled,
      onNote,
      onSelect,
      onSelectOnly,
      openPad,
      updateHover,
    ],
  );

  return { pad, closePad, cellHandlers, pickAndClose };
}