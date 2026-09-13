// 存档层单测：空档 / 坏 JSON / 缺字段 / 错类型 / 负数 / NaN / Infinity / 越界 /
// normalize 修正 / 版本不兼容 / localStorage 不可用降级 / 写入失败静默降级。
import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PROGRESS,
  STORAGE_KEY,
  VERSION,
  clearProgress,
  dailyBest,
  levelStat,
  loadProgress,
  normalizeProgress,
  recordDaily,
  recordEndless,
  recordLevel,
  saveProgress
} from "../js/storage.mjs";
import { LEVEL_COUNT } from "../js/engine.mjs";
import { MAX_SCORE } from "../js/score.mjs";

/* ------------------------------------------------------------ 工具 */

function withWindow(impl, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const previous = globalThis.window;
  globalThis.window = impl;
  try {
    return fn();
  } finally {
    if (had) globalThis.window = previous;
    else delete globalThis.window;
  }
}

function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map)
  };
}

/* ------------------------------------------------------------ normalize */

test("normalize：空 / 非对象 / 数组 / 字符串 一律回退默认值", () => {
  const expected = {
    v: VERSION,
    unlocked: 1,
    levels: {},
    endlessBest: 0,
    daily: { dateKey: "", bestScore: 0 },
    muted: false,
    lastLevel: 1
  };
  assert.deepEqual(normalizeProgress(null), expected);
  assert.deepEqual(normalizeProgress(undefined), expected);
  assert.deepEqual(normalizeProgress("nope"), expected);
  assert.deepEqual(normalizeProgress(42), expected);
  assert.deepEqual(normalizeProgress([]), expected);
  assert.deepEqual(normalizeProgress(DEFAULT_PROGRESS), expected);
});

test("normalize：版本不兼容（v !== 1）整体回退默认值", () => {
  const stale = { v: 0, unlocked: 30, levels: { "1": { score: 9999, stars: 3 } }, endlessBest: 5000 };
  assert.deepEqual(normalizeProgress(stale), {
    v: VERSION,
    unlocked: 1,
    levels: {},
    endlessBest: 0,
    daily: { dateKey: "", bestScore: 0 },
    muted: false,
    lastLevel: 1
  });
  assert.deepEqual(normalizeProgress({ v: 2, unlocked: 12 }).unlocked, 1);
});

test("normalize：老存档（没有 daily 字段）必须原样保留主线进度", () => {
  // 每日一盘是**追加字段**，不是破坏性变更：v 仍为 1，老档不能因此被清空。
  const legacy = {
    v: 1,
    unlocked: 18,
    levels: { "7": { score: 4200, stars: 3 } },
    endlessBest: 9000,
    muted: true,
    lastLevel: 12
  };
  const out = normalizeProgress(legacy);
  assert.equal(out.unlocked, 18, "老档的主线进度不得被重置");
  assert.deepEqual(out.levels["7"], { score: 4200, stars: 3 });
  assert.equal(out.endlessBest, 9000);
  assert.equal(out.muted, true);
  assert.equal(out.lastLevel, 12);
  assert.deepEqual(out.daily, { dateKey: "", bestScore: 0 }, "缺失的 daily 应补默认值");
});

test("normalize：unlocked 越界 / 负数 / NaN / Infinity 全部钳制", () => {
  assert.equal(normalizeProgress({ v: 1, unlocked: 999 }).unlocked, LEVEL_COUNT);
  assert.equal(normalizeProgress({ v: 1, unlocked: -5 }).unlocked, 1);
  assert.equal(normalizeProgress({ v: 1, unlocked: NaN }).unlocked, 1);
  assert.equal(normalizeProgress({ v: 1, unlocked: Infinity }).unlocked, 1);
  assert.equal(normalizeProgress({ v: 1, unlocked: "12" }).unlocked, 1, "字符串必须判为非法");
  assert.equal(normalizeProgress({ v: 1, unlocked: 12.7 }).unlocked, 12);
  assert.equal(normalizeProgress({ v: 1 }).unlocked, 1, "缺失字段回退默认");
});

test("normalize：levels 非法 key / 错类型 / 越界数值全部丢弃或修正", () => {
  const raw = {
    v: 1,
    unlocked: 20,
    levels: {
      "1": { score: 1234, stars: 3 },
      "0": { score: 10, stars: 1 },
      "37": { score: 10, stars: 1 },
      "-2": { score: 10, stars: 1 },
      "01": { score: 10, stars: 1 },
      "abc": { score: 10, stars: 1 },
      "5": { score: -100, stars: 9 },
      "6": { score: NaN, stars: Infinity },
      "7": { score: "500", stars: "2" },
      "8": null,
      "9": [1, 2, 3]
    }
  };
  const out = normalizeProgress(raw);
  assert.deepEqual(out.levels["1"], { score: 1234, stars: 3 });
  assert.deepEqual(out.levels["5"], { score: 0, stars: 3 }, "负数归零、星数上限 3");
  assert.deepEqual(out.levels["6"], { score: 0, stars: 0 }, "NaN / Infinity 归零");
  assert.deepEqual(out.levels["7"], { score: 0, stars: 0 }, "字符串数值必须判为非法");
  assert.equal(out.levels["0"], undefined);
  assert.equal(out.levels["37"], undefined);
  assert.equal(out.levels["-2"], undefined);
  assert.equal(out.levels["01"], undefined);
  assert.equal(out.levels["abc"], undefined);
  assert.equal(out.levels["8"], undefined);
  assert.equal(out.levels["9"], undefined);
});

test("normalize：endlessBest / lastLevel / muted 严格清洗", () => {
  assert.equal(normalizeProgress({ v: 1, endlessBest: -1 }).endlessBest, 0);
  assert.equal(normalizeProgress({ v: 1, endlessBest: NaN }).endlessBest, 0);
  assert.equal(normalizeProgress({ v: 1, endlessBest: Infinity }).endlessBest, 0);
  assert.equal(normalizeProgress({ v: 1, endlessBest: 1e15 }).endlessBest, MAX_SCORE);
  assert.equal(normalizeProgress({ v: 1, endlessBest: 4321 }).endlessBest, 4321);

  assert.equal(normalizeProgress({ v: 1, unlocked: 10, lastLevel: 99 }).lastLevel, 10, "lastLevel 不得超过 unlocked");
  assert.equal(normalizeProgress({ v: 1, unlocked: 10, lastLevel: -3 }).lastLevel, 1);
  assert.equal(normalizeProgress({ v: 1, unlocked: 10, lastLevel: "7" }).lastLevel, 1);

  assert.equal(normalizeProgress({ v: 1, muted: "true" }).muted, false, "非布尔必须判为 false");
  assert.equal(normalizeProgress({ v: 1, muted: 1 }).muted, false);
  assert.equal(normalizeProgress({ v: 1, muted: true }).muted, true);
});

/* ------------------------------------------------------------ 读写降级 */

test("loadProgress：localStorage 不可用时回退内存默认值且不抛错", () => {
  const out = loadProgress();
  assert.equal(out.v, VERSION);
  assert.ok(out.unlocked >= 1 && out.unlocked <= LEVEL_COUNT);
  assert.equal(typeof out.levels, "object");
});

test("loadProgress：坏 JSON / 版本不符 / 空值均安全降级", () => {
  withWindow({ localStorage: fakeStorage({ [STORAGE_KEY]: "{ not json" }) }, () => {
    const out = loadProgress();
    assert.equal(out.v, VERSION);
    assert.equal(out.unlocked, 1);
  });

  withWindow({ localStorage: fakeStorage({ [STORAGE_KEY]: JSON.stringify({ v: 99, unlocked: 30 }) }) }, () => {
    assert.equal(loadProgress().unlocked, 1, "版本不符必须回退默认");
  });

  withWindow({ localStorage: fakeStorage({}) }, () => {
    assert.equal(loadProgress().unlocked, 1, "空存档必须回退默认");
  });

  withWindow(
    {
      get localStorage() {
        throw new Error("private mode");
      }
    },
    () => {
      assert.equal(loadProgress().v, VERSION, "访问 localStorage 抛错时必须静默降级");
    }
  );
});

test("saveProgress：正常写入并规范化；写入抛错时静默降级", () => {
  const storage = fakeStorage({});
  withWindow({ localStorage: storage }, () => {
    const saved = saveProgress({ v: 1, unlocked: 999, levels: { "3": { score: -5, stars: 7 } }, endlessBest: NaN });
    assert.equal(saved.unlocked, LEVEL_COUNT);
    assert.deepEqual(saved.levels["3"], { score: 0, stars: 3 });
    assert.equal(saved.endlessBest, 0);
    const written = JSON.parse(storage.dump()[STORAGE_KEY]);
    assert.equal(written.unlocked, LEVEL_COUNT, "落盘内容必须是清洗后的结果");
  });

  withWindow(
    {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {}
      }
    },
    () => {
      const out = saveProgress({ v: 1, unlocked: 4 });
      assert.equal(out.unlocked, 4, "写入失败也必须返回内存态且不抛错");
      assert.equal(loadProgress().unlocked, 4, "内存降级后应仍能读到最新状态");
    }
  );
});

test("clearProgress：清空后回退默认值", () => {
  const storage = fakeStorage({});
  withWindow({ localStorage: storage }, () => {
    saveProgress({ v: 1, unlocked: 8, levels: { "1": { score: 900, stars: 2 } } });
    const cleared = clearProgress();
    assert.equal(cleared.unlocked, 1);
    assert.deepEqual(cleared.levels, {});
    assert.equal(storage.dump()[STORAGE_KEY], undefined);
  });
});

/* ------------------------------------------------------------ 成绩记录 */

test("levelStat：无记录返回零值，非法关卡安全钳制", () => {
  assert.deepEqual(levelStat(DEFAULT_PROGRESS, 1), { score: 0, stars: 0 });
  assert.deepEqual(levelStat({ v: 1, levels: { "3": { score: 500, stars: 2 } } }, 3), { score: 500, stars: 2 });
  assert.deepEqual(levelStat(DEFAULT_PROGRESS, 999), { score: 0, stars: 0 });
  assert.deepEqual(levelStat(null, 1), { score: 0, stars: 0 });
});

test("recordLevel：分数取历史最高，星数只增不减，并解锁下一关", () => {
  let progress = { v: 1, unlocked: 1, levels: {}, endlessBest: 0, muted: false, lastLevel: 1 };
  progress = recordLevel(progress, 1, { score: 1500, stars: 2 });
  assert.deepEqual(progress.levels["1"], { score: 1500, stars: 2 });
  assert.equal(progress.unlocked, 2);
  assert.equal(progress.lastLevel, 1);

  // 更差的成绩不得覆盖
  progress = recordLevel(progress, 1, { score: 800, stars: 1 });
  assert.deepEqual(progress.levels["1"], { score: 1500, stars: 2 }, "更差成绩不得覆盖历史最好");
  assert.equal(progress.unlocked, 2);

  // 分数更高但星数更低 → 各自取最大
  progress = recordLevel(progress, 1, { score: 3000, stars: 0 });
  assert.deepEqual(progress.levels["1"], { score: 3000, stars: 2 });

  // 星数更高但分数更低
  progress = recordLevel(progress, 1, { score: 10, stars: 3 });
  assert.deepEqual(progress.levels["1"], { score: 3000, stars: 3 });

  // 最后一关不得越界解锁
  const last = recordLevel({ v: 1, unlocked: LEVEL_COUNT, levels: {}, endlessBest: 0, muted: false, lastLevel: 1 }, LEVEL_COUNT, {
    score: 100,
    stars: 1
  });
  assert.equal(last.unlocked, LEVEL_COUNT);

  // 非法输入不得污染存档
  const dirty = recordLevel({ v: 1, unlocked: 1, levels: {}, endlessBest: 0, muted: false, lastLevel: 1 }, 2, {
    score: NaN,
    stars: -5
  });
  assert.deepEqual(dirty.levels["2"], { score: 0, stars: 0 });
  assert.equal(dirty.unlocked, 3);
});

test("recordEndless：只保留最高分", () => {
  let progress = { v: 1, unlocked: 1, levels: {}, endlessBest: 0, muted: false, lastLevel: 1 };
  progress = recordEndless(progress, 2400);
  assert.equal(progress.endlessBest, 2400);
  progress = recordEndless(progress, 900);
  assert.equal(progress.endlessBest, 2400, "更低分不得覆盖");
  progress = recordEndless(progress, 5000);
  assert.equal(progress.endlessBest, 5000);
  assert.equal(recordEndless(progress, NaN).endlessBest, 5000);
  assert.equal(recordEndless(progress, -100).endlessBest, 5000);
});

test("存档 Key 与版本号符合契约", () => {
  assert.equal(STORAGE_KEY, "doin.pair-link.v1");
  assert.equal(VERSION, 1);
  assert.ok(!STORAGE_KEY.includes("<slug>"));
});

/* ------------------------------------------------------------ 每日一盘 */

test("recordDaily：同一天取最高分，跨天重置", () => {
  const day1 = "2026-09-13";
  const day2 = "2026-09-14";
  let progress = { v: 1, unlocked: 1, levels: {}, endlessBest: 0, muted: false, lastLevel: 1 };

  let out = recordDaily(progress, day1, 1200);
  assert.equal(out.isNewBest, true, "今天第一次记录就是新纪录");
  progress = out.progress;
  assert.deepEqual(progress.daily, { dateKey: day1, bestScore: 1200 });
  assert.equal(dailyBest(progress, day1), 1200);

  out = recordDaily(progress, day1, 800);
  assert.equal(out.isNewBest, false, "更低分不算新纪录");
  assert.equal(out.progress.daily.bestScore, 1200, "更低分不得覆盖");

  out = recordDaily(progress, day1, 2600);
  assert.equal(out.isNewBest, true);
  progress = out.progress;
  assert.equal(progress.daily.bestScore, 2600);

  // 跨天：昨天的最佳分不该出现在今天
  assert.equal(dailyBest(progress, day2), 0, "跨天后旧记录必须失效");
  out = recordDaily(progress, day2, 300);
  assert.equal(out.isNewBest, true);
  assert.deepEqual(out.progress.daily, { dateKey: day2, bestScore: 300 }, "跨天应重置而不是取历史最高");
  assert.equal(dailyBest(out.progress, day1), 0);
});

test("recordDaily：不触碰 unlocked / levels / lastLevel", () => {
  const progress = {
    v: 1,
    unlocked: 5,
    levels: { "3": { score: 900, stars: 2 } },
    endlessBest: 700,
    muted: false,
    lastLevel: 4
  };
  const out = recordDaily(progress, "2026-09-13", 5000).progress;
  assert.equal(out.unlocked, 5, "每日一盘不得解锁主线");
  assert.deepEqual(out.levels, { "3": { score: 900, stars: 2 } }, "每日一盘不得写入主线关卡记录");
  assert.equal(out.lastLevel, 4, "每日一盘不得改动 lastLevel");
  assert.equal(out.endlessBest, 700);
});

test("recordDaily：非法日期 / 非法分数安全降级", () => {
  const progress = { v: 1, unlocked: 1, levels: {}, endlessBest: 0, muted: false, lastLevel: 1 };
  const bad = recordDaily(progress, "2026-9-3", 500);
  assert.equal(bad.isNewBest, false);
  assert.deepEqual(bad.progress.daily, { dateKey: "", bestScore: 0 }, "非法日期不得写进存档");
  assert.equal(recordDaily(progress, null, 500).progress.daily.dateKey, "");
  assert.equal(recordDaily(progress, 20260913, 500).progress.daily.dateKey, "");

  const dirty = recordDaily(progress, "2026-09-13", NaN).progress;
  assert.equal(dirty.daily.bestScore, 0, "NaN 必须钳制为 0");
  assert.equal(recordDaily(progress, "2026-09-13", -50).progress.daily.bestScore, 0);
  assert.equal(recordDaily(progress, "2026-09-13", MAX_SCORE + 1).progress.daily.bestScore, MAX_SCORE);
});

test("normalize：daily 字段被严格清洗（坏日期整条回退）", () => {
  const ok = normalizeProgress({ v: 1, daily: { dateKey: "2026-09-13", bestScore: 800 } });
  assert.deepEqual(ok.daily, { dateKey: "2026-09-13", bestScore: 800 });

  assert.deepEqual(normalizeProgress({ v: 1, daily: { dateKey: "bad", bestScore: 800 } }).daily, {
    dateKey: "",
    bestScore: 0
  });
  assert.deepEqual(normalizeProgress({ v: 1, daily: "nope" }).daily, { dateKey: "", bestScore: 0 });
  assert.deepEqual(normalizeProgress({ v: 1, daily: [] }).daily, { dateKey: "", bestScore: 0 });
  assert.deepEqual(normalizeProgress({ v: 1, daily: null }).daily, { dateKey: "", bestScore: 0 });
  assert.deepEqual(normalizeProgress({ v: 1, daily: { dateKey: "2026-09-13", bestScore: NaN } }).daily, {
    dateKey: "2026-09-13",
    bestScore: 0
  });
  assert.deepEqual(normalizeProgress({ v: 1, daily: { dateKey: "2026-09-13", bestScore: -9 } }).daily, {
    dateKey: "2026-09-13",
    bestScore: 0
  });
});

test("dailyBest：日期不符 / 无记录一律返回 0", () => {
  const progress = { v: 1, daily: { dateKey: "2026-09-13", bestScore: 1500 } };
  assert.equal(dailyBest(progress, "2026-09-13"), 1500);
  assert.equal(dailyBest(progress, "2026-09-14"), 0);
  assert.equal(dailyBest(progress, "bad"), 0);
  assert.equal(dailyBest(progress, null), 0);
  assert.equal(dailyBest(null, "2026-09-13"), 0);
  assert.equal(dailyBest({}, "2026-09-13"), 0);
});

test("每日一盘存档能真实落盘并读回", () => {
  const store = fakeStorage();
  withWindow({ localStorage: store }, () => {
    let progress = loadProgress();
    progress = recordDaily(progress, "2026-09-13", 3300).progress;
    saveProgress(progress);
    const reloaded = loadProgress();
    assert.equal(dailyBest(reloaded, "2026-09-13"), 3300);
    assert.equal(reloaded.unlocked, 1, "每日一盘不该影响主线解锁");
  });
});
