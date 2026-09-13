import assert from "node:assert/strict";
import test from "node:test";

import {
  DATA_VERSION,
  STORAGE_KEY,
  defaultData,
  isUsingMemory,
  loadData,
  normalize,
  recordRun,
  saveData,
  setStore,
  setSound,
  unlockTier
} from "../js/storage.mjs";

function fakeStore(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    }
  };
}

function brokenStore() {
  return {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    }
  };
}

test("存档 Key 与版本号固定", () => {
  assert.equal(STORAGE_KEY, "doin.bubble-bloom.v1");
  assert.equal(DATA_VERSION, 1);
  const fresh = defaultData();
  assert.equal(fresh.codex.length, 10);
  assert.equal(fresh.best.score, 0);
  assert.equal(fresh.sound, true);
});

test("空存档回退默认值", () => {
  const store = fakeStore();
  setStore(store);
  assert.deepEqual(loadData(), defaultData());
  setStore(null);
});

test("坏 JSON 不白屏", () => {
  setStore(fakeStore({ [STORAGE_KEY]: "{not json" }));
  assert.deepEqual(loadData(), defaultData());
  setStore(fakeStore({ [STORAGE_KEY]: "null" }));
  assert.deepEqual(loadData(), defaultData());
  setStore(fakeStore({ [STORAGE_KEY]: "[]" }));
  assert.deepEqual(loadData(), defaultData());
  setStore(fakeStore({ [STORAGE_KEY]: '"hello"' }));
  assert.deepEqual(loadData(), defaultData());
  setStore(null);
});

test("缺失字段补齐", () => {
  setStore(fakeStore({ [STORAGE_KEY]: JSON.stringify({ score: 5 }) }));
  const data = loadData();
  assert.equal(data.version, DATA_VERSION);
  assert.equal(data.sound, true);
  assert.equal(data.best.score, 0);
  assert.equal(data.daily.date, "");
  assert.deepEqual(data.codex, new Array(10).fill(false));
  assert.deepEqual(data.badges, { chain3: false, king: false, bloom: false });
  setStore(null);
});

test("错误类型被 normalize 修正", () => {
  const cleaned = normalize({
    sound: "yes",
    best: { score: "1200", tier: "5", chain: "3", drops: "20" },
    daily: { date: 12345, score: "abc" },
    codex: "not an array",
    badges: "nope"
  });
  assert.equal(cleaned.sound, true);
  assert.equal(cleaned.best.score, 1200);
  assert.equal(cleaned.best.tier, 5);
  assert.equal(cleaned.daily.score, 0);
  assert.equal(cleaned.daily.date, "");
  assert.equal(cleaned.codex.length, 10);
  assert.deepEqual(cleaned.badges, { chain3: false, king: false, bloom: false });
});

test("负数、NaN、Infinity 与越界数值被钳制", () => {
  const cleaned = normalize({
    best: { score: Number.NaN, tier: -3, chain: Infinity, drops: -10 },
    daily: { score: 1e12, tier: 99, chain: -1, drops: Number.POSITIVE_INFINITY }
  });
  assert.equal(cleaned.best.score, 0);
  assert.equal(cleaned.best.tier, 0);
  assert.equal(cleaned.best.chain, 0);
  assert.equal(cleaned.best.drops, 0);
  assert.equal(cleaned.daily.score, 99999999);
  assert.equal(cleaned.daily.tier, 10);
  assert.equal(cleaned.daily.chain, 0);
  assert.equal(cleaned.daily.drops, 0);
});

test("图鉴解锁与音效开关会落盘", () => {
  let data = defaultData();
  const first = unlockTier(data, 3);
  assert.equal(first.changed, true);
  assert.equal(first.data.codex[2], true);
  assert.equal(unlockTier(first.data, 3).changed, false);
  assert.equal(unlockTier(first.data, 0).changed, false, "0 阶不是合法阶级");
  assert.equal(unlockTier(first.data, 99).changed, false, "越界阶级被忽略");
  assert.equal(unlockTier(first.data, 10).data.codex[9], true);
  data = setSound(first.data, false);
  assert.equal(data.sound, false);
});

test("标准舱纪录：更高分才算新纪录，最高阶与连锁持续累积", () => {
  let data = defaultData();
  let res = recordRun(data, { mode: "standard", score: 500, tier: 4, chain: 2, drops: 30 });
  assert.equal(res.isRecord, true);
  assert.equal(res.data.best.score, 500);
  data = res.data;

  res = recordRun(data, { mode: "standard", score: 300, tier: 8, chain: 5, drops: 40 });
  assert.equal(res.isRecord, false);
  assert.equal(res.data.best.score, 500);
  assert.equal(res.data.best.tier, 8);
  assert.equal(res.data.best.chain, 5);
});

test("每日试验：换日重置，同日只取最高分", () => {
  let data = defaultData();
  let res = recordRun(data, { mode: "daily", date: "2026-09-13", score: 800, tier: 5, chain: 3, drops: 40 });
  assert.equal(res.isRecord, true);
  assert.equal(res.data.daily.date, "2026-09-13");
  data = res.data;

  res = recordRun(data, { mode: "daily", date: "2026-09-13", score: 600, tier: 6, chain: 4, drops: 50 });
  assert.equal(res.isRecord, false);
  assert.equal(res.data.daily.score, 800);
  assert.equal(res.data.daily.tier, 6);
  data = res.data;

  res = recordRun(data, { mode: "daily", date: "2026-09-14", score: 10, tier: 2, chain: 1, drops: 5 });
  assert.equal(res.isRecord, true);
  assert.equal(res.data.daily.date, "2026-09-14");
  assert.equal(res.data.daily.score, 10);
});

test("坏 run 输入也不会写脏数据", () => {
  const res = recordRun(defaultData(), null);
  assert.equal(res.data.best.score, 0);
  const res2 = recordRun(defaultData(), { mode: "standard", score: Number.NaN, tier: -1, chain: 1e9, drops: -5 });
  assert.equal(res2.data.best.score, 0);
  assert.equal(res2.data.best.chain, 9999);
});

test("localStorage 不可用时静默降级，不抛错", () => {
  setStore(brokenStore());
  assert.deepEqual(loadData(), defaultData());
  assert.doesNotThrow(() => {
    saveData(defaultData());
  });
  setStore(null);
});

test("无外部存储时走内存存档并可回读", () => {
  setStore(null);
  const saved = saveData(Object.assign(defaultData(), { sound: false }));
  assert.equal(saved.sound, false);
  const back = loadData();
  assert.equal(back.sound, false);
  assert.ok(typeof isUsingMemory() === "boolean");
});
