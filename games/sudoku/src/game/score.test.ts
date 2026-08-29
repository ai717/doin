import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DIFFICULTIES } from "../engine/types.ts";
import {
  daysInMonth,
  earnedStamps,
  liveScore,
  scoreGame,
  type StampContext,
} from "./score.ts";

function completed(fill: Partial<Record<string, number>> = {}) {
  const completedByDifficulty = {} as StampContext["completedByDifficulty"];
  for (const d of DIFFICULTIES) {
    completedByDifficulty[d] = fill[d] ?? 0;
  }
  return completedByDifficulty;
}

describe("scoreGame", () => {
  it("scores a clean medium daily under par", () => {
    const s = scoreGame({
      difficulty: "medium",
      elapsedMs: 12 * 60 * 1000,
      mistakes: 0,
      hintUsed: 0,
      kind: "daily",
    });
    assert.equal(s.base, 110);
    assert.equal(s.time, 18);
    assert.equal(s.clean, 75);
    assert.equal(s.daily, 20);
    assert.equal(s.total, 223);
  });

  it("gives no time bonus when slower than par", () => {
    const s = scoreGame({
      difficulty: "easy",
      elapsedMs: 20 * 60 * 1000,
      mistakes: 1,
      hintUsed: 2,
      kind: "free",
    });
    assert.equal(s.base, 70);
    assert.equal(s.time, 0);
    assert.equal(s.clean, 0);
    assert.equal(s.daily, 0);
    assert.equal(s.total, 70);
  });

  it("caps the time bonus", () => {
    const s = scoreGame({
      difficulty: "intro",
      elapsedMs: 5_000,
      mistakes: 0,
      hintUsed: 0,
      kind: "free",
    });
    assert.equal(s.time, 20);
    assert.equal(s.clean, 75);
    assert.equal(s.total, 40 + 20 + 75);
  });

  it("scales live score by correct fills", () => {
    const half = liveScore({
      difficulty: "easy",
      elapsedMs: 20 * 60 * 1000,
      mistakes: 1,
      hintUsed: 2,
      kind: "free",
      filled: 20,
      empty: 40,
    });
    assert.equal(half.total, 70);
    assert.equal(half.live, 35);
    const done = liveScore({
      difficulty: "easy",
      elapsedMs: 20 * 60 * 1000,
      mistakes: 1,
      hintUsed: 2,
      kind: "free",
      filled: 40,
      empty: 40,
    });
    assert.equal(done.live, 70);
  });

  it("awards partial clean for no-hint with mistakes", () => {
    const s = scoreGame({
      difficulty: "hard",
      elapsedMs: 25 * 60 * 1000,
      mistakes: 2,
      hintUsed: 0,
      kind: "free",
    });
    assert.equal(s.clean, 35);
    assert.equal(s.total, 160 + 35);
  });
});

describe("earnedStamps", () => {
  it("unlocks first, clean, record, swift on a fast intro", () => {
    const ids = earnedStamps({
      total: 1,
      ink: 135,
      streak: 0,
      kind: "free",
      difficulty: "intro",
      elapsedMs: 2 * 60 * 1000,
      mistakes: 0,
      hintUsed: 0,
      wasRecord: true,
      completedByDifficulty: completed({ intro: 1 }),
      dailyHistory: {},
      monthKey: "2026-08",
      hour: 14,
    });
    assert.deepEqual(ids, ["first", "clean", "record", "swift"]);
  });

  it("unlocks five only when every difficulty has a win", () => {
    const missing = earnedStamps({
      total: 4,
      ink: 400,
      streak: 0,
      kind: "free",
      difficulty: "expert",
      elapsedMs: 30 * 60 * 1000,
      mistakes: 0,
      hintUsed: 1,
      wasRecord: true,
      completedByDifficulty: completed({ intro: 1, easy: 1, medium: 1, hard: 1 }),
      dailyHistory: {},
      monthKey: "2026-08",
      hour: 14,
    });
    assert.equal(missing.includes("five"), false);
    const full = earnedStamps({
      total: 5,
      ink: 620,
      streak: 0,
      kind: "free",
      difficulty: "expert",
      elapsedMs: 30 * 60 * 1000,
      mistakes: 0,
      hintUsed: 0,
      wasRecord: true,
      completedByDifficulty: completed({
        intro: 1,
        easy: 1,
        medium: 1,
        hard: 1,
        expert: 1,
      }),
      dailyHistory: {},
      monthKey: "2026-08",
      hour: 14,
    });
    assert.equal(full.includes("five"), true);
    assert.equal(full.includes("blind"), true);
  });

  it("counts twenty daily days in the current month", () => {
    const history: Record<string, { ms: number; hints: number }> = {};
    for (let d = 1; d <= 20; d++) {
      history[`2026-08-${String(d).padStart(2, "0")}`] = { ms: 1, hints: 0 };
    }
    history["2026-07-31"] = { ms: 1, hints: 0 };
    assert.equal(daysInMonth(history, "2026-08"), 20);
    const ids = earnedStamps({
      total: 20,
      ink: 2000,
      streak: 7,
      kind: "daily",
      difficulty: "medium",
      elapsedMs: 10 * 60 * 1000,
      mistakes: 1,
      hintUsed: 0,
      wasRecord: false,
      completedByDifficulty: completed({ medium: 20 }),
      dailyHistory: history,
      monthKey: "2026-08",
      hour: 14,
    });
    assert.equal(ids.includes("month"), true);
    assert.equal(ids.includes("streak7"), true);
    assert.equal(ids.includes("daily"), true);
    assert.equal(ids.includes("ten"), true);
  });

  it("unlocks expert, perfect, night, and pour", () => {
    const day = earnedStamps({
      total: 2,
      ink: 8000,
      streak: 30,
      kind: "daily",
      difficulty: "expert",
      elapsedMs: 40 * 60 * 1000,
      mistakes: 0,
      hintUsed: 0,
      wasRecord: false,
      completedByDifficulty: completed({ expert: 1, easy: 1 }),
      dailyHistory: { "2026-08-28": { ms: 1, hints: 0 } },
      monthKey: "2026-08",
      hour: 22,
    });
    assert.equal(day.includes("expert"), true);
    assert.equal(day.includes("perfect"), true);
    assert.equal(day.includes("night"), true);
    assert.equal(day.includes("pour"), true);
    assert.equal(day.includes("streak30"), true);
    const noon = earnedStamps({
      total: 1,
      ink: 100,
      streak: 0,
      kind: "free",
      difficulty: "easy",
      elapsedMs: 8 * 60 * 1000,
      mistakes: 1,
      hintUsed: 1,
      wasRecord: false,
      completedByDifficulty: completed({ easy: 1 }),
      dailyHistory: {},
      monthKey: "2026-08",
      hour: 12,
    });
    assert.equal(noon.includes("night"), false);
    assert.equal(noon.includes("expert"), false);
  });
});