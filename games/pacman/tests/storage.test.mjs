// storage.test.mjs —— 存档验收：脏数据必须 normalize 成合法档而不抛错，本地存储不可用时静默降级内存。
//
// 坑（照抄前务必看）：
//   1) Node 里没有 localStorage，用假实现挂在 globalThis 上，测完必须还原，否则串到别的用例。
//   2) 断言写"写入后 normalize 回来仍相等"而不是"读到的对象等于写入的对象"——save 走的是 normalize 后的快照。
//   3) 越界/脏值一律测：存档来自用户磁盘，任何字段都可能是字符串或 NaN。

import test from "node:test";
import assert from "node:assert/strict";

import {
  KEY,
  VERSION,
  MAZE_COUNT,
  SETPIECE_IDS,
  defaults,
  normalize,
  load,
  save,
  clear,
  levelRecord,
  recordLevel,
  isLevelUnlocked,
  highestUnlocked,
  totalStars,
  campaignCleared,
  arcadeBest,
  recordArcade,
  setpieceRecord,
  recordSetpiece,
  setpiecesCleared,
  recordRunStats,
  setMuted,
  setAssist,
  setSpeedTier,
  SPEED_TIER_IDS,
  DEFAULT_TIER,
  setLast,
} from "../js/storage.mjs";
import { MAZES, SETPIECES } from "../js/mazes.mjs";

const store = new Map();
let broken = false;

const fake = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => {
    if (broken) throw new Error("QuotaExceededError");
    store.set(k, String(v));
  },
  removeItem: (k) => store.delete(k),
};

function withStorage(body) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = fake;
  store.clear();
  broken = false;
  try {
    return body();
  } finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
    store.clear();
    broken = false;
  }
}

test("存档 key 与版本号锁定，数据规模与迷宫表对齐", () => {
  assert.equal(KEY, "doin.pacman.v1");
  assert.equal(VERSION, 1);
  assert.equal(MAZE_COUNT, MAZES.length);
  assert.equal(MAZE_COUNT, 7);
  assert.equal(SETPIECE_IDS.length, SETPIECES.length);
  assert.equal(SETPIECE_IDS.length, 10);
});

test("默认档：静音关、AI 可读化开、战役只解锁第 1 张", () => {
  const d = defaults();
  assert.equal(d.v, VERSION);
  assert.equal(d.muted, false);
  assert.equal(d.assist.aiRead, true, "AI 可读化默认全开（拍板 ❶）");
  assert.equal(d.campaign.unlocked, 1);
  assert.deepEqual(d.arcade.best, { score: 0, level: 0, dots: 0, ghosts: 0 });
  assert.deepEqual(d.records, { highScore: 0, bestChain: 0, ghostsEaten: 0, runs: 0 });
});

test("normalize：垃圾输入一律退回合法档，绝不抛错", () => {
  for (const junk of [null, undefined, 0, "", "abc", [], [1, 2], true, 42]) {
    const out = normalize(junk);
    assert.equal(out.v, VERSION, `输入 ${String(junk)} 应得到合法档`);
    assert.equal(typeof out.muted, "boolean");
    assert.equal(out.campaign.unlocked >= 1, true);
  }
});

test("normalize：每个字段的脏值都被钳回区间", () => {
  const out = normalize({
    v: 999,
    muted: "yes",
    assist: { aiRead: 0 },
    last: { mode: "nope", level: 999, setpiece: "sp_hack" },
    campaign: { unlocked: -5, levels: { 1: { stars: 99, best: "abc", timeMs: -1 }, 99: { stars: 2 } } },
    arcade: { best: { score: -1, level: NaN, dots: 1e12 } },
    setpieces: { sp_clear_1: { cleared: "true", best: 5.7, tries: -3 }, "sp_bad": { cleared: true } },
    records: { highScore: null, bestChain: 1e9, runs: "many" },
  });
  assert.equal(out.v, VERSION, "版本号永远写回当前版本");
  assert.equal(out.muted, false, "非 true 一律按关");
  assert.equal(out.assist.aiRead, false, "0 显式关掉了可读化");
  assert.equal(out.last.mode, "campaign", "未知模式回落战役");
  assert.equal(out.last.level, MAZE_COUNT, "越界关卡号钳到最大");
  assert.equal(out.last.setpiece, SETPIECE_IDS[0], "未知残局回落第一张");
  assert.equal(out.campaign.unlocked, 1);
  assert.equal(out.campaign.levels[1].stars, 3, "星级上限 3");
  assert.equal(out.campaign.levels[1].best, 0, "脏分数按 0");
  assert.equal(out.campaign.levels[1].timeMs, 0, "负时间按 0");
  assert.equal(out.campaign.levels[1].cleared, true, "星级 >0 即视为通关过");
  assert.equal(out.campaign.levels[99], undefined, "越界关卡号不该进档");
  assert.equal(out.arcade.best.score, 0);
  assert.equal(out.arcade.best.dots === 9999999, true, "超限分数钳到 SCORE_MAX");
  assert.equal(out.setpieces.sp_clear_1.cleared, false, '字符串 "true" 不算通关');
  assert.equal(out.setpieces.sp_clear_1.best, 6, "小数分数四舍五入");
  assert.equal(out.setpieces.sp_bad, undefined, "未知残局 id 不该进档");
  assert.equal(out.records.highScore, 0);
  assert.equal(out.records.bestChain, 99, "连吞上限 99");
  assert.equal(out.records.runs, 0);
});

test("load / save / clear：读不到、读坏了都能开局", () => {
  return withStorage(() => {
    assert.deepEqual(load(), defaults(), "空档返回默认值");

    store.set(KEY, "{ 这不是 JSON");
    assert.deepEqual(load(), defaults(), "坏 JSON 静默回落默认档");

    const saved = save(defaults());
    assert.deepEqual(load(), saved, "存进去再读出来应完全一致");

    broken = true;
    const after = save(defaults());
    assert.equal(after.v, VERSION, "写不进去也要把归一化后的档还回来（内存降级）");
    broken = false;

    save({ ...defaults(), muted: true });
    assert.deepEqual(clear(), defaults(), "clear 抹掉磁盘并返回默认档");
    assert.equal(store.has(KEY), false);

    delete globalThis.localStorage;
    assert.deepEqual(load(), defaults(), "根本没有 localStorage 时也不抛错");
    assert.equal(save(defaults()).v, VERSION);
  });
});

test("战役记录：星级与分数只涨不跌，通关用时取最快的一档", () => {
  return withStorage(() => {
    let data = defaults();
    ({ data } = recordLevel(data, 1, { stars: 2, score: 5000, timeMs: 80000, cleared: true, noDeath: true }));
    assert.equal(levelRecord(data, 1).stars, 2);
    assert.equal(levelRecord(data, 1).best, 5000);
    assert.equal(levelRecord(data, 1).cleared, true);
    assert.equal(data.campaign.unlocked, 2, "通关第 1 张解锁第 2 张");

    ({ data } = recordLevel(data, 1, { stars: 1, score: 3000, timeMs: 60000, cleared: true }));
    assert.equal(levelRecord(data, 1).stars, 2, "更差的成绩不许覆盖星级");
    assert.equal(levelRecord(data, 1).best, 5000, "更差的分数不许覆盖最高分");
    assert.equal(levelRecord(data, 1).timeMs, 60000, "更快的用时要覆盖");
    assert.equal(levelRecord(data, 1).noDeath, true, "零死亡一旦拿到就不撤销");

    ({ data } = recordLevel(data, 1, { stars: 3, score: 9000, timeMs: 90000, cleared: true }));
    assert.equal(levelRecord(data, 1).stars, 3, "更好的成绩要覆盖");
    assert.equal(levelRecord(data, 1).timeMs, 60000, "更慢的用时不许覆盖");

    const res = recordLevel(data, 99, { stars: 3, score: 1 });
    assert.equal(res.improved, false, "越界关卡号直接忽略");
    assert.equal(levelRecord(res.data, 99).stars, 0);
  });
});

test("解锁链：第 1 张恒开，之后逐张解锁，越界恒关", () => {
  return withStorage(() => {
    let data = defaults();
    assert.equal(isLevelUnlocked(data, 1), true);
    assert.equal(isLevelUnlocked(data, 2), false);
    assert.equal(isLevelUnlocked(data, 0), false, "0 号关不存在");
    assert.equal(isLevelUnlocked(data, 99), false);
    assert.equal(highestUnlocked(data), 1);

    ({ data } = recordLevel(data, 1, { stars: 1, score: 100, cleared: true }));
    assert.equal(isLevelUnlocked(data, 2), true);
    assert.equal(highestUnlocked(data), 2);
    assert.equal(isLevelUnlocked(data, 3), false, "不能跳关");
  });
});

test("星级汇总与战役通关判定", () => {
  return withStorage(() => {
    let data = defaults();
    assert.equal(totalStars(data), 0);
    assert.equal(campaignCleared(data), false);

    ({ data } = recordLevel(data, 1, { stars: 3, score: 100, cleared: true }));
    ({ data } = recordLevel(data, 2, { stars: 2, score: 100, cleared: true }));
    assert.equal(totalStars(data), 5);
    assert.equal(campaignCleared(data), false);

    for (let id = 3; id <= MAZE_COUNT; id += 1) {
      ({ data } = recordLevel(data, id, { stars: 1, score: 100, cleared: true }));
    }
    assert.equal(campaignCleared(data), true, "通关最后一张即战役通关");
    assert.equal(data.campaign.unlocked, MAZE_COUNT, "解锁数封顶在最后一张");
  });
});

test("街机无尽：四项最佳各自取最大", () => {
  return withStorage(() => {
    let data = defaults();
    data = recordArcade(data, { score: 12000, level: 5, dots: 300, ghosts: 12 });
    assert.deepEqual(arcadeBest(data), { score: 12000, level: 5, dots: 300, ghosts: 12 });

    data = recordArcade(data, { score: 8000, level: 9, dots: 120, ghosts: 3 });
    assert.deepEqual(arcadeBest(data), { score: 12000, level: 9, dots: 300, ghosts: 12 }, "只涨不跌");
    assert.equal(data.records.highScore, 12000, "街机分也进总最高分");
  });
});

test("残局：十张各自记账，尝试次数累加，未知 id 不改档", () => {
  return withStorage(() => {
    let data = defaults();
    assert.deepEqual(setpieceRecord(data, "sp_clear_1"), { cleared: false, best: 0, timeMs: 0, tries: 0 });

    ({ data } = recordSetpiece(data, "sp_clear_1", { cleared: false, score: 400, timeMs: 30000 }));
    assert.equal(setpieceRecord(data, "sp_clear_1").tries, 1, "失败也算一次尝试");
    assert.equal(setpieceRecord(data, "sp_clear_1").cleared, false);
    assert.equal(setpieceRecord(data, "sp_clear_1").timeMs, 0, "没通关不记用时");

    ({ data } = recordSetpiece(data, "sp_clear_1", { cleared: true, score: 900, timeMs: 25000 }));
    assert.equal(setpieceRecord(data, "sp_clear_1").cleared, true);
    assert.equal(setpieceRecord(data, "sp_clear_1").best, 900);
    assert.equal(setpieceRecord(data, "sp_clear_1").timeMs, 25000);
    assert.equal(setpieceRecord(data, "sp_clear_1").tries, 2);

    ({ data } = recordSetpiece(data, "sp_clear_1", { cleared: true, score: 700, timeMs: 31000 }));
    assert.equal(setpieceRecord(data, "sp_clear_1").best, 900, "低分不覆盖");
    assert.equal(setpieceRecord(data, "sp_clear_1").timeMs, 25000, "慢成绩不覆盖");

    const bad = recordSetpiece(data, "sp_nope", { cleared: true, score: 999 });
    assert.equal(bad.improved, false);
    assert.equal(setpiecesCleared(bad.data), 1, "只有真实 id 被记账");
  });
});

test("通用记录：连吞取最大、吞灯累加、局数累加", () => {
  return withStorage(() => {
    let data = defaults();
    data = recordRunStats(data, { chain: 3, ghostsEaten: 8 });
    data = recordRunStats(data, { chain: 1, ghostsEaten: 4 });
    assert.equal(data.records.bestChain, 3);
    assert.equal(data.records.ghostsEaten, 12);
    assert.equal(data.records.runs, 2);
  });
});

test("偏好：静音、AI 可读化、上次位置都能落盘", () => {
  return withStorage(() => {
    let data = defaults();
    data = setMuted(data, true);
    assert.equal(data.muted, true);
    assert.equal(setMuted(data, "yes").muted, false, "非 true 一律按关");

    data = setAssist(data, { aiRead: false });
    assert.equal(data.assist.aiRead, false, "硬核模式可关");
    assert.equal(setAssist(data, {}).assist.aiRead, false, "不传就保持原值");

    data = setLast(data, { mode: "setpiece", setpiece: "sp_chain_2" });
    assert.equal(data.last.mode, "setpiece");
    assert.equal(data.last.setpiece, "sp_chain_2");
    assert.equal(setLast(data, { mode: "bogus" }).last.mode, "setpiece", "未知模式不改");
    assert.equal(setLast(data, { level: 0 }).last.level, 1, "越界关卡号钳回");
    assert.equal(setLast(data, { setpiece: "sp_nope" }).last.setpiece, "sp_chain_2");
  });
});

test("速度档能落盘，脏值一律回落标准档", () => {
  return withStorage(() => {
    assert.ok(SPEED_TIER_IDS.length >= 3, "至少三档可选才有意义");
    assert.equal(defaults().prefs.speedTier, DEFAULT_TIER, "新档默认标准");

    let data = defaults();
    data = setSpeedTier(data, "surge");
    assert.equal(data.prefs.speedTier, "surge");
    assert.equal(load().prefs.speedTier, "surge", "换档必须真的写进本机");

    // 存档来自用户磁盘，字段可能是任何东西；读回来必须还是合法档
    for (const bad of ["turbo", "", null, undefined, 0, 1, NaN, {}, []]) {
      const fixed = normalize({ prefs: { speedTier: bad } });
      assert.equal(fixed.prefs.speedTier, DEFAULT_TIER, `脏值 ${String(bad)} 必须回落 ${DEFAULT_TIER}`);
    }
    assert.equal(normalize({}).prefs.speedTier, DEFAULT_TIER, "老存档没有这个字段也要补上默认值");
    assert.equal(normalize({ prefs: "坏掉了" }).prefs.speedTier, DEFAULT_TIER);
  });
});

test("save 出口再脏也不炸：非对象快照会被 normalize 救回来", () => {
  return withStorage(() => {
    const saved = save({ muted: true, campaign: "坏掉了", records: [] });
    assert.equal(saved.muted, true);
    assert.deepEqual(saved.campaign.levels, {});
    assert.equal(saved.records.highScore, 0);
    assert.deepEqual(load(), saved, "落盘的就是归一化后的档");
  });
});
