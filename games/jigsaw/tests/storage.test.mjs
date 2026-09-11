// filepath: games/jigsaw/tests/storage.test.mjs
// 存档层回归：损坏数据 normalize、越界钳制、降级不抛错、成绩只在更优时覆盖。
import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEY,
  normalize,
  load,
  save,
  current,
  isPersistent,
  recordResult,
  recordDaily,
  setMuted,
  setCurrent,
  isUnlocked,
  reset,
} from "../js/storage.mjs";
import { LEVELS, LEVEL_COUNT, levelAt } from "../js/levels.mjs";
import { createState, applyMove, snapshot, pieceAt } from "../js/engine.mjs";
import { PERFECT, DAILY_PERFECT } from "../js/score.mjs";

/** 临时注入一个内存版 localStorage，跑完还原（隐私模式降级另有单独用例） */
function withFakeStorage(fn) {
  const map = new Map();
  const fake = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    value: fake,
    configurable: true,
    writable: true,
  });
  try {
    return fn(map);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
}

/** 造一个"进行中"的合法快照：把属于 (0,0) 的碎片换到别处 */
function inProgressSnapshot(level) {
  const state = createState(level.n, level.seed);
  let holder = null;
  for (let r = 0; r < level.n && !holder; r++) {
    for (let c = 0; c < level.n && !holder; c++) {
      const piece = pieceAt(state, r, c);
      if (piece.r === 0 && piece.c === 0) holder = { r, c };
    }
  }
  const moved = applyMove(state, { from: { r: 0, c: 0 }, to: holder }).state;
  return snapshot(moved);
}

test("normalize：缺失 / 非法输入一律回落默认值，绝不抛错", () => {
  for (const input of [undefined, null, 0, "", "x", [], () => {}]) {
    const data = normalize(input);
    assert.equal(data.version, 1);
    assert.equal(data.unlocked, 1);
    assert.deepEqual(data.levels, {});
    assert.equal(data.current.levelId, LEVELS[0].id);
    assert.equal(data.current.state, null);
    assert.equal(data.prefs.muted, false);
    assert.equal(data.daily.dateKey, "");
    assert.equal(data.daily.bestScore, 0);
  }
});

test("normalize：越界与非法类型被钳制/丢弃", () => {
  const data = normalize({
    version: "x",
    unlocked: 9999,
    current: { levelId: "不存在", state: {} },
    levels: {
      l1: { cleared: true, bestScore: 99999, bestMoves: -3, bestTimeMs: -1 },
      l2: { cleared: false, bestScore: 700 },
      l3: { cleared: true, bestScore: Number.NaN },
      nope: { cleared: true, bestScore: 500 },
      l4: null,
    },
    daily: { dateKey: "not-a-date", bestScore: 5000 },
    prefs: { muted: "yes" },
  });
  assert.equal(data.unlocked, LEVEL_COUNT);
  assert.equal(data.levels.l1.bestScore, PERFECT, "超过满分必须钳制");
  assert.equal(data.levels.l1.bestMoves, 0);
  assert.equal(data.levels.l1.bestTimeMs, 0);
  assert.equal(data.levels.l2, undefined, "未通关的记录不保留");
  assert.equal(data.levels.l3.bestScore, 0, "NaN 应回落 0");
  assert.equal(data.levels.nope, undefined, "未知关卡 id 必须丢弃");
  assert.equal(data.levels.l4, undefined);
  assert.equal(data.daily.dateKey, "", "非法日期应丢弃");
  assert.equal(data.daily.bestScore, 0);
  assert.equal(data.prefs.muted, false);
  assert.equal(data.current.state, null, "非法进行中局面应丢弃");
});

test("normalize：解锁进度不得落后于已通关的最大关 + 1", () => {
  const data = normalize({ unlocked: 1, levels: { l5: { cleared: true, bestScore: 700 } } });
  assert.equal(data.unlocked, 6);
  const capped = normalize({ unlocked: 1, levels: { l50: { cleared: true, bestScore: 700 } } });
  assert.equal(capped.unlocked, LEVEL_COUNT);
});

test("normalize：进行中局面保留合法快照，丢弃损坏快照", () => {
  const level = levelAt(2);
  const good = normalize({
    unlocked: 5,
    current: { levelId: level.id, state: inProgressSnapshot(level) },
  });
  assert.equal(good.current.levelId, level.id);
  assert.ok(good.current.state, "合法快照应被保留");
  assert.ok(good.current.state.moves > 0);

  const bad = normalize({
    unlocked: 5,
    current: { levelId: level.id, state: { n: 3, order: [0, 0, 0], locked: [false, false, false] } },
  });
  assert.equal(bad.current.state, null);

  const lockedAhead = normalize({
    unlocked: 2,
    current: { levelId: levelAt(30).id, state: inProgressSnapshot(levelAt(30)) },
  });
  assert.equal(lockedAhead.current.state, null, "未解锁关卡的进度不应被恢复");
});

test("load / save：写入 localStorage 后可原样读回（含损坏 JSON 兜底）", () => {
  withFakeStorage((map) => {
    reset();
    assert.equal(isPersistent(), true);
    save({ unlocked: 7, levels: { l3: { cleared: true, bestScore: 640, bestMoves: 11, bestTimeMs: 42000 } } });
    assert.ok(map.has(STORAGE_KEY), "应写入约定 key");

    const raw = map.get(STORAGE_KEY);
    assert.ok(raw.includes("doin.jigsaw.v1") || raw.includes("unlocked"));

    const reloaded = load();
    assert.equal(reloaded.unlocked, 7);
    assert.equal(reloaded.levels.l3.bestScore, 640);
    assert.equal(reloaded.levels.l3.bestMoves, 11);

    map.set(STORAGE_KEY, "{ 这不是 JSON");
    const fallback = load();
    assert.equal(fallback.unlocked, 7, "损坏数据应回落到内存中的上一份好数据");
  });
});

test("localStorage 不可用时静默降级内存，不抛错", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  if (descriptor) delete globalThis.localStorage;
  try {
    reset();
    const saved = save({ unlocked: 3 });
    assert.equal(saved, false);
    assert.equal(isPersistent(), false);
    const data = load();
    assert.equal(data.unlocked, 3, "内存降级仍应保住本次会话的数据");
    assert.equal(current().unlocked, 3);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
  }
});

test("recordResult：只在更优时刷新，步数/用时取历史最好", () => {
  reset();
  const id = LEVELS[0].id;
  const first = recordResult(id, { score: 700, moves: 14, timeMs: 90_000 });
  assert.equal(first.isNewBest, true);
  assert.equal(first.data.levels[id].bestScore, 700);
  assert.equal(first.data.unlocked, 2, "通关第 1 关应解锁第 2 关");

  const worse = recordResult(id, { score: 650, moves: 20, timeMs: 120_000 });
  assert.equal(worse.isNewBest, false);
  assert.equal(worse.data.levels[id].bestScore, 700, "低分不应覆盖");
  assert.equal(worse.data.levels[id].bestMoves, 14, "步数取更少的那次");
  assert.equal(worse.data.levels[id].bestTimeMs, 90_000, "用时取更快的那次");

  const better = recordResult(id, { score: 790, moves: 9, timeMs: 40_000 });
  assert.equal(better.isNewBest, true);
  assert.equal(better.data.levels[id].bestScore, 790);
  assert.equal(better.data.levels[id].bestMoves, 9);
  assert.equal(better.data.levels[id].bestTimeMs, 40_000);

  const unknown = recordResult("l999", { score: 800, moves: 1, timeMs: 1 });
  assert.equal(unknown.isNewBest, false, "未知关卡不应写入");
});

test("recordResult：分数超过满分被钳制，且清空进行中局面", () => {
  reset();
  const id = LEVELS[0].id;
  const { data } = recordResult(id, { score: 99999, moves: 5, timeMs: 1000 });
  assert.equal(data.levels[id].bestScore, PERFECT);
  assert.equal(data.current.state, null, "通关后不应再保留进行中局面");
});

test("recordDaily：同日取更高分，跨日重置；上限 950", () => {
  reset();
  const day1 = recordDaily("2026-09-11", { score: 820 });
  assert.equal(day1.isNewBest, true);
  assert.equal(day1.data.daily.dateKey, "2026-09-11");
  assert.equal(day1.data.daily.bestScore, 820);

  const lower = recordDaily("2026-09-11", { score: 700 });
  assert.equal(lower.isNewBest, false);
  assert.equal(lower.data.daily.bestScore, 820);

  const higher = recordDaily("2026-09-11", { score: 900 });
  assert.equal(higher.isNewBest, true);
  assert.equal(higher.data.daily.bestScore, 900);

  const nextDay = recordDaily("2026-09-12", { score: 500 });
  assert.equal(nextDay.isNewBest, true);
  assert.equal(nextDay.data.daily.bestScore, 500, "换日应重置当天最佳");

  const clamped = recordDaily("2026-09-12", { score: 100000 });
  assert.equal(clamped.data.daily.bestScore, DAILY_PERFECT);

  const invalid = recordDaily("today", { score: 900 });
  assert.equal(invalid.isNewBest, false);
  assert.equal(invalid.data.daily.dateKey, "2026-09-12");
});

test("setMuted / setCurrent / isUnlocked / reset", () => {
  reset();
  assert.equal(setMuted(true).prefs.muted, true);
  assert.equal(setMuted(false).prefs.muted, false);

  const level = levelAt(0);
  const saved = setCurrent(level.id, inProgressSnapshot(level));
  assert.equal(saved.current.levelId, level.id);
  assert.ok(saved.current.state, "已解锁关卡的进行中局面应被保存");

  assert.equal(setCurrent(level.id, { n: 99 }).current.state, null, "非法快照应清空而不是写入");
  assert.equal(setCurrent("l999", inProgressSnapshot(level)).current.state, null, "未知关卡不应写入");

  // 未解锁关卡不占用 current 槽位（否则刷新后会"跳关"）
  const locked = levelAt(9);
  assert.equal(setCurrent(locked.id, inProgressSnapshot(locked)).current.state, null, "未解锁关卡不应写入");

  assert.equal(isUnlocked(0), true);
  assert.equal(isUnlocked(LEVEL_COUNT - 1), false);
  assert.equal(isUnlocked(-1), false);
  assert.equal(isUnlocked("0"), false);

  reset();
  assert.equal(current().unlocked, 1);
  assert.deepEqual(current().levels, {});
  assert.equal(current().current.state, null);
});
