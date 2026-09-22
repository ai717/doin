import { test } from "node:test";
import assert from "node:assert/strict";
import * as storage from "../js/storage.mjs";

test("normalize：非法输入回默认", () => {
  const d = storage.defaultState();
  assert.deepEqual(storage.normalize(null), d);
  assert.deepEqual(storage.normalize("xx"), d);
  assert.deepEqual(storage.normalize({ prefs: "bad" }), d);
});

test("normalize：坏星级/用时回默认值", () => {
  const st = storage.normalize({
    prefs: { muted: true },
    progress: { unlocked: 99, best: { 1: { stars: 99, timeMs: -5 } } },
  });
  assert.equal(st.prefs.muted, true);
  assert.equal(st.progress.unlocked, 40); // 上限钳制
  assert.equal(st.progress.best[1].stars, 3);
  assert.equal(st.progress.best[1].timeMs, null);
});

test("recordResult：首次通关记录星级与用时并解锁下一关", () => {
  let st = storage.defaultState();
  const { state, isRecord } = storage.recordResult(st, { levelId: 1, stars: 3, timeMs: 12345 });
  assert.equal(isRecord, true);
  assert.equal(state.progress.best[1].stars, 3);
  assert.equal(state.progress.best[1].timeMs, 12345);
  assert.equal(state.progress.unlocked, 2);
});

test("recordResult：更慢通关不覆盖最快、更低星级不降星", () => {
  let st = storage.defaultState();
  st = storage.recordResult(st, { levelId: 1, stars: 3, timeMs: 10000 }).state;
  const a = storage.recordResult(st, { levelId: 1, stars: 1, timeMs: 30000 });
  assert.equal(a.isRecord, false);
  assert.equal(a.state.progress.best[1].stars, 3); // 星级取更高
  assert.equal(a.state.progress.best[1].timeMs, 10000); // 用时取更快
  const b = storage.recordResult(a.state, { levelId: 1, stars: 2, timeMs: 8000 });
  assert.equal(b.isRecord, true);
  assert.equal(b.state.progress.best[1].timeMs, 8000);
});

test("load/save：内存降级 + 往返一致", () => {
  storage.resetBackendForTests();
  const saved = storage.defaultState();
  saved.progress.unlocked = 3;
  assert.equal(storage.save(saved), true);
  const loaded = storage.load();
  assert.equal(loaded.progress.unlocked, 3);
});

test("bestFor：无记录返回 0 星", () => {
  const st = storage.defaultState();
  assert.deepEqual(storage.bestFor(st, 1), { stars: 0, timeMs: null });
});