// filepath: games/klotski/tests/engine.test.mjs
// 规则层测试：node --test games/klotski/tests/
import test from "node:test";
import assert from "node:assert/strict";

import {
  COLS,
  ROWS,
  EXIT_R,
  EXIT_C,
  KIND,
  mulberry32,
  textureSeeds,
  parseGrid,
  occupancy,
  createState,
  cloneState,
  canMove,
  maxSlide,
  legalMoves,
  anyLegalMove,
  applyMove,
  applySlide,
  undo,
  goalPiece,
  isSolved,
  snapshot,
  restore,
} from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";

const CLASSIC = ["ACCB", "ACCB", "DGGE", "DabE", "c..d"];
const SOLVED = ["A..B", "A..B", "D..E", "DCCE", "aCCb"];

function countKinds(pieces) {
  const out = {};
  for (const piece of pieces) out[piece.kind] = (out[piece.kind] || 0) + 1;
  return out;
}

function assertSane(state) {
  const hits = new Array(ROWS * COLS).fill(0);
  for (const piece of state.pieces) {
    assert.ok(piece.r >= 0 && piece.c >= 0, "方块不得越出左上边界");
    assert.ok(piece.r + piece.h <= ROWS, "方块不得越出下边界");
    assert.ok(piece.c + piece.w <= COLS, "方块不得越出右边界");
    for (let dr = 0; dr < piece.h; dr++) {
      for (let dc = 0; dc < piece.w; dc++) {
        hits[(piece.r + dr) * COLS + (piece.c + dc)] += 1;
      }
    }
  }
  assert.ok(hits.every((n) => n <= 1), "任意两格不得重叠");
}

test("parseGrid 正确识别经典布局的 10 个方块与四类形状", () => {
  const pieces = parseGrid(CLASSIC);
  assert.equal(pieces.length, 10);
  const kinds = countKinds(pieces);
  assert.equal(kinds[KIND.CAOCAO], 1);
  assert.equal(kinds[KIND.GUANYU], 1);
  assert.equal(kinds[KIND.GENERAL], 4);
  assert.equal(kinds[KIND.SOLDIER], 4);

  const cells = pieces.reduce((sum, piece) => sum + piece.h * piece.w, 0);
  assert.equal(cells, 18, "4×5 棋盘留 2 个空格");
});

test("occupancy 覆盖 18 格且空格恰好 2 个", () => {
  const state = createState({ id: "t", par: 1, grid: CLASSIC });
  const grid = occupancy(state);
  assert.equal(grid.length, ROWS * COLS);
  assert.equal(grid.filter((cell) => cell === null).length, 2);
  assert.equal(grid.filter((cell) => cell !== null).length, 18);
});

test("mulberry32 同 seed 完全可复现，不同 seed 不同", () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  const seqA = Array.from({ length: 6 }, () => a());
  const seqB = Array.from({ length: 6 }, () => b());
  const seqC = Array.from({ length: 6 }, () => c());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  for (const value of seqA) {
    assert.ok(value >= 0 && value < 1, "PRNG 输出必须落在 [0,1)");
  }
});

test("textureSeeds 对同一关卡 id 稳定", () => {
  const first = textureSeeds("l7", 5);
  const second = textureSeeds("l7", 5);
  assert.deepEqual(first, second);
  assert.equal(first.length, 5);
  assert.ok(first.every((value) => Number.isInteger(value) && value >= 0));
});

test("canMove / applyMove：合法即执行，非法返回 null 且不改原状态", () => {
  const base = createState({ id: "t", par: 1, grid: CLASSIC });
  // 曹操 C 上方无空位，不能上移
  assert.equal(canMove(base, "C", "up"), false);
  assert.equal(applyMove(base, "C", "up"), null);
  assert.equal(base.moves, 0, "非法操作不得改变原状态");

  // 底部小兵 c 在 (4,0)，右边是空格 (4,1)，可以右移
  assert.equal(canMove(base, "c", "right"), true);
  const moved = applyMove(base, "c", "right");
  assert.ok(moved, "合法操作必须执行");
  assert.equal(moved.moves, 1);
  assert.equal(moved.history.length, 1);
  assert.equal(base.moves, 0, "状态不可变：原 state 保持不动");
  assertSane(moved);
});

test("applySlide 连滑多格按格计步；半途受阻时走到能走的位置", () => {
  const base = createState({ id: "t", par: 1, grid: CLASSIC });
  // c 在 (4,0)，右侧 (4,1) (4,2) 均空，可连滑 2 格
  assert.equal(maxSlide(base, "c", "right"), 2);
  const slid = applySlide(base, "c", "right", 2);
  assert.ok(slid);
  assert.equal(slid.moves, 2);
  assert.equal(slid.pieces.find((piece) => piece.id === "c").c, 2);

  // 请求 5 格超出可滑动范围，应返回能走到的最远处而不是 null
  const partial = applySlide(base, "c", "right", 5);
  assert.ok(partial, "受阻时返回已走到的中间状态");
  assert.equal(partial.moves, 2);
  assert.equal(partial.pieces.find((piece) => piece.id === "c").c, 2);
});

test("undo 完整回滚位置与步数；空历史返回 null", () => {
  const base = createState({ id: "t", par: 1, grid: CLASSIC });
  assert.equal(undo(base), null, "空历史不可撤销");
  const moved = applySlide(base, "c", "right", 2);
  const back = undo(moved);
  assert.ok(back);
  assert.equal(back.moves, 1);
  const back2 = undo(back);
  assert.equal(back2.moves, 0);
  assert.deepEqual(
    back2.pieces.map((piece) => [piece.id, piece.r, piece.c]),
    base.pieces.map((piece) => [piece.id, piece.r, piece.c])
  );
});

test("isSolved：曹操到达 (3,1) 出口位才算过关", () => {
  const start = createState({ id: "t", par: 1, grid: CLASSIC });
  assert.equal(isSolved(start), false);
  const done = createState({ id: "t", par: 1, grid: SOLVED });
  const goal = goalPiece(done);
  assert.equal(goal.kind, KIND.CAOCAO);
  assert.equal(goal.r, EXIT_R);
  assert.equal(goal.c, EXIT_C);
  assert.equal(isSolved(done), true);
});

test("snapshot / restore 往返一致；损坏快照回退到初始局面", () => {
  const level = { id: "t", par: 1, grid: CLASSIC };
  const base = createState(level);
  const moved = applySlide(base, "c", "right", 2);
  const restored = restore(level, snapshot(moved));
  assert.equal(restored.moves, 2);
  assert.deepEqual(
    restored.pieces.map((piece) => [piece.id, piece.r, piece.c]),
    moved.pieces.map((piece) => [piece.id, piece.r, piece.c])
  );

  assert.deepEqual(restore(level, null).pieces, base.pieces);
  assert.deepEqual(restore(level, { levelId: "other" }).pieces, base.pieces);
  // 坐标越界
  assert.deepEqual(
    restore(level, { levelId: "t", moves: 3, pieces: [{ id: "c", r: 9, c: 9 }] }).pieces,
    base.pieces
  );
  // 制造重叠：把 a 挪到 c 的位置
  const overlap = {
    levelId: "t",
    moves: 0,
    pieces: base.pieces.map((piece) => ({ id: piece.id, r: piece.r, c: piece.c })),
  };
  overlap.pieces.find((piece) => piece.id === "a").r = 4;
  overlap.pieces.find((piece) => piece.id === "a").c = 0;
  assert.deepEqual(restore(level, overlap).pieces, base.pieces, "重叠快照必须丢弃");
});

test("cloneState 是深拷贝，改动副本不影响原状态", () => {
  const base = createState({ id: "t", par: 1, grid: CLASSIC });
  const copy = cloneState(base);
  copy.pieces[0].r = 99;
  copy.history.push({ id: "x" });
  assert.notEqual(base.pieces[0].r, 99);
  assert.equal(base.history.length, 0);
});

test("全部 12 关：标准 10 块、两个空格、开局有路、布局无重叠", () => {
  for (const level of LEVELS) {
    const state = createState(level);
    assert.equal(state.pieces.length, 10, `${level.id} 应为标准 10 块`);
    const kinds = countKinds(state.pieces);
    assert.equal(kinds[KIND.CAOCAO], 1, `${level.id} 缺曹操`);
    assert.equal(kinds[KIND.GUANYU], 1, `${level.id} 缺横刀（1×2）`);
    assert.equal(kinds[KIND.GENERAL], 4, `${level.id} 竖块数量不对`);
    assert.equal(kinds[KIND.SOLDIER], 4, `${level.id} 小兵数量不对`);

    const grid = occupancy(state);
    assert.equal(grid.filter((cell) => cell === null).length, 2, `${level.id} 应恰好留 2 个空格`);

    assert.ok(level.par > 0 && Number.isInteger(level.par), `${level.id} 的 par 非法`);
    assert.equal(anyLegalMove(state), true, `${level.id} 开局无路可走`);
    assertSane(state);
  }
});

test("par 随关卡严格递增（难度曲线单调）", () => {
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].par > LEVELS[i - 1].par, `${LEVELS[i].id} 的 par 未高于上一关`);
  }
});

/** 与形状同构的局面折叠成同一个 key：同形状的块互换不算新局面 */
function canonKey(state) {
  const groups = new Map();
  for (const piece of state.pieces) {
    const shape = `${piece.h}x${piece.w}`;
    if (!groups.has(shape)) groups.set(shape, []);
    groups.get(shape).push(piece);
  }
  const parts = [];
  for (const [shape, list] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    list.sort((a, b) => a.r - b.r || a.c - b.c);
    list.forEach((piece, index) => parts.push(`${shape}#${index}:${piece.r},${piece.c}`));
  }
  return parts.join("|");
}

/** 用引擎自身的规则做 BFS，返回到达出口的最少步数；超出 maxDepth 返回 -1 */
function bfsOptimal(level, maxDepth) {
  const start = createState(level);
  if (isSolved(start)) return 0;
  const seen = new Set([canonKey(start)]);
  let frontier = [start];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const current of frontier) {
      for (const piece of current.pieces) {
        for (const dir of ["up", "down", "left", "right"]) {
          const moved = applyMove(current, piece.id, dir);
          if (!moved) continue;
          const key = canonKey(moved);
          if (seen.has(key)) continue;
          seen.add(key);
          if (isSolved(moved)) return depth;
          next.push(moved);
        }
      }
    }
    frontier = next;
    if (!frontier.length) return -1;
  }
  return -1;
}

test("前四关 par 与引擎 BFS 实测最优步数一致（防假 par / 防死局）", () => {
  assert.equal(bfsOptimal(LEVELS[0], 12), LEVELS[0].par);
  assert.equal(bfsOptimal(LEVELS[1], 18), LEVELS[1].par);
  assert.equal(bfsOptimal(LEVELS[2], 26), LEVELS[2].par);
  assert.equal(bfsOptimal(LEVELS[3], 30), LEVELS[3].par);
});

test("随机游走 3000 步：合法走法永不报错，局面始终自洽（合法操作铁律）", () => {
  const rand = mulberry32(20260908);
  let state = createState(LEVELS[11]);
  for (let step = 0; step < 3000; step++) {
    const options = [];
    for (const piece of state.pieces) {
      for (const dir of legalMoves(state, piece.id)) options.push([piece.id, dir]);
    }
    assert.ok(options.length > 0, "任何局面都必须至少有一条合法走法");
    const [id, dir] = options[Math.floor(rand() * options.length) % options.length];
    const next = applyMove(state, id, dir);
    assert.ok(next, `合法走法被拒绝：${id} ${dir}`);
    state = next;
    if (step % 37 === 0) assertSane(state);
    if (isSolved(state)) state = createState(LEVELS[11]);
  }
  assertSane(state);
});
