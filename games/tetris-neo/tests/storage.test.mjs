import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BOARDS,
  DEFAULT_BOARD,
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  SCHEMA_VERSION,
  STORAGE_KEY,
  clearRun,
  defaultState,
  load,
  normalize,
  normalizeBoard,
  normalizeDifficulty,
  readBest,
  readBoard,
  readDifficulty,
  readMuted,
  readRun,
  recordBest,
  resetAll,
  resetBackendForTests,
  save,
  slot,
  writeBoard,
  writeDifficulty,
  writeMuted,
  writeRun,
} from "../js/storage.mjs";

function installStorage(initial = new Map()) {
  const store = new Map(initial);
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  resetBackendForTests();
  return store;
}

function useMemoryBackend() {
  delete globalThis.localStorage;
  resetBackendForTests();
}

function runSnapshot() {
  return {
    grid: [[0, 0], [1, 0]],
    piece: { matrix: [[1, 1]], pos: { x: 2, y: 0 }, color: "#00f0ff" },
    nextPieceType: "T",
    score: 300,
    lines: 3,
    level: 1,
  };
}

test("存档键与默认值：doin.tetris-neo.v1 + 标准尺寸 / 标准难度", () => {
  assert.equal(STORAGE_KEY, "doin.tetris-neo.v1");
  assert.equal(SCHEMA_VERSION, 1);
  assert.deepEqual(defaultState(), {
    version: 1,
    prefs: { muted: false, difficulty: DEFAULT_DIFFICULTY, board: DEFAULT_BOARD },
    best: {},
    runs: {},
  });
  assert.equal(DEFAULT_DIFFICULTY, "normal");
  assert.equal(DEFAULT_BOARD, "standard");
});

test("白名单：难度 / 尺寸只认固定枚举，坏值回默认", () => {
  assert.deepEqual([...DIFFICULTIES], ["casual", "normal", "master"]);
  assert.deepEqual([...BOARDS], ["mini", "standard", "wide"]);
  for (const value of DIFFICULTIES) assert.equal(normalizeDifficulty(value), value);
  for (const value of BOARDS) assert.equal(normalizeBoard(value), value);
  for (const bad of ["insane", "", null, undefined, 0, {}, "NORMAL"]) {
    assert.equal(normalizeDifficulty(bad), DEFAULT_DIFFICULTY);
    assert.equal(normalizeBoard(bad), DEFAULT_BOARD);
  }
  assert.equal(slot("wide", "master"), "wide_master");
  assert.equal(slot("坏值", "坏值"), "standard_normal");
});

test("normalize：偏好夹取、分数取非负整数、坏对局快照整条丢弃", () => {
  const fixed = normalize({
    version: 99,
    prefs: { muted: "true", difficulty: "insane", board: "huge" },
    best: { standard_normal: "1200", wide_master: -50, mini_casual: NaN },
    runs: { standard_normal: runSnapshot(), wide_master: { grid: "不是矩阵" }, mini_casual: null },
  });
  assert.equal(fixed.version, SCHEMA_VERSION, "版本号永远写当前 schema");
  assert.deepEqual(fixed.prefs, { muted: true, difficulty: DEFAULT_DIFFICULTY, board: DEFAULT_BOARD });
  assert.equal(fixed.best.standard_normal, 1200);
  assert.equal(fixed.best.wide_master, 0, "负分夹到 0");
  assert.equal(fixed.best.mini_casual, 0, "NaN 夹到 0");
  assert.ok(fixed.runs.standard_normal, "合法快照保留");
  assert.equal(fixed.runs.wide_master, undefined, "棋盘不是矩阵 → 丢弃");
  assert.equal(fixed.runs.mini_casual, undefined, "null 快照 → 丢弃");
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize("字符串"), defaultState());
});

test("快照形状校验：缺方块矩阵或坐标非数字都算没有存档", () => {
  installStorage();
  const good = runSnapshot();
  assert.equal(writeRun("standard", "normal", good), good);
  assert.deepEqual(readRun("standard", "normal"), good);

  assert.equal(writeRun("standard", "normal", { grid: good.grid, piece: { matrix: [[1]] } }), null);
  assert.equal(readRun("standard", "normal"), null, "写坏值时旧快照一并清掉");

  assert.equal(writeRun("standard", "normal", { grid: good.grid, piece: { matrix: [[1]], pos: { x: "a", y: 0 } } }), null);
  assert.equal(writeRun("standard", "normal", { grid: [], piece: good.piece }), null, "空棋盘不是矩阵");
});

test("每个尺寸 × 难度各自记最高分与对局，互不串档", () => {
  installStorage();
  recordBest("mini", "casual", 500);
  recordBest("standard", "normal", 900);
  writeRun("wide", "master", runSnapshot());

  assert.equal(readBest("mini", "casual"), 500);
  assert.equal(readBest("standard", "normal"), 900);
  assert.equal(readBest("wide", "master"), 0, "没记过就是 0");
  assert.equal(readRun("mini", "casual"), null);
  assert.ok(readRun("wide", "master"));
});

test("最高分只增不减，返回写入后的值供 UI 直接显示", () => {
  installStorage();
  assert.equal(recordBest("standard", "normal", 800), 800);
  assert.equal(recordBest("standard", "normal", 1500), 1500);
  assert.equal(recordBest("standard", "normal", 300), 1500, "低分不覆盖纪录");
  assert.equal(readBest("standard", "normal"), 1500);
  assert.equal(recordBest("standard", "normal", -20), 1500, "负分被夹取");
});

test("clearRun 只清当前尺寸 / 难度的对局，最高分与偏好不动", () => {
  installStorage();
  recordBest("standard", "normal", 700);
  writeRun("standard", "normal", runSnapshot());
  writeRun("mini", "casual", runSnapshot());
  writeMuted(true);

  clearRun("standard", "normal");
  assert.equal(readRun("standard", "normal"), null);
  assert.ok(readRun("mini", "casual"), "别档不受影响");
  assert.equal(readBest("standard", "normal"), 700);
  assert.equal(readMuted(), true);
});

test("偏好读写往返：muted / difficulty / board 落盘后仍读得回来", () => {
  const store = installStorage();
  assert.equal(readMuted(), false);
  assert.equal(writeMuted(true), true);
  assert.equal(writeDifficulty("master"), "master");
  assert.equal(writeBoard("wide"), "wide");
  assert.equal(readDifficulty(), "master");
  assert.equal(readBoard(), "wide");
  assert.equal(store.has(STORAGE_KEY), true);

  resetBackendForTests();
  assert.equal(readMuted(), true, "重新装载后端后仍读到同一份存档");
  assert.equal(writeDifficulty("不存在的难度"), DEFAULT_DIFFICULTY);
});

test("localStorage 不可用时静默降级内存，读写照常工作", () => {
  useMemoryBackend();
  assert.equal(readBest("standard", "normal"), 0);
  assert.equal(recordBest("standard", "normal", 420), 420);
  assert.equal(readBest("standard", "normal"), 420);
  assert.equal(save(defaultState()).prefs.difficulty, DEFAULT_DIFFICULTY);
});

test("存档被写坏（非法 JSON / 数组 / 抛异常）也绝不把错误抛给 UI", () => {
  installStorage(new Map([[STORAGE_KEY, "{ 这不是 JSON"]]));
  assert.deepEqual(load(), defaultState());

  globalThis.localStorage = {
    getItem() {
      throw new Error("隐私模式");
    },
    setItem() {
      throw new Error("隐私模式");
    },
    removeItem() {
      throw new Error("隐私模式");
    },
  };
  resetBackendForTests();
  assert.deepEqual(load(), defaultState());
  assert.equal(save(defaultState()).version, SCHEMA_VERSION);
  assert.equal(recordBest("standard", "normal", 100), 100);
});

test("resetAll 清空整份存档并回到默认值", () => {
  installStorage();
  recordBest("standard", "normal", 1000);
  writeMuted(true);
  assert.deepEqual(resetAll(), defaultState());
  assert.equal(readBest("standard", "normal"), 0);
  assert.equal(readMuted(), false);
});
