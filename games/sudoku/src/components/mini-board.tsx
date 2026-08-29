import { rowOf, colOf, boxOf } from "@/engine/grid";
import { cn } from "@/lib/utils";

interface Props {
  values: number[];
  notes?: Record<number, number[]>;
  glow?: number[];
  focus?: number[];
  house?: { kind: "row" | "col" | "box"; index: number };
}

export function MiniBoard({ values, notes, glow, focus, house }: Props) {
  const glowSet = new Set(glow ?? []);
  const focusSet = new Set(focus ?? []);
  const cells = values.length === 81 ? values : pad81(values);

  return (
    <div
      className="aspect-square w-full max-w-[11.5rem] rounded-md bg-board p-1 shadow-[var(--shadow)]"
      aria-hidden
    >
      <div className="grid h-full w-full grid-cols-9 grid-rows-9 overflow-hidden rounded-sm">
        {cells.map((v, i) => {
          const r = rowOf(i);
          const c = colOf(i);
          const b = boxOf(i);
          const inHouse =
            house &&
            ((house.kind === "row" && r === house.index) ||
              (house.kind === "col" && c === house.index) ||
              (house.kind === "box" && b === house.index));
          const thickR = c === 2 || c === 5;
          const thickB = r === 2 || r === 5;
          const cellNotes = notes?.[i];
          return (
            <div
              key={i}
              className={cn(
                "relative flex items-center justify-center border-b border-r border-line-soft",
                c === 8 && "border-r-0",
                r === 8 && "border-b-0",
                thickR && "border-r-line border-r-2",
                thickB && "border-b-line border-b-2",
                inHouse && "bg-wash",
                glowSet.has(i) && "bg-same",
                focusSet.has(i) && "z-[1] ring-1 ring-inset ring-accent",
              )}
            >
              {v ? (
                <span className="text-[0.7rem] font-semibold leading-none text-fg">{v}</span>
              ) : cellNotes?.length ? (
                <span className="grid size-full grid-cols-3 grid-rows-3 p-px text-[0.38rem] leading-none text-note">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <span key={n} className="flex items-center justify-center">
                      {cellNotes.includes(n) ? n : ""}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function pad81(values: number[]): number[] {
  const out = Array.from({ length: 81 }, () => 0);
  for (let i = 0; i < Math.min(values.length, 81); i++) out[i] = values[i]!;
  return out;
}

export function parseGrid(rows: string[]): number[] {
  const s = rows.join("").replace(/\s/g, "");
  const out = Array.from({ length: 81 }, () => 0);
  for (let i = 0; i < Math.min(81, s.length); i++) {
    const ch = s[i]!;
    out[i] = ch === "." ? 0 : Number(ch);
  }
  return out;
}
