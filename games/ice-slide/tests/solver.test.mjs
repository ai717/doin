// filepath: games/ice-slide/tests/solver.test.mjs
// 求解器测试：手验 par（1/2/4 步）、解可回放且步数自洽、无解关卡 BFS 耗尽、
// 角落死局剪枝不过度（贴墙箱仍可沿墙滑行）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLevel, slide, idx } from "../js/engine.mjs";
import { solve, par, hint, cornerDeadlockCells } from "../js/solver.mjs";

// S1：一推通关——箱顺右墙滑至灯标
const S1 = ["#######", "#@$  .#", "#######"];
// S2：两步——先下滑就位，再右推箱入死角灯标
const S2 = ["#########", "#   @   #", "#       #", "#     $.#", "#########"];
// S3：四步——右推箱贴墙停 (5,2)，上-右就位到箱正上，下推入灯标
const S3 = ["#######", "#     #", "#@$   #", "#    .#", "#######"];
// U1：箱入左上角即死，灯标在 (1,2) 永不可达
const U1 = ["#####", "#@$ #", "#.  #", "#####"];
// U2：双箱单灯标——不可能全入位
const U2 = ["#######", "#@* $.#", "#   $  #", "#######"];

function replayWin(rows, dirs) {
  let st = parseLevel(rows);
  for (const d of dirs) {
    const nx = slide(st, d);
    assert.ok(nx, `方向 ${d} 应合法可执行`);
    st = nx;
  }
  assert.ok(st.won, "解序列必须导向通关");
  return st;
}

test("solve: 一推通关，par = 1", () => {
  const r = solve(parseLevel(S1));
  assert.equal(r.solvable, true);
  assert.equal(r.optimal, 1);
  assert.deepEqual(r.dirs, [1]); // 右
  assert.equal(par(parseLevel(S1)), 1);
  replayWin(S1, r.dirs);
});

test("solve: 两步通关，par = 2（先就位再推）", () => {
  const r = solve(parseLevel(S2));
  assert.equal(r.solvable, true);
  assert.equal(r.optimal, 2);
  assert.deepEqual(r.dirs, [2, 1]); // 下、右
  replayWin(S2, r.dirs);
});

test("solve: 沿墙停箱，par = 4", () => {
  const r = solve(parseLevel(S3));
  assert.equal(r.solvable, true);
  assert.equal(r.optimal, 4);
  assert.deepEqual(r.dirs, [1, 0, 1, 2]); // 右推、上、右、下推
  replayWin(S3, r.dirs);
});

test("solve: 解可回放，且实际步数 == optimal（自洽性）", () => {
  for (const rows of [S1, S2, S3]) {
    const level = parseLevel(rows);
    const r = solve(level);
    assert.equal(r.solvable, true);
    const end = replayWin(rows, r.dirs);
    assert.equal(end.moves, r.optimal, "回放步数必须等于最优步数");
  }
});

test("solve: 无解关卡 BFS 耗尽（角落死箱 / 箱数多于灯标）", () => {
  for (const rows of [U1, U2]) {
    const r = solve(parseLevel(rows));
    assert.equal(r.solvable, false, "应判定无解");
    assert.equal(r.optimal, null);
    assert.equal(r.dirs, null);
  }
});

test("cornerDeadlockCells: 只标非灯标死角，灯标格永不标", () => {
  const level = parseLevel(S3);
  const corner = cornerDeadlockCells(level);
  // (5,3) 是右下角但是灯标 -> 不能标
  assert.equal(corner[idx(level, 5, 3)], 0);
  // (1,1) 非灯标死角 -> 标
  assert.equal(corner[idx(level, 1, 1)], 1);
  // (5,2) 只贴一面墙，箱可沿墙滑行 -> 不能标（剪枝不过度）
  assert.equal(corner[idx(level, 5, 2)], 0);
});

test("solve: 已通关局面 par = 0", () => {
  const level = parseLevel(["#####", "#@* #", "#####"]);
  const r = solve(level);
  assert.equal(r.solvable, true);
  assert.equal(r.optimal, 0);
  assert.deepEqual(r.dirs, []);
});

test("hint: 初始局提示 = 最优序列首方向", () => {
  const h = hint(parseLevel(S2));
  assert.equal(h.won, false);
  assert.equal(h.dir, 2); // 下
  assert.equal(h.optimal, 2);
  assert.deepEqual(h.dirs, [2, 1]);
});

test("hint: 游戏中局（推完第一步）给出剩余最优 3 步", () => {
  const m = parseLevel(S3);
  const after = slide(m, 1); // 右推：箱 (5,2)，人 (4,2)
  assert.equal(after.last.boxTo, idx(m, 5, 2));
  const h = hint(after);
  assert.equal(h.won, false);
  assert.equal(h.dir, 0); // 上（就位列正上方再下推）
  assert.equal(h.optimal, 3);
  assert.deepEqual(h.dirs, [0, 1, 2]);
  // 提示序列可回放通关
  replayWin(S3, [1, ...h.dirs]);
});

test("hint: 死局态（箱入死角）明确返回无解，供 UI 提示撤销", () => {
  const m = parseLevel(U1);
  const dead = slide(m, 1); // 箱被推入右上角 (3,1)，灯标在 (1,2) 永不可达
  assert.equal(dead.box[idx(m, 3, 1)], 1);
  const h = hint(dead);
  assert.equal(h.won, false);
  assert.equal(h.dir, null);
  assert.equal(h.solvable, false);
});

test("hint: 已通关态 won = true", () => {
  const won = slide(parseLevel(S1), 1);
  const h = hint(won);
  assert.equal(h.won, true);
  assert.equal(h.dir, null);
  assert.equal(h.optimal, 0);
});

test("hint: 与 solve 口径一致（提示序列即最优解）", () => {
  for (const rows of [S1, S2, S3]) {
    const level = parseLevel(rows);
    const h = hint(level);
    const r = solve(level);
    assert.equal(r.solvable, true);
    assert.notEqual(h.dir, null);
    assert.deepEqual(h.dirs, r.dirs);
    assert.equal(h.optimal, r.optimal);
  }
});
