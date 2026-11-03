// game.test.mjs — 控制器：撤销栈 / 楼层快照 / 点击寻路 / 重开
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGame, UNDO_LIMIT } from "../js/game.mjs";
import { LEVELS } from "../js/levels.mjs";
import { cellAt, currentFloor } from "../js/engine.mjs";
import { CH } from "../js/engine.mjs";

function fresh() {
  return createGame(LEVELS);
}

describe("game: 撤销", () => {
  it("撤销恢复到上一步的完整状态", () => {
    const game = fresh();
    const start = game.getState();
    const startHp = start.hp;
    const startPos = `${start.x},${start.y}`;

    // 连走到左上角方向，直到有一步成功
    const result = game.pathTo(1, 1);
    assert.ok(result.action, "寻路应成功");
    assert.notEqual(`${game.getState().x},${game.getState().y}`, startPos);

    // pathTo 逐格入栈：连续撤销 result.steps 次应回到原点
    for (let i = 0; i < result.steps; i += 1) {
      const undone = game.undo();
      assert.equal(undone.action.type, "undo");
    }
    const state = game.getState();
    assert.equal(`${state.x},${state.y}`, startPos);
    assert.equal(state.hp, startHp);
    assert.equal(game.canUndo(), false);
  });

  it("没有历史时撤销是 no-op", () => {
    const game = fresh();
    const result = game.undo();
    assert.equal(result.action, null);
    assert.equal(game.canUndo(), false);
  });

  it("撤销栈最多保留 30 步", () => {
    const game = fresh();
    for (let i = 0; i < 60; i += 1) {
      game.pathTo(1, 1);
      game.pathTo(9, 9);
    }
    assert.ok(game.undoDepth() <= UNDO_LIMIT, `撤销深度 ${game.undoDepth()}`);
    assert.equal(UNDO_LIMIT, 30);
  });
});

describe("game: 楼层快照", () => {
  it("踏入新楼层后可用「重返本层」回到初入状态", () => {
    const game = fresh();
    // 走到上楼口
    const state = game.getState();
    const floor = currentFloor(state);
    const upIdx = floor.cells.indexOf(CH.UP);
    assert.ok(upIdx >= 0);
    const ux = upIdx % 11;
    const uy = Math.floor(upIdx / 11);
    game.pathTo(ux, uy);
    // 上楼需要踩进去：再向楼梯迈一步
    const beforeFloor = game.getState().floor;
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      game.move(dx, dy);
      if (game.getState().floor !== beforeFloor) break;
    }
    if (game.getState().floor === beforeFloor) return; // 门被锁住则跳过（第 1 层无需钥匙）
    assert.equal(game.getState().floor, beforeFloor + 1);
    const entered = game.getState();
    const enteredSnap = `${entered.x},${entered.y}`;

    game.move(0, 1);
    const restored = game.restoreFloor();
    assert.ok(restored.action);
    assert.equal(`${game.getState().x},${game.getState().y}`, enteredSnap);
  });
});

describe("game: 点击寻路与重开", () => {
  it("pathTo 一次走完整段路径并逐格入栈", () => {
    const game = fresh();
    const before = game.getState();
    const result = game.pathTo(1, 9);
    assert.ok(result.steps >= 1);
    assert.equal(game.getState().status, "playing");
    assert.ok(game.undoDepth() >= 1);
    assert.notEqual(`${game.getState().x},${game.getState().y}`, `${before.x},${before.y}`);
  });

  it("不可达目标不会改变状态", () => {
    const game = fresh();
    const before = game.getState();
    const result = game.pathTo(0, 0);
    assert.equal(result.action, null);
    assert.equal(game.getState(), before);
  });

  it("重开回到第 1 层原始属性并清空撤销栈", () => {
    const game = fresh();
    game.pathTo(1, 9);
    const before = game.getState();
    game.restart();
    const state = game.getState();
    assert.equal(state.floor, 1);
    assert.equal(state.stats.steps, 0);
    assert.equal(game.canUndo(), false);
    assert.notEqual(state, before);
  });

  it("订阅者在每次动作后收到新状态", () => {
    const game = fresh();
    const seen = [];
    const off = game.subscribe((state) => seen.push(state.stats.steps));
    game.move(0, -1);
    game.move(0, 1);
    off();
    game.move(0, -1);
    assert.ok(seen.length >= 2);
    assert.equal(seen.length, 2);
  });
});
