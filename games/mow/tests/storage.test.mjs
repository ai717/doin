// storage.test.mjs — 存档唯一口径：归一化、静默降级、最佳/图鉴/统计/解锁。
import { test } from "node:test";
import assert from "node:assert/strict";
import * as storage from "../js/storage.mjs";

const CODEX_KEYS = ["weapons", "passives", "evolutions"];

test("默认存档结构与显式归一化", () => {
  storage.resetBackendForTests();
  const def = storage.load();
  assert.equal(def.prefs.muted, false);
  assert.deepEqual(def.best, { standard: null, endless: null });
  assert.deepEqual(def.unlocked, ["mower", "sprinkler", "ladybug"]);
  assert.equal(def.stats.runs, 0);
  for (const k of CODEX_KEYS) assert.deepEqual(def.codex[k], []);
  // 脏数据归一化
  const dirty = storage.normalize({ lang: "en", prefs: { muted: "yes" }, best: { standard: { score: "x" } }, stats: null, codex: { weapons: [1, null, "blade-ring", "blade-ring"] }, unlocked: "rabbit", unknown: true });
  assert.equal(dirty.prefs.muted, false, "非法布尔回退");
  assert.equal(dirty.best.standard, null, "坏记录丢弃");
  assert.equal(typeof dirty.stats.runs, "number");
  assert.deepEqual(dirty.codex.weapons, ["blade-ring"], "非法图鉴项过滤且去重");
  assert.deepEqual(dirty.unlocked, ["mower"], "非法解锁重置，仅保证初始机台");
  assert.ok(!("unknown" in dirty));
});

test("读写回环与坏 JSON 静默降级", () => {
  storage.resetBackendForTests();
  let save = storage.load();
  save.prefs.muted = true;
  save.stats.runs = 7;
  save = storage.save(save);
  const reloaded = storage.load();
  assert.equal(reloaded.prefs.muted, true);
  assert.equal(reloaded.stats.runs, 7);
  // 坏 JSON：注入会返回乱码的 localStorage shim 后重新探测
  storage.resetBackendForTests();
  globalThis.localStorage = {
    _map: new Map(),
    setItem(k, v) {
      this._map.set(k, String(v));
    },
    getItem(k) {
      return k === storage.STORAGE_KEY ? "not-json{{" : this._map.get(k) ?? null;
    },
    removeItem(k) {
      this._map.delete(k);
    },
  };
  const after = storage.load();
  assert.equal(after.stats.runs, 0, "损坏自动 normalize 回默认，不抛错");
  delete globalThis.localStorage;
  storage.resetBackendForTests();
});

test("applyResult：最佳/图鉴/统计/解锁四路归档", () => {
  storage.resetBackendForTests();
  const save = storage.load();
  const res = {
    won: true,
    mode: "standard",
    character: "ladybug",
    score: 6666,
    stars: 3,
    kills: 800,
    maxCombo: 50,
    burstCount: 9,
    time: 500,
    bossKilled: true,
    codex: { weapons: ["blade-ring", "sunbeam"], passives: ["sprout"], evolutions: ["gold-disk"] },
  };
  const applied = storage.applyResult(save, res);
  let s = applied.state;
  assert.equal(applied.improved, true);
  assert.equal(applied.newUnlock, true);
  assert.equal(s.best.standard.score, 6666);
  assert.equal(s.best.standard.won, true);
  assert.deepEqual(s.codex.weapons, ["blade-ring", "sunbeam"]);
  assert.deepEqual(s.codex.passives, ["sprout"]);
  assert.deepEqual(s.codex.evolutions, ["gold-disk"]);
  assert.equal(s.stats.runs, 1);
  assert.equal(s.stats.totalKills, 800);
  assert.ok(s.unlocked.includes("rabbit"), "通关解锁兔子");
  // 二次归档：低分不覆盖、图鉴只扩池
  const res2 = { ...res, won: true, score: 1000, kills: 50, codex: { weapons: ["blade-ring"], passives: [], evolutions: [] } };
  s = storage.applyResult(s, res2).state;
  assert.equal(s.best.standard.score, 6666, "低分不覆盖最佳");
  assert.deepEqual(s.codex.weapons, ["blade-ring", "sunbeam"], "图鉴只扩池不重复");
  assert.equal(s.stats.runs, 2);
  // 无尽最佳独立
  const resE = { ...res, mode: "endless", won: false, time: 800, score: 3000 };
  s = storage.applyResult(s, resE).state;
  assert.equal(s.best.endless.time, 800);
  assert.equal(s.best.standard.score, 6666);
  // 失败不触发兔子解锁
  storage.resetBackendForTests();
  const fresh = storage.load();
  const afterLose = storage.applyResult(fresh, { ...res, won: false, score: 0 }).state;
  assert.ok(!afterLose.unlocked.includes("rabbit"), "未通关不解锁");
});

test("setMuted 只改静音偏好", () => {
  storage.resetBackendForTests();
  let save = storage.load();
  save = storage.setMuted(save, true);
  assert.equal(save.prefs.muted, true);
  assert.equal(save.stats.runs, 0, "不影响其他字段");
});
