import assert from "node:assert/strict";
import { test } from "node:test";
import { computeStars, formatTime } from "../js/score.mjs";

test("no win means no stars", () => {
  assert.equal(computeStars({ won: false, elapsedMs: 0, undoCount: 0, slotPeak: 0, parMs: 10000, cap: 6 }), 0);
});

test("base star for any victory", () => {
  assert.equal(
    computeStars({ won: true, elapsedMs: 999999, undoCount: 99, slotPeak: 6, parMs: 10000, cap: 6 }),
    1,
  );
});

test("tidy play earns the second star", () => {
  const base = { won: true, elapsedMs: 999999, parMs: 10000, cap: 6 };
  assert.equal(computeStars({ ...base, undoCount: 3, slotPeak: 4 }), 2);
  assert.equal(computeStars({ ...base, undoCount: 4, slotPeak: 4 }), 1);
  assert.equal(computeStars({ ...base, undoCount: 3, slotPeak: 5 }), 1);
});

test("fast and clean play earns three stars", () => {
  const base = { won: true, slotPeak: 4, parMs: 60000, cap: 6 };
  assert.equal(computeStars({ ...base, elapsedMs: 60000, undoCount: 1 }), 3);
  assert.equal(computeStars({ ...base, elapsedMs: 60001, undoCount: 1 }), 2);
  assert.equal(computeStars({ ...base, elapsedMs: 60000, undoCount: 2 }), 2);
});

test("formatTime formats minutes and seconds", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(59000), "0:59");
  assert.equal(formatTime(60000), "1:00");
  assert.equal(formatTime(65000), "1:05");
});
