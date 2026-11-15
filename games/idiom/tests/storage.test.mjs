import test from "node:test";
import assert from "node:assert/strict";
import * as storage from "../js/storage.mjs";
import { BOARDS } from "../js/boards.mjs";

function fakeLocalStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  };
}

test.beforeEach(() => {
  globalThis.localStorage = fakeLocalStorage();
  storage.resetBackendForTests();
});

test.afterEach(() => {
  delete globalThis.localStorage;
  storage.resetBackendForTests();
});

test("默认存档：双语八榜十关全部就绪", () => {
  const progress = storage.defaultProgress();
  assert.equal(progress.version, storage.VERSION);
  assert.deepEqual(progress.current.zh, { boardId: BOARDS[0].id, levelIndex: 0 });
  for (const lang of ["zh", "en"]) {
    assert.equal(Object.keys(progress.boards[lang]).length, 8);
    for (const board of BOARDS) {
      assert.deepEqual(progress.boards[lang][board.id], { levels: {}, atlas: {} });
    }
  }
});

test("归一化：脏数据被钳制，未知榜与关卡被丢弃", () => {
  const progress = storage.normalize({
    version: 99,
    current: {
      zh: { boardId: "board_unknown", levelIndex: 99 },
      en: { boardId: "board_nature", levelIndex: -3 },
    },
    boards: {
      zh: {
        board_history: {
          levels: {
            0: { stars: 9, hintsUsed: -2, ms: -100, clearedAt: "x" },
            1: { stars: 0 },
            2: { stars: 2, hintsUsed: 7, ms: "1200" },
            99: { stars: 3 },
          },
          atlas: { idiom_h01: true, idiom_h02: false, "": true, idiom_h03: 1 },
        },
        board_unknown: { levels: { 0: { stars: 3 } }, atlas: { x: true } },
      },
      en: null,
    },
  });
  assert.equal(progress.current.zh.boardId, BOARDS[0].id);
  assert.equal(progress.current.zh.levelIndex, 0);
  assert.equal(progress.current.en.levelIndex, 0);
  const levels = progress.boards.zh.board_history.levels;
  assert.equal(levels["0"].stars, 3);
  assert.equal(levels["0"].hintsUsed, 0);
  assert.equal(levels["0"].ms, 0);
  assert.equal(levels["1"], undefined);
  assert.equal(levels["2"].hintsUsed, 3);
  assert.equal(levels["99"], undefined);
  assert.deepEqual(Object.keys(progress.boards.zh.board_history.atlas).sort(), ["idiom_h01", "idiom_h03"]);
  assert.equal(progress.boards.zh.board_unknown, undefined);
  assert.equal(progress.version, storage.VERSION);
});

test("清关：保留最高星、最少提示与最快用时，并收录图鉴", () => {
  const progress = storage.defaultProgress();
  storage.recordClear(progress, {
    lang: "zh",
    boardId: "board_history",
    levelIndex: 0,
    stars: 2,
    hintsUsed: 1,
    ms: 60000,
    entries: ["idiom_h01"],
  });
  storage.recordClear(progress, {
    lang: "zh",
    boardId: "board_history",
    levelIndex: 0,
    stars: 1,
    hintsUsed: 3,
    ms: 90000,
    entries: ["idiom_h02"],
  });
  const record = storage.levelRecord(progress, "zh", "board_history", 0);
  assert.equal(record.stars, 2);
  assert.equal(record.hintsUsed, 1);
  assert.equal(record.ms, 60000);
  assert.ok(storage.hasCard(progress, "zh", "board_history", "idiom_h01"));
  assert.ok(storage.hasCard(progress, "zh", "board_history", "idiom_h02"));
  assert.equal(storage.hasCard(progress, "zh", "board_history", "idiom_h03"), false);
});

test("图鉴：只接受合法 id，跨榜不串味", () => {
  const progress = storage.defaultProgress();
  storage.unlockCard(progress, "zh", "board_nature", "idiom_n01");
  storage.unlockCard(progress, "zh", "board_nature", "");
  storage.unlockCard(progress, "nope", "board_nature", "x");
  assert.equal(storage.hasCard(progress, "zh", "board_nature", "idiom_n01"), true);
  assert.equal(storage.hasCard(progress, "zh", "board_nature", ""), false);
  assert.equal(storage.hasCard(progress, "zh", "board_history", "idiom_n01"), false);
  assert.equal(storage.hasCard(progress, "en", "board_nature", "idiom_n01"), false);
});

test("当前进度：记住每门语言最后一次打开的榜与关", () => {
  const progress = storage.defaultProgress();
  storage.remember(progress, "zh", "board_colors", 7);
  storage.remember(progress, "en", "board_numbers", 99);
  storage.remember(progress, "fr", "board_colors", 2);
  assert.deepEqual(progress.current.zh, { boardId: "board_colors", levelIndex: 7 });
  assert.deepEqual(progress.current.en, { boardId: "board_numbers", levelIndex: 9 });
  assert.equal(progress.current.fr, undefined);
});

test("落盘：保存后可原样读回，坏 JSON 回退默认值", () => {
  const progress = storage.defaultProgress();
  storage.recordClear(progress, {
    lang: "en",
    boardId: "board_objects",
    levelIndex: 4,
    stars: 3,
    hintsUsed: 0,
    ms: 33000,
    entries: ["word_o01"],
  });
  storage.remember(progress, "en", "board_objects", 4);
  assert.equal(storage.save(progress), true);
  const loaded = storage.load();
  assert.equal(loaded.current.en.boardId, "board_objects");
  assert.equal(storage.levelRecord(loaded, "en", "board_objects", 4).stars, 3);
  assert.ok(storage.hasCard(loaded, "en", "board_objects", "word_o01"));

  globalThis.localStorage.setItem(storage.STORAGE_KEY, "{broken");
  const fallback = storage.load();
  assert.deepEqual(fallback, storage.defaultProgress());
});

test("降级：localStorage 抛错时使用内存后端仍可读写", () => {
  delete globalThis.localStorage;
  storage.resetBackendForTests();
  const progress = storage.defaultProgress();
  storage.remember(progress, "zh", "board_body", 5);
  assert.equal(storage.save(progress), true);
  const loaded = storage.load();
  assert.deepEqual(loaded.current.zh, { boardId: "board_body", levelIndex: 5 });
});
