// storage.test.mjs - the save file must survive junk, and stars must never be
// forgeable by hand-editing localStorage.

import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TRAVEL,
  SAVE_VERSION,
  STORAGE_KEY,
  emptyMeta,
  loadLastLevel,
  loadLocale,
  loadMeta,
  loadProgress,
  loadSound,
  normalizeMeta,
  recordLevel,
  resetBackendForTests,
  saveLastLevel,
  saveLocale,
  saveMeta,
  saveSound,
} from "../js/storage.mjs";
import { getLevel } from "../js/levels.mjs";
import { starsFor } from "../js/score.mjs";

class FakeStorage {
  constructor() {
    this.map = new Map();
    this.writes = 0;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.writes += 1;
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

function install(fake = new FakeStorage()) {
  globalThis.localStorage = fake;
  resetBackendForTests();
  return fake;
}

function uninstall() {
  delete globalThis.localStorage;
  resetBackendForTests();
}

test("空档: 默认值稳定，进度全空", () => {
  install();
  assert.deepEqual(loadMeta(), { version: SAVE_VERSION, sound: true, last: 1, best: {} });
  assert.deepEqual(emptyMeta(), loadMeta());
  const progress = loadProgress();
  assert.deepEqual(progress.cleared, {});
  assert.equal(progress.clearedCount, 0);
  assert.equal(progress.totalStars, 0);
  assert.equal(progress.maxStars, 60);
  uninstall();
});

test("存档: 只保留最短臂展，更好成绩才覆盖", () => {
  const fake = install();
  const first = recordLevel(1, 700);
  assert.equal(first.improved, true);
  assert.equal(first.best, 700);
  assert.equal(first.stars, starsFor(getLevel(1), 700));

  const worse = recordLevel(1, 900);
  assert.equal(worse.improved, false);
  assert.equal(worse.best, 700);

  const better = recordLevel(1, 620);
  assert.equal(better.improved, true);
  assert.equal(better.best, 620);
  assert.ok(fake.getItem(STORAGE_KEY).includes("620"));

  const progress = loadProgress();
  assert.equal(progress.cleared[1], starsFor(getLevel(1), 620));
  assert.equal(progress.clearedCount, 1);
  assert.equal(progress.maxStars, 60);
  uninstall();
});

test("防伪造: 手改存档改不出三星", () => {
  const fake = install();
  fake.setItem(STORAGE_KEY, JSON.stringify({ version: 1, best: { 1: 9000 } }));
  assert.equal(loadProgress().cleared[1], starsFor(getLevel(1), 9000));
  assert.ok(loadProgress().cleared[1] < 3, "远超标定的臂展只能拿一星");

  // 超出上限、负数、非数字一律丢弃
  fake.setItem(STORAGE_KEY, JSON.stringify({ version: 1, best: { 1: MAX_TRAVEL + 1, 2: -5, 3: "abc" } }));
  assert.deepEqual(loadProgress().best, {});
  uninstall();
});

test("脏存档: 坏 JSON / 非对象 / 数组 best 都回落到默认值", () => {
  const fake = install();
  fake.setItem(STORAGE_KEY, "{not json");
  assert.deepEqual(loadMeta(), emptyMeta());

  fake.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
  assert.deepEqual(loadMeta(), emptyMeta());

  fake.setItem(STORAGE_KEY, JSON.stringify({ version: 9, sound: false, last: 7, best: [4, 5] }));
  const meta = loadMeta();
  assert.equal(meta.version, SAVE_VERSION);
  assert.equal(meta.sound, false);
  assert.equal(meta.last, 7);
  assert.deepEqual(meta.best, {});
  uninstall();
});

test("脏存档: 越界关卡号被丢弃，合法项保留", () => {
  const fake = install();
  fake.setItem(STORAGE_KEY, JSON.stringify({ version: 1, best: { 0: 500, 21: 500, abc: 500, 5: 800 } }));
  assert.deepEqual(loadProgress().best, { 5: 800 });
  uninstall();
});

test("偏好: 音效与上次关卡往返", () => {
  install();
  assert.equal(loadSound(), true);
  saveSound(false);
  assert.equal(loadSound(), false);
  saveSound(true);
  assert.equal(loadSound(), true);

  assert.equal(loadLastLevel(), 1);
  assert.equal(saveLastLevel(12), true);
  assert.equal(loadLastLevel(), 12);
  saveLastLevel(21);
  assert.equal(loadLastLevel(), 12, "非法关卡号不应覆盖");
  uninstall();
});

test("语言: 走全站共享的 doin.lang 键", () => {
  const fake = install();
  assert.equal(loadLocale(), "zh");
  saveLocale("en");
  assert.equal(fake.getItem("doin.lang"), "en");
  assert.equal(loadLocale(), "en");
  saveLocale("fr");
  assert.equal(loadLocale(), "zh", "未知语言回落中文");
  uninstall();
});

test("降级: localStorage 被禁时改用内存后端，读写不抛错", () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  resetBackendForTests();
  assert.doesNotThrow(() => saveMeta({ best: { 2: 640 } }));
  assert.equal(loadProgress().best[2], 640);
  assert.doesNotThrow(() => saveLocale("en"));
  assert.equal(loadLocale(), "en", "内存后端在本次会话内依然记得选择");
  uninstall();
});

test("归一化: normalizeMeta 收敛任意输入", () => {
  assert.deepEqual(normalizeMeta(null), emptyMeta());
  assert.deepEqual(normalizeMeta("nope"), emptyMeta());
  assert.deepEqual(normalizeMeta({ last: 3, sound: 0, best: { 4: 611.4 } }), {
    version: SAVE_VERSION,
    sound: true,
    last: 3,
    best: { 4: 611 },
  });
});
