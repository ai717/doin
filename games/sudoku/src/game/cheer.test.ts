import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { crossedCheers, fillRatio, type CheerMark } from "./cheer.ts";
import type { Cell } from "./types.ts";

function board(filled: number, empty: number): Cell[] {
  const out: Cell[] = [];
  for (let i = 0; i < filled; i++) out.push({ value: 1, notes: [], given: false });
  for (let i = 0; i < empty; i++) out.push({ value: null, notes: [], given: false });
  while (out.length < 81) out.push({ value: 5, notes: [], given: true });
  return out;
}

describe("fillRatio", () => {
  it("ignores givens", () => {
    assert.equal(fillRatio(board(0, 50)), 0);
    assert.equal(fillRatio(board(25, 25)), 0.5);
  });
});

describe("crossedCheers", () => {
  it("returns only newly crossed marks, highest last", () => {
    const hit = crossedCheers(0.5, []);
    assert.deepEqual(hit, [30, 50] as CheerMark[]);
    assert.deepEqual(crossedCheers(0.3, [30]), []);
    assert.deepEqual(crossedCheers(0.81, [30, 50]), [80]);
    assert.deepEqual(crossedCheers(0.2, []), []);
  });
});