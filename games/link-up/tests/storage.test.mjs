import test from "node:test";
import assert from "node:assert/strict";

// 在首次调用前注入可控 localStorage stub（node 默认无 localStorage）
const mem = new Map();
let mode = "ok"; // ok | throw
globalThis.localStorage = {
  getItem(k) {
    if (mode === "throw") throw new Error("denied");
    return mem.has(k) ? mem.get(k) : null;
  },
  setItem(k, v) {
    if (mode === "throw") throw new Error("denied");
    mem.set(k, String(v));
  },
  removeItem(k) {
    if (mode === "throw") throw new Error("denied");
    mem.delete(k);
  },
};

const { load, save, recordResult, setSound } = await import("../js/storage.mjs");

test("存档 Key 为 doin.link-up.v1", () => {
  save({ unlocked: 3 });
  assert.ok(mem.has("doin.link-up.v1"));
});

test("空存档 → 默认值", () => {
  mem.clear();
  const d = load();
  assert.equal(d.unlocked, 1);
  assert.deepEqual(d.best, {});
  assert.equal(d.daily, null);
  assert.equal(d.sound, true);
});

test("坏 JSON → 回退默认", () => {
  mem.set("doin.link-up.v1", "{bad json!!");
  const d = load();
  assert.equal(d.unlocked, 1);
  assert.equal(d.sound, true);
});

test("缺失字段 / 错误类型 / 越界数值 → normalize 修正", () => {
  mem.set(
    "doin.link-up.v1",
    JSON.stringify({
      unlocked: "9", // 错误类型
      sound: 1, // 错误类型
      best: [1, 2, 3], // 错误类型（应为对象）
      daily: { date: "short", score: "x", steps: -3, elapsedMs: Infinity },
    })
  );
  const d = load();
  assert.equal(d.unlocked, 1);
  assert.equal(d.sound, true);
  assert.deepEqual(d.best, {});
  assert.equal(d.daily, null);
});

test("数值钳制：负数/NaN/Infinity/越界均被钳到合法区间", () => {
  mem.set(
    "doin.link-up.v1",
    JSON.stringify({
      unlocked: 999,
      sound: false,
      best: { 1: 9999, 2: -5, 3: NaN, 4: Infinity },
      daily: { date: "2026-09-13", score: -100, steps: Infinity, elapsedMs: NaN },
    })
  );
  const d = load();
  assert.equal(d.unlocked, 50);
  assert.equal(d.sound, false);
  assert.equal(d.best["1"], 800);
  assert.equal(d.best["2"], 0);
  assert.equal(d.best["3"], 0);
  assert.equal(d.best["4"], 0);
  assert.equal(d.daily.date, "2026-09-13");
  assert.equal(d.daily.score, 0);
  assert.equal(d.daily.steps, 0);
  assert.equal(d.daily.elapsedMs, 0);
});

test("save → load 往返一致且 key 落盘", () => {
  save({ unlocked: 5, best: { 3: 620 }, daily: { date: "2026-09-12", score: 700, steps: 22, elapsedMs: 90000 }, sound: false });
  const d = load();
  assert.equal(d.unlocked, 5);
  assert.equal(d.best["3"], 620);
  assert.equal(d.daily.score, 700);
  assert.equal(d.sound, false);
  assert.ok(mem.get("doin.link-up.v1").includes('"unlocked":5'));
});

test("recordResult：普通关新高分 → 更新 best 并解锁下一关", () => {
  let data = { unlocked: 1, best: {}, daily: null, sound: true };
  const r1 = recordResult(data, { kind: "level", levelIndex: 1, score: 500, steps: 10, elapsedMs: 1000 });
  assert.equal(r1.isNewBest, true);
  assert.equal(r1.data.best["1"], 500);
  assert.equal(r1.data.unlocked, 2);
  // 同关更高分：再解锁不应越过（unlocked 已 > levelIndex）
  const r2 = recordResult(r1.data, { kind: "level", levelIndex: 1, score: 700, steps: 8, elapsedMs: 900 });
  assert.equal(r2.isNewBest, true);
  assert.equal(r2.data.best["1"], 700);
  assert.equal(r2.data.unlocked, 2);
  // 低分不降级
  const r3 = recordResult(r2.data, { kind: "level", levelIndex: 1, score: 100, steps: 30, elapsedMs: 2000 });
  assert.equal(r3.isNewBest, false);
  assert.equal(r3.data.best["1"], 700);
});

test("recordResult：第 50 关不再解锁", () => {
  let data = { unlocked: 50, best: {} };
  const r = recordResult(data, { kind: "level", levelIndex: 50, score: 800, steps: 5, elapsedMs: 500 });
  assert.equal(r.data.unlocked, 50);
});

test("recordResult：每日挑战同日同分更少步数覆盖", () => {
  let data = { unlocked: 1, best: {}, daily: null };
  const r1 = recordResult(data, { kind: "daily", date: "2026-09-13", score: 600, steps: 40, elapsedMs: 150000 });
  assert.equal(r1.isNewBest, false); // 首次记录无旧值对比
  assert.equal(r1.data.daily.date, "2026-09-13");
  // 更差分数不覆盖
  const r2 = recordResult(r1.data, { kind: "daily", date: "2026-09-13", score: 500, steps: 30, elapsedMs: 100000 });
  assert.equal(r2.data.daily.score, 600);
  // 同分更少步数覆盖
  const r3 = recordResult(r2.data, { kind: "daily", date: "2026-09-13", score: 600, steps: 35, elapsedMs: 120000 });
  assert.equal(r3.data.daily.steps, 35);
  assert.equal(r3.isNewBest, false);
  // 更高分覆盖且 isNewBest
  const r4 = recordResult(r3.data, { kind: "daily", date: "2026-09-13", score: 750, steps: 40, elapsedMs: 140000 });
  assert.equal(r4.data.daily.score, 750);
  assert.equal(r4.isNewBest, true);
});

test("localStorage 被禁（抛错）→ 静默降级不白屏", () => {
  mode = "throw";
  const d = load();
  assert.ok(d);
  assert.equal(typeof d.unlocked, "number");
  const saved = save({ unlocked: 8 });
  assert.equal(saved.unlocked, 8);
  mode = "ok";
});

test("setSound 持久化开关", () => {
  setSound(false);
  assert.equal(load().sound, false);
  setSound(true);
  assert.equal(load().sound, true);
});
