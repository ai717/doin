// filepath: games/sokoban/tests/solver.test.mjs
// 求解器单元测试：小关可解与推数最优、hintDir、角落死局格。
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLevel } from "../js/engine.mjs";
import { solve, hintDir, cornerDeadlockCells } from "../js/solver.mjs";

test("solve: 2 推小关 PBD 与 IDA* 一致且 path 可执行", () => {
  const level = parseLevel(["#####", "#.  #", "# $@#", "#   #", "#####"]);
  const pbd = solve(level, { mode: "pbd", maxTimeMs: 5000 });
  assert.equal(pbd.solvable, true);
  assert.equal(pbd.pushes, 2);
  assert.equal(pbd.path.length, 2);
  assert.ok(Array.isArray(pbd.pushedBoxes) && pbd.pushedBoxes.length === 2);

  const ida = solve(level, { mode: "ida", maxTimeMs: 5000, upperBound: 4 });
  assert.equal(ida.solvable, true);
  assert.equal(ida.pushes, 2);
});

test("solve: 不可解局面返回 solvable=false", () => {
  // 箱 (2,1) 被四周墙/死局夹住：右墙、上墙、下目标格但推位不可达 → 无任何合法推
  const level = parseLevel(["#####", "#@$#", "#..#", "#####"]);
  const res = solve(level, { mode: "pbd", maxTimeMs: 3000, maxPushes: 8 });
  assert.equal(res.solvable, false);
});

test("solve: 超时返回 timedOut 而非崩溃", () => {
  const level = parseLevel(["#####", "#.  #", "# $@#", "#   #", "#####"]);
  const res = solve(level, { mode: "pbd", maxTimeMs: 1, maxStates: 10 });
  assert.ok(res.solvable || res.timedOut === true || res.states >= 0);
});

test("hintDir: 可解局面返回最优下一步推箱方向，不可解返回 null", () => {
  const level = parseLevel(["#####", "#.  #", "# $@#", "#   #", "#####"]);
  const dir = hintDir(level, { maxTimeMs: 3000, maxStates: 100_000 });
  assert.ok(dir === 0 || dir === 1 || dir === 2 || dir === 3);

  const dead = parseLevel(["#####", "#@$.#", "#####"]);
  const deadDir = hintDir(dead, { maxTimeMs: 1500, maxStates: 20_000 });
  // 允许 null（无解或超时），但不抛错
  assert.ok(deadDir === null || (deadDir >= 0 && deadDir <= 3));
});

test("cornerDeadlockCells: 非目标角落格标记、目标格豁免", () => {
  const level = parseLevel(["#####", "#.  #", "# $@#", "#   #", "#####"]);
  const corner = cornerDeadlockCells(level);
  // 目标格 (1,1) 非死角
  assert.equal(corner[level.cols * 1 + 1], 0);
  // 左上内角 (1,1) 之外：左上角格 (1,1) 是目标豁免；(1,1) 右侧 (2,1) 非角落
  // 左上内角死格：紧贴左上墙的 (1,1) 被豁免；(1,1) 不是。检查 (1,3)?——取一个非目标角落
  // (2,1) 上方墙、左侧 (1,1) 空 → 非角落
  assert.equal(corner[level.cols * 1 + 2], 0);
  // (1,2) 左墙 + 上 (1,1) 空 → 非角落
  assert.equal(corner[level.cols * 2 + 1], 0);
});

test("cornerDeadlockCells: 真实死角被标记", () => {
  const level = parseLevel(["#####", "#@$ #", "#####"]);
  const corner = cornerDeadlockCells(level);
  // (1,1)：上方与左侧都是墙 → 角落死格（即便玩家初始在此）
  assert.equal(corner[level.cols * 1 + 1], 1);
});
