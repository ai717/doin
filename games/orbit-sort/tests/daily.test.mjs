import assert from "node:assert/strict";
import test from "node:test";

import { createDailyLevel, todayKey } from "../js/daily.mjs";
import { canExtract, extractOrb, undo } from "../engine.mjs";
import { createLevelState } from "../levels.mjs";

test("daily challenge 同日期 deterministic：同 dateKey 生成对象完全 deepEqual", () => {
  const dateKey = todayKey(new Date(2026, 8, 1));
  assert.equal(dateKey, "2026-09-01");
  const a = createDailyLevel(dateKey);
  const b = createDailyLevel(dateKey);
  // 去掉含 validation 的大对象比较，比较核心字段
  assert.equal(a.id, b.id);
  assert.equal(a.dateKey, b.dateKey);
  assert.equal(a.seed, b.seed);
  assert.equal(a.capacity, b.capacity);
  assert.equal(a.dockCount, b.dockCount);
  assert.deepEqual(a.tracks, b.tracks);
  assert.deepEqual(a.modifiers, b.modifiers);
  assert.equal(a.par, b.par);
});

test("连续 7 天样本：今日挑战产出高难度题 (D5-D7, dock=2, cap≥5, color≥5) 且每题 validation.valid=true", () => {
  const start = new Date(2026, 0, 1);
  let minPar = Infinity, maxPar = -Infinity;
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const daily = createDailyLevel(todayKey(date));
    assert.ok(daily, "level is generated");
    assert.equal(daily.id, "daily", `offset ${offset}`);
    assert.equal(daily.today, true, `offset ${offset} today=true`);
    assert.ok(Number.isInteger(daily.difficulty) && daily.difficulty >= 5 && daily.difficulty <= 6,
      `offset ${offset} 难度=${daily.difficulty}，应在 D5~D6（保证生产性能）`);
    assert.equal(daily.dockCount, 2, `offset ${offset} 应为双槽(=2)`);
    assert.ok(daily.capacity >= 5, `offset ${offset} capacity=${daily.capacity} ≥5`);
    const colors = new Set(daily.tracks.flat());
    assert.ok(colors.size >= 5, `offset ${offset} colorCount=${colors.size} ≥5`);
    assert.ok(daily.validation?.valid === true,
      `offset ${offset} validation.invalid, reason=${daily.validation?.reason ?? "unknown"}`);
    assert.ok(Number.isInteger(daily.par) && daily.par > 0, `offset ${offset} par 缺失`);
    minPar = Math.min(minPar, daily.par);
    maxPar = Math.max(maxPar, daily.par);
  }
  console.log(`7 天样本 par ∈ [${minPar}, ${maxPar}]`);
  assert.ok(minPar >= 10, "高难度题 par 下限不应低于 10");
});

test("daily dateKey identity survives state transitions + undo (撤回不破坏 identity)", () => {
  const level = createDailyLevel("2026-09-01");
  assert.ok(level, "daily level generated");
  const state = createLevelState(level);
  const track = state.tracks.find((item) => canExtract(state, item.id));
  assert.ok(track, "存在可 extract 轨道");
  const extracted = extractOrb(state, track.id);
  assert.equal(extracted.dateKey, level.dateKey, "extract 后 state 携带 dateKey");
  const undone = undo(extracted);
  assert.equal(undone.dateKey, level.dateKey, "undo 后 state 仍携带 dateKey");
  assert.ok(undone.stats.movesPlayed >= extracted.stats.movesPlayed, "撤回 movesPlayed 不减少 (只增不减)");
});
