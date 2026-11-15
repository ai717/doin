// 存档契约：坏数据归一化、降级内存回退、往返一致、AI 阶梯解锁、
// doin.lang 全站共享 key、sound key 读写。

import test from "node:test";
import assert from "node:assert/strict";
import {
  LANG_KEY,
  STORAGE_KEY,
  aiUnlocked,
  emptyProgress,
  loadLocale,
  loadProgress,
  loadSound,
  normalizeProgress,
  recordMatchResult,
  resetBackendForTests,
  saveLocale,
  saveProgress,
  saveSound,
} from "../js/storage.mjs";

test("normalizeProgress discards junk and keeps sane fields", () => {
  assert.deepEqual(normalizeProgress(null), emptyProgress());
  assert.deepEqual(normalizeProgress("junk"), emptyProgress());
  assert.deepEqual(normalizeProgress({ version: 99, wins: 5 }), emptyProgress());
  const good = normalizeProgress({ version: 1, wins: 3, losses: 4, lastMode: "duo", lastAi: "master" });
  assert.deepEqual(good, { version: 1, wins: 3, losses: 4, lastMode: "duo", lastAi: "master" });
  const clamped = normalizeProgress({ version: 1, wins: -8, losses: 1e9, lastMode: "hack", lastAi: "nope" });
  assert.equal(clamped.wins, 0);
  assert.equal(clamped.losses, 0);
  assert.equal(clamped.lastMode, "quick");
  assert.equal(clamped.lastAi, "novice");
  const weird = normalizeProgress({ version: 1, wins: "7", losses: null });
  assert.equal(weird.wins, 7);
  assert.equal(weird.losses, 0);
});

test("save/load round-trip survives normalization", () => {
  resetBackendForTests();
  saveProgress({ version: 1, wins: 12, losses: 5, lastMode: "2p", lastAi: "skilled" });
  const loaded = loadProgress();
  assert.deepEqual(loaded, { version: 1, wins: 12, losses: 5, lastMode: "2p", lastAi: "skilled" });
  saveProgress({ version: 1, wins: NaN, losses: "x" });
  assert.equal(loadProgress().wins, 0);
});

test("recordMatchResult counts wins and losses only", () => {
  const base = emptyProgress();
  const won = recordMatchResult(base, true);
  assert.equal(won.wins, 1);
  assert.equal(won.losses, 0);
  const lost = recordMatchResult(won, false);
  assert.equal(lost.wins, 1);
  assert.equal(lost.losses, 1);
  const drawn = recordMatchResult(lost, undefined);
  assert.equal(drawn.wins, 1);
  assert.equal(drawn.losses, 1);
  // 输入不被篡改
  assert.deepEqual(base, emptyProgress());
});

test("AI ladder unlock thresholds", () => {
  const zero = emptyProgress();
  assert.equal(aiUnlocked(zero, "novice"), true);
  assert.equal(aiUnlocked(zero, "skilled"), false);
  assert.equal(aiUnlocked(zero, "master"), false);
  const one = { ...zero, wins: 1 };
  assert.equal(aiUnlocked(one, "skilled"), true);
  assert.equal(aiUnlocked(one, "master"), false);
  const three = { ...zero, wins: 3 };
  assert.equal(aiUnlocked(three, "master"), true);
});

test("locale uses the shared doin.lang key and defaults to zh", () => {
  resetBackendForTests();
  assert.equal(loadLocale(), "zh");
  saveLocale("en");
  assert.equal(loadLocale(), "en");
  saveLocale("fr");
  assert.equal(loadLocale(), "zh");
  assert.equal(LANG_KEY, "doin.lang");
});

test("sound preference round-trips with bad-data tolerance", () => {
  resetBackendForTests();
  assert.equal(loadSound(), true);
  saveSound(false);
  assert.equal(loadSound(), false);
  saveSound(1);
  assert.equal(loadSound(), true);
});

test("storage key follows the doin.<slug>.v1 convention", () => {
  assert.equal(STORAGE_KEY, "doin.richman.v1");
});

test("degrades silently when localStorage throws", () => {
  resetBackendForTests();
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
      removeItem() {
        throw new Error("blocked");
      },
    },
  });
  try {
    // 读取与写入都不得抛错：降级到内存后端后本会话内往返一致
    const progress = loadProgress();
    assert.deepEqual(progress, emptyProgress());
    const payload = { ...emptyProgress(), wins: 4, losses: 2 };
    assert.equal(saveProgress(payload), true, "memory backend accepts the write");
    assert.deepEqual(loadProgress(), payload, "memory backend round-trips");
    assert.equal(loadLocale(), "zh");
    saveLocale("en");
    assert.equal(loadLocale(), "en", "shared lang key works on the memory backend");
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: original,
    });
    resetBackendForTests();
  }
});
