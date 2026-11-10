import test from "node:test";
import assert from "node:assert/strict";

import {
  COLS, FLOOR, ROWS, WALL, createState, isSolved, restore, snapshot, stateKey, step,
} from "../js/engine.mjs";
import { LEVELS, getLevel } from "../js/levels.mjs";

const eq = assert.strictEqual;

function custom({ player, boxes, goals, walls = [], portals }) {
  const grid = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1 ? "#" : ".")),
  );
  for (const [col, row] of walls) grid[row][col] = "#";
  for (const [col, row] of goals) grid[row][col] = "G";
  for (const [col, row] of boxes) grid[row][col] = "B";
  const [pc, pr] = player;
  grid[pr][pc] = "P";
  return { id: "test", chapter: 1, map: grid.map((row) => row.join("")), portals };
}

test("createState：地图解析、实体与传送门校验", () => {
  const state = createState(getLevel("p01"));
  eq(state.grid.length, ROWS);
  eq(state.grid[0].length, COLS);
  eq(state.player.col, 1);
  eq(state.player.row, 1);
  eq(state.boxes.length, 1);
  eq(state.goals.length, 1);
  eq(state.portals.length, 2);
  eq(state.steps, 0);
  eq(state.solved, false);

  eq(createState(null), null);
  eq(createState({ id: "x", map: ["###"], portals: [] }), null);
  eq(createState({ id: "x", map: Array.from({ length: ROWS }, () => "############"), portals: [] }), null);

  const noPair = custom({
    player: [2, 2], boxes: [[4, 2]], goals: [[8, 2]],
    walls: [[6, 2]],
    portals: [{ pair: "A", color: "blue", col: 5, row: 2, side: "right" }],
  });
  eq(createState(noPair), null);

  const badWall = custom({
    player: [2, 2], boxes: [[4, 2]], goals: [[8, 2]],
    portals: [
      { pair: "A", color: "blue", col: 5, row: 2, side: "right" },
      { pair: "A", color: "orange", col: 8, row: 2, side: "right" },
    ],
  });
  eq(createState(badWall), null);
});

test("基础移动 / 推箱 / 撞墙，步数只在有效移动时增加", () => {
  let state = createState(getLevel("p01"));
  const blocked = step(state, "up");
  eq(blocked.lastMove.moved, false);
  eq(blocked.steps, 0);

  state = step(state, "right");
  eq(state.player.col, 2);
  eq(state.steps, 1);

  state = step(state, "right");
  eq(state.player.col, 3);
  state = step(state, "right");
  eq(state.boxes[0].col, 5);
  eq(state.player.col, 4);
  eq(state.lastMove.type, "push");
  eq(state.steps, 3);
});

test("箱子穿门后落在配对门口，人留在原地（方案 A）", () => {
  let state = createState(getLevel("p01"));
  for (let i = 0; i < 5; i += 1) state = step(state, "right");
  eq(state.solved, true);
  eq(state.steps, 5);
  eq(state.boxes[0].col, 9);
  eq(state.boxes[0].row, 1);
  eq(state.player.col, 5);
  eq(state.player.row, 1);
  eq(state.lastMove.type, "portal-box");
});

test("90 度传送门：向右推进，向上穿出", () => {
  let state = createState(getLevel("p05"));
  for (let i = 0; i < 7; i += 1) state = step(state, "right");
  eq(state.solved, true);
  eq(state.steps, 7);
  eq(state.boxes[0].col, 6);
  eq(state.boxes[0].row, 8);
  eq(state.lastMove.type, "portal-box");
});

test("玩家亲自穿门，不推箱时人进入配对门所在的格", () => {
  let state = createState(getLevel("p13"));
  for (let i = 0; i < 4; i += 1) state = step(state, "right");
  eq(state.player.col, 7);
  eq(state.player.row, 4);
  eq(state.steps, 4);
  eq(state.solved, false);
  eq(state.lastMove.type, "portal");
});

test("出口被占时严格阻抗，入口门硬化", () => {
  const level = custom({
    player: [4, 4],
    boxes: [[5, 4], [8, 4]],
    goals: [[9, 4], [9, 5]],
    walls: [[6, 4], [7, 4]],
    portals: [
      { pair: "A", color: "blue", col: 5, row: 4, side: "right" },
      { pair: "A", color: "orange", col: 8, row: 4, side: "left" },
    ],
  });
  let state = createState(level);
  assert.ok(state);
  state = step(state, "right");
  eq(state.steps, 0);
  eq(state.lastMove.moved, false);
  eq(state.lastMove.type, "impedance");
  eq(state.boxes[0].col, 5);
});

test("快照与恢复可还原人物、箱子与步数", () => {
  let state = createState(getLevel("p01"));
  const start = snapshot(state);
  state = step(state, "right");
  state = step(state, "right");
  eq(state.steps, 2);
  const restored = restore(state, start);
  eq(restored.player.col, 1);
  eq(restored.steps, 0);
  eq(restored.boxes[0].col, 4);
  eq(restored.solved, false);
});

test("isSolved 与 stateKey 对箱子顺序不敏感", () => {
  const state = createState(getLevel("p09"));
  eq(isSolved(state), false);
  const keyA = stateKey({
    player: state.player,
    boxes: [{ col: 3, row: 6 }, { col: 3, row: 2 }],
  });
  const keyB = stateKey({
    player: state.player,
    boxes: [{ col: 3, row: 2 }, { col: 3, row: 6 }],
  });
  eq(keyA, keyB);
});

test("1000 步随机游走：不抛错、实体不穿墙、箱子不重叠", () => {
  let seed = 0x51ed270b;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const dirs = ["up", "down", "left", "right"];
  let state = createState(LEVELS[19]);
  let moves = 0;
  assert.doesNotThrow(() => {
    for (let i = 0; i < 1000; i += 1) {
      state = step(state, dirs[Math.floor(random() * 4)]);
      if (state.lastMove?.moved) moves += 1;
      assert.ok(state.player.col >= 0 && state.player.col < COLS);
      assert.ok(state.player.row >= 0 && state.player.row < ROWS);
      eq(state.grid[state.player.row][state.player.col], FLOOR);
      const seen = new Set();
      for (const box of state.boxes) {
        assert.ok(box.col >= 0 && box.col < COLS && box.row >= 0 && box.row < ROWS);
        eq(state.grid[box.row][box.col], FLOOR);
        const id = `${box.col},${box.row}`;
        assert.ok(!seen.has(id), "两个箱子重叠");
        seen.add(id);
        assert.ok(!(box.col === state.player.col && box.row === state.player.row), "箱子压在人物身上");
      }
      assert.ok(state.steps >= 0 && Number.isFinite(state.steps));
      eq(state.portals.length % 2, 0);
      if (state.solved) state = createState(LEVELS[19]);
    }
  });
  assert.ok(moves > 50, `随机游走有效移动过少（${moves}）`);
});

test("相同操作序列完全可复现", () => {
  const script = () => {
    let state = createState(getLevel("p17"));
    const dirs = ["right", "down", "right", "up", "left", "down"];
    for (let i = 0; i < 240; i += 1) state = step(state, dirs[i % dirs.length]);
    return JSON.stringify({
      player: state.player,
      boxes: state.boxes,
      steps: state.steps,
      solved: state.solved,
    });
  };
  eq(script(), script());
});
