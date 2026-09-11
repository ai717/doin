// filepath: games/jigsaw/tests/engine.test.mjs
// 规则层回归：交换、锁定、重排、胜利判定、快照校验，以及 50 关的可解性门禁。
// 只 import 纯函数模块，不涉及任何 DOM。
import test from "node:test";
import assert from "node:assert/strict";

import {
  MIN_SIZE,
  MAX_SIZE,
  createState,
  cloneState,
  applyMove,
  shuffle,
  isSolved,
  isPlaced,
  isLocked,
  pieceAt,
  unlockedCells,
  placedCount,
  anyLegalMove,
  snapshot,
  validateSnapshot,
  restore,
  mulberry32,
  hashString,
} from "../js/engine.mjs";
import { LEVELS, LEVEL_COUNT } from "../js/levels.mjs";

const cellsOf = (state) => {
  const out = [];
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) out.push({ r, c });
  }
  return out;
};

const whereIs = (state, target) => {
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      const piece = pieceAt(state, r, c);
      if (piece && piece.r === target.r && piece.c === target.c) return { r, c };
    }
  }
  return null;
};

/** 不变式：放对的格必然已锁定，未放对的格必然未锁定 */
function assertInvariant(state, label) {
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      assert.equal(
        isPlaced(state, r, c),
        isLocked(state, r, c),
        `${label}: (${r},${c}) 的"放对 ⇔ 已锁定"不变式被破坏`
      );
    }
  }
}

test("createState：尺寸合法、初始无一块在位、全部未锁定", () => {
  for (let n = MIN_SIZE; n <= MAX_SIZE; n++) {
    const state = createState(n, `seed-${n}`);
    assert.equal(state.n, n);
    assert.equal(state.moves, 0);
    assert.equal(state.grid.length, n);
    assert.equal(state.grid[0].length, n);
    assert.equal(placedCount(state), 0, `${n}×${n} 初始不应有碎片已在原位`);
    assert.equal(state.locked.flat().filter(Boolean).length, 0);
    assertInvariant(state, `createState ${n}`);
  }
});

test("createState：网格是完整排列（每格恰好对应一个原始格）", () => {
  const state = createState(5, "permutation");
  const seen = new Set();
  for (const cell of cellsOf(state)) {
    const piece = pieceAt(state, cell.r, cell.c);
    const key = piece.r * state.n + piece.c;
    assert.ok(!seen.has(key), "出现重复碎片");
    seen.add(key);
  }
  assert.equal(seen.size, 25);
});

test("createState：同一 seed 可复现，不同 seed 不同局", () => {
  const a = createState(4, "same");
  const b = createState(4, "same");
  assert.deepEqual(a.grid, b.grid);
  const c = createState(4, "other");
  assert.notDeepEqual(a.grid, c.grid);
});

test("createState：注入 rng 时按 rng 决定（测试可复现）", () => {
  const state = createState(3, mulberry32(7));
  const again = createState(3, mulberry32(7));
  assert.deepEqual(state.grid, again.grid);
});

test("createState：越界尺寸回退到最小尺寸而不是抛错", () => {
  assert.equal(createState(1, "x").n, MIN_SIZE);
  assert.equal(createState(99, "x").n, MIN_SIZE);
  assert.equal(createState("3", "x").n, MIN_SIZE);
});

test("applyMove：合法交换必执行，步数 +1，状态不可变", () => {
  const state = createState(3, "swap-basic");
  const before = JSON.stringify(state);
  const from = { r: 0, c: 0 };
  const to = { r: 1, c: 1 };
  const pieceFrom = pieceAt(state, from.r, from.c);
  const pieceTo = pieceAt(state, to.r, to.c);

  const outcome = applyMove(state, { from, to });
  assert.equal(outcome.action, "swap");
  assert.equal(outcome.reason, null);
  assert.equal(outcome.state.moves, 1);
  assert.deepEqual(pieceAt(outcome.state, from.r, from.c), pieceTo);
  assert.deepEqual(pieceAt(outcome.state, to.r, to.c), pieceFrom);
  assert.equal(JSON.stringify(state), before, "原 state 被修改了");
});

test("applyMove：交换后落在正确位置的格立即锁定并回报", () => {
  const state = createState(3, "lock-on-swap");
  const target = { r: 0, c: 0 };
  const holder = whereIs(state, target);
  assert.ok(holder, "应能定位属于 (0,0) 的碎片");

  const outcome = applyMove(state, { from: target, to: holder });
  assert.equal(outcome.action, "swap");
  assert.ok(outcome.locked.some((cell) => cell.r === 0 && cell.c === 0), "目标格应被锁定");
  assert.ok(isLocked(outcome.state, 0, 0));
  assertInvariant(outcome.state, "applyMove lock");
});

test("applyMove：拖已锁定块 / 同格 / 越界 / 空参都是安全 no-op", () => {
  const state = createState(3, "noop");
  const target = { r: 2, c: 2 };
  const holder = whereIs(state, target);
  const lockedState = applyMove(state, { from: target, to: holder }).state;
  assert.ok(isLocked(lockedState, 2, 2));

  const other = { r: 0, c: 1 };
  const lockedHit = applyMove(lockedState, { from: { r: 2, c: 2 }, to: other });
  assert.equal(lockedHit.action, null);
  assert.equal(lockedHit.reason, "locked");
  assert.equal(lockedHit.state, lockedState, "no-op 必须原样返回同一状态引用");

  const same = applyMove(state, { from: { r: 0, c: 0 }, to: { r: 0, c: 0 } });
  assert.equal(same.action, null);
  assert.equal(same.reason, "same");

  assert.equal(applyMove(state, { from: { r: -1, c: 0 }, to: { r: 0, c: 0 } }).action, null);
  assert.equal(applyMove(state, { from: { r: 0, c: 0 }, to: { r: 9, c: 9 } }).action, null);
  assert.equal(applyMove(state, null).action, null);
  assert.equal(applyMove(null, { from: { r: 0, c: 0 }, to: { r: 1, c: 1 } }).action, null);
});

test("applyMove：终止态（已拼完）上继续交换是 no-op", () => {
  const state = createState(3, "solved-guard");
  const solved = solveGreedy(state).state;
  assert.ok(isSolved(solved));
  const outcome = applyMove(solved, { from: { r: 0, c: 0 }, to: { r: 0, c: 1 } });
  assert.equal(outcome.action, null);
  assert.equal(outcome.reason, "locked");
  assert.equal(outcome.state, solved);
});

test("isSolved：初始为假，全部归位后为真", () => {
  const state = createState(4, "solve-me");
  assert.equal(isSolved(state), false);
  const solved = solveGreedy(state).state;
  assert.equal(isSolved(solved), true);
  assert.equal(placedCount(solved), 16);
  assert.equal(unlockedCells(solved).length, 0);
  assert.equal(anyLegalMove(solved), false);
});

test("shuffle：不改锁定集合、不把碎片洗回原位、不计步数", () => {
  const state = createState(4, "shuffle-base");
  const target = { r: 0, c: 0 };
  const withLock = applyMove(state, { from: target, to: whereIs(state, target) }).state;

  const outcome = shuffle(withLock, mulberry32(2026));
  assert.equal(outcome.action, "shuffle");
  assert.equal(outcome.state.moves, withLock.moves, "重排不应计步");
  assert.ok(isLocked(outcome.state, 0, 0), "已锁定的格不应被动到");
  assert.equal(placedCount(outcome.state), placedCount(withLock));
  assertInvariant(outcome.state, "shuffle");

  const before = new Set(
    unlockedCells(withLock).map((cell) => `${pieceAt(withLock, cell.r, cell.c).r},${pieceAt(withLock, cell.r, cell.c).c}`)
  );
  const after = new Set(
    unlockedCells(outcome.state).map((cell) => `${pieceAt(outcome.state, cell.r, cell.c).r},${pieceAt(outcome.state, cell.r, cell.c).c}`)
  );
  assert.deepEqual([...after].sort(), [...before].sort(), "重排只应置换未锁定碎片");
});

test("shuffle：未锁定格不足 2 个时返回 action: null（不消耗次数）", () => {
  const state = createState(3, "shuffle-none");
  const solved = solveGreedy(state).state;
  const outcome = shuffle(solved, mulberry32(1));
  assert.equal(outcome.action, null);
  assert.equal(outcome.state, solved);
});

test("shuffle：同一 rng 可复现", () => {
  const state = createState(5, "shuffle-seed");
  const a = shuffle(state, mulberry32(42)).state;
  const b = shuffle(state, mulberry32(42)).state;
  assert.deepEqual(a.grid, b.grid);
});

test("快照：snapshot -> validateSnapshot -> restore 往返一致", () => {
  const state = createState(4, "snap");
  const mixed = applyMove(state, { from: { r: 0, c: 0 }, to: whereIs(state, { r: 0, c: 0 }) }).state;
  const snap = snapshot(mixed);
  assert.equal(validateSnapshot({ n: 4, seed: "snap" }, snap), true);
  const back = restore({ n: 4, seed: "snap" }, snap);
  assert.deepEqual(back.grid, mixed.grid);
  assert.deepEqual(back.locked, mixed.locked);
  assert.equal(back.moves, mixed.moves);
});

test("快照：损坏 / 越界 / 与锁定状态矛盾时一律回退到关卡初始局面", () => {
  const level = { n: 3, seed: "bad-snap" };
  const state = createState(3, level.seed);
  const good = snapshot(state);

  assert.equal(validateSnapshot(level, null), false);
  assert.equal(validateSnapshot(level, { n: 4, order: [], locked: [] }), false);
  assert.equal(validateSnapshot(level, { ...good, order: [0, 0, 0, 0, 0, 0, 0, 0, 0] }), false);
  assert.equal(validateSnapshot(level, { ...good, order: good.order.slice(0, 5) }), false);
  assert.equal(validateSnapshot(level, { ...good, order: good.order.map((v, i) => (i === 0 ? 99 : v)) }), false);
  // 声称 (0,0) 已锁定却没放对 -> 结构矛盾
  assert.equal(validateSnapshot(level, { ...good, locked: good.locked.map((v, i) => (i === 0 ? true : v)) }), false);

  const fallback = restore(level, { n: 3, order: [0, 0, 0], locked: [false, false, false] });
  assert.equal(placedCount(fallback), 0, "损坏快照应回退到全新关卡");
  assert.equal(fallback.n, 3);
});

test("快照：已拼完的局面不写进存档（restore 视为无效）", () => {
  const level = { n: 3, seed: "solved-snap" };
  const solved = solveGreedy(createState(3, level.seed)).state;
  const snap = snapshot(solved);
  assert.equal(validateSnapshot(level, snap), true, "结构本身合法");
  const restored = restore(level, snap);
  assert.equal(isSolved(restored), false, "已拼完的快照应被丢弃");
});

test("cloneState 是深拷贝", () => {
  const state = createState(3, "clone");
  const copy = cloneState(state);
  copy.grid[0][0] = { r: 9, c: 9 };
  copy.locked[0][0] = true;
  assert.notEqual(state.grid[0][0].r, 9);
  assert.equal(state.locked[0][0], false);
});

test("hashString / mulberry32 稳定且落在预期范围", () => {
  assert.equal(hashString("jigsaw"), hashString("jigsaw"));
  assert.notEqual(hashString("jigsaw"), hashString("jigsaw "));
  const rng = mulberry32(1);
  for (let i = 0; i < 100; i++) {
    const value = rng();
    assert.ok(value >= 0 && value < 1, `rng 越界: ${value}`);
  }
});

/** 贪心解：逐格把"属于这里的碎片"换过来。每步至少放对一块，最多 n*n 步收敛。 */
function solveGreedy(state) {
  let current = state;
  let guard = 0;
  const limit = state.n * state.n + 2;
  for (let r = 0; r < state.n; r++) {
    for (let c = 0; c < state.n; c++) {
      if (isPlaced(current, r, c)) continue;
      const holder = whereIs(current, { r, c });
      assert.ok(holder, `找不到属于 (${r},${c}) 的碎片`);
      const outcome = applyMove(current, { from: { r, c }, to: holder });
      assert.equal(outcome.action, "swap", `第 (${r},${c}) 格的修复交换必须合法`);
      current = outcome.state;
      assertInvariant(current, `solveGreedy (${r},${c})`);
      guard++;
      assert.ok(guard <= limit, "贪心解步数超出上界，可能存在死循环");
    }
  }
  return { state: current, steps: guard };
}

test("50 关全部可解：贪心解步数不超过 n*n，且全程不变式成立", () => {
  assert.equal(LEVELS.length, LEVEL_COUNT);
  assert.equal(LEVEL_COUNT, 50);
  for (const level of LEVELS) {
    const start = createState(level.n, level.seed);
    const { state, steps } = solveGreedy(start);
    assert.ok(isSolved(state), `${level.id} 贪心解未收敛`);
    assert.ok(steps <= level.n * level.n, `${level.id} 步数 ${steps} 超出上界`);
  }
});

test("50 关随机游走：任意合法交换都不抛错、不变式不破、最终可解", () => {
  for (const level of LEVELS) {
    let state = createState(level.n, `${level.seed}:walk`);
    const rng = mulberry32(level.index + 1);
    for (let step = 0; step < 60; step++) {
      const free = unlockedCells(state);
      if (free.length < 2) break;
      const a = free[Math.floor(rng() * free.length)];
      let b = free[Math.floor(rng() * free.length)];
      if (a.r === b.r && a.c === b.c) b = free[(free.indexOf(a) + 1) % free.length];
      const outcome = applyMove(state, { from: a, to: b });
      assert.equal(outcome.action, "swap", `${level.id} 随机游走出现非法交换`);
      state = outcome.state;
      assertInvariant(state, `${level.id} walk`);
    }
    assert.ok(isSolved(solveGreedy(state).state), `${level.id} 游走后仍应可解`);
  }
});
