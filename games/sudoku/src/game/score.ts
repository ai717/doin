import { DIFFICULTIES, type Difficulty } from "../engine/types.ts";
import { stampLabel } from "../i18n/core.ts";

export const STAMP_IDS = [
  "first",
  "daily",
  "clean",
  "blind",
  "five",
  "streak3",
  "streak7",
  "month",
  "ten",
  "fifty",
  "hundred",
  "thick",
  "record",
  "swift",
  "expert",
  "perfect",
  "mediumFly",
  "streak30",
  "pour",
  "night",
] as const;

export type StampId = (typeof STAMP_IDS)[number];

export const STAMPS: {
  id: StampId;
  name: string;
  hint: string;
}[] = [
  { id: "first", name: "第一笔", hint: "完成任意一局" },
  { id: "daily", name: "今日", hint: "完成一题今日挑战" },
  { id: "clean", name: "干净", hint: "无错且无提示通关" },
  { id: "blind", name: "盲解", hint: "无提示完成困难或专家" },
  { id: "five", name: "五档", hint: "五个难度各完成一局" },
  { id: "streak3", name: "三日", hint: "今日挑战连胜 3 天" },
  { id: "streak7", name: "七日", hint: "今日挑战连胜 7 天" },
  { id: "month", name: "满月", hint: "当月今日挑战满 20 天" },
  { id: "ten", name: "十局", hint: "累计完成 10 局" },
  { id: "fifty", name: "五十局", hint: "累计完成 50 局" },
  { id: "hundred", name: "百局", hint: "累计完成 100 局" },
  { id: "thick", name: "墨浓", hint: "累计墨点 3000" },
  { id: "record", name: "新纪录", hint: "刷新某一难度最佳" },
  { id: "swift", name: "入门飞", hint: "入门 3 分钟内完成" },
  { id: "expert", name: "专家", hint: "完成一局专家" },
  { id: "perfect", name: "完璧", hint: "今日挑战无错无提示" },
  { id: "mediumFly", name: "中飞", hint: "中等 10 分钟内完成" },
  { id: "streak30", name: "月勤", hint: "今日挑战连胜 30 天" },
  { id: "pour", name: "泼墨", hint: "累计墨点 8000" },
  { id: "night", name: "灯下", hint: "21 点后完成一局" },
];

const TABLE: Record<
  Difficulty,
  { base: number; parSec: number; timeCap: number }
> = {
  intro: { base: 40, parSec: 5 * 60, timeCap: 20 },
  easy: { base: 70, parSec: 8 * 60, timeCap: 25 },
  medium: { base: 110, parSec: 15 * 60, timeCap: 30 },
  hard: { base: 160, parSec: 25 * 60, timeCap: 35 },
  expert: { base: 220, parSec: 40 * 60, timeCap: 40 },
};

export interface ScoreParts {
  total: number;
  base: number;
  time: number;
  clean: number;
  daily: number;
}

export function scoreGame(input: {
  difficulty: Difficulty;
  elapsedMs: number;
  mistakes: number;
  hintUsed: number;
  kind: "free" | "daily";
}): ScoreParts {
  const row = TABLE[input.difficulty];
  const elapsedSec = Math.max(0, Math.floor(input.elapsedMs / 1000));
  const time = Math.max(
    0,
    Math.min(row.timeCap, Math.floor((row.parSec - elapsedSec) / 10)),
  );
  const noMistakes = input.mistakes === 0;
  const noHints = input.hintUsed === 0;
  let clean = 0;
  if (noMistakes) clean += 25;
  if (noHints) clean += 35;
  if (noMistakes && noHints) clean += 15;
  const daily = input.kind === "daily" ? 20 : 0;
  const base = row.base;
  return { base, time, clean, daily, total: base + time + clean + daily };
}

export function correctFillCounts(
  board: { given: boolean; value: number | null }[],
  solution: number[],
): { filled: number; empty: number } {
  let empty = 0;
  let filled = 0;
  const n = Math.min(board.length, solution.length);
  for (let i = 0; i < n; i++) {
    const c = board[i];
    if (!c || c.given) continue;
    empty += 1;
    if (c.value != null && c.value === solution[i]) filled += 1;
  }
  return { filled, empty };
}

export function liveScore(
  input: Parameters<typeof scoreGame>[0] & {
    filled: number;
    empty: number;
  },
): ScoreParts & { live: number } {
  const parts = scoreGame(input);
  const ratio = input.empty <= 0 ? 1 : Math.min(1, input.filled / input.empty);
  return { ...parts, live: Math.round(parts.total * ratio) };
}

export interface StampContext {
  total: number;
  ink: number;
  streak: number;
  kind: "free" | "daily";
  difficulty: Difficulty;
  elapsedMs: number;
  mistakes: number;
  hintUsed: number;
  wasRecord: boolean;
  completedByDifficulty: Record<Difficulty, number>;
  dailyHistory: Record<string, { ms: number; hints: number }>;
  monthKey: string;
  hour: number;
}

export function earnedStamps(ctx: StampContext): StampId[] {
  const out: StampId[] = [];
  if (ctx.total >= 1) out.push("first");
  if (ctx.kind === "daily") out.push("daily");
  if (ctx.mistakes === 0 && ctx.hintUsed === 0) out.push("clean");
  if (
    ctx.hintUsed === 0 &&
    (ctx.difficulty === "hard" || ctx.difficulty === "expert")
  ) {
    out.push("blind");
  }
  if (DIFFICULTIES.every((d) => (ctx.completedByDifficulty[d] ?? 0) >= 1)) {
    out.push("five");
  }
  if (ctx.streak >= 3) out.push("streak3");
  if (ctx.streak >= 7) out.push("streak7");
  if (daysInMonth(ctx.dailyHistory, ctx.monthKey) >= 20) out.push("month");
  if (ctx.total >= 10) out.push("ten");
  if (ctx.total >= 50) out.push("fifty");
  if (ctx.total >= 100) out.push("hundred");
  if (ctx.ink >= 3000) out.push("thick");
  if (ctx.wasRecord) out.push("record");
  if (ctx.difficulty === "intro" && ctx.elapsedMs <= 3 * 60 * 1000) {
    out.push("swift");
  }
  if (ctx.difficulty === "expert") out.push("expert");
  if (
    ctx.kind === "daily" &&
    ctx.mistakes === 0 &&
    ctx.hintUsed === 0
  ) {
    out.push("perfect");
  }
  if (ctx.difficulty === "medium" && ctx.elapsedMs <= 10 * 60 * 1000) {
    out.push("mediumFly");
  }
  if (ctx.streak >= 30) out.push("streak30");
  if (ctx.ink >= 8000) out.push("pour");
  if (ctx.hour >= 21 || ctx.hour < 5) out.push("night");
  return out;
}

export function daysInMonth(
  history: Record<string, { ms: number; hints: number }>,
  monthKey: string,
): number {
  let n = 0;
  for (const id of Object.keys(history)) {
    if (id.startsWith(monthKey)) n += 1;
  }
  return n;
}

export function monthKeyOf(dateId: string): string {
  return dateId.slice(0, 7);
}

export function stampName(id: StampId): string {
  return stampLabel(id, "name");
}