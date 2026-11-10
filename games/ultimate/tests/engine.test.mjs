import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY, MARK_O, MARK_X, STATUS_DRAW, STATUS_PLAYING, STATUS_WON, WILDCARD,
  applyMove, bigOf, bigResults, canForceWin, cellIndex, countEmpty, createEmptyState,
  createState, isClosed, isLegal, legalMoves, markOf, other, playableBoards, replay, smallOf,
} from "../js/engine.mjs";

const eq = assert.strictEqual;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 手工残局构造：显式给出双方棋子，保证 X/O 数量满足当前手方。
function build(xs = [], os = [], options = {}) {
  const cells = new Array(81).fill(EMPTY);
  for (const index of xs) cells[index] = MARK_X;
  for (const index of os) cells[index] = MARK_O;
  return createState({ cells, ...options });
}

// 一个 X 只差一手就完成大九宫三连的盘面。
function nearGrandWin() {
  return build(
    [0, 1, 2, 9, 10, 11, 18, 19],
    [45, 46, 47, 54, 55, 56, 63, 64],
    { active: 2, current: MARK_X },
  );
}

test("坐标换算与对手标记", () => {
  eq(bigOf(0), 0);
  eq(bigOf(80), 8);
  eq(smallOf(80), 8);
  eq(cellIndex(4, 7), 43);
  eq(markOf(MARK_X), "X");
  eq(markOf(MARK_O), "O");
  eq(markOf(EMPTY), "");
  eq(other(MARK_X), MARK_O);
  eq(other(MARK_O), MARK_X);
  eq(other(EMPTY), EMPTY);
});

test("空盘：X 先手、全盘自由、81 个落点", () => {
  const state = createEmptyState();
  eq(state.current, MARK_X);
  eq(state.active, WILDCARD);
  eq(state.status, STATUS_PLAYING);
  eq(legalMoves(state).length, 81);
  eq(countEmpty(state), 81);
  eq(state.bigs.every((value) => value === EMPTY), true);
});

test("导向落子：落点的小格坐标决定下一回合的活跃大格", () => {
  const start = createEmptyState();
  const first = applyMove(start, cellIndex(4, 6));
  eq(first.active, 6);
  eq(first.current, MARK_O);
  const moves = legalMoves(first);
  eq(moves.length, 9);
  assert.ok(moves.every((index) => bigOf(index) === 6));

  const second = applyMove(first, cellIndex(6, 1));
  eq(second.active, 1);
});

test("合法操作必须执行，非法操作原引用返回且静默忽略", () => {
  const state = createEmptyState();
  const next = applyMove(state, 40);
  assert.notStrictEqual(next, state);
  eq(state.cells[40], EMPTY, "旧状态不可被就地修改");
  eq(next.moves.length, 1);

  eq(applyMove(next, 40), next, "同一格重复落子必须原引用返回");
  eq(applyMove(state, -1), state);
  eq(applyMove(state, 81), state);
  eq(applyMove(state, 1.5), state);
  eq(isLegal(state, 40), true);
  eq(isLegal(next, 40), false);
  eq(isLegal(state, 40.2), false);
});

test("小格三连即占领大格", () => {
  const state = build([0, 1], [30, 31], { current: MARK_X });
  const after = applyMove(state, 2);
  eq(after.bigs[0], MARK_X);
  eq(after.status, STATUS_PLAYING);
  eq(after.active, 2);
});

test("大九宫三连即终局（含 line 记录）", () => {
  const ready = nearGrandWin();
  const done = applyMove(ready, 20);
  eq(done.bigs[2], MARK_X);
  eq(done.status, STATUS_WON);
  eq(done.winner, MARK_X);
  assert.deepEqual(done.winLine, [0, 1, 2]);
  eq(legalMoves(done).length, 0);
  eq(applyMove(done, 21), done, "终局后的操作必须 no-op");
});

test("被指向的大格已封盘时授予全盘自由落子权", () => {
  const state = build([0, 1, 2], [45, 46, 54], { active: 1, current: MARK_X });
  const after = applyMove(state, cellIndex(1, 0));
  eq(after.active, WILDCARD);
  assert.ok(legalMoves(after).every((index) => bigOf(index) !== 0));
  assert.ok(legalMoves(after).some((index) => bigOf(index) === 5));
});

test("自由落子权下不能进入已封盘的大格", () => {
  const owned = build([cellIndex(4, 0), cellIndex(4, 3), cellIndex(4, 6)], [45, 46], {
    active: 1,
    current: MARK_O,
  });
  assert.ok(owned);
  const moves = legalMoves(owned);
  assert.ok(moves.every((index) => bigOf(index) !== 4));
});

test("全盘填满且无大三连时，占领更多大格者获胜", () => {
  const A = [1, 1, 1, 2, 2, 1, 1, 1, 2];
  const B = [2, 2, 2, 1, 1, 2, 2, 2, 1];
  const E = [1, 1, 2, 2, 2, 1, 1, 2, 1];
  const F = [2, 2, 1, 1, 1, 2, 2, 1, 2];
  const plan = [A, A, B, F, F, F, F, E, E];
  const cells = [];
  for (const board of plan) cells.push(...board);
  const state = createState({ cells, active: WILDCARD, current: MARK_O });
  assert.ok(state, "合法满盘应当成功构造");
  eq(state.bigs[0], MARK_X);
  eq(state.bigs[1], MARK_X);
  eq(state.bigs[2], MARK_O);
  eq(state.status, STATUS_WON);
  eq(state.winner, MARK_X);
  eq(legalMoves(state).length, 0);
});

test("同一大格内双方都三连的盘面被判为非法", () => {
  const cells = new Array(81).fill(EMPTY);
  cells[0] = MARK_X;
  cells[1] = MARK_X;
  cells[2] = MARK_X;
  cells[3] = MARK_O;
  cells[4] = MARK_O;
  cells[5] = MARK_O;
  eq(createState({ cells }), null);
});

test("回放：非法步被静默丢弃，绝不抛错", () => {
  const state = createEmptyState();
  const replayed = replay({ cells: state.cells, active: WILDCARD, current: MARK_X }, [0, 40, 40, 999, 3]);
  eq(replayed.moves.length, 2);
  eq(replayed.cells[0], MARK_X);
  eq(replayed.cells[3], MARK_O);
  eq(replay({ cells: state.cells }, []).moves.length, 0);
});

test("求解器：一步杀与零步杀的判定", () => {
  const ready = nearGrandWin();
  eq(canForceWin(ready, MARK_X, 1), true);
  eq(canForceWin(ready, MARK_X, 0), false);
  eq(canForceWin(ready, MARK_O, 3), false);
});

test("1000 步随机游走：不抛错、不卡死、不变式守恒", () => {
  const rng = mulberry32(20261110);
  let state = createEmptyState();
  let steps = 0;
  let restarts = 0;

  while (steps < 1000) {
    if (state.status !== STATUS_PLAYING) {
      eq(legalMoves(state).length, 0);
      state = createEmptyState();
      restarts += 1;
      continue;
    }

    const before = state;
    const moves = legalMoves(state);
    assert.ok(moves.length > 0, "对局中必须始终存在合法落点（严禁死局）");

    const index = moves[Math.floor(rng() * moves.length)];
    assert.ok(isLegal(state, index));
    const next = applyMove(state, index);
    assert.notStrictEqual(next, state, "合法落子必须推进状态");

    eq(before.cells[index], EMPTY, "旧状态绝不能被就地修改");
    eq(before.moves.length + 1, next.moves.length);
    assert.deepEqual(bigResults(next.cells), next.bigs);

    let x = 0;
    let o = 0;
    for (const value of next.cells) {
      if (value === MARK_X) x += 1;
      else if (value === MARK_O) o += 1;
    }
    assert.ok(x === o || x === o + 1, `回合数必须守恒（X=${x}, O=${o}）`);

    if (next.status === STATUS_PLAYING) {
      assert.ok(next.active === WILDCARD || !isClosed(next.bigs, next.cells, next.active));
      if (next.active !== WILDCARD) {
        assert.ok(playableBoards(next).every((big) => big === next.active));
      }
      for (const move of legalMoves(next)) eq(next.cells[move], EMPTY);
    } else {
      assert.ok(next.status === STATUS_WON || next.status === STATUS_DRAW);
    }

    state = next;
    steps += 1;
  }

  assert.ok(restarts >= 1, "1000 步内应当至少完成一局");
});
