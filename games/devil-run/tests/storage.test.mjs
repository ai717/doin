// 恶魔迷途 · 存档层测试
// 重点：损坏数据绝不白屏、印章只增不减、最佳用时只更快、内存降级可用。

import test from "node:test";
import assert from "node:assert/strict";

import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  defaultState,
  normalize,
  load,
  save,
  reset,
  recordClear,
  recordDeath,
  getSeal,
  getBestTime,
  getDeaths,
  getTotalDeaths,
  overallSeals,
  isLevelUnlocked,
  resetBackendForTests
} from "../js/storage.mjs";
import { LEVEL_COUNT, NODES } from "../js/levels.mjs";

// 每个用例都从干净后端开始，避免相互污染
test.beforeEach(() => {
  resetBackendForTests();
});

// ---------------------------------------------------------------- 默认状态

test("默认状态结构完整（版本 / 偏好 / 进度三件套）", () => {
  const s = defaultState();
  assert.equal(s.version, SCHEMA_VERSION);
  assert.equal(s.prefs.muted, false);
  assert.equal(s.progress.unlocked, 1);
  assert.deepEqual(s.progress.seals, {});
  assert.deepEqual(s.progress.bestTime, {});
  assert.deepEqual(s.progress.deaths, {});
  assert.equal(s.progress.totalDeaths, 0);
});

test("存档 key 符合平台规范 doin.<slug>.v1", () => {
  assert.equal(STORAGE_KEY, "doin.devil-run.v1");
  assert.match(STORAGE_KEY, /^doin\.[a-z0-9-]+\.v\d+$/);
});

// ---------------------------------------------------------------- 归一化防线

test("normalize 对 null / 非对象 / 垃圾输入一律退回默认值", () => {
  for (const bad of [null, undefined, 0, "", "junk", [], true, NaN]) {
    const s = normalize(bad);
    assert.equal(s.progress.unlocked, 1, `输入 ${JSON.stringify(bad)} 应退回默认`);
    assert.deepEqual(s.progress.seals, {});
  }
});

test("normalize 钳制越界的 unlocked，不信任外部数据", () => {
  assert.equal(normalize({ progress: { unlocked: 9999 } }).progress.unlocked, LEVEL_COUNT);
  assert.equal(normalize({ progress: { unlocked: -5 } }).progress.unlocked, 1);
  assert.equal(normalize({ progress: { unlocked: 3.7 } }).progress.unlocked, 3);
  assert.equal(normalize({ progress: { unlocked: NaN } }).progress.unlocked, 1);
});

test("normalize 丢弃非法印章值，并遵守「无通关则其余两印归零」规则", () => {
  const s = normalize({
    progress: {
      seals: {
        0: { clear: true, candle: "yes", flawless: 1 },
        1: "garbage",
        2: null,
        3: { clear: false, candle: true, flawless: true }
      }
    }
  });
  // clear 为真：其余两印按布尔强制转换（"yes"/1 均为真值）
  assert.equal(s.progress.seals[0].clear, true);
  assert.equal(s.progress.seals[0].candle, true);
  assert.equal(s.progress.seals[0].flawless, true);
  assert.equal(s.progress.seals[1], undefined, "垃圾条目应被丢弃");
  assert.equal(s.progress.seals[2], undefined);
  // 无通关则其余两印无意义，必须归零，防止造出「没通关却有蜡烛印」的脏状态
  assert.deepEqual(s.progress.seals[3], {
    clear: false, candle: false, flawless: false
  });
});

test("normalize 丢弃越界关卡索引与非法用时", () => {
  const s = normalize({
    progress: {
      bestTime: { 0: 12.5, 999: 3, 1: -8, 2: "abc", 3: NaN },
      deaths: { 0: 4, 999: 9, 1: -2 }
    }
  });
  assert.equal(s.progress.bestTime[0], 12.5);
  assert.equal(s.progress.bestTime[999], undefined);
  assert.equal(s.progress.bestTime[1], undefined, "负用时应丢弃");
  assert.equal(s.progress.bestTime[2], undefined, "字符串应丢弃");
  assert.equal(s.progress.bestTime[3], undefined, "NaN 应丢弃");
  assert.equal(s.progress.deaths[0], 4);
  assert.equal(s.progress.deaths[999], undefined);
  assert.equal(s.progress.deaths[1], undefined, "负死亡数应丢弃");
});

// ---------------------------------------------------------------- 读写往返

test("save → load 往返一致", () => {
  const s = defaultState();
  s.prefs.muted = true;
  s.progress.unlocked = 7;
  assert.equal(save(s), true);
  const back = load();
  assert.equal(back.prefs.muted, true);
  assert.equal(back.progress.unlocked, 7);
});

test("存储为空时 load 返回默认值，不抛错", () => {
  reset();
  const s = load();
  assert.equal(s.progress.unlocked, 1);
});

test("存储中是坏 JSON 时 load 静默退回默认值（绝不白屏）", () => {
  assert.doesNotThrow(() => {
    // 直接塞一段非法内容
    save(defaultState());
    const store = globalThis.localStorage;
    if (store) store.setItem(STORAGE_KEY, "{ this is not json");
  });
  const s = load();
  assert.equal(s.progress.unlocked, 1, "坏数据应静默降级");
  assert.equal(s.version, SCHEMA_VERSION);
});

test("存档损坏场景下 save/load 仍可正常工作（内存降级）", () => {
  resetBackendForTests();
  assert.doesNotThrow(() => {
    save({ totally: "broken" });
    load();
    reset();
  });
  assert.equal(load().progress.unlocked, 1);
});

// ---------------------------------------------------------------- 印章语义

test("recordClear 点亮通关印并解锁下一关", () => {
  let s = recordClear(defaultState(), {
    levelIndex: 0,
    seal: { clear: true, candle: false, flawless: false },
    elapsed: 5
  });
  assert.equal(getSeal(s, 0).clear, true);
  assert.equal(s.progress.unlocked, 2, "应解锁第 2 关");
  assert.equal(getBestTime(s, 0), 5);
});

test("印章只增不减：二次通关不抹掉已有的蜡烛印 / 无伤印", () => {
  let s = recordClear(defaultState(), {
    levelIndex: 3,
    seal: { clear: true, candle: true, flawless: true },
    elapsed: 10
  });
  s = recordClear(s, {
    levelIndex: 3,
    seal: { clear: true, candle: false, flawless: false },
    elapsed: 9
  });
  const seal = getSeal(s, 3);
  assert.equal(seal.candle, true, "蜡烛印不该被抹掉");
  assert.equal(seal.flawless, true, "无伤印不该被抹掉");
});

test("最佳用时只更快才更新", () => {
  let s = recordClear(defaultState(), {
    levelIndex: 2,
    seal: { clear: true },
    elapsed: 8
  });
  assert.equal(getBestTime(s, 2), 8);
  s = recordClear(s, { levelIndex: 2, seal: { clear: true }, elapsed: 12 });
  assert.equal(getBestTime(s, 2), 8, "更慢不应覆盖");
  s = recordClear(s, { levelIndex: 2, seal: { clear: true }, elapsed: 6 });
  assert.equal(getBestTime(s, 2), 6, "更快应更新");
});

test("最后一关通关不会把 unlocked 顶出边界", () => {
  const s = recordClear(defaultState(), {
    levelIndex: LEVEL_COUNT - 1,
    seal: { clear: true },
    elapsed: 3
  });
  assert.equal(s.progress.unlocked, LEVEL_COUNT, "最多解锁到最后一关");
});

test("recordClear 对越界 / 非法 levelIndex 安全无操作", () => {
  const base = defaultState();
  for (const bad of [-1, 999, NaN, "x", null]) {
    const out = recordClear(base, { levelIndex: bad, seal: { clear: true } });
    assert.equal(out.progress.unlocked, 1, `非法索引 ${bad} 不应解锁`);
  }
});

test("recordDeath 累计本关与全局死亡数", () => {
  let s = recordDeath(defaultState(), 4, 3);
  assert.equal(getDeaths(s, 4), 3);
  assert.equal(getTotalDeaths(s), 3);
  s = recordDeath(s, 4, 2);
  assert.equal(getDeaths(s, 4), 5);
  assert.equal(getTotalDeaths(s), 5);
  s = recordDeath(s, 7, 1);
  assert.equal(getDeaths(s, 7), 1);
  assert.equal(getTotalDeaths(s), 6);
});

test("recordDeath 忽略非法参数且不污染存档", () => {
  let s = recordDeath(defaultState(), -1, 5);
  s = recordDeath(s, 3, 0);
  s = recordDeath(s, 3, -2);
  assert.equal(getTotalDeaths(s), 0);
});

test("getSeal / getBestTime / getDeaths 对未记录的关卡返回安全默认", () => {
  const s = defaultState();
  assert.deepEqual(getSeal(s, 42), { clear: false, candle: false, flawless: false });
  assert.equal(getBestTime(s, 42), null);
  assert.equal(getDeaths(s, 42), 0);
});

// ---------------------------------------------------------------- 派生统计

test("overallSeals 统计全局印章总数，上限为 关数 × 3", () => {
  let s = defaultState();
  assert.equal(overallSeals(s).clear, 0);
  s = recordClear(s, { levelIndex: 0, seal: { clear: true, candle: true, flawless: true }, elapsed: 1 });
  s = recordClear(s, { levelIndex: 1, seal: { clear: true }, elapsed: 1 });
  const tally = overallSeals(s);
  assert.equal(tally.clear, 2);
  assert.equal(tally.candle, 1);
  assert.equal(tally.flawless, 1);
  assert.ok(tally.total <= LEVEL_COUNT * 3, "印章总数不得超过上限");
});

test("isLevelUnlocked 依据进度正确判断", () => {
  let s = defaultState();
  assert.equal(isLevelUnlocked(s, 0), true, "第 1 关默认解锁");
  assert.equal(isLevelUnlocked(s, 1), false, "第 2 关初始未解锁");
  s = recordClear(s, { levelIndex: 0, seal: { clear: true }, elapsed: 1 });
  assert.equal(isLevelUnlocked(s, 1), true, "通关第 1 关后第 2 关解锁");
});

test("NODES 结构自洽：from ≤ to 且连续覆盖 0..49", () => {
  let expectedFrom = 0;
  for (const node of NODES) {
    assert.ok(node.from <= node.to, `节点 ${node.id} 区间非法`);
    assert.equal(node.from, expectedFrom, `节点 ${node.id} 起点不连续`);
    expectedFrom = node.to + 1;
  }
  assert.equal(expectedFrom, LEVEL_COUNT, "节点区间应恰好覆盖全部关卡");
});
