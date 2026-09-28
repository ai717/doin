// 倒退贪吃蛇 Uncoil · 存档口径单测（含损坏数据降级与解锁推进）
import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  defaultSave,
  normalize,
  loadSave,
  saveSave,
  clearSave,
  totalStars,
  solvedEndgames,
  recordClear,
  useMemoryBackend
} from "../js/storage.mjs";

const mem = new Map();
useMemoryBackend(mem);

test("存档键为 doin.uncoil.v1", () => {
  assert.equal(STORAGE_KEY, "doin.uncoil.v1");
});

test("默认存档：首关解锁、静音关闭之外的默认值健全", () => {
  const s = defaultSave();
  assert.equal(s.sound, true);
  assert.equal(s.unlocked, 1);
  assert.deepEqual(s.stars, {});
  assert.equal(s.dailyDone, false);
});

test("空 / null / 垃圾输入一律归一化", () => {
  assert.deepEqual(normalize(null), defaultSave());
  assert.deepEqual(normalize("nonsense"), defaultSave());
  assert.deepEqual(normalize(42), defaultSave());
});

test("越界字段被钳制（unlocked / 步数 / 星级）", () => {
  const s = normalize({ unlocked: 999, stars: { level_1_1: 9, bad: 3 }, best: { level_1_1: -4 }, dailySteps: 1e9 });
  assert.equal(s.unlocked, 40);
  assert.equal(s.stars.level_1_1, 3);
  assert.equal(s.stars.bad, 3, "合法 id 形态保留");
  assert.equal(s.best.level_1_1, undefined, "非正步数被丢弃");
  assert.equal(s.dailySteps, 9999);
});

test("非法 id 形态被剔除（防脏数据污染）", () => {
  const s = normalize({ stars: { "level 1 1": 3, "../evil": 2, "": 1 } });
  assert.deepEqual(s.stars, {});
});

test("写入后可读回，且读回结果是归一化后的", () => {
  saveSave({ unlocked: 3, stars: { level_1_1: 3 }, junk: 1 });
  const back = loadSave();
  assert.equal(back.unlocked, 3);
  assert.equal(back.stars.level_1_1, 3);
  assert.equal(back.junk, undefined);
});

test("存储损坏（非法 JSON）静默降级为默认存档", () => {
  mem.set(STORAGE_KEY, "{not json");
  assert.deepEqual(loadSave(), defaultSave());
});

test("clearSave 之后回到默认", () => {
  saveSave({ unlocked: 9 });
  clearSave();
  assert.equal(loadSave().unlocked, 1);
});

test("总星数与残局已解数统计", () => {
  const s = normalize({ stars: { a: 3, b: 2 }, endgameBest: { endgame_1: 12, endgame_2: 10 } });
  assert.equal(totalStars(s), 5);
  assert.equal(solvedEndgames(s), 2);
});

test("通关记录：步数更少才覆盖，星级取更高", () => {
  let s = defaultSave();
  s = recordClear(s, { id: "level_1_1", mode: "stage", steps: 30, stars: 2, index: 0 });
  assert.equal(s.best.level_1_1, 30);
  assert.equal(s.stars.level_1_1, 2);
  assert.equal(s.unlocked, 2, "通关第 1 关解锁第 2 关");
  s = recordClear(s, { id: "level_1_1", mode: "stage", steps: 22, stars: 3, index: 0 });
  assert.equal(s.best.level_1_1, 22);
  assert.equal(s.stars.level_1_1, 3);
  s = recordClear(s, { id: "level_1_1", mode: "stage", steps: 40, stars: 1, index: 0 });
  assert.equal(s.best.level_1_1, 22, "更差成绩不覆盖");
  assert.equal(s.stars.level_1_1, 3, "更低星级不覆盖");
});

test("残局与每日记录走各自口径", () => {
  let s = defaultSave();
  s = recordClear(s, { id: "endgame_1", mode: "endgame", steps: 18, stars: 3, index: -1 });
  assert.equal(s.endgameBest.endgame_1, 18);
  assert.equal(s.unlocked, 1, "残局不推进主线解锁");
  s = recordClear(s, { id: "x", mode: "daily", steps: 27, stars: 3, index: -1, dateKey: 20260928 });
  assert.equal(s.dailyDate, 20260928);
  assert.equal(s.dailySteps, 27);
  assert.equal(s.dailyDone, true);
});
