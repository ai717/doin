// storage.test.mjs: 存档稳健性 —— 归一化、只增不减、解锁规则、localStorage 不可用时静默降级

import test from "node:test";
import assert from "node:assert/strict";

import * as storage from "../js/storage.mjs";
import { LEVEL_MAX, BOX_UNLOCK_STARS } from "../js/score.mjs";

function withMemoryStore(fn) {
  const map = new Map();
  const impl = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  const had = "localStorage" in globalThis;
  const prev = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { value: impl, configurable: true, writable: true });
  try {
    return fn(impl, map);
  } finally {
    if (had) Object.defineProperty(globalThis, "localStorage", { value: prev, configurable: true, writable: true });
    else delete globalThis.localStorage;
  }
}

test("defaults 结构正确", () => {
  const d = storage.defaults();
  assert.equal(d.v, 1);
  assert.deepEqual(d.levels, {});
  assert.equal(d.muted, false);
  assert.equal(d.last, 1);
});

test("normalize：垃圾输入一律退回合法形状，绝不抛错", () => {
  for (const junk of [null, undefined, 0, "x", [], { levels: "no" }, { levels: { 1: 7 } }, { last: 999 }]) {
    const out = storage.normalize(junk);
    assert.equal(out.v, 1);
    assert.equal(typeof out.levels, "object");
    assert.ok(out.last >= 1 && out.last <= 40, `last 越界：${out.last}`);
    assert.equal(typeof out.muted, "boolean");
  }
});

test("normalize：越界数值被钳制，非法记录被丢弃", () => {
  const out = storage.normalize({
    levels: {
      1: { stars: 99, score: 1e9, cleared: "yes" },
      2: { stars: -5, score: -10 },
      999: { stars: 3 },
      abc: { stars: 3 },
    },
    last: 999,
    muted: "true",
  });
  assert.equal(out.levels[1].stars, 3);
  assert.equal(out.levels[1].score, LEVEL_MAX);
  assert.equal(out.levels[1].cleared, true);
  assert.equal(out.levels[2].stars, 0);
  assert.equal(out.levels[2].score, 0);
  assert.equal(out.levels[999], undefined);
  assert.equal(out.levels.abc, undefined);
  assert.equal(out.last, 40);
  assert.equal(out.muted, false, "非严格 true 一律视为 false");
});

test("save / load 往返一致", () => {
  withMemoryStore(() => {
    const data = { ...storage.defaults(), levels: { 1: { stars: 2, cleared: true, score: 400, best: 400 } } };
    storage.save(data);
    const back = storage.load();
    assert.equal(back.levels[1].stars, 2);
    assert.equal(back.levels[1].score, 400);
  });
});

test("load：存储内容损坏时静默退回默认，绝不抛错", () => {
  withMemoryStore((impl) => {
    impl.setItem(storage.KEY, "{ 这不是 JSON");
    const d = storage.load();
    assert.deepEqual(d, storage.defaults());
  });
});

test("无 localStorage 环境下降级：save/load 不抛错", () => {
  const data = storage.save({ ...storage.defaults(), muted: true });
  assert.equal(data.muted, true);
  const back = storage.load();
  assert.equal(back.muted, false, "内存降级时不保留写入（不谎称持久）");
  assert.equal(storage.clear().muted, false);
});

test("recordResult：星级与得分只增不减", () => {
  withMemoryStore(() => {
    let data = storage.defaults();
    let r = storage.recordResult(data, 1, { stars: 2, won: true });
    data = r.data;
    assert.equal(r.improved, true);
    assert.equal(data.levels[1].stars, 2);
    assert.equal(data.levels[1].score, 400);
    assert.equal(data.levels[1].cleared, true);
    assert.equal(data.last, 2, "通关后应把进度推到下一关");

    r = storage.recordResult(data, 1, { stars: 1, won: true });
    data = r.data;
    assert.equal(r.improved, false);
    assert.equal(data.levels[1].stars, 2, "低星不得覆盖高星");
    assert.equal(data.levels[1].score, 400);

    r = storage.recordResult(data, 1, { stars: 3, won: true });
    data = r.data;
    assert.equal(data.levels[1].stars, 3);
    assert.equal(data.levels[1].score, LEVEL_MAX);
    assert.equal(data.levels[1].best, LEVEL_MAX);
  });
});

test("recordResult：失败也记录收星，但不解锁下一关", () => {
  withMemoryStore(() => {
    let data = storage.defaults();
    const r = storage.recordResult(data, 3, { stars: 2, won: false });
    data = r.data;
    assert.equal(data.levels[3].stars, 2);
    assert.equal(data.levels[3].score, 0, "未进嘴不得记分");
    assert.equal(data.levels[3].cleared, false);
    assert.equal(data.last, 3);
  });
});

test("recordResult：非法关卡 id 不改变存档", () => {
  const data = storage.defaults();
  const r = storage.recordResult(data, 999, { stars: 3, won: true });
  assert.equal(r.improved, false);
  assert.deepEqual(r.data, data);
});

test("解锁：盒 1 恒开，盒 2+ 需上一盒 12 星", () => {
  const data = storage.defaults();
  assert.equal(storage.isBoxUnlocked(data, 1), true);
  assert.equal(storage.isBoxUnlocked(data, 2), false);

  // 盒 1 只有 8 关：每关 2 星 = 16 星 ≥ 12 才解锁盒 2
  const levels = {};
  for (let i = 1; i <= 8; i += 1) levels[i] = { stars: 2, cleared: true, score: 400, best: 400 };
  const unlocked = { ...data, levels };
  assert.equal(storage.isBoxUnlocked(unlocked, 2), true);
  assert.equal(storage.isBoxUnlocked(unlocked, 3), false);

  // 恰好 12 星的边界也要放行
  const edge = { ...data, levels: {} };
  for (let i = 1; i <= 8; i += 1) edge.levels[i] = { stars: i <= 4 ? 3 : 0, cleared: i <= 4, score: 0, best: 0 };
  assert.equal(storage.isBoxUnlocked(edge, 2), true);
  edge.levels[4] = { stars: 2, cleared: true, score: 0, best: 0 };
  assert.equal(BOX_UNLOCK_STARS, 12);
  assert.equal(storage.isBoxUnlocked(edge, 2), false, "11 星不该解锁");
});

test("解锁：关卡需前一关已通关（第 1 关除外）", () => {
  const data = storage.defaults();
  assert.equal(storage.isLevelUnlocked(data, 1), true);
  assert.equal(storage.isLevelUnlocked(data, 2), false);
  const cleared = { ...data, levels: { 1: { stars: 1, cleared: true, score: 300, best: 300 } } };
  assert.equal(storage.isLevelUnlocked(cleared, 2), true);
  assert.equal(storage.isLevelUnlocked(cleared, 3), false);
  assert.equal(storage.highestUnlocked(cleared), 2);
});

test("setMuted / setLast 立即持久化", () => {
  withMemoryStore(() => {
    let data = storage.defaults();
    data = storage.setMuted(data, true);
    assert.equal(data.muted, true);
    assert.equal(storage.load().muted, true);
    data = storage.setLast(data, 7);
    assert.equal(data.last, 7);
    assert.equal(storage.load().last, 7);
    data = storage.setLast(data, 999);
    assert.equal(data.last, 40, "越界 last 被钳制");
  });
});

test("clear 后回到默认", () => {
  withMemoryStore(() => {
    storage.save({ ...storage.defaults(), levels: { 1: { stars: 3, cleared: true, score: 500, best: 500 } } });
    storage.clear();
    assert.deepEqual(storage.load(), storage.defaults());
  });
});
