// 本地存储模块单测：格式规整、损坏回退、全站统一 Key
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  DEFAULT_SAVE_DATA,
  normalizeSaveData,
  loadSaveData,
  saveSaveData,
  resetSaveData,
} from "../js/storage.mjs";

test("STORAGE_KEY 契约前缀为 doin.memory-duel.v1", () => {
  assert.equal(STORAGE_KEY, "doin.memory-duel.v1");
});

test("normalizeSaveData 处理 null/undefined/畸形对象回退默认", () => {
  const norm1 = normalizeSaveData(null);
  assert.deepEqual(norm1, DEFAULT_SAVE_DATA);

  const norm2 = normalizeSaveData("invalid json");
  assert.deepEqual(norm2, DEFAULT_SAVE_DATA);
});

test("normalizeSaveData 钳制非法数值", () => {
  const corrupt = {
    sound: "true", // 非 boolean
    challenge: {
      unlockedTier: 99, // 溢出
      stars: { novice: -5, veteran: 10, master: 1 },
      wins: { novice: -2 },
    },
    puzzles: {
      unlockedLevel: -10,
      stars: [5, 4, 3],
    },
  };

  const norm = normalizeSaveData(corrupt);
  assert.equal(norm.sound, true);
  assert.equal(norm.challenge.unlockedTier, 2);
  assert.equal(norm.challenge.stars.novice, 0);
  assert.equal(norm.challenge.stars.veteran, 3);
  assert.equal(norm.challenge.stars.master, 1);
  assert.equal(norm.challenge.wins.novice, 0);
  assert.equal(norm.puzzles.unlockedLevel, 0);
  assert.equal(norm.puzzles.stars[0], 3);
  assert.equal(norm.puzzles.stars[1], 3);
  assert.equal(norm.puzzles.stars[2], 3);
});

test("内存降级环境下 loadSaveData 与 saveSaveData 正常工作", () => {
  resetSaveData();
  const data = loadSaveData();
  assert.equal(data.version, 1);

  data.sound = false;
  data.challenge.unlockedTier = 1;
  const ok = saveSaveData(data);
  assert.equal(ok, true);

  const loaded = loadSaveData();
  assert.equal(loaded.sound, false);
  assert.equal(loaded.challenge.unlockedTier, 1);
});
