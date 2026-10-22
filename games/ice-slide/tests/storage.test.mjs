// filepath: games/ice-slide/tests/storage.test.mjs
// 存档口径测试：清洗归一、通关纪录最优覆盖、解锁推进、每日一局跨日、内存降级、reset。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  normalize,
  load,
  save,
  current,
  recordResult,
  recordDaily,
  isDailyDone,
  setMuted,
  setCurrent,
  isUnlocked,
  reset,
} from "../js/storage.mjs";

test("storage: 存档 key 为 doin.ice-slide.v1", () => {
  assert.equal(STORAGE_KEY, "doin.ice-slide.v1");
});

test("storage: normalize 严格清洗（脏数据回落，不抛错）", () => {
  const n = normalize({
    unlocked: "x",
    current: 999,
    muted: 1,
    levels: { level_1: { cleared: true, stars: 99, bestMoves: -5 }, bogus: { cleared: true }, level_2: { cleared: false } },
    daily: { date: "2026-10-19T23:59:59Z", done: "yes", moves: "abc" },
  });
  assert.equal(n.unlocked, 2); // level_1 已通关 -> 推导解锁第 2 关（与 sokoban 同口径）
  assert.equal(n.current, 1); // current=999 先钳到 31，再钳到 unlocked-1=1
  assert.equal(n.muted, false);
  assert.deepEqual(Object.keys(n.levels), ["level_1"]);
  assert.equal(n.levels.level_1.stars, 3); // 99 钳制到 3
  assert.equal(n.levels.level_1.bestMoves, 0); // -5 钳制到 0
  assert.equal(n.daily.date, "2026-10-19"); // ISO 截断到日期
  assert.equal(n.daily.done, false); // "yes" !== true
  assert.equal(normalize(null).unlocked, 1);
  assert.equal(normalize("broken").unlocked, 1);
});

test("storage: 解锁进度由已通关最大关推导", () => {
  const n = normalize({ unlocked: 1, levels: { level_3: { cleared: true, stars: 2, bestMoves: 5 } } });
  assert.equal(n.unlocked, 4); // 通关第 3 关 -> 解锁到第 4 关
  assert.equal(n.current, 0); // current 不得越出解锁范围
});

test("storage: recordResult 最优覆盖（stars 取大、bestMoves 取小）", () => {
  reset();
  const r1 = recordResult("level_1", { moves: 2, stars: 2 });
  assert.equal(r1.isNewBest, true);
  assert.equal(current().levels.level_1.bestMoves, 2);
  assert.equal(current().levels.level_1.stars, 2);
  // 更差成绩不覆盖步数，但更高星级覆盖
  const r2 = recordResult("level_1", { moves: 5, stars: 3 });
  assert.equal(r2.isNewBest, true);
  assert.equal(current().levels.level_1.bestMoves, 2);
  assert.equal(current().levels.level_1.stars, 3);
  // 全维度更差 -> 非新纪录
  const r3 = recordResult("level_1", { moves: 6, stars: 1 });
  assert.equal(r3.isNewBest, false);
  assert.equal(current().levels.level_1.bestMoves, 2);
  assert.equal(current().levels.level_1.stars, 3);
  // 未知关卡静默忽略
  const r4 = recordResult("level_999", { moves: 1, stars: 3 });
  assert.equal(r4.isNewBest, false);
  // 解锁推进：通关 level_1 后 index 1（第 2 关）已解锁，index 2 未解锁
  assert.equal(current().unlocked, 2);
  assert.equal(isUnlocked(0), true);
  assert.equal(isUnlocked(1), true);
  assert.equal(isUnlocked(2), false);
});

test("storage: 每日一局当日只此一局、跨日作废", () => {
  reset();
  assert.equal(isDailyDone("2026-10-19"), false);
  const r1 = recordDaily("2026-10-19", 12);
  assert.equal(r1.isNew, true);
  assert.equal(isDailyDone("2026-10-19"), true);
  assert.equal(current().daily.moves, 12);
  // 同日再玩不刷新
  const r2 = recordDaily("2026-10-19", 3);
  assert.equal(r2.isNew, false);
  assert.equal(current().daily.moves, 12);
  // 跨日期重新可玩
  assert.equal(isDailyDone("2026-10-20"), false);
  const r3 = recordDaily("2026-10-20", 7);
  assert.equal(r3.isNew, true);
  assert.equal(current().daily.moves, 7);
});

test("storage: setMuted / setCurrent / isUnlocked 边界钳制", () => {
  reset();
  setMuted(true);
  assert.equal(current().muted, true);
  setCurrent(0);
  assert.equal(current().current, 0);
  setCurrent(99); // 越界钳到 unlocked-1
  assert.equal(current().current, 0);
  recordResult("level_2", { moves: 3, stars: 3 });
  setCurrent(1);
  assert.equal(current().current, 1);
  setCurrent(5); // 越界钳到 unlocked-1（通关 level_2 后 unlocked=3 -> index 2）
  assert.equal(current().current, 2);
  assert.equal(isUnlocked(2), true);
  assert.equal(isUnlocked(3), false);
});

test("storage: 无 localStorage 环境静默降级内存（Node 天然无 localStorage）", () => {
  reset();
  assert.equal(typeof localStorage, "undefined");
  const data = load();
  assert.equal(data.unlocked, 1);
  const r = recordResult("level_1", { moves: 1, stars: 3 });
  assert.equal(r.data.levels.level_1.cleared, true); // 内存内仍可用
  assert.equal(current().levels.level_1.bestMoves, 1);
});

test("storage: reset 清空全部进度", () => {
  reset();
  recordResult("level_1", { moves: 1, stars: 3 });
  recordDaily("2026-10-19", 5);
  setMuted(true);
  const n = reset();
  assert.equal(n.unlocked, 1);
  assert.deepEqual(n.levels, {});
  assert.equal(n.muted, false);
  assert.equal(n.daily.done, false);
});

test("storage: save/load 往返（内存后端）", () => {
  reset();
  recordResult("level_5", { moves: 4, stars: 2 });
  const snap = JSON.parse(JSON.stringify(current()));
  const reloaded = load();
  assert.equal(reloaded.levels.level_5.bestMoves, 4);
  assert.equal(reloaded.levels.level_5.stars, 2);
  assert.deepEqual(reloaded.levels, snap.levels);
  // save 显式调用不抛错
  assert.doesNotThrow(() => save(snap));
});
