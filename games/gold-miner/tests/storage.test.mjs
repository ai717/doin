import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SCHEMA_VERSION,
  START_DYNAMITE,
  START_LEVEL,
  STORAGE_KEY,
  clearRun,
  defaultProgress,
  defaultState,
  load,
  normalize,
  recordRound,
  resetAll,
  resetBackendForTests,
  save,
  setMuted,
} from "../js/storage.mjs";

function installStorage(initial = new Map()) {
  const store = new Map(initial);
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  resetBackendForTests();
  return store;
}

function useMemoryBackend() {
  delete globalThis.localStorage;
  resetBackendForTests();
}

test("存档键与默认值：doin.gold-miner.v1 + 第 1 关 / 3 桶炸药", () => {
  assert.equal(STORAGE_KEY, "doin.gold-miner.v1");
  assert.equal(SCHEMA_VERSION, 1);
  assert.deepEqual(defaultProgress(), {
    level: START_LEVEL,
    money: 0,
    record: 0,
    dynamite: START_DYNAMITE,
    potion: false,
    polish: false,
  });
  assert.deepEqual(defaultState(), {
    version: SCHEMA_VERSION,
    prefs: { muted: false },
    progress: defaultProgress(),
  });
});

test("normalize：空值、缺字段、被手改坏都退回默认，不抛异常", () => {
  assert.deepEqual(normalize(null), defaultState());
  assert.deepEqual(normalize(undefined), defaultState());
  assert.deepEqual(normalize("junk"), defaultState());
  assert.deepEqual(normalize({}), defaultState());
  assert.deepEqual(normalize({ progress: null, prefs: 7 }), defaultState());

  const broken = normalize({
    progress: { level: -5, money: -100, record: -1, dynamite: "x", potion: "yes", polish: 0 },
    prefs: { muted: "true" },
  });
  assert.equal(broken.progress.level, START_LEVEL);
  assert.equal(broken.progress.money, 0);
  assert.equal(broken.progress.record, 0);
  assert.equal(broken.progress.dynamite, START_DYNAMITE, "非数字炸药数退回初始值");
  assert.equal(broken.progress.potion, false);
  assert.equal(broken.progress.polish, false);
  assert.equal(broken.prefs.muted, true);
});

test("normalize：record 永远不小于当前现金（本地改档也不能倒挂）", () => {
  const state = normalize({ progress: { money: 4200, record: 10 } });
  assert.equal(state.progress.record, 4200);
});

test("load/save：写入后可原样读回，脏 JSON 退回默认", () => {
  const store = installStorage();
  assert.deepEqual(load(), defaultState());

  const next = save({ ...defaultState(), progress: { ...defaultProgress(), level: 4, money: 3000 } });
  assert.equal(store.has(STORAGE_KEY), true);
  assert.deepEqual(load(), next);
  assert.equal(load().progress.level, 4);

  store.set(STORAGE_KEY, "{not json");
  assert.deepEqual(load(), defaultState(), "解析失败必须退回默认而不是抛错");
  useMemoryBackend();
});

test("load/save：localStorage 不可用时静默降级内存，不抛给 UI", () => {
  useMemoryBackend();
  assert.deepEqual(load(), defaultState());
  save({ ...defaultState(), progress: { ...defaultProgress(), money: 700 } });
  assert.equal(load().progress.money, 700, "内存后端同样能续上本局");

  Object.defineProperty(globalThis, "localStorage", {
    get() {
      throw new Error("security");
    },
    configurable: true,
  });
  resetBackendForTests();
  assert.doesNotThrow(() => load());
  assert.doesNotThrow(() => save(defaultState()));
  delete globalThis.localStorage;
  resetBackendForTests();
});

test("recordRound：最高纪录只增不减，并回报是否破纪录", () => {
  useMemoryBackend();
  let state = defaultState();
  const first = recordRound(state, { money: 1200 });
  assert.equal(first.isRecord, true);
  assert.equal(first.state.progress.record, 1200);

  const lower = recordRound(first.state, { money: 300 });
  assert.equal(lower.isRecord, false);
  assert.equal(lower.state.progress.record, 1200, "破纪录只认历史最高");

  const higher = recordRound(lower.state, { money: 5000 });
  assert.equal(higher.isRecord, true);
  assert.equal(higher.state.progress.record, 5000);

  const junk = recordRound(higher.state, { money: "hack" });
  assert.equal(junk.state.progress.record, 5000);
  state = junk.state;
  assert.equal(state.progress.record, 5000);
});

test("clearRun：破产后清掉本局资产，保留最高纪录与静音偏好", () => {
  const state = normalize({
    prefs: { muted: true },
    progress: { level: 6, money: 900, record: 8000, dynamite: 5, potion: true, polish: true },
  });
  const cleared = clearRun(state);
  assert.deepEqual(cleared.progress, { ...defaultProgress(), record: 8000 });
  assert.equal(cleared.prefs.muted, true);
});

test("setMuted / resetAll：偏好可切换，重置后回到全新存档", () => {
  const store = installStorage();
  save(setMuted(defaultState(), true));
  assert.equal(load().prefs.muted, true);
  save(setMuted(load(), false));
  assert.equal(load().prefs.muted, false);

  save({ ...defaultState(), progress: { ...defaultProgress(), level: 9, money: 4000, record: 4000 } });
  const reset = resetAll();
  assert.deepEqual(reset, defaultState());
  assert.equal(store.has(STORAGE_KEY), false);
  assert.deepEqual(load(), defaultState());
  useMemoryBackend();
});
