// 存档契约：坏数据归一化、隐私模式降级内存、往返读写一致、局部更新不可变。

import test from "node:test";
import assert from "node:assert/strict";

import { BLACK, WHITE } from "../js/engine.mjs";
import { TIER_KEYS, TIER_NOVICE, TIER_DUELIST, TIER_VIRTUOSO, TIER_INFALLIBLE } from "../js/ai.mjs";
import { PUZZLE_STARS_MAX } from "../js/score.mjs";
import {
  STORAGE_KEY, SCHEMA_VERSION, MODES, MODE_KEYS, OPENINGS,
  DEFAULT_TIER, DEFAULT_SIDE, DEFAULT_OPENING,
  defaultState, normalize, load, save, resetBackendForTests, isPuzzleId,
  patchPrefs, applyOutcome, applyHighlights, applyPuzzleResult, applyRushResult, clearRecords,
} from "../js/storage.mjs";

const eq = assert.strictEqual;
const de = assert.deepStrictEqual;

function installMemoryStorage(entries = []) {
  const store = new Map(entries);
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  resetBackendForTests();
  return store;
}

function uninstallStorage() {
  delete globalThis.localStorage;
  resetBackendForTests();
}

const TierEnum = {
  NOVICE: TIER_NOVICE,
  DUELIST: TIER_DUELIST,
  VIRTUOSO: TIER_VIRTUOSO,
  INFALLIBLE: TIER_INFALLIBLE,
};

// ─── 契约常量 ─────────────────────────────────────────────────────
test("存档 key 与版本号符合 <slug>.v1 契约", () => {
  eq(STORAGE_KEY, "doin.reversi.v1");
  eq(SCHEMA_VERSION, 1);
  de(MODE_KEYS, [MODES.PLAY, MODES.PUZZLE, MODES.RUSH]);
  de(OPENINGS, ["standard", "diagonal", "perpendicular", "parallel", "random"]);
  eq(DEFAULT_TIER, TIER_DUELIST);
  eq(DEFAULT_SIDE, BLACK);
  eq(DEFAULT_OPENING, "standard");
});

test("defaultState：四档 AI 各有一个战绩桶，进度与最高分为空", () => {
  const state = defaultState();
  eq(state.version, SCHEMA_VERSION);
  de(Object.keys(state.records.vs).sort(), [...TIER_KEYS].sort());
  for (const tier of TIER_KEYS) de(state.records.vs[tier], { w: 0, d: 0, l: 0 });
  de(state.records.puzzle, {});
  de(state.records.rush, { bestScore: 0, bestCombo: 0 });
  de(state.records.highlights, { maxFlip: 0, bestSwing: 0 });
  eq(state.prefs.classic, false);
  eq(state.prefs.blitz, false);
  eq(state.prefs.showMobility, true);
});

// ─── 归一化（绝不白屏的第一道防线）────────────────────────────────
test("normalize：非对象输入一律退回默认值", () => {
  const base = defaultState();
  for (const bad of [null, undefined, 0, "", "x", true, [], () => {}]) {
    de(normalize(bad), base, `输入 ${String(bad)} 应退回默认`);
  }
  de(normalize({}), base);
});

test("normalize：偏好项越界即回落，布尔项强制成布尔", () => {
  const state = normalize({
    prefs: {
      mode: "raid", tier: "grandmaster", side: 7, opening: "knight",
      blitz: "yes", classic: 1, muted: 0, showMobility: null,
    },
  });
  eq(state.prefs.mode, MODES.PLAY);
  eq(state.prefs.tier, DEFAULT_TIER);
  eq(state.prefs.side, DEFAULT_SIDE);
  eq(state.prefs.opening, DEFAULT_OPENING);
  eq(state.prefs.blitz, true);
  eq(state.prefs.classic, true);
  eq(state.prefs.muted, false);
  eq(state.prefs.showMobility, false);

  const white = normalize({ prefs: { side: WHITE, tier: TIER_INFALLIBLE, mode: MODES.RUSH } });
  eq(white.prefs.side, WHITE);
  eq(white.prefs.tier, TIER_INFALLIBLE);
  eq(white.prefs.mode, MODES.RUSH);
});

test("normalize：战绩只接受非负整数，负数/小数/字符串垃圾一律归零", () => {
  const state = normalize({
    records: {
      vs: {
        novice: { w: -3, d: 2.9, l: "7" },
        duelist: { w: "x", d: null, l: undefined },
        virtuoso: "not an object",
        infallible: { w: Infinity, d: NaN, l: 1e9 },
        ghost: { w: 999 },
      },
    },
  });
  de(state.records.vs[TierEnum.NOVICE], { w: 0, d: 2, l: 7 });
  de(state.records.vs[TierEnum.DUELIST], { w: 0, d: 0, l: 0 });
  de(state.records.vs[TierEnum.VIRTUOSO], { w: 0, d: 0, l: 0 });
  de(state.records.vs[TierEnum.INFALLIBLE], { w: 0, d: 0, l: 1000000000 });
  eq("ghost" in state.records.vs, false); // 未知档位不留垃圾键
});

test("normalize：残局进度按 id 契约过滤，星级夹到 0..3", () => {
  const state = normalize({
    records: {
      puzzle: {
        p0101: { stars: 3, hadWrongRetry: false, firstMoveOptimal: true },
        p0610: { stars: 99, hadWrongRetry: "yes" },
        p0199: { stars: 3 }, // 章内题号越界
        p0701: { stars: 3 }, // 章号越界
        p0100: { stars: 3 },
        junk: { stars: 3 },
        p0102: "not an object",
        p0103: { stars: -5, hadWrongRetry: 0, firstMoveOptimal: 1 },
      },
    },
  });
  const keys = Object.keys(state.records.puzzle).sort();
  de(keys, ["p0101", "p0103", "p0610"]);
  de(state.records.puzzle.p0101, { stars: 3, hadWrongRetry: false, firstMoveOptimal: true });
  de(state.records.puzzle.p0610, { stars: PUZZLE_STARS_MAX, hadWrongRetry: true, firstMoveOptimal: false });
  de(state.records.puzzle.p0103, { stars: 0, hadWrongRetry: false, firstMoveOptimal: true });
});

test("isPuzzleId：只认 p + 章(01-06) + 题(01-10)", () => {
  for (const good of ["p0101", "p0110", "p0601", "p0610"]) eq(isPuzzleId(good), true, good);
  for (const bad of ["p0100", "p0199", "p0701", "p0001", "p010", "p01011", "", null, 101, "P0101"]) {
    eq(isPuzzleId(bad), false, String(bad));
  }
});

test("normalize：最高分与纪录只接受非负整数", () => {
  const state = normalize({
    records: {
      rush: { bestScore: -100, bestCombo: 3.7 },
      highlights: { maxFlip: "12", bestSwing: -8 },
    },
  });
  de(state.records.rush, { bestScore: 0, bestCombo: 3 });
  de(state.records.highlights, { maxFlip: 12, bestSwing: 0 });
});

test("normalize：输出恒为全新对象，不夹带未知字段", () => {
  const raw = { version: 99, prefs: { mode: "play" }, records: {}, evil: { __proto__: { x: 1 } } };
  const state = normalize(raw);
  de(Object.keys(state).sort(), ["prefs", "records", "version"]);
  de(Object.keys(state.records).sort(), ["highlights", "puzzle", "rush", "vs"]);
  de(Object.keys(state.prefs).sort(),
    ["blitz", "classic", "mode", "muted", "opening", "showMobility", "side", "tier"]);
  eq(state.version, SCHEMA_VERSION);
  eq("evil" in state, false);
});

// ─── 读写 ─────────────────────────────────────────────────────────
test("无 localStorage 时降级内存，读写照常且互不污染", () => {
  uninstallStorage();
  const state = patchPrefs(defaultState(), { tier: TIER_NOVICE, muted: true });
  eq(save(state), true);
  const back = load();
  eq(back.prefs.tier, TIER_NOVICE);
  eq(back.prefs.muted, true);
});

test("往返一致：save 后 load 得到等价的归一化状态", () => {
  installMemoryStorage();
  let state = defaultState();
  state = patchPrefs(state, { mode: MODES.PUZZLE, tier: TIER_VIRTUOSO, side: WHITE, blitz: true });
  state = applyOutcome(state, "win", TIER_VIRTUOSO);
  state = applyHighlights(state, { maxFlip: 11, bestSwing: 25 });
  state = applyPuzzleResult(state, "p0304", { stars: 2, hadWrongRetry: false, firstMoveOptimal: false });
  state = applyRushResult(state, { score: 480.5, combo: 13 });
  eq(save(state), true);
  de(load(), state);
});

test("save 落盘的永远是归一化结果（不把垃圾字段写进 localStorage）", () => {
  const store = installMemoryStorage();
  save({ prefs: { tier: "hacker", evil: 1 }, records: { puzzle: { junk: {} } }, extra: 1 });
  const raw = JSON.parse(store.get(STORAGE_KEY));
  de(Object.keys(raw).sort(), ["prefs", "records", "version"]);
  eq(raw.prefs.tier, DEFAULT_TIER);
  de(raw.records.puzzle, {});
  eq("extra" in raw, false);
});

test("存档损坏或不是 JSON 时静默退回默认值，绝不抛错", () => {
  const store = installMemoryStorage();
  for (const junk of ["{{{", "null", "true", "12", '"a string"', "[1,2,3]"]) {
    store.set(STORAGE_KEY, junk);
    const state = load();
    eq(state.version, SCHEMA_VERSION, `内容 ${junk} 应被安全兜住`);
    de(state.records.rush, { bestScore: 0, bestCombo: 0 });
  }
});

test("localStorage 抛异常（隐私模式）时静默降级内存，功能不受影响", () => {
  globalThis.localStorage = {
    getItem: () => { throw new Error("SecurityError"); },
    setItem: () => { throw new Error("SecurityError"); },
    removeItem: () => { throw new Error("SecurityError"); },
  };
  resetBackendForTests();
  const state = patchPrefs(defaultState(), { tier: TIER_NOVICE });
  eq(save(state), true); // 探测失败 → 内存后端接管
  eq(load().prefs.tier, TIER_NOVICE);
});

// ─── 局部更新 ─────────────────────────────────────────────────────
test("patchPrefs：局部合并且重新归一化，入参不被修改", () => {
  installMemoryStorage();
  const before = defaultState();
  const after = patchPrefs(before, { tier: TIER_INFALLIBLE, opening: "bogus", blitz: true });
  eq(after.prefs.tier, TIER_INFALLIBLE);
  eq(after.prefs.opening, DEFAULT_OPENING);
  eq(after.prefs.blitz, true);
  eq(before.prefs.tier, DEFAULT_TIER);
  eq(before.prefs.blitz, false);
  de(after, patchPrefs(after, {})); // 空补丁是恒等变换
});

test("applyOutcome：按档位累计胜/负/和，未知档位记到默认档", () => {
  let state = defaultState();
  state = applyOutcome(state, "win", TIER_NOVICE);
  state = applyOutcome(state, "win", TIER_NOVICE);
  state = applyOutcome(state, "loss", TIER_NOVICE);
  state = applyOutcome(state, "draw", TIER_INFALLIBLE);
  state = applyOutcome(state, "win", "impossible");
  state = applyOutcome(state, "nonsense", TIER_NOVICE); // 非法胜负结果忽略计数

  de(state.records.vs[TIER_NOVICE], { w: 2, d: 0, l: 1 });
  de(state.records.vs[TIER_INFALLIBLE], { w: 0, d: 1, l: 0 });
  de(state.records.vs[DEFAULT_TIER], { w: 1, d: 0, l: 0 });
  de(defaultState().records.vs[TIER_NOVICE], { w: 0, d: 0, l: 0 });
});

test("applyHighlights：历史纪录只升不降", () => {
  let state = applyHighlights(defaultState(), { maxFlip: 9, bestSwing: 14 });
  de(state.records.highlights, { maxFlip: 9, bestSwing: 14 });
  state = applyHighlights(state, { maxFlip: 4, bestSwing: 30 });
  de(state.records.highlights, { maxFlip: 9, bestSwing: 30 });
  state = applyHighlights(state, null);
  de(state.records.highlights, { maxFlip: 9, bestSwing: 30 });
});

test("applyPuzzleResult：星级只升不降，非法 id 直接忽略", () => {
  let state = defaultState();
  state = applyPuzzleResult(state, "p0205", { stars: 1, hadWrongRetry: true, firstMoveOptimal: false });
  de(state.records.puzzle.p0205, { stars: 1, hadWrongRetry: true, firstMoveOptimal: false });

  state = applyPuzzleResult(state, "p0205", { stars: 3, hadWrongRetry: false, firstMoveOptimal: true });
  de(state.records.puzzle.p0205, { stars: 3, hadWrongRetry: false, firstMoveOptimal: true });

  state = applyPuzzleResult(state, "p0205", { stars: 1, hadWrongRetry: true, firstMoveOptimal: false });
  de(state.records.puzzle.p0205, { stars: 3, hadWrongRetry: false, firstMoveOptimal: true });

  const untouched = applyPuzzleResult(state, "junk", { stars: 3 });
  de(untouched, state);
  const noResult = applyPuzzleResult(defaultState(), "p0101", null);
  de(noResult.records.puzzle.p0101, { stars: 0, hadWrongRetry: false, firstMoveOptimal: false });
});

test("applyRushResult：最高分与最高连击各自取历史最大", () => {
  let state = applyRushResult(defaultState(), { score: 120, combo: 9 });
  de(state.records.rush, { bestScore: 120, bestCombo: 9 });
  state = applyRushResult(state, { score: 90, combo: 15 });
  de(state.records.rush, { bestScore: 120, bestCombo: 15 });
  state = applyRushResult(state, { score: 400, combo: 2 });
  de(state.records.rush, { bestScore: 400, bestCombo: 15 });
  state = applyRushResult(state, null);
  de(state.records.rush, { bestScore: 400, bestCombo: 15 });
});

test("clearRecords：清空战绩与进度，偏好原样保留", () => {
  let state = patchPrefs(defaultState(), { tier: TIER_NOVICE, muted: true, mode: MODES.PUZZLE });
  state = applyOutcome(state, "win", TIER_NOVICE);
  state = applyPuzzleResult(state, "p0101", { stars: 3, hadWrongRetry: false, firstMoveOptimal: true });
  state = applyRushResult(state, { score: 500, combo: 20 });
  state = applyHighlights(state, { maxFlip: 12, bestSwing: 33 });

  const cleared = clearRecords(state);
  de(cleared.records, defaultState().records);
  de(cleared.prefs, state.prefs);
  de(state.records.rush, { bestScore: 500, bestCombo: 20 }); // 入参未被就地清空
});
