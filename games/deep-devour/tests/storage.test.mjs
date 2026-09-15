// 存档层：key 契约、脏数据归一化、localStorage 不可用时的静默降级。
// 铁律是「绝不白屏」——任何情况下 load() 都必须返回一份完整合法的 state。

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { LEVELS } from "../js/levels.mjs";
import {
  SCHEMA_VERSION,
  STORAGE_KEY,
  defaultState,
  load,
  normalize,
  recordAbyss,
  recordLevel,
  resetAll,
  resetBackendForTests,
  save,
  setLastLevel,
  setMuted,
} from "../js/storage.mjs";

const FIRST = LEVELS[0].id;
const SECOND = LEVELS[1].id;
const LAST = LEVELS[LEVELS.length - 1].id;
const BOGUS = "9-9";

function fakeStorage(overrides = {}) {
  const map = new Map();
  return {
    map,
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    ...overrides,
  };
}

// Node 默认没有 localStorage；某些版本会带上只读的 webstorage，
// 所以统一走 defineProperty 安装，测完再拆掉。
function installStorage(fake) {
  Object.defineProperty(globalThis, "localStorage", {
    value: fake,
    configurable: true,
    writable: true,
  });
  resetBackendForTests();
}

// 不用 delete：ESM 是严格模式，若宿主把 localStorage 定义成不可配置属性会直接抛错。
// 置成 undefined 效果一样（typeof 探测失败 → 内存兜底），且永远安全。
function removeStorage() {
  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  } catch (error) {
    // 宿主不允许覆盖就随它去：每个用例开头的 resetBackendForTests() 会重新探测。
  }
  resetBackendForTests();
}

beforeEach(() => {
  resetBackendForTests();
});

afterEach(() => {
  removeStorage();
});

describe("存储契约", () => {
  it("key 与版本号是写死的公开契约", () => {
    assert.equal(STORAGE_KEY, "doin.deep-devour.v1");
    assert.equal(SCHEMA_VERSION, 1);
  });

  it("默认存档是一份完整可用的空档", () => {
    const state = defaultState();
    assert.equal(state.version, 1);
    assert.deepEqual(state.prefs, { muted: false });
    assert.deepEqual(state.progress.stars, {});
    assert.equal(state.progress.lastLevel, FIRST, "默认停在第一关");
    assert.deepEqual(state.progress.abyss, { meters: 0, score: 0 });
  });

  it("两个 defaultProgress 实例互不共享引用", () => {
    const a = defaultState();
    a.progress.stars["1-1"] = 3;
    assert.deepEqual(defaultState().progress.stars, {});
  });
});

describe("normalize：脏数据一律静默修好", () => {
  it("非对象输入退回默认档", () => {
    for (const raw of [null, undefined, 0, 1, "oops", true, [], NaN]) {
      const state = normalize(raw);
      assert.equal(state.version, 1);
      assert.deepEqual(state.progress.stars, {});
      assert.equal(state.progress.lastLevel, FIRST);
    }
  });

  it("丢弃不存在的关卡 id，只保留合法珍珠数", () => {
    const state = normalize({
      progress: { stars: { [FIRST]: 3, [BOGUS]: 3, [SECOND]: 2.9, [LAST]: -1 } },
    });
    assert.deepEqual(state.progress.stars, { [FIRST]: 3, [SECOND]: 2 });
  });

  it("珍珠数超过 3 被钳回 3，0 颗的关卡不留痕", () => {
    const state = normalize({ progress: { stars: { [FIRST]: 99, [SECOND]: 0 } } });
    assert.deepEqual(state.progress.stars, { [FIRST]: 3 });
  });

  it("lastLevel 非法时退回第一关", () => {
    assert.equal(normalize({ progress: { lastLevel: BOGUS } }).progress.lastLevel, FIRST);
    assert.equal(normalize({ progress: { lastLevel: 42 } }).progress.lastLevel, FIRST);
    assert.equal(normalize({ progress: { lastLevel: SECOND } }).progress.lastLevel, SECOND);
  });

  it("深渊纪录与 mute 开关按类型兜底", () => {
    const state = normalize({ prefs: { muted: "true" }, progress: { abyss: { meters: "320.9", score: -7 } } });
    assert.equal(state.prefs.muted, true);
    assert.deepEqual(state.progress.abyss, { meters: 320, score: 0 });

    const junk = normalize({ prefs: { muted: "yes" }, progress: { abyss: { meters: {}, score: [] } } });
    assert.equal(junk.prefs.muted, false);
    assert.deepEqual(junk.progress.abyss, { meters: 0, score: 0 });
  });

  it("progress / prefs / stars 类型不对也不会抛", () => {
    assert.doesNotThrow(() => normalize({ progress: "nope", prefs: 5 }));
    const state = normalize({ progress: { stars: null, abyss: "x" } });
    assert.deepEqual(state.progress.stars, {});
    assert.deepEqual(state.progress.abyss, { meters: 0, score: 0 });
  });
});

describe("读写往返", () => {
  it("save 之后 load 能原样读回来", () => {
    installStorage(fakeStorage());
    let state = defaultState();
    state = recordLevel(state, { levelId: SECOND, pearls: 2 }).state;
    state = setMuted(state, true);
    state = recordAbyss(state, { meters: 240, score: 3300 }).state;
    save(state);

    const loaded = load();
    assert.equal(loaded.progress.stars[SECOND], 2);
    assert.equal(loaded.prefs.muted, true);
    assert.deepEqual(loaded.progress.abyss, { meters: 240, score: 3300 });
    assert.equal(loaded.progress.lastLevel, SECOND);
    removeStorage();
  });

  it("存档被手改成非法 JSON 时 load 退回默认档而不是抛错", () => {
    installStorage(fakeStorage());
    globalThis.localStorage.setItem(STORAGE_KEY, "{ 这不是 json");
    assert.doesNotThrow(() => load());
    assert.deepEqual(load().progress.stars, {});
    removeStorage();
  });

  it("localStorage 完全不可用时静默降级到内存，本局照样能玩", () => {
    const boom = {
      getItem() {
        throw new Error("SecurityError");
      },
      setItem() {
        throw new Error("SecurityError");
      },
      removeItem() {
        throw new Error("SecurityError");
      },
    };
    installStorage(boom);
    assert.doesNotThrow(() => load());
    assert.deepEqual(load().progress.stars, {}, "读失败退回默认档");
    assert.doesNotThrow(() => save(defaultState()), "写失败不许影响本局");
    assert.doesNotThrow(() => resetAll());
    removeStorage();
  });

  it("写入过程中被拒（配额满）也不会把异常抛给 UI", () => {
    const full = fakeStorage({
      setItem(key) {
        if (key === "__doin_dd__") return; // 探针通过
        throw new Error("QuotaExceededError");
      },
    });
    installStorage(full);
    assert.doesNotThrow(() => save(defaultState()));
    removeStorage();
  });
});

describe("进度记账", () => {
  it("recordLevel 只记更高的评级，且点过的关卡就是 lastLevel", () => {
    let state = defaultState();
    const first = recordLevel(state, { levelId: SECOND, pearls: 2 });
    assert.equal(first.improved, true);
    state = first.state;

    const worse = recordLevel(state, { levelId: SECOND, pearls: 1 });
    assert.equal(worse.improved, false, "打得更差不该覆盖旧纪录");
    assert.equal(worse.state.progress.stars[SECOND], 2);

    const better = recordLevel(state, { levelId: SECOND, pearls: 3 });
    assert.equal(better.improved, true);
    assert.equal(better.state.progress.stars[SECOND], 3);

    // 0 颗珍珠也照样记住“玩到哪儿了”
    const zero = recordLevel(better.state, { levelId: LAST, pearls: 0 });
    assert.equal(zero.improved, false);
    assert.equal(zero.state.progress.lastLevel, LAST);
    assert.equal(zero.state.progress.stars[LAST], undefined);
  });

  it("recordLevel 拒绝不存在的关卡，也不改 lastLevel", () => {
    const state = recordLevel(defaultState(), { levelId: BOGUS, pearls: 3 });
    assert.equal(state.improved, false);
    assert.equal(state.state.progress.lastLevel, FIRST);
    assert.deepEqual(state.state.progress.stars, {});
  });

  it("setLastLevel 忽略非法 id", () => {
    assert.equal(setLastLevel(defaultState(), BOGUS).progress.lastLevel, FIRST);
    assert.equal(setLastLevel(defaultState(), LAST).progress.lastLevel, LAST);
  });

  it("recordAbyss 取历史最好成绩并给出 isRecord", () => {
    let state = defaultState();
    const first = recordAbyss(state, { meters: 300, score: 5000 });
    assert.equal(first.isRecord, true);
    state = first.state;

    const deeper = recordAbyss(state, { meters: 420, score: 100 });
    assert.equal(deeper.isRecord, true);
    assert.deepEqual(deeper.state.progress.abyss, { meters: 420, score: 5000 });

    const shallow = recordAbyss(deeper.state, { meters: 10, score: 20 });
    assert.equal(shallow.isRecord, false);
    assert.deepEqual(shallow.state.progress.abyss, { meters: 420, score: 5000 });
  });

  it("setMuted 强制布尔化", () => {
    assert.equal(setMuted(defaultState(), true).prefs.muted, true);
    assert.equal(setMuted(defaultState(), 0).prefs.muted, false);
    assert.equal(setMuted(defaultState(), "yes").prefs.muted, true);
  });

  it("resetAll 清空一切并退回默认档", () => {
    installStorage(fakeStorage());
    let state = recordLevel(defaultState(), { levelId: SECOND, pearls: 3 }).state;
    state = recordAbyss(state, { meters: 999, score: 9999 }).state;
    save(state);

    const cleared = resetAll();
    assert.deepEqual(cleared, defaultState());
    assert.deepEqual(load(), defaultState());
    removeStorage();
  });

  it("所有记账函数都接受并返回规范化后的新对象（不改入参）", () => {
    const before = { progress: { stars: { [FIRST]: 1 } } };
    const snapshot = JSON.stringify(before);
    const after = recordLevel(before, { levelId: SECOND, pearls: 3 }).state;
    assert.equal(JSON.stringify(before), snapshot, "入参必须保持原样");
    assert.notEqual(after, before);
    assert.deepEqual(Object.keys(after).sort(), ["prefs", "progress", "version"]);
  });
});
