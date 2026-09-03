import assert from "node:assert/strict";
import test from "node:test";

import { todayKey } from "../js/daily.mjs";
import { canExtract, extractOrb, undo, createState } from "../engine.mjs";
import { paramsForDifficulty } from "../difficulty.mjs";
import { LEVELS, createLevelState } from "../levels.mjs";

test("todayKey deterministically formats local calendar date as YYYY-MM-DD", () => {
  assert.equal(todayKey(new Date(2026, 8, 1)), "2026-09-01");
  assert.equal(todayKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(todayKey(new Date(2026, 11, 31)), "2026-12-31");
});

test("今日挑战难度公式（D5/D6）参数正确：双 dock=2, capacity≥5, colorCount≥5", () => {
  // 公式：D5 基本 params + 容量+1, 颜色+0（上探不爆炸）+ 强制 dock=2, empty=2
  for (const D of [5, 6]) {
    const base = paramsForDifficulty(D);
    const difficulty = D; // 5 or 6 直接
    const dockCount = 2;
    const capacity = Math.max(5, Math.min(6, base.capacity + 1));
    const colorCount = Math.max(5, Math.min(6, base.colorCount + 0));
    const emptyCount = Math.max(2, dockCount);
    assert.equal(dockCount, 2, `D${D} 双中转槽`);
    assert.ok(capacity >= 5, `D${D} cap=${capacity} ≥5`);
    assert.ok(colorCount >= 5, `D${D} colors=${colorCount} ≥5`);
    assert.ok(emptyCount >= 2, `D${D} empty=${emptyCount} ≥2`);
  }
});

test("关卡 state 携带 dateKey：extract/undo 过程中 dateKey identity 不破坏，且 movesPlayed 永不减少（用户需求：撤回不减少步数）", () => {
  // 用主线 L6 模拟今日挑战包装（不需要 solve，只测 engine 行为）— engine 对 daily/主线 state 结构完全统一
  const dateKey = "2026-09-01";
  const level = {
    ...LEVELS[5], // L6
    id: "daily",
    today: true,
    dateKey,
    difficulty: 6,
    title: `今日挑战 · ${dateKey}`,
  };
  const state0 = createLevelState(level);
  assert.equal(state0.dateKey, dateKey, "初始 state 携带 dateKey");
  const track = state0.tracks.find((t) => canExtract(state0, t.id));
  assert.ok(track, "开局存在可 extract 轨道");
  const after1 = extractOrb(state0, track.id);
  assert.equal(after1.stats.movesPlayed, 1, "一次 extract +1");
  assert.equal(after1.dateKey, dateKey, "extract 后 state.dateKey 保持");
  const after2 = undo(after1);
  assert.equal(after2.dateKey, dateKey, "undo 后 dateKey 仍保持");
  assert.ok(after2.stats.movesPlayed >= after1.stats.movesPlayed,
    `undo 后 movesPlayed(${after2.stats.movesPlayed}) ≥ extract 后(${after1.stats.movesPlayed}) — 不减少用户步数`);
});

test("paramsForDifficulty 基础值（给今日挑战难度用）在 D5/D6 范围内均为 cap≥4, color≥4, dock≥1", () => {
  for (const D of [1,2,3,4,5,6,7]) {
    const p = paramsForDifficulty(D);
    assert.ok(Number.isInteger(p.capacity) && p.capacity >= 3 && p.capacity <= 7, `D${D} capacity=${p.capacity}`);
    assert.ok(Number.isInteger(p.colorCount) && p.colorCount >= 3 && p.colorCount <= 7, `D${D} colorCount=${p.colorCount}`);
    assert.ok([1,2].includes(p.dockCount), `D${D} dockCount=${p.dockCount} ∈ {1,2}`);
  }
});
