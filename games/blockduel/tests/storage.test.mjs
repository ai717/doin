import test from "node:test";
import assert from "node:assert/strict";

import {
  SAVE_KEY,
  defaultSave,
  normalize,
  loadSave,
  recordStageResult,
  recordSeries,
  setPreferences,
  highestUnlocked,
} from "../js/storage.mjs";

test("无 localStorage 时静默降级为默认内存态", () => {
  assert.deepEqual(loadSave(), defaultSave());
});

test("损坏存档必须归一化为安全默认值", () => {
  assert.deepEqual(normalize(null), defaultSave());
  assert.deepEqual(normalize("broken"), defaultSave());
  assert.deepEqual(normalize({ cleared: "x", bestStage: 999, mode: "??", bestOf: 7, sound: "no" }), {
    cleared: [],
    bestStage: 21,
    lastStage: 0,
    mode: "solo",
    bestOf: 3,
    sound: true,
    wins: 0,
    losses: 0,
    played: 0,
  });
});

test("cleared 去重、排序并夹在 0..21", () => {
  const save = normalize({ cleared: [5, 1, 5, -3, 40] });
  assert.deepEqual(save.cleared, [0, 1, 5, 21]);
});

test("通关记录解锁下一关并累计战绩", () => {
  const start = defaultSave();
  const next = recordStageResult(start, 3, true);
  assert.deepEqual(next.cleared, [3]);
  assert.equal(next.bestStage, 4);
  assert.equal(next.lastStage, 4);
  assert.equal(next.wins, 1);
  assert.equal(next.played, 1);
  assert.equal(highestUnlocked(next), 4);

  const lost = recordStageResult(next, 4, false);
  assert.equal(lost.losses, 1);
  assert.equal(lost.played, 2);
  assert.equal(lost.bestStage, 4, "失败不推进解锁");
});

test("末关通关不越界", () => {
  const next = recordStageResult(defaultSave(), 21, true);
  assert.equal(next.bestStage, 21);
  assert.equal(next.lastStage, 21);
});

test("双人战绩只记录胜负，不写天梯进度", () => {
  const next = recordSeries(defaultSave(), "versus", true);
  assert.equal(next.wins, 1);
  assert.equal(next.played, 1);
  assert.equal(next.mode, "versus");
  assert.deepEqual(next.cleared, []);
});

test("偏好写入受白名单约束", () => {
  const next = setPreferences(defaultSave(), { mode: "versus", bestOf: 5, sound: false });
  assert.equal(next.mode, "versus");
  assert.equal(next.bestOf, 5);
  assert.equal(next.sound, false);
  const bad = setPreferences(next, { mode: "hack", bestOf: 8, sound: "x" });
  assert.equal(bad.mode, "versus");
  assert.equal(bad.bestOf, 5);
  assert.equal(bad.sound, false);
});

test("持久化写入、读回与坏 JSON 回退", async () => {
  const map = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
  try {
    const mod = await import(new URL(`../js/storage.mjs?persist=${Date.now()}`, import.meta.url).href);
    assert.deepEqual(mod.loadSave(), defaultSave());

    const saved = mod.writeSave({ ...defaultSave(), bestStage: 5, cleared: [0, 1, 2] });
    assert.equal(saved.bestStage, 5);
    assert.ok(map.get(SAVE_KEY).includes('"bestStage":5'));
    assert.deepEqual(mod.loadSave().cleared, [0, 1, 2]);

    map.set(SAVE_KEY, "{broken json");
    assert.deepEqual(mod.loadSave(), defaultSave(), "坏 JSON 必须回退默认");
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
