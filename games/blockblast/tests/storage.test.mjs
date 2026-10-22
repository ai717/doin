// storage.test.mjs —— 存档：坏数据归一化、内存降级、往返一致、按难度分榜只升不降。
import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  defaultState,
  normalize,
  load,
  save,
  setMuted,
  setDifficulty,
  bestOf,
  recordDifficulty,
  resetBackendForTests,
} from "../js/storage.mjs";
import { DIFFICULTY_IDS } from "../js/difficulty.mjs";

test("storage: key and schema", () => {
  assert.equal(STORAGE_KEY, "doin.blockblast.v1");
  assert.equal(SCHEMA_VERSION, 2);
});

test("defaultState: every difficulty has an empty record", () => {
  const s = defaultState();
  assert.deepEqual(s.prefs, { muted: false, difficulty: "normal" });
  for (const id of DIFFICULTY_IDS) {
    assert.deepEqual(s.best[id], { bestScore: 0, bestRows: 0, bestCombo: 0, plays: 0 });
  }
});

test("normalize: junk data falls back to defaults", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize(undefined), defaultState());
  assert.deepEqual(normalize(42), defaultState());
  assert.deepEqual(normalize("nope"), defaultState());
  assert.deepEqual(normalize({ prefs: { muted: "yes", difficulty: "nightmare" } }), {
    ...defaultState(),
    prefs: { muted: true, difficulty: "normal" }, // 未知难度回落
  });
});

test("normalize: clamps and drops invalid fields", () => {
  const raw = {
    prefs: { muted: 1, difficulty: "hard" },
    best: {
      hard: { bestScore: -10, bestRows: 3.7, bestCombo: "x", plays: 2.9 }, // 夹取/清洗
      easy: { bestScore: 50 },
      nightmare: { bestScore: 999 }, // 未知难度丢弃
      bad: "nope",
    },
    campaign: { last: 7, levels: { 1: { stars: 3 } } }, // 旧版字段静默忽略
  };
  const s = normalize(raw);
  assert.equal(s.prefs.difficulty, "hard");
  assert.deepEqual(s.best.hard, { bestScore: 0, bestRows: 3, bestCombo: 0, plays: 2 });
  assert.deepEqual(s.best.easy, { bestScore: 50, bestRows: 0, bestCombo: 0, plays: 0 });
  assert.deepEqual(s.best.normal, { bestScore: 0, bestRows: 0, bestCombo: 0, plays: 0 });
  assert.equal(s.best.nightmare, undefined);
  assert.equal(s.best.bad, undefined);
  assert.equal(s.campaign, undefined); // 无旧版残留
});

test("storage: memory fallback roundtrip (no localStorage in node)", () => {
  resetBackendForTests();
  const fresh = load();
  assert.deepEqual(fresh, defaultState());
  const withData = recordDifficulty(setMuted(fresh, true), "normal", { score: 120, rows: 9, combo: 3 }).state;
  assert.equal(save(withData), true);
  assert.deepEqual(load(), withData);
  // 再存一份全新的，读回仍是归一化后的默认值（旧数据被覆盖而非合并）
  assert.equal(save(defaultState()), true);
  assert.deepEqual(load(), defaultState());
});

test("storage: save/load survive garbage writes", () => {
  resetBackendForTests();
  save({ prefs: { difficulty: "hard" }, best: { hard: { bestScore: 12 } } });
  const s = load();
  assert.equal(s.best.hard.bestScore, 12);
  assert.equal(s.prefs.muted, false);
  assert.equal(s.prefs.difficulty, "hard");
  assert.deepEqual(s.best.normal, { bestScore: 0, bestRows: 0, bestCombo: 0, plays: 0 });
});

test("recordDifficulty: bests only increase, plays always count, per-difficulty isolated", () => {
  let s = defaultState();
  let r = recordDifficulty(s, "normal", { score: 100, rows: 12, combo: 3 });
  s = r.state;
  assert.equal(r.isBestScore, true);
  assert.deepEqual(s.best.normal, { bestScore: 100, bestRows: 12, bestCombo: 3, plays: 1 });
  // 低分局：分数纪录不动，但 rows/combo 各自取max，plays 照记
  r = recordDifficulty(s, "normal", { score: 60, rows: 30, combo: 1 });
  s = r.state;
  assert.equal(r.isBestScore, false);
  assert.deepEqual(s.best.normal, { bestScore: 100, bestRows: 30, bestCombo: 3, plays: 2 });
  // 换难度：另一条榜从零开始，互不污染
  r = recordDifficulty(s, "hard", { score: 40, rows: 2, combo: 1 });
  s = r.state;
  assert.equal(r.isBestScore, true);
  assert.deepEqual(s.best.hard, { bestScore: 40, bestRows: 2, bestCombo: 1, plays: 1 });
  assert.equal(s.best.normal.bestScore, 100);
  // 未知难度记进 normal 档（与 pickDifficulty 一致）
  r = recordDifficulty(s, "nightmare", { score: 7 });
  s = r.state;
  assert.equal(s.best.normal.plays, 3);
  assert.equal(s.best.normal.bestScore, 100);
});

test("bestOf: unknown difficulty reads the normal record", () => {
  let s = defaultState();
  s = recordDifficulty(s, "normal", { score: 55 }).state;
  assert.equal(bestOf(s, "normal").bestScore, 55);
  assert.equal(bestOf(s, "nightmare").bestScore, 55);
  assert.equal(bestOf(s, "easy").bestScore, 0);
});

test("pure setters do not mutate the input state", () => {
  const s = defaultState();
  const muted = setMuted(s, true);
  assert.equal(s.prefs.muted, false);
  assert.equal(muted.prefs.muted, true);
  const hard = setDifficulty(s, "hard");
  assert.equal(s.prefs.difficulty, "normal");
  assert.equal(hard.prefs.difficulty, "hard");
  // 未知难度回落 normal，不改原对象
  assert.equal(setDifficulty(s, "nightmare").prefs.difficulty, "normal");
  assert.equal(s.prefs.difficulty, "normal");
});
