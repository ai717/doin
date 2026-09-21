// 森林冰火人 · 存储层测试
// 覆盖：默认态、损坏数据归一化、通关结算（解锁/星级/最佳用时）、内存降级

import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  defaultState,
  normalize,
  load,
  save,
  recordClear,
  recordPlay,
  chapterUnlocked,
  chapterStars,
  resetBackendForTests
} from "../js/storage.mjs";
import { LEVEL_COUNT } from "../js/levels.mjs";

test("存储 Key 统一为 doin.fire-ice.v1", () => {
  assert.equal(STORAGE_KEY, "doin.fire-ice.v1");
});

test("损坏数据归一化回默认，绝不抛错", () => {
  resetBackendForTests();
  // 直接塞损坏 JSON
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, "{oops not json");
  } catch {
    // node 环境无 localStorage → 内存 fallback，直接验证 normalize
  }
  const d = normalize("garbage");
  assert.equal(d.progress.unlocked, 1);
  assert.deepEqual(d.progress.stars, {});
});

test("normalize 校验非法字段（越界星级/负数用时/超限解锁）", () => {
  const raw = {
    version: 999,
    prefs: { muted: 1 },
    progress: {
      unlocked: 9999,
      stars: { 0: 7, 1: -3, 2: "abc" },
      bestTime: { 0: -5, 1: 12.5 },
      plays: { 0: "x" }
    }
  };
  const n = normalize(raw);
  assert.equal(n.progress.unlocked, LEVEL_COUNT);
  assert.equal(n.progress.stars[0], 3);
  assert.equal(n.progress.stars[1], 1);
  assert.equal(n.progress.stars[2], 1);
  assert.equal(n.progress.bestTime[0], undefined);
  assert.equal(n.progress.bestTime[1], 12.5);
  assert.equal(n.progress.plays[0], 0);
  assert.equal(n.prefs.muted, true);
});

test("load/save 往返一致", () => {
  resetBackendForTests();
  const s = defaultState();
  s.progress.unlocked = 5;
  s.progress.stars[2] = 3;
  assert.equal(save(s), true);
  const loaded = load();
  assert.equal(loaded.progress.unlocked, 5);
  assert.equal(loaded.progress.stars[2], 3);
});

test("recordClear：解锁下一关、星级取最大值、最佳用时取更小", () => {
  resetBackendForTests();
  let store = defaultState();

  // 第一次通关第 0 关：2 星、100s
  store = recordClear(store, { levelIndex: 0, stars: 2, elapsed: 100 });
  assert.equal(store.progress.unlocked, 2, "通关后解锁下一关");
  assert.equal(store.progress.stars[0], 2);
  assert.equal(store.progress.bestTime[0], 100);
  assert.equal(store.progress.plays[0], 1);

  // 再次通关：1 星不降级、更快用时覆盖
  store = recordClear(store, { levelIndex: 0, stars: 1, elapsed: 80 });
  assert.equal(store.progress.stars[0], 2, "星级只升不降");
  assert.equal(store.progress.bestTime[0], 80, "最佳用时取更小");
  assert.equal(store.progress.plays[0], 2);

  // 3 星覆盖 2 星
  store = recordClear(store, { levelIndex: 0, stars: 3, elapsed: 90 });
  assert.equal(store.progress.stars[0], 3);
  assert.equal(store.progress.bestTime[0], 80, "更慢但 3 星不覆盖最佳用时");
});

test("章节解锁与星级汇总", () => {
  resetBackendForTests();
  let store = defaultState();
  // 默认只解锁第 1 章
  assert.equal(chapterUnlocked(store, { from: 0, to: 7 }), true);
  assert.equal(chapterUnlocked(store, { from: 8, to: 15 }), false);

  // 通关到第 2 章
  store = recordClear(store, { levelIndex: 7, stars: 3, elapsed: 60 });
  assert.equal(store.progress.unlocked, 9);
  assert.equal(chapterUnlocked(store, { from: 8, to: 15 }), true);

  store.progress.stars[0] = 3;
  store.progress.stars[1] = 2;
  assert.equal(chapterStars(store, { from: 0, to: 7 }), 8, "含 recordClear(7) 的星级");

  // 星级汇总独立验证（干净 store，避免 recordClear(7) 干扰期望）
  const s2 = defaultState();
  s2.progress.stars[0] = 3;
  s2.progress.stars[1] = 2;
  assert.equal(chapterStars(s2, { from: 0, to: 7 }), 5);
});

test("recordPlay 仅记录游玩次数", () => {
  resetBackendForTests();
  let store = defaultState();
  store = recordPlay(store, 3);
  store = recordPlay(store, 3);
  assert.equal(store.progress.plays[3], 2);
});
