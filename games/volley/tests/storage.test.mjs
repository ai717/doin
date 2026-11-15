// Volley storage tests: preference whitelist, match stats, persistence fallback.

import test from "node:test";
import assert from "node:assert/strict";

test("loadSave：无 localStorage 时返回完整默认存档（内存降级）", async () => {
  const mod = await import(`../js/storage.mjs?t=${Date.now()}`);
  const save = mod.loadSave();
  assert.equal(save.mode, "2p");
  assert.equal(save.aiLevel, "veteran");
  assert.equal(save.terrain, "hill");
  assert.equal(save.sound, true);
  assert.equal(save.matches, 0);
});

test("normalize：损坏数据整体回退默认、字段逐项白名单校验", async () => {
  const { normalize } = await import(`../js/storage.mjs?t=${Date.now()}`);
  assert.equal(normalize(null).mode, "2p");
  assert.equal(normalize("garbage").mode, "2p");
  assert.equal(normalize({ mode: "hack", aiLevel: "god", terrain: "lava" }).mode, "2p");
  assert.equal(normalize({ aiLevel: "god" }).aiLevel, "veteran");
  assert.equal(normalize({ terrain: "lava" }).terrain, "hill");
  assert.equal(normalize({ sound: "yes" }).sound, true);
  const n = normalize({ matches: "many", p1Wins: -3, bestSingle: 1e9 });
  assert.equal(n.matches, 0);
  assert.equal(n.p1Wins, 0);
  assert.ok(n.bestSingle >= 0);
});

test("setPreferences：仅接受白名单键，非法值拒绝", async () => {
  const mod = await import(`../js/storage.mjs?t=${Date.now()}`);
  const before = mod.loadSave();
  mod.setPreferences({ sound: false });
  assert.equal(mod.loadSave().sound, false);
  mod.setPreferences({ mode: "ai", aiLevel: "master", terrain: "twin" });
  const after = mod.loadSave();
  assert.equal(after.mode, "ai");
  assert.equal(after.aiLevel, "master");
  assert.equal(after.terrain, "twin");
  mod.setPreferences({ mode: "hack", sound: true });
  assert.equal(mod.loadSave().mode, "ai", "非法 mode 拒绝");
  assert.equal(mod.loadSave().sound, true);
  // restore
  mod.setPreferences({ sound: before.sound, mode: before.mode, aiLevel: before.aiLevel, terrain: before.terrain });
});

test("recordMatch：累计场次、胜负、最佳命中率与单发伤害", async () => {
  const mod = await import(`../js/storage.mjs?t=${Date.now()}`);
  const before = mod.loadSave();
  mod.recordMatch(1, 66, 45);
  const s1 = mod.loadSave();
  assert.equal(s1.matches, before.matches + 1);
  assert.equal(s1.p1Wins, before.p1Wins + 1, "side1 = 玩家1胜");
  assert.equal(s1.lastWinner, 1);
  assert.equal(s1.bestHitRate, 66);
  assert.equal(s1.bestSingle, 45);
  mod.recordMatch(2, 90, 22);
  const s2 = mod.loadSave();
  assert.equal(s2.p2Wins, before.p2Wins + 1, "side2 = 玩家2胜");
  assert.equal(s2.bestHitRate, 90);
  mod.recordMatch("draw", 10, 3);
  assert.equal(mod.loadSave().bestHitRate, 90, "低值不刷新最佳");
  // restore
  mod.updateSave(() => ({ ...before }));
});

test("持久化往返：localStorage 正常时写入并可读回", async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
  const mod = await import(`../js/storage.mjs?t=${Date.now()}p`);
  mod.setPreferences({ mode: "ai", terrain: "peak" });
  const raw = store.get("doin.volley.v1");
  assert.ok(raw, "存档应写入 localStorage");
  const back = JSON.parse(raw);
  assert.equal(back.mode, "ai");
  assert.equal(back.terrain, "peak");
  delete globalThis.localStorage;
});

test("损坏 JSON：读取回退默认档不崩溃", async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: () => "{broken json",
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
  const mod = await import(`../js/storage.mjs?t=${Date.now()}q`);
  const save = mod.loadSave();
  assert.equal(save.mode, "2p");
  delete globalThis.localStorage;
});

test("get throwing localStorage：静默降级内存档", async () => {
  globalThis.localStorage = {
    get getItem() { throw new Error("denied"); },
  };
  const mod = await import(`../js/storage.mjs?t=${Date.now()}r`);
  const save = mod.loadSave();
  assert.equal(save.aiLevel, "veteran");
  delete globalThis.localStorage;
});

test("SAVE_KEY 契约：doin.volley.v1", async () => {
  const { SAVE_KEY } = await import(`../js/storage.mjs?t=${Date.now()}s`);
  assert.equal(SAVE_KEY, "doin.volley.v1");
});
