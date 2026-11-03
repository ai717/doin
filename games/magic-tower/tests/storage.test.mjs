// storage.test.mjs — 存档唯一口径：坏数据归一化 / 降级内存 / 往返一致 / 纪录刷新
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  clearRun,
  emptyMeta,
  loadLocale,
  loadMeta,
  loadRun,
  loadSound,
  normalizeMeta,
  recordClear,
  resetBackendForTests,
  saveLocale,
  saveMeta,
  saveRun,
  saveSound,
} from "../js/storage.mjs";
import { createState, step } from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";

beforeEach(() => {
  resetBackendForTests();
});

describe("storage: 归一化", () => {
  it("空值 / 垃圾值一律回落到安全默认", () => {
    const base = emptyMeta();
    assert.deepEqual(normalizeMeta(null), base);
    assert.deepEqual(normalizeMeta("nope"), base);
    assert.deepEqual(normalizeMeta({ best: "x" }), base);
    const cleaned = normalizeMeta({
      sound: "yes",
      best: { damage: -5, steps: "abc", clears: -3, trueEnding: 1 },
      save: "bad",
    });
    assert.equal(cleaned.sound, true);
    assert.equal(cleaned.best.damage, null);
    assert.equal(cleaned.best.steps, null);
    assert.equal(cleaned.best.clears, 0);
    assert.equal(cleaned.best.trueEnding, true);
    assert.equal(cleaned.save, null);
  });

  it("Key 固定为 doin.magic-tower.v1", () => {
    assert.equal(STORAGE_KEY, "doin.magic-tower.v1");
  });
});

describe("storage: 局内存档往返", () => {
  it("保存后能原样读回，含盘面改动", () => {
    let state = createState(LEVELS);
    const moved = step(state, { type: "move", dx: 0, dy: -1 });
    state = moved.state;
    assert.ok(saveRun(state));
    const restored = loadRun(LEVELS);
    assert.ok(restored);
    assert.equal(restored.x, state.x);
    assert.equal(restored.y, state.y);
    assert.equal(restored.hp, state.hp);
    assert.equal(restored.floor, state.floor);
    assert.equal(restored.floors[0].cells.join(""), state.floors[0].cells.join(""));
  });

  it("清档后不再返回局内进度", () => {
    saveRun(createState(LEVELS));
    assert.ok(loadRun(LEVELS));
    clearRun();
    assert.equal(loadRun(LEVELS), null);
  });

  it("已终局的存档不会被当作可续玩进度", () => {
    const state = { ...createState(LEVELS), status: "victory", ending: "true" };
    saveRun(state);
    assert.equal(loadRun(LEVELS), null);
  });

  it("脏存档不会让 loadRun 抛错", () => {
    saveMeta({ ...emptyMeta(), save: { floor: "x", floors: [{ cells: "短" }] } });
    assert.equal(loadRun(LEVELS), null);
  });
});

describe("storage: 纪录与偏好", () => {
  it("首次通关写入纪录，后续更优才刷新", () => {
    const state = createState(LEVELS);
    const better = { ...state, status: "victory", ending: "true", stats: { ...state.stats, damageTaken: 800, steps: 1200 } };
    const first = recordClear(better);
    assert.equal(first.improved, true);
    assert.equal(first.best.damage, 800);
    assert.equal(first.best.steps, 1200);
    assert.equal(first.best.clears, 1);
    assert.equal(first.best.trueEnding, true);

    const worse = { ...state, status: "victory", stats: { ...state.stats, damageTaken: 2000, steps: 3000 } };
    const second = recordClear(worse);
    assert.equal(second.improved, false);
    assert.equal(second.best.damage, 800);
    assert.equal(second.best.clears, 2);
  });

  it("音效开关与语言偏好各自独立持久化", () => {
    assert.equal(loadSound(), true);
    saveSound(false);
    assert.equal(loadSound(), false);
    assert.equal(loadLocale(), "zh");
    saveLocale("en");
    assert.equal(loadLocale(), "en");
    // 语言偏好写在全站共享 key 上，不污染本游戏存档
    assert.equal(loadMeta().sound, false);
  });
});
