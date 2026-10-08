// storage.test.mjs — 存档归一化、坏数据降级、最佳成绩合并、解锁链
// 与门户契约一致：localStorage 全部读写集中在 js/storage.mjs 且带 try/catch。
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  STORAGE_KEY, normalizeStorageData, saveGameData, loadGameData,
  toggleFlag, recordClearRun, recordDuelResult, bestOf, totalStarsOf, isUnlocked,
} from "../js/storage.mjs";
import { TABLES } from "../js/tables.mjs";

/** 极简 localStorage 桩：可注入、可抛、可查。 */
function stubStorage(initial = {}, mode = "ok") {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      if (mode === "throw-read") throw new Error("blocked");
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      if (mode === "throw-write") throw new Error("blocked");
      map.set(key, String(value));
    },
    removeItem(key) { map.delete(key); },
    _map: map,
  };
}

describe("storage: 模块契约", () => {
  it("使用私有命名空间 key", () => {
    assert.equal(STORAGE_KEY, "doin.billiards.v1");
    assert.ok(STORAGE_KEY.startsWith("doin.billiards."));
  });
  it("localStorage 只出现在 storage.mjs 且带 catch 降级", () => {
    const jsDir = join(import.meta.dirname, "..", "js");
    for (const file of ["engine.mjs", "game.mjs", "rules.mjs", "tables.mjs", "score.mjs", "render.mjs", "ui.mjs", "audio.mjs"]) {
      const src = readFileSync(join(jsDir, file), "utf8");
      assert.equal(src.includes("localStorage"), false, `${file} 不得直接碰 localStorage`);
    }
    const own = readFileSync(join(jsDir, "storage.mjs"), "utf8");
    assert.ok(own.includes("catch"), "storage.mjs 必须 try/catch 降级");
  });
});

describe("storage: 归一化吃掉一切脏数据", () => {
  it("非对象输入回落到默认态", () => {
    for (const junk of [null, undefined, 0, "", "x", [], true]) {
      const out = normalizeStorageData(junk);
      assert.equal(out.gamesPlayed, 0);
      assert.equal(out.lastMode, "clear");
      assert.deepEqual(out.tables, {});
      assert.deepEqual(out.duelWins, [0, 0]);
      assert.equal(out.soundEnabled, true);
    }
  });
  it("越界与错误类型被钳制", () => {
    const out = normalizeStorageData({
      tables: {
        table_1: { cleared: "yes", stars: 99, bestShots: -5, bestMs: NaN, fouls: 3.9 },
        table_999: { stars: 3 },
        "": { stars: 1 },
        table_2: "not an object",
      },
      duelWins: [50000, -1, 7],
      soundEnabled: "no",
      aimAssist: 1,
      spinPreview: null,
      lastMode: "versus",
      lastTable: "table_404",
      gamesPlayed: -12,
    });
    assert.equal(out.tables.table_1.cleared, false, "非布尔 cleared 视为 false");
    assert.equal(out.tables.table_1.stars, 3, "stars 上限 3");
    assert.equal(out.tables.table_1.bestShots, 0, "负数杆数下限 0");
    assert.equal(out.tables.table_1.fouls, 3, "小数取整");
    assert.equal(out.tables.table_999, undefined, "未知球局被丢弃");
    assert.equal(out.tables[""], undefined);
    assert.equal(out.tables.table_2, undefined, "非对象条目被丢弃");
    assert.deepEqual(out.duelWins, [9999, 0], "胜场钳到 [0,9999]");
    assert.equal(out.soundEnabled, true, "非布尔开关回落默认开");
    assert.equal(out.aimAssist, true);
    assert.equal(out.spinPreview, true);
    assert.equal(out.lastMode, "clear", "未知模式回落 clear");
    assert.equal(out.lastTable, TABLES[0].id, "未知球局回落首局");
    assert.equal(out.gamesPlayed, 0);
  });
  it("归一化是幂等的", () => {
    const raw = { tables: { table_3: { stars: 5 } }, duelWins: [2], lastMode: "duel", gamesPlayed: 4 };
    const once = normalizeStorageData(raw);
    const twice = normalizeStorageData(once);
    assert.deepEqual(twice, once);
  });
});

describe("storage: 读写往返与降级", () => {
  it("save → load 往返保持字段", () => {
    const store = stubStorage();
    globalThis.localStorage = store;
    const saved = saveGameData({
      tables: { table_1: { cleared: true, stars: 2, bestShots: 18, bestMs: 42000, fouls: 1 } },
      duelWins: [1, 2],
      soundEnabled: false,
      lastMode: "duel",
      lastTable: "table_4",
      gamesPlayed: 9,
    });
    assert.equal(saved.tables.table_1.stars, 2);
    const loaded = loadGameData();
    assert.deepEqual(loaded, saved);
    assert.ok(store._map.has(STORAGE_KEY));
    delete globalThis.localStorage;
  });
  it("无存档时给出默认态", () => {
    const store = stubStorage();
    globalThis.localStorage = store;
    const data = loadGameData();
    assert.deepEqual(data.tables, {});
    assert.equal(data.gamesPlayed, 0);
    delete globalThis.localStorage;
  });
  it("坏 JSON 不抛，降级为内存副本", () => {
    const store = stubStorage();
    globalThis.localStorage = store;
    saveGameData({ gamesPlayed: 0 }); // 先把内存副本归零，隔离上一用例
    store._map.set(STORAGE_KEY, "{not json");
    const data = loadGameData();
    assert.equal(data.gamesPlayed, 0);
    assert.deepEqual(data.tables, {});
    delete globalThis.localStorage;
  });
  it("读取抛异常（隐私模式）不冒泡", () => {
    globalThis.localStorage = stubStorage({}, "throw-read");
    const data = loadGameData();
    assert.equal(typeof data.gamesPlayed, "number");
    delete globalThis.localStorage;
  });
  it("写入抛异常（配额满）不冒泡且仍返回归一化结果", () => {
    globalThis.localStorage = stubStorage({}, "throw-write");
    const out = saveGameData({ gamesPlayed: 3 });
    assert.equal(out.gamesPlayed, 3);
    delete globalThis.localStorage;
  });
  it("完全无 localStorage 环境仍可用", () => {
    const out = saveGameData({ gamesPlayed: 7 });
    assert.equal(out.gamesPlayed, 7);
    assert.deepEqual(loadGameData().tables, {});
  });
});

describe("storage: 开关与战绩合并", () => {
  it("toggleFlag 只翻布尔字段", () => {
    const base = normalizeStorageData({ soundEnabled: true, aimAssist: false });
    assert.equal(toggleFlag(base, "soundEnabled").soundEnabled, false);
    assert.equal(toggleFlag(base, "aimAssist").aimAssist, true);
    assert.equal(toggleFlag(base, "gamesPlayed").gamesPlayed, 0, "非布尔字段不动");
    assert.deepEqual(toggleFlag(base, "nope"), base);
  });
  it("recordClearRun 各项取最优且只进位", () => {
    let data = normalizeStorageData(null);
    data = recordClearRun(data, { tableId: "table_1", cleared: true, stars: 2, shots: 30, timeMs: 60000, fouls: 3 });
    assert.equal(data.gamesPlayed, 1);
    assert.equal(data.lastMode, "clear");
    assert.equal(data.lastTable, "table_1");
    // 更差的一局不得覆盖
    data = recordClearRun(data, { tableId: "table_1", cleared: false, stars: 1, shots: 44, timeMs: 90000, fouls: 6 });
    const best = bestOf(data, "table_1");
    assert.equal(best.stars, 2, "星级只升不降");
    assert.equal(best.bestShots, 30, "杆数取小");
    assert.equal(best.bestMs, 60000, "用时取小");
    assert.equal(best.fouls, 3, "犯规取小");
    assert.equal(best.cleared, true, "通关标记不回退");
    // 更好的一局覆盖
    data = recordClearRun(data, { tableId: "table_1", cleared: true, stars: 3, shots: 21, timeMs: 30000, fouls: 0 });
    assert.equal(bestOf(data, "table_1").stars, 3);
    assert.equal(bestOf(data, "table_1").bestShots, 21);
    assert.equal(data.gamesPlayed, 3);
  });
  it("recordClearRun 拒绝脏 run", () => {
    const base = normalizeStorageData({ gamesPlayed: 2 });
    for (const bad of [null, {}, { tableId: 1 }, { tableId: "table_404" }]) {
      const out = recordClearRun(base, bad);
      assert.deepEqual(out.tables, {});
      assert.equal(out.gamesPlayed, 3, "局数仍计数一次");
    }
  });
  it("recordDuelResult 累计胜场", () => {
    let data = normalizeStorageData(null);
    data = recordDuelResult(data, 0);
    data = recordDuelResult(data, 1);
    data = recordDuelResult(data, 1);
    assert.deepEqual(data.duelWins, [1, 2]);
    assert.equal(data.lastMode, "duel");
    assert.equal(data.gamesPlayed, 3);
    const same = recordDuelResult(data, 7);
    assert.deepEqual(same.duelWins, [1, 2], "非法 winner 忽略");
  });
  it("totalStarsOf 与 isUnlocked 解锁链", () => {
    let data = normalizeStorageData(null);
    assert.equal(totalStarsOf(data), 0);
    assert.equal(isUnlocked(data, TABLES[0].id), true, "首局永远解锁");
    assert.equal(isUnlocked(data, TABLES[1].id), false);
    data = recordClearRun(data, { tableId: TABLES[0].id, cleared: true, stars: 3, shots: 10, timeMs: 1000, fouls: 0 });
    assert.equal(totalStarsOf(data), 3);
    assert.equal(isUnlocked(data, TABLES[1].id), true, "通关上一局后解锁");
    assert.equal(isUnlocked(data, TABLES[2].id), false);
  });
  it("bestOf 未知球局返回 null", () => {
    assert.equal(bestOf(normalizeStorageData(null), "nope"), null);
  });
});
