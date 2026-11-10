import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_CASE_ID,
  SAVE_VERSION,
  STORAGE_KEY,
  emptyProgress,
  loadLastCase,
  loadLocale,
  loadProgress,
  loadSound,
  normalizeProgress,
  recordCase,
  resetBackendForTests,
  saveLastCase,
  saveLocale,
  saveProgress,
  saveSound,
} from "../js/storage.mjs";

beforeEach(() => {
  resetBackendForTests();
});

test("空存档：结构完整、没有任何案件记录", () => {
  const progress = loadProgress();
  assert.equal(progress.version, SAVE_VERSION);
  assert.deepEqual(progress.cases, {});
  assert.equal(progress.lastCase, 1);
  assert.deepEqual(emptyProgress(), progress);
});

test("往返一致：写入后读回同样的记录", () => {
  let progress = loadProgress();
  progress = recordCase(progress, 3, { timeMs: 88_000, mistakes: 1, stars: 2 });
  assert.equal(saveProgress(progress), true);
  const loaded = loadProgress();
  assert.deepEqual(loaded.cases[3], { timeMs: 88_000, mistakes: 1, stars: 2 });
  assert.equal(loaded.lastCase, 3);
});

test("归一化：垃圾数据一律丢弃而不是让整份存档失效", () => {
  assert.deepEqual(normalizeProgress(null), emptyProgress());
  assert.deepEqual(normalizeProgress("nonsense"), emptyProgress());
  assert.deepEqual(normalizeProgress({ version: 99, cases: { 1: { timeMs: 1, mistakes: 0, stars: 3 } } }), emptyProgress());

  const messy = normalizeProgress({
    version: SAVE_VERSION,
    lastCase: 999,
    cases: {
      1: { timeMs: 60_000, mistakes: 0, stars: 3 },
      2: { timeMs: -1, mistakes: 0, stars: 3 },
      3: { timeMs: 60_000, mistakes: 0, stars: 9 },
      4: { timeMs: 60_000, mistakes: 0, stars: 3 },
      99: { timeMs: 60_000, mistakes: 0, stars: 3 },
      abc: { timeMs: 60_000, mistakes: 0, stars: 3 },
      "0": { timeMs: 60_000, mistakes: 0, stars: 3 },
    },
  });
  assert.deepEqual(Object.keys(messy.cases).sort(), ["1", "4"]);
  assert.equal(messy.lastCase, MAX_CASE_ID, "越界的 lastCase 被夹回最大值");
});

test("更优记录才覆盖：零误判胜过更快的错误记录", () => {
  let progress = emptyProgress();
  progress = recordCase(progress, 5, { timeMs: 50_000, mistakes: 2, stars: 1 });
  progress = recordCase(progress, 5, { timeMs: 120_000, mistakes: 0, stars: 3 });
  assert.equal(progress.cases[5].mistakes, 0);
  progress = recordCase(progress, 5, { timeMs: 40_000, mistakes: 1, stars: 2 });
  assert.equal(progress.cases[5].mistakes, 0, "更差的记录不得覆盖");
  progress = recordCase(progress, 5, { timeMs: 90_000, mistakes: 0, stars: 3 });
  assert.equal(progress.cases[5].timeMs, 90_000, "同为零误判时取更短用时");
});

test("非法记录写入被静默忽略，盘面存档不变", () => {
  const progress = emptyProgress();
  assert.deepEqual(recordCase(progress, 2, null), progress);
  assert.deepEqual(recordCase(progress, 2, { timeMs: NaN, mistakes: 0, stars: 3 }), progress);
  assert.deepEqual(recordCase(progress, 2, { timeMs: 1000, mistakes: -1, stars: 3 }), progress);
  assert.deepEqual(recordCase(progress, 2, { timeMs: 1000, mistakes: 0, stars: 0 }), progress);
});

test("上次案件：读写一致且越界被夹紧", () => {
  saveLastCase(7);
  assert.equal(loadLastCase(), 7);
  saveLastCase(0);
  assert.equal(loadLastCase(), 1);
  saveLastCase(9999);
  assert.equal(loadLastCase(), MAX_CASE_ID);
});

test("语言偏好走全站共享 key doin.lang", () => {
  saveLocale("en");
  assert.equal(loadLocale(), "en");
  saveLocale("zh");
  assert.equal(loadLocale(), "zh");
  saveLocale("klingon");
  assert.equal(loadLocale(), "zh", "未知语言回落到中文");
});

test("音效开关往返", () => {
  assert.equal(loadSound(), true, "默认开音效");
  saveSound(false);
  assert.equal(loadSound(), false);
  saveSound(true);
  assert.equal(loadSound(), true);
});

test("存储被禁时不抛错，静默降级内存后端", () => {
  const broken = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("SecurityError");
    },
    removeItem() {
      throw new Error("SecurityError");
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", { value: broken, configurable: true, writable: true });
    resetBackendForTests();
    assert.doesNotThrow(() => loadProgress());
    assert.doesNotThrow(() => saveProgress(emptyProgress()));
    assert.deepEqual(loadProgress(), emptyProgress(), "降级后端从空白开始");
    assert.doesNotThrow(() => saveLocale("en"));
    assert.equal(loadLocale(), "en", "降级后语言偏好仍能在本次会话内往返");
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
    resetBackendForTests();
  }
});

test("后端可重置：测试之间不串数据", () => {
  saveProgress(recordCase(emptyProgress(), 1, { timeMs: 10_000, mistakes: 0, stars: 3 }));
  assert.ok(loadProgress().cases[1]);
  resetBackendForTests();
  assert.equal(loadProgress().cases[1], undefined);
  assert.ok(STORAGE_KEY.startsWith("doin.detective."));
});
