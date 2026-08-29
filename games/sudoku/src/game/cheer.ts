import type { Cell } from "./types";

export const CHEER_MARKS = [30, 50, 80] as const;
export type CheerMark = (typeof CHEER_MARKS)[number];

export const CHEER_COPY: Record<CheerMark, { kicker: string; line: string }> = {
  30: { kicker: "三成", line: "笔锋已起，棋盘开始说话。" },
  50: { kicker: "过半", line: "半局已成，脉络渐清。" },
  80: { kicker: "八成", line: "收束在即，只差几笔。" },
};

export function fillRatio(board: Cell[]): number {
  let total = 0;
  let filled = 0;
  for (const c of board) {
    if (c.given) continue;
    total += 1;
    if (c.value != null) filled += 1;
  }
  return total === 0 ? 1 : filled / total;
}

export function crossedCheers(ratio: number, already: number[]): CheerMark[] {
  const pct = Math.floor(ratio * 100 + 1e-6);
  return CHEER_MARKS.filter((m) => pct >= m && !already.includes(m));
}