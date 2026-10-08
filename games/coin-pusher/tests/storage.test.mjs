// storage.test.mjs — 存档唯一口径：默认值 / 归一化 / 初始币白名单 / 降级
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { STORAGE_KEY, defaultSave, normalize, loadSave, saveSave, clearSave } from "../js/storage.mjs";
import { DEFAULT_CREDITS, CREDIT_OPTIONS } from "../js/engine.mjs";

// storage.mjs 只在首次使用时探测一次后端并缓存，因此这里在模块顶层装好内存版 localStorage，
// 之后每个用例只清空内容，保证所有断言都打在同一个后端上。
const map = new Map();
globalThis.localStorage = {
  getItem: (k) => (map.has(k) ? map.get(k) : null),
  setItem: (k, v) => map.set(k, String(v)),
  removeItem: (k) => map.delete(k)
};
const reset = () => map.clear();

describe("storage: 默认存档", () => {
  it("键名固定为 doin.coin-pusher.v1", () => {
    assert.equal(STORAGE_KEY, "doin.coin-pusher.v1");
  });

  it("默认值：音效开、纪录全 0、上次初始币数为默认档", () => {
    const d = defaultSave();
    assert.equal(d.sound, true);
    assert.equal(d.bestScore, 0);
    assert.equal(d.bestCascade, 0);
    assert.equal(d.bestDrops, 0);
    assert.equal(d.runs, 0);
    assert.equal(d.lastCredits, DEFAULT_CREDITS);
    // 无尽机台没有关卡进度 / 星级
    assert.equal("stars" in d, false);
    assert.equal("level" in d, false);
    assert.equal("cleared" in d, false);
  });
});

describe("storage: 归一化", () => {
  it("非对象输入一律回默认", () => {
    for (const bad of [null, undefined, 0, "", "x", [], NaN]) {
      assert.deepEqual(normalize(bad), defaultSave());
    }
  });

  it("损坏字段被逐项兜底", () => {
    const out = normalize({ sound: "yes", bestScore: -5, bestCascade: "abc", bestDrops: 3.9, runs: Infinity });
    assert.equal(out.sound, true, "非布尔 sound 应回默认");
    assert.equal(out.bestScore, 0, "负数应回 0");
    assert.equal(out.bestCascade, 0, "非数字应回 0");
    assert.equal(out.bestDrops, 3, "小数应取整");
    assert.equal(out.runs, 0, "Infinity 应回 0");
  });

  it("合法字段被保留", () => {
    const out = normalize({ sound: false, bestScore: 123456, bestCascade: 19, bestDrops: 321, runs: 7, lastCredits: 100 });
    assert.equal(out.sound, false);
    assert.equal(out.bestScore, 123456);
    assert.equal(out.bestCascade, 19);
    assert.equal(out.bestDrops, 321);
    assert.equal(out.runs, 7);
    assert.equal(out.lastCredits, 100);
  });

  it("初始币数只接受白名单档位，手改存档塞别的值一律回落", () => {
    for (const value of CREDIT_OPTIONS) {
      assert.equal(normalize({ lastCredits: value }).lastCredits, value);
    }
    for (const bad of [0, 1, 21, 999, 1000000, -50, "50", null, NaN]) {
      assert.equal(normalize({ lastCredits: bad }).lastCredits, DEFAULT_CREDITS, `非法档位 ${bad} 未被拦下`);
    }
  });

  it("归一化是幂等的", () => {
    const once = normalize({ sound: false, bestScore: 42, lastCredits: 20 });
    assert.deepEqual(normalize(once), once);
  });
});

describe("storage: 读写", () => {
  it("saveSave → loadSave 往返一致", () => {
    reset();
    const save = { sound: false, bestScore: 999, bestCascade: 12, bestDrops: 88, runs: 3, lastCredits: 20 };
    assert.equal(saveSave(save), true);
    assert.deepEqual(loadSave(), normalize(save));
  });

  it("saveSave 返回布尔（不是存档对象）——事故防线", () => {
    reset();
    const ret = saveSave(defaultSave());
    assert.equal(typeof ret, "boolean", "saveSave 必须返回布尔；返回对象会让 `save = saveSave(save)` 静默变成 true");
  });

  it("clearSave 后回到默认存档", () => {
    reset();
    saveSave({ ...defaultSave(), bestScore: 500 });
    assert.equal(clearSave(), true);
    assert.deepEqual(loadSave(), defaultSave());
  });

  it("存档内容损坏（非 JSON / 半截 JSON / 标量）时静默回默认，不抛错", () => {
    for (const junk of ["{oops", '"just a string"', "null", "[]", "123"]) {
      reset();
      localStorage.setItem(STORAGE_KEY, junk);
      assert.deepEqual(loadSave(), defaultSave(), `损坏内容 ${junk} 未被兜底`);
    }
  });

  it("只读写自己那把 key，不碰别的键", () => {
    reset();
    localStorage.setItem("doin.lang", "en");
    saveSave({ ...defaultSave(), bestScore: 7 });
    assert.equal(map.get("doin.lang"), "en", "不得覆盖全站共享的语言偏好");
    assert.ok(map.has(STORAGE_KEY));
  });
});

describe("storage: 存储不可用时的降级", () => {
  it("localStorage 抛错（隐私模式）时降级内存，功能仍可用", async () => {
    const prev = globalThis.localStorage;
    globalThis.localStorage = {
      getItem() { throw new Error("denied"); },
      setItem() { throw new Error("denied"); },
      removeItem() { throw new Error("denied"); }
    };
    try {
      // 换一个模块实例，让 storage() 重新探测后端（后端只在首次使用时缓存一次）
      const mod = await import("../js/storage.mjs?fallback=1");
      assert.doesNotThrow(() => mod.loadSave());
      assert.deepEqual(mod.loadSave(), mod.defaultSave());
      assert.equal(mod.saveSave({ ...mod.defaultSave(), bestScore: 5 }), true, "降级后仍应写入内存");
      assert.equal(mod.loadSave().bestScore, 5);
      assert.doesNotThrow(() => mod.clearSave());
      assert.equal(mod.loadSave().bestScore, 0);
    } finally {
      globalThis.localStorage = prev;
    }
  });
});
