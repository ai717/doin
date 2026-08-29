import { remainingCounts } from "@/engine/grid";
import type { Cell } from "@/game/types";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import { useRef } from "react";

interface Props {
  board: Cell[];
  noteMode: boolean;
  digitLock: number | null;
  digitFirst: boolean;
  disabled?: boolean;
  onDigit: (d: number) => void;
  onLongPress: (d: number) => void;
}

export function Keypad({
  board,
  noteMode,
  digitLock,
  digitFirst,
  disabled,
  onDigit,
  onLongPress,
}: Props) {
  const values = board.map((c) => c.value ?? 0);
  const remaining = remainingCounts(values);
  const timer = useRef<number | null>(null);
  const t = useT();

  return (
    <div
      className="keypad-grid grid grid-cols-9 gap-1.5 lg:grid-cols-3 lg:gap-3"
      role="toolbar"
      aria-label={t("keypad.label")}
    >
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
        const left = remaining[d] ?? 0;
        const locked = digitFirst && digitLock === d;
        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onPointerDown={() => {
              if (timer.current) window.clearTimeout(timer.current);
              timer.current = window.setTimeout(() => {
                onLongPress(d);
                timer.current = null;
              }, 400);
            }}
            onPointerUp={() => {
              if (timer.current) {
                window.clearTimeout(timer.current);
                timer.current = null;
                onDigit(d);
              }
            }}
            onPointerLeave={() => {
              if (timer.current) {
                window.clearTimeout(timer.current);
                timer.current = null;
              }
            }}
            className={cn(
              "relative flex min-h-11 flex-col items-center justify-center rounded-md border tabular-nums transition-colors lg:min-h-0 lg:rounded-lg",
              locked || noteMode
                ? "border-accent bg-wash text-fg"
                : "border-border bg-bg-elevated text-fg hover:bg-wash",
              left === 0 && "opacity-40",
            )}
            aria-label={t("keypad.digit", { d, n: left })}
            aria-pressed={locked}
          >
            <span
              className={cn(
                "leading-none font-medium",
                noteMode
                  ? "text-lg lg:text-5xl"
                  : "text-xl lg:text-6xl",
              )}
            >
              {d}
            </span>
            <span className="mt-0.5 text-[10px] leading-none text-fg-muted lg:absolute lg:top-2.5 lg:right-3 lg:mt-0 lg:text-xs">
              {left}
            </span>
          </button>
        );
      })}
    </div>
  );
}
