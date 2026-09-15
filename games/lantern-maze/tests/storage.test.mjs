// storage.test.mjs —— 存档唯一口径验收：任何脏输入都要归一化，读写只能走 localStorage 注入的假实现。
//
// 用法（在项目根跑）：
//   node --test games/lantern-maze/tests/storage.test.mjs
//   npm run test:lantern-maze          # 四套一起跑
// 坑：本文件把 globalThis.localStorage 换成内存假实现（绝不碰真机存储），测完必须还原；
//     storage.mjs 只在函数体内读全局，所以 import 前后装假实现都来得及，但用例之间要 reset。
//     尾段顺带验收 score.mjs 的口径（星级、钳制、格式化）与三十更关卡表：
//     更次表要逐更 createState 成功，影魅名单的性格、四角键、影匣槽位与出匣节拍都在这一段把关。

import test from "node:test";
import assert from "node:assert/strict";

import {
  KEY,
  VERSION,
  MAX_LANES,
  TALLY_MAX,
  LEFT_MS_MAX,
  defaults,
  normalize,
  load,
  save,
  clear,
  levelRecord,
  recordLevel,
  isLevelUnlocked,
  highestUnlocked,
  watchStars,
  totalStars,
  watchCleared,
  modeUnlocked,
  recordTimed,
  recordSurvival,
  laneEntry,
  saveLane,
  dropLane,
  setMuted,
  setLast,
  setAssist,
} from "../js/storage.mjs";
import { LEVELS, LEVEL_COUNT, LEVELS_PER_WATCH, levelById, rowsForLevel } from "../js/levels.mjs";
import { parseLayout, createState, GHOST_BEH, SCATTER_KEYS } from "../js/engine.mjs";
import { SCORE_MAX, EXTRA_LIFE_AT, clampInt, formatScore, rateRun, fruitScore, ghostScore } from "../js/score.mjs";

// ---------------------------------------------------------------- 假 localStorage

const store = new Map();
let throwOnWrite = false;

const fakeStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    if (throwOnWrite) throw new Error("QuotaExceededError");
    store.set(k, String(v));
  },
  removeItem: (k) => store.delete(k),
};

function withStorage(body) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = fakeStorage;
  store.clear();
  throwOnWrite = false;
  try {
    return body();
  } finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
    store.clear();
    throwOnWrite = false;
  }
}

/** 打通 1..n 更（拿满三签），用于测模式解锁与更签累计 */
function clearThrough(n, data = defaults()) {
  let d = data;
  for (let id = 1; id <= n; id += 1) {
    d = recordLevel(d, id, { stars: 3, score: 5000, timeMs: 30000 + id, cleared: true, noDeath: true }).data;
  }
  return d;
}

// ---------------------------------------------------------------- 归一化

test("默认档自洽，且 key 与版本符合平台口径", () => {
  assert.equal(KEY, "doin.lantern-maze.v1");
  assert.equal(VERSION, 1);
  assert.equal(TALLY_MAX, LEVEL_COUNT * 3);
  const d = defaults();
  assert.equal(d.v, VERSION);
  assert.equal(d.last, 1);
  assert.deepEqual(d.levels, {});
  assert.deepEqual(d.lanes, []);
  assert.equal(d.muted, false);
  assert.equal(d.assist.fog, true);
  assert.equal(normalize(undefined).last, 1);
});

test("任何脏输入都归一化成合法档，绝不抛错", () => {
  const junk = [
    null,
    undefined,
    42,
    "nope",
    [],
    { v: 99, last: -5, muted: "yes", levels: "x", lanes: "y", records: 7 },
    { levels: { 3: { stars: 99, best: -3, cleared: 1, timeMs: 1e9, noDeath: "t" } } },
    { lanes: [null, 7, { code: "" }, { code: 1 }, { code: "LM1-x", name: 12345, dots: -9, best: null }] },
    { timed: { best: { chain: "abc", score: 1e12, leftMs: -1 } }, survival: { best: { rounds: 1.7 } } },
  ];
  for (const raw of junk) {
    const d = normalize(raw);
    assert.equal(d.v, VERSION);
    assert.equal(typeof d.muted, "boolean");
    assert.ok(d.last >= 1 && d.last <= LEVEL_COUNT, `last 越界: ${d.last}`);
    assert.ok(d.records.highScore >= 0 && d.records.highScore <= SCORE_MAX);
    assert.ok(Array.isArray(d.lanes));
    for (const [id, rec] of Object.entries(d.levels)) {
      assert.ok(id >= 1 && Number(id) <= LEVEL_COUNT, "越界更次不该留档");
      assert.ok(rec.stars >= 0 && rec.stars <= 3);
      assert.equal(typeof rec.cleared, "boolean");
      assert.equal(typeof rec.noDeath, "boolean");
    }
  }

  const dirty = normalize({
    timed: { best: { chain: "abc", score: 1e12, leftMs: -1 } },
    survival: { best: { rounds: 1.7, score: -9 } },
  });
  assert.deepEqual(dirty.timed.best, { chain: 0, score: SCORE_MAX, leftMs: 0 });
  assert.deepEqual(dirty.survival.best, { rounds: 2, score: 0 });
});

test("越界与未知键被丢弃：脏更次、脏巷码都进不了档", () => {
  const d = normalize({
    levels: { 0: { stars: 3 }, 99: { stars: 3 }, "-3": { stars: 1 }, hello: { stars: 2 }, 5: { stars: 2, cleared: true } },
    lanes: [{ code: " ".repeat(5000) }, { code: "LM1-ok" }],
  });
  assert.deepEqual(Object.keys(d.levels), ["5"]);
  assert.equal(d.lanes.length, 1);
  assert.equal(d.lanes[0].code, "LM1-ok");
});

test("存档读写：坏 JSON / 非 JSON / 写不进都静默降级，绝不白屏", () => {
  return withStorage(() => {
    assert.equal(load().last, 1);
    localStorage.setItem(KEY, "{not json");
    assert.deepEqual(load(), defaults());
    localStorage.setItem(KEY, JSON.stringify({ v: 1, last: 7, levels: { 7: { stars: 2, cleared: true } } }));
    assert.equal(load().last, 7);
    assert.equal(load().levels[7].stars, 2);

    throwOnWrite = true;
    const back = save(setMuted(load(), true));
    assert.equal(back.muted, true, "写不进去也要把归一化后的档还回来");
    throwOnWrite = false;

    assert.equal(clear().last, 1);
    assert.equal(load().muted, false);
  });
});

test("localStorage 整体不可用时退化为内存档", () => {
  const prev = globalThis.localStorage;
  delete globalThis.localStorage;
  try {
    const d = save(setLast(defaults(), 9));
    assert.equal(d.last, 9);
    assert.equal(load().last, 1, "读不到档就回默认，不抛错");
  } finally {
    if (prev !== undefined) globalThis.localStorage = prev;
  }
});

// ---------------------------------------------------------------- 主线更签

test("通关记账：星级与分只升不降，用时取最快，逐更解锁", () => {
  let d = defaults();
  assert.equal(isLevelUnlocked(d, 1), true);
  assert.equal(isLevelUnlocked(d, 2), false);
  assert.equal(highestUnlocked(d), 1);

  d = recordLevel(d, 1, { stars: 1, score: 800, timeMs: 50000, cleared: true }).data;
  assert.equal(d.levels[1].stars, 1);
  assert.equal(d.levels[1].timeMs, 50000);
  assert.equal(isLevelUnlocked(d, 2), true, "通关即解锁下一更");
  assert.equal(d.last, 2);

  d = recordLevel(d, 1, { stars: 3, score: 1500, timeMs: 41000, cleared: true, noDeath: true }).data;
  assert.equal(d.levels[1].stars, 3);
  assert.equal(d.levels[1].best, 1500);
  assert.equal(d.levels[1].timeMs, 41000);
  assert.equal(d.levels[1].noDeath, true);
  assert.equal(d.records.highScore, 1500);

  d = recordLevel(d, 1, { stars: 1, score: 10, timeMs: 99999, cleared: false }).data;
  assert.equal(d.levels[1].stars, 3, "打得更差不得覆盖历史星级");
  assert.equal(d.levels[1].best, 1500);
  assert.equal(d.levels[1].timeMs, 41000, "没通关就不刷新最快用时");
  assert.equal(d.records.highScore, 1500);
});

test("未知更次与越界参数都不脏写", () => {
  let d = defaults();
  const before = d;
  const r = recordLevel(d, 999, { stars: 3, cleared: true });
  assert.equal(r.improved, false);
  assert.deepEqual(r.data, before);
  d = recordLevel(d, 1, { stars: 9, score: 1e12, timeMs: -7, cleared: true }).data;
  assert.equal(d.levels[1].stars, 3);
  assert.equal(d.levels[1].best, SCORE_MAX);
  assert.equal(d.levels[1].timeMs, 0);
});

test("最后一更不再往前跳档", () => {
  const d = clearThrough(LEVEL_COUNT - 1);
  const r = recordLevel(d, LEVEL_COUNT, { stars: 3, score: 9000, cleared: true }).data;
  assert.equal(r.last, LEVEL_COUNT);
  assert.equal(r.levels[LEVEL_COUNT].cleared, true);
});

test("更签与整更判定：30 更 × 3 枚，五更口径正确", () => {
  const d = clearThrough(12);
  assert.equal(LEVELS.length, LEVEL_COUNT);
  assert.equal(watchStars(d, 1), 18, "一更 6 关满签 = 18");
  assert.equal(watchStars(d, 3), 0);
  assert.equal(totalStars(d), 36);
  assert.equal(watchCleared(d, 1), true);
  assert.equal(watchCleared(d, 2), true);
  assert.equal(watchCleared(d, 3), false);
  assert.equal(watchCleared(d, 6), false, "越界更次不该算通");
  assert.equal(LEVELS_PER_WATCH, 6);
});

test("模式解锁：破晓需三更全通，百鬼需五更全通", () => {
  assert.equal(modeUnlocked(defaults(), "campaign"), true);
  assert.equal(modeUnlocked(defaults(), "timed"), false);
  assert.equal(modeUnlocked(clearThrough(18), "timed"), true);
  assert.equal(modeUnlocked(clearThrough(18), "survival"), false);
  assert.equal(modeUnlocked(clearThrough(LEVEL_COUNT), "survival"), true);
  assert.equal(modeUnlocked(defaults(), "workshop"), true, "扎巷坊随时可进");
});

test("限时与生存只记各自最好成绩，并共用全局最高分", () => {
  let d = recordTimed(defaults(), { chain: 3, score: 4200, leftMs: 9000 });
  assert.equal(d.timed.best.chain, 3);
  assert.equal(d.timed.best.score, 4200);
  assert.equal(d.timed.best.leftMs, 9000);
  d = recordTimed(d, { chain: 1, score: 100, leftMs: 1000 });
  assert.equal(d.timed.best.chain, 3);
  assert.equal(d.timed.best.score, 4200);
  d = recordTimed(d, { chain: 9, score: 9999, leftMs: 999999 });
  assert.equal(d.timed.best.chain, 9);
  assert.equal(d.timed.best.leftMs, LEFT_MS_MAX, "更漏余量超上限要钳，绝不显示成 999999");
  assert.equal(d.records.highScore, 9999);

  d = recordSurvival(d, { rounds: 2, score: 700, longestTrain: 3, ghostsEaten: 5 });
  assert.equal(d.survival.best.rounds, 2);
  d = recordSurvival(d, { rounds: 5, score: 300, longestTrain: 1, ghostsEaten: 2 });
  assert.equal(d.survival.best.rounds, 5);
  assert.equal(d.survival.best.score, 700, "生存分只留高的");
  assert.equal(d.records.longestTrain, 3);
  assert.equal(d.records.ghostsEaten, 5);
});

// ---------------------------------------------------------------- 擂台簿

test("巷码簿：同码去重提到最前，条数与字段都有上限", () => {
  const long = "LM1-" + "z".repeat(5000);
  let d = defaults();
  for (let i = 0; i < MAX_LANES + 8; i += 1) {
    d = saveLane(d, { code: `LM1-a${i}`, name: `巷子${i}`.repeat(20), dots: 99999 }).data;
  }
  assert.equal(d.lanes.length, MAX_LANES);
  assert.equal(d.lanes[0].name.length, 24);
  assert.equal(d.lanes[0].dots, 9999);
  assert.equal(d.lanes[0].code, `LM1-a${MAX_LANES + 7}`, "最新一条在前");
  assert.equal(laneEntry(d, "LM1-a0"), null, "最旧的几条应被挤出院子");

  d = saveLane(d, { code: "LM1-a3", score: 400, eaten: 2, timeMs: 12000, cleared: true }).data;
  assert.equal(d.lanes.length, MAX_LANES);
  assert.equal(d.lanes[0].code, "LM1-a3");
  assert.equal(d.lanes[0].best.score, 400);
  assert.equal(d.lanes[0].best.cleared, true);

  d = saveLane(d, { code: "LM1-a3", score: 90, timeMs: 99999 }).data;
  assert.equal(d.lanes[0].best.score, 400, "同码只升不降");
  assert.equal(d.lanes[0].best.timeMs, 12000, "再次跑巷不刷新最好成绩就不该动");

  d = saveLane(d, { code: long }).data;
  assert.equal(d.lanes[0].code.length, 4096, "超长巷码要裁到上限");

  assert.equal(saveLane(d, { code: "   " }).saved, false);
  assert.equal(saveLane(d, {}).saved, false);

  const { data: dropped, dropped: hit } = dropLane(d, "LM1-a3");
  assert.equal(hit, true);
  assert.equal(laneEntry(dropped, "LM1-a3"), null);
  assert.equal(dropLane(dropped, "LM1-a3").dropped, false, "删不存在的条目不该报错");
  assert.equal(dropped.lanes.length, d.lanes.length - 1);
});

test("偏好开关与读档回路", () => {
  return withStorage(() => {
    let d = save(setMuted(defaults(), true));
    assert.equal(d.muted, true);
    assert.equal(load().muted, true);
    d = save(setMuted(d, false));
    assert.equal(load().muted, false);
    d = save(setAssist(d, { fog: false }));
    assert.equal(load().assist.fog, false);
    d = save(setAssist(d, {}));
    assert.equal(load().assist.fog, false, "未传的键不该被改写");
    d = save(setLast(d, LEVEL_COUNT + 5));
    assert.equal(load().last, LEVEL_COUNT);
  });
});

// ---------------------------------------------------------------- 计分口径

test("clampInt 与 formatScore：越界即钳，显示永远补齐", () => {
  assert.equal(clampInt(5, 0, 3, 0), 3);
  assert.equal(clampInt(-5, 0, 3, 0), 0);
  assert.equal(clampInt("x", 0, 3, 2), 2);
  assert.equal(clampInt(NaN, 1, 9, 4), 4);
  assert.equal(clampInt(2.6, 0, 9, 0), 3);
  assert.equal(formatScore(0), "000000");
  assert.equal(formatScore(1234), "001234");
  assert.equal(formatScore(1e9), String(SCORE_MAX));
  assert.equal(formatScore("n/a"), "000000");
});

test("三星评级：没清场一律零签，快清与连吞都算效率", () => {
  assert.equal(rateRun({ cleared: false, deaths: 0, timeMs: 1000, parMs: 9000 }).stars, 0);
  assert.equal(rateRun({ cleared: true, deaths: 1, timeMs: 9000, parMs: 9000 }).stars, 2);
  assert.equal(rateRun({ cleared: true, deaths: 0, timeMs: 8000, parMs: 9000, bestChain: 0, longestTrain: 0 }).stars, 3);
  assert.equal(
    rateRun({ cleared: true, deaths: 2, timeMs: 99000, parMs: 9000, bestChain: 3 }).stars,
    2,
    "连吞三影补效率签，但熄灯丢零熄灯签"
  );
  assert.equal(
    rateRun({ cleared: true, deaths: 2, timeMs: 99000, parMs: 9000, longestTrain: 4 }).stars,
    2,
    "影列倍率四也算效率签"
  );
  assert.deepEqual(
    rateRun({ cleared: true, deaths: 0, timeMs: 1000, parMs: 0 }).detail,
    { clear: true, noDeath: true, fast: false },
    "没有 par 就不白送效率签"
  );
  assert.deepEqual(
    rateRun({ cleared: true, deaths: 0, timeMs: 1000, parMs: 9000 }).detail,
    { clear: true, noDeath: true, fast: true },
    "同一份成绩补上 par 即三签"
  );
});

test("分值表：吞影按连吞翻倍，流明灯按更次递增", () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => ghostScore(i)), [200, 400, 800, 1600]);
  assert.equal(ghostScore(9), 1600, "连吞第四只之后封顶");
  assert.equal(ghostScore(-1), 200);
  assert.equal(fruitScore({ fruitValue: 700 }, 0), 700, "cfg 指定优先");
  assert.equal(fruitScore(null, 0), 100);
  assert.equal(fruitScore(null, 7), 5000);
  assert.equal(fruitScore(null, 99), 5000);
  assert.ok(EXTRA_LIFE_AT > 0);
});

test("每一更都带得动存档：更次表自洽且 id 连续", () => {
  for (let id = 1; id <= LEVEL_COUNT; id += 1) {
    const lvl = levelById(id);
    assert.ok(lvl, `缺第 ${id} 更`);
    assert.equal(lvl.id, id);
    assert.equal(lvl.watch, Math.ceil(id / LEVELS_PER_WATCH));
    assert.ok(lvl.roster.length >= 1 && lvl.roster.length <= 8, `第 ${id} 更影魅数越界`);
    assert.ok(lvl.parMs > 0);

    const layout = parseLayout(rowsForLevel(id));
    const state = createState({ rows: rowsForLevel(id), cfg: lvl, seed: 5, mode: "campaign" });
    const names = new Set();
    for (const g of lvl.roster) {
      assert.ok(GHOST_BEH.includes(g.beh), `第 ${id} 更出现未知影魅性格 ${g.beh}`);
      assert.ok(SCATTER_KEYS.includes(g.scatter), `第 ${id} 更四角键非法 ${g.scatter}`);
      assert.ok(!names.has(g.name), `第 ${id} 更影魅重名 ${g.name}`);
      names.add(g.name);
    }
    assert.ok(layout.houses.length >= 1 && layout.houses.length <= 2, `第 ${id} 更影匣数量异常`);
    for (const g of state.ghosts) {
      const house = layout.houses[g.houseIdx];
      assert.ok(house, `第 ${id} 更 ${g.name} 的影匣序号 ${g.houseIdx} 越界`);
      assert.ok(
        house.slots.some((s) => s.x === g.slot.x && s.y === g.slot.y),
        `第 ${id} 更 ${g.name} 的出匣槽位不在自己那座匣里`
      );
    }
    const release = state.cfg.release;
    assert.equal(release.length ? release[0] : 0, 0, `第 ${id} 更该有一只影魅开局即出匣`);
    for (let i = 1; i < release.length; i += 1) {
      assert.ok(release[i] > release[i - 1], `第 ${id} 更出匣节拍必须逐档拉开，避免两只同时挤门`);
    }
    assert.equal(
      state.ghosts.filter((g) => g.st === "house").length,
      Math.min(state.ghosts.length, release.length),
      `第 ${id} 更开局匣中影魅数应与出匣节拍档数对齐`
    );

    const d = recordLevel(defaults(), id, { stars: 2, score: 100, cleared: true }).data;
    assert.equal(levelRecord(d, id).stars, 2);
  }
  assert.equal(levelById(0), null);
  assert.equal(levelById(999), null);
  assert.equal(levelRecord(defaults(), 5).cleared, false, "没打过的更次要给空档而不是 undefined");
});
