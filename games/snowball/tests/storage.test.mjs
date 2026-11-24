import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  LEVEL_COUNT,
  defaultProgress,
  normalize,
  load,
  save,
  remember,
  recordLevel,
  recordRush,
  levelRecord,
  totalStars,
  resetBackendForTests,
} from "../js/storage.mjs";

function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("存档：默认结构与空数据归一化", () => {
  const base = defaultProgress();
  assert.equal(base.version, 1);
  assert.deepEqual(base.stars, {});
  assert.equal(base.current.mode, "level");
  assert.equal(base.current.levelIndex, 0);
  assert.deepEqual(normalize(null), base);
  assert.deepEqual(normalize("junk"), base);
  assert.deepEqual(normalize({ stars: {} }).current.levelIndex, 0);
});

test("存档：坏字段被夹取，未知关卡被丢弃", () => {
  const normalized = normalize({
    stars: {
      snow_01: { stars: 9, score: -20, chain: 999 },
      snow_31: { stars: 2, score: 10, chain: 1 },
      vitals: { stars: 3 },
    },
    rush: { best: -5, kills: 99999 },
    current: { mode: "weird", levelIndex: 999 },
  });
  assert.equal(normalized.stars.snow_01.stars, 3);
  assert.equal(normalized.stars.snow_01.score, 0);
  assert.equal(normalized.stars.snow_01.chain, 99);
  assert.equal(normalized.stars.snow_31, undefined);
  assert.equal(normalized.stars.vitals, undefined);
  assert.equal(normalized.rush.best, 0);
  assert.equal(normalized.rush.kills, 9999);
  assert.equal(normalized.current.mode, "level");
  assert.equal(normalized.current.levelIndex, LEVEL_COUNT - 1);
});

test("存档：关卡成绩只增不减", () => {
  const progress = defaultProgress();
  recordLevel(progress, "snow_01", 2, 400, 2);
  recordLevel(progress, "snow_01", 1, 900, 1);
  recordLevel(progress, "snow_01", 3, 300, 5);
  const record = levelRecord(progress, "snow_01");
  assert.equal(record.stars, 3);
  assert.equal(record.score, 900);
  assert.equal(record.chain, 5);
  assert.equal(levelRecord(progress, "snow_02"), null);
});

test("存档：冲刺最佳成绩只升不降", () => {
  const progress = defaultProgress();
  recordRush(progress, 1200, 6);
  recordRush(progress, 800, 9);
  assert.equal(progress.rush.best, 1200);
  assert.equal(progress.rush.kills, 9);
});

test("存档：记忆模式与关卡并夹取范围", () => {
  const progress = defaultProgress();
  remember(progress, "rush", 4);
  assert.deepEqual(progress.current, { mode: "rush", levelIndex: 4 });
  remember(progress, "level", 999);
  assert.deepEqual(progress.current, { mode: "level", levelIndex: LEVEL_COUNT - 1 });
  remember(progress, "level", -3);
  assert.equal(progress.current.levelIndex, 0);
});

test("存档：总星数统计", () => {
  const progress = defaultProgress();
  assert.equal(totalStars(progress), 0);
  recordLevel(progress, "snow_01", 3, 100, 0);
  recordLevel(progress, "snow_02", 2, 100, 0);
  assert.equal(totalStars(progress), 5);
});

test("存档：写入后可完整读回", () => {
  globalThis.localStorage = fakeStorage();
  resetBackendForTests();
  const progress = defaultProgress();
  recordLevel(progress, "snow_05", 3, 1500, 4);
  recordRush(progress, 2600, 13);
  remember(progress, "rush", 9);
  assert.equal(save(progress), true);
  const loaded = load();
  assert.deepEqual(loaded.stars, progress.stars);
  assert.deepEqual(loaded.rush, progress.rush);
  assert.deepEqual(loaded.current, progress.current);
  assert.ok(globalThis.localStorage.map.has(STORAGE_KEY));
});

test("存档：损坏 JSON 静默回退默认值", () => {
  const storage = fakeStorage();
  storage.setItem(STORAGE_KEY, "{not-json");
  globalThis.localStorage = storage;
  resetBackendForTests();
  assert.deepEqual(load(), defaultProgress());
});

test("存档：存储抛错时静默降级内存且不崩溃", () => {
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
  const progress = defaultProgress();
  recordLevel(progress, "snow_01", 3, 500, 2);
  assert.equal(save(progress), true);
  const loaded = load();
  assert.equal(loaded.stars.snow_01.stars, 3);
  remember(loaded, "rush", 3);
  assert.equal(loaded.current.mode, "rush");
});
