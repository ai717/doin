import { MiniBoard, parseGrid } from "@/components/mini-board";
import type { TechniqueId } from "@/engine/types";
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";

const BAND: Record<TechniqueId, MessageKey> = {
  "naked-single": "diff.intro",
  "hidden-single": "diff.intro",
  "naked-pair": "diff.medium",
  "hidden-pair": "diff.medium",
  pointing: "diff.medium",
  "naked-triple": "diff.hard",
  "hidden-triple": "diff.hard",
  "x-wing": "diff.hard",
  "xy-wing": "diff.expert",
  swordfish: "diff.expert",
  conflict: "tech.conflict",
};

type Entry = {
  id: TechniqueId;
  band: string;
  body: string;
  grid: number[];
  house?: { kind: "row" | "col" | "box"; index: number };
  glow?: number[];
  focus?: number[];
  notes?: Record<number, number[]>;
};

const ENTRIES: Entry[] = [
  {
    id: "naked-single",
    band: "入门",
    body: "一格的候选只剩一个数字，那就是它。",
    grid: parseGrid([
      "12345678.",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]),
    house: { kind: "row", index: 0 },
    focus: [8],
  },
  {
    id: "hidden-single",
    band: "入门",
    body: "某个数字在一行、一列或一宫里只剩一个位置，即使那格还有别的候选。",
    grid: parseGrid([
      "1.3.5.7.9",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]),
    house: { kind: "row", index: 0 },
    focus: [1],
    notes: { 1: [2], 3: [4, 6], 5: [4, 8], 7: [4, 6] },
  },
  {
    id: "naked-pair",
    band: "中等",
    body: "同一行、列或宫里，有两格都只能是 a 和 b。这两格锁住 a、b，其它格可以删掉它们。",
    grid: parseGrid([
      ".........",
      "4.5...8.9",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]),
    house: { kind: "row", index: 1 },
    glow: [10, 12],
    notes: { 10: [2, 3], 12: [2, 3], 14: [2, 3, 6], 16: [2, 6] },
  },
  {
    id: "hidden-pair",
    band: "中等",
    body: "某个区域里，a 和 b 只出现在同样的两格。这两格可以删掉其它候选。",
    grid: parseGrid([
      ".........",
      ".........",
      ".........",
      ".1.2.3...",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]),
    house: { kind: "row", index: 3 },
    glow: [27, 33],
    notes: { 27: [4, 5, 8], 33: [4, 5, 9] },
  },
  {
    id: "pointing",
    band: "中等",
    body: "一个数字在某宫里只出现在同一行（或列），则这一行其它宫不能再填它。",
    grid: parseGrid([
      "...123...",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]),
    house: { kind: "box", index: 0 },
    glow: [0, 1, 2],
    notes: { 0: [4, 5], 1: [4, 7], 2: [5, 7] },
  },
  {
    id: "naked-triple",
    band: "困难",
    body: "三格共同锁住三个数字（每格不必正好三个），同区域其它格删掉这三个数字。",
    grid: parseGrid([
      ".........",
      ".........",
      "4.....8.9",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]),
    house: { kind: "row", index: 2 },
    glow: [19, 20, 22],
    notes: { 19: [1, 2], 20: [1, 3], 22: [2, 3] },
  },
  {
    id: "hidden-triple",
    band: "困难",
    body: "三个数字只出现在同一区域的三格里。这三格可以只保留这三个数字。",
    grid: parseGrid([
      ".........",
      ".........",
      ".........",
      ".........",
      ".1.2.3.4.",
      ".........",
      ".........",
      ".........",
      ".........",
    ]),
    house: { kind: "row", index: 4 },
    glow: [36, 40, 44],
    notes: { 36: [5, 6, 9], 40: [5, 7, 9], 44: [6, 7] },
  },
  {
    id: "x-wing",
    band: "困难",
    body: "某个数字在两行里都只出现在相同的两列，构成矩形。这两列的其它行可以删掉它。",
    grid: parseGrid([
      ".2.4.6.8.",
      ".........",
      ".........",
      ".1.3.5.7.",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
    ]),
    glow: [0, 8, 27, 35],
    notes: { 0: [9], 8: [9], 27: [9], 35: [9] },
  },
  {
    id: "xy-wing",
    band: "专家",
    body: "轴是 XY，两翼分别是 XZ、YZ。同时看到两翼的格子可以删掉 Z。",
    grid: parseGrid([
      ".........",
      ".........",
      ".........",
      ".........",
      "....1....",
      ".........",
      ".........",
      ".........",
      ".........",
    ]),
    glow: [30, 32, 40],
    focus: [40],
    notes: { 40: [2, 3], 30: [2, 5], 32: [3, 5] },
  },
  {
    id: "swordfish",
    band: "专家",
    body: "某个数字在三行里只出现在相同的三列（每行 2 或 3 处）。这三列其它行可以删掉它。",
    grid: parseGrid([
      ".1.2.3...",
      ".........",
      ".........",
      ".4.5.6...",
      ".........",
      ".........",
      ".7.8.9...",
      ".........",
      ".........",
    ]),
    glow: [0, 8, 27, 35, 54, 62],
    notes: { 0: [9], 8: [9], 27: [9], 35: [9], 54: [9], 62: [9] },
  },
];

export function TechniqueAtlas() {
  const t = useT();
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl text-fg">{t("atlas.title")}</h2>
      <p className="mt-2 text-sm text-fg-muted">{t("atlas.lead")}</p>
      <nav className="mt-4 flex flex-wrap gap-2 text-xs">
        {ENTRIES.map((e) => (
          <a
            key={e.id}
            href={`#${e.id}`}
            className="rounded-full border border-border bg-bg-elevated px-2.5 py-1 text-fg-muted"
          >
            {t(`tech.${e.id}` as MessageKey)}
          </a>
        ))}
      </nav>
      <ol className="mt-8 space-y-10">
        {ENTRIES.map((e) => (
          <li
            key={e.id}
            id={e.id}
            className="scroll-mt-20 border-t border-border pt-8"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <MiniBoard
                values={e.grid}
                notes={e.notes}
                glow={e.glow}
                focus={e.focus}
                house={e.house}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-fg-muted">{t(BAND[e.id])}</p>
                <h3 className="mt-1 font-medium text-fg">{t(`tech.${e.id}` as MessageKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  {t(`atlas.${e.id}` as MessageKey)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
