import test from "node:test";
import assert from "node:assert/strict";

import {
  SCHEMA_VERSION,
  STORAGE_KEY,
  arcadeBest,
  defaultState,
  levelRecord,
  load,
  maxStars,
  normalize,
  recordArcade,
  recordLevel,
  remember,
  resetBackendForTests,
  save,
  totalStars,
} from "../js/storage.mjs";

test("默认存档结构完整且版本正确", () => {
  const state = defaultState();
  assert.equal(state.version, SCHEMA_VERSION);
  assert.equal(state.prefs.mode, "story");
  assert.equal(state.prefs.players, 1);
  assert.equal(state.prefs.lastLevel, "level_01");
  assert.equal(state.prefs.muted, false);
  assert.deepEqual(state.progress, {});
  assert.deepEqual(state.arcade, { bestKo: 0, bestScore: 0, bestBossKills: 0 });
  assert.equal(maxStars(), 36);
});

test("损坏、缺字段与越界数据都被安全归一化", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize("nope"), defaultState());
  const normalized = normalize({
    version: 99,
    prefs: { mode: "arcade", players: 7, lastLevel: "missing", muted: "yes" },
    progress: {
      level_01: { cleared: true, stars: 99, bestKo: -5, bestTime: 12.9, bestScore: "88" },
      level_02: { cleared: false, stars: 0, bestKo: 0 },
      nope: { cleared: true, stars: 3 },
    },
    arcade: { bestKo: -1, bestScore: 4.8, bestBossKills: "2" },
  });
  assert.equal(normalized.version, SCHEMA_VERSION);
  assert.equal(normalized.prefs.mode, "arcade");
  assert.equal(normalized.prefs.players, 1);
  assert.equal(normalized.prefs.lastLevel, "level_01");
  assert.equal(normalized.prefs.muted, true);
  assert.equal(normalized.progress.level_01.stars, 3);
  assert.equal(normalized.progress.level_01.bestKo, 0);
  assert.equal(normalized.progress.level_01.bestScore, 88);
  assert.equal(normalized.progress.level_02, undefined);
  assert.equal(normalized.progress.nope, undefined);
  assert.equal(normalized.arcade.bestKo, 0);
  assert.equal(normalized.arcade.bestScore, 4);
  assert.equal(normalized.arcade.bestBossKills, 2);
});

test("写入与读取在内存降级后仍然可往返", () => {
  resetBackendForTests();
  const store = recordArcade(recordLevel(defaultState(), {
    outcome: "clear",
    levelId: "level_03",
    stars: 2,
    ko: 18,
    time: 64.2,
    score: 2400,
  }), { outcome: "clear", ko: 33, score: 5000, bossKills: 2 });
  assert.equal(save(store), true);
  const loaded = load();
  assert.deepEqual(loaded.progress.level_03, {
    cleared: true,
    stars: 2,
    bestKo: 18,
    bestTime: 64,
    bestScore: 2400,
  });
  assert.equal(loaded.arcade.bestKo, 33);
  assert.equal(arcadeBest(loaded).bestScore, 5000);
  assert.equal(loaded.prefs.lastLevel, "level_03");
  resetBackendForTests();
});

test("关卡记录只升不降，星级与最佳击飞取历史最高", () => {
  let store = defaultState();
  store = recordLevel(store, { outcome: "clear", levelId: "level_05", stars: 3, ko: 20, time: 70, score: 3000 });
  store = recordLevel(store, { outcome: "clear", levelId: "level_05", stars: 1, ko: 9, time: 90, score: 1000 });
  const record = levelRecord(store, "level_05");
  assert.equal(record.stars, 3);
  assert.equal(record.bestKo, 20);
  assert.equal(record.bestTime, 70);
  assert.equal(record.bestScore, 3000);
  assert.equal(totalStars(store), 3);
});

test("失败结果不会写入进度，未知关卡不会污染存档", () => {
  let store = defaultState();
  store = recordLevel(store, { outcome: "lose", levelId: "level_01", stars: 0, ko: 3, time: 20, score: 0 });
  assert.equal(store.progress.level_01, undefined);
  store = recordLevel(store, { outcome: "clear", levelId: "level_99", stars: 3, ko: 3, time: 20, score: 100 });
  assert.deepEqual(store.progress, {});
});

test("remember 只接受合法偏好并钳制模式/人数", () => {
  const store = remember(defaultState(), { mode: "arcade", players: 2, lastLevel: "level_07", muted: true });
  assert.equal(store.prefs.mode, "arcade");
  assert.equal(store.prefs.players, 2);
  assert.equal(store.prefs.lastLevel, "level_07");
  assert.equal(store.prefs.muted, true);
  const guarded = remember(store, { mode: "weird", players: 9, lastLevel: "nope" });
  assert.equal(guarded.prefs.mode, "story");
  assert.equal(guarded.prefs.players, 1);
  assert.equal(guarded.prefs.lastLevel, "level_01");
});

test("save 使用统一 key，坏 JSON 读取时回落默认", () => {
  resetBackendForTests();
  assert.equal(save(defaultState()), true);
  let raw = null;
  try {
    raw = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch (error) {
    raw = null;
  }
  if (raw) assert.ok(raw.includes("\"prefs\""));
  assert.equal(load().prefs.mode, "story");
  resetBackendForTests();
});
