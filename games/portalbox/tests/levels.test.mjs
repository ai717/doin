import test from "node:test";
import assert from "node:assert/strict";

import { COLS, ROWS } from "../js/engine.mjs";
import { CHAPTERS, LEVELS, LEVEL_COUNT, getLevel, nextLevel } from "../js/levels.mjs";
import { replay, solve } from "../js/solver.mjs";

const eq = assert.strictEqual;
let solutions = null;

function allSolutions() {
  if (!solutions) {
    solutions = LEVELS.map((level) => ({ level, result: solve(level, { limit: 900000 }) }));
  }
  return solutions;
}

test("20 关 / 5 章 / 每章 4 关", () => {
  eq(LEVEL_COUNT, 20);
  eq(LEVELS.length, 20);
  eq(CHAPTERS.length, 5);
  for (let chapter = 1; chapter <= 5; chapter += 1) {
    eq(LEVELS.filter((level) => level.chapter === chapter).length, 4);
  }
  LEVELS.forEach((level, index) => {
    eq(level.index, index);
    eq(level.id, `p${String(index + 1).padStart(2, "0")}`);
    assert.ok(level.optimal > 0, `${level.id} 缺少最优步数`);
    assert.ok(level.map.length === ROWS);
    assert.ok(level.map.every((row) => row.length === COLS));
  });
});

test("地图边界、实体与传送门布局合法", () => {
  for (const level of LEVELS) {
    const grid = level.map.map((row) => row.split(""));
    for (let col = 0; col < COLS; col += 1) {
      eq(grid[0][col], "#", `${level.id} 顶边未封闭`);
      eq(grid[ROWS - 1][col], "#", `${level.id} 底边未封闭`);
    }
    for (let row = 0; row < ROWS; row += 1) {
      eq(grid[row][0], "#", `${level.id} 左边未封闭`);
      eq(grid[row][COLS - 1], "#", `${level.id} 右边未封闭`);
    }
    const flat = grid.flat();
    eq(flat.filter((cell) => cell === "P").length, 1, `${level.id} 玩家数量异常`);
    const boxes = flat.filter((cell) => cell === "B").length;
    const goals = flat.filter((cell) => cell === "G").length;
    eq(boxes, goals, `${level.id} 箱子与目标数量不一致`);
    assert.ok(boxes >= 1);

    const pairs = new Map();
    for (const portal of level.portals) {
      assert.ok(["up", "down", "left", "right"].includes(portal.side));
      eq(grid[portal.row][portal.col] === "#", false, `${level.id} 传送门落在墙内`);
      const delta = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[portal.side];
      eq(grid[portal.row + delta[1]][portal.col + delta[0]], "#", `${level.id} 传送门背面不是墙`);
      pairs.set(portal.pair, (pairs.get(portal.pair) ?? 0) + 1);
    }
    eq(pairs.get("A"), 2, `${level.id} 蓝橙门对不完整`);
    if (pairs.has("B")) eq(pairs.get("B"), 2, `${level.id} 紫绿门对不完整`);
    assert.ok(pairs.has("A"), `${level.id} 缺少主门对`);
  }
});

test("全部 20 关经 BFS 验证可解，且最优步数与数据一致", () => {
  for (const { level, result } of allSolutions()) {
    assert.ok(result.solvable, `${level.id} 不可解（${result.reason}）`);
    eq(result.optimal, level.optimal, `${level.id} 最优步数不一致`);
    assert.ok(result.moves.length === result.optimal);
    const finalState = replay(level, result.moves);
    eq(finalState.solved, true, `${level.id} 回放未通关`);
  }
});

test("第一卷为直线虫洞，第二卷出现 90 度折射", () => {
  const p05 = getLevel("p05");
  eq(p05.chapter, 2);
  const solution = solve(p05);
  eq(solution.optimal, 7);
  const finalState = replay(p05, solution.moves);
  eq(finalState.boxes[0].col, 6);
  eq(finalState.boxes[0].row, 8);
});

test("玩家亲自穿门可以进入上锁密室", () => {
  const p13 = getLevel("p13");
  const solution = solve(p13);
  eq(solution.optimal, 10);
  const finalState = replay(p13, solution.moves);
  eq(finalState.solved, true);
  eq(finalState.boxes[0].col, 9);
  eq(finalState.boxes[0].row, 7);
});

test("getLevel / nextLevel 链路", () => {
  eq(getLevel("p01"), LEVELS[0]);
  eq(getLevel("p20"), LEVELS[19]);
  eq(getLevel("nope"), null);
  eq(nextLevel("p01"), LEVELS[1]);
  eq(nextLevel("p19"), LEVELS[19]);
  eq(nextLevel("p20"), null);
  eq(nextLevel("nope"), null);
  for (let index = 0; index < 19; index += 1) {
    eq(nextLevel(LEVELS[index].id), LEVELS[index + 1]);
  }
});
