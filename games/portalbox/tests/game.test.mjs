import test from "node:test";
import assert from "node:assert/strict";

import { createGameController } from "../js/game.mjs";

const eq = assert.strictEqual;

test("控制器启动、视图与非法关卡", () => {
  const game = createGameController();
  eq(game.start("nope"), false);
  eq(game.view().state, null);
  eq(game.start("p01"), true);
  const view = game.view();
  eq(view.state.levelId, "p01");
  eq(view.level.id, "p01");
  eq(view.canMove, true);
  eq(view.canUndo, false);
  eq(view.undoDepth, 0);
  eq(view.optimal, 5);
  eq(game.levelId, "p01");
});

test("撞墙不增加步数，也不进入撤销栈", () => {
  const game = createGameController();
  game.start("p01");
  game.move("up");
  const view = game.view();
  eq(view.state.steps, 0);
  eq(view.state.lastMove.moved, false);
  eq(view.canUndo, false);
  assert.ok(game.drainEvents().some((event) => event.type === "blocked"));
});

test("推箱事件进入出站队列", () => {
  const game = createGameController();
  game.start("p01");
  game.move("right");
  game.move("right");
  game.move("right");
  const events = game.drainEvents();
  assert.ok(events.some((event) => event.type === "push"));
  eq(game.drainEvents().length, 0);
});

test("五次右推通关并产生三星结算", () => {
  const game = createGameController();
  game.start("p01");
  for (let i = 0; i < 5; i += 1) eq(game.move("right"), true);
  const view = game.view();
  eq(view.state.solved, true);
  eq(view.result.outcome, "clear");
  eq(view.result.steps, 5);
  eq(view.result.optimal, 5);
  eq(view.result.stars, 3);
  assert.ok(view.result.score > 0);
  assert.ok(game.drainEvents().some((event) => event.type === "solved"));
});

test("无限撤销可逐步退回起点，通关后也能撤销", () => {
  const game = createGameController();
  game.start("p01");
  for (let i = 0; i < 5; i += 1) game.move("right");
  eq(game.view().result.stars, 3);
  for (let i = 4; i >= 0; i -= 1) {
    eq(game.undo(), true);
    eq(game.view().state.steps, i);
    eq(game.view().result, null);
  }
  eq(game.view().state.player.col, 1);
  eq(game.view().state.boxes[0].col, 4);
  eq(game.undo(), false);
});

test("重置立即回到初始盘面", () => {
  const game = createGameController();
  game.start("p01");
  game.move("right");
  game.move("right");
  eq(game.view().state.steps, 2);
  eq(game.reset(), true);
  eq(game.view().state.steps, 0);
  eq(game.view().state.player.col, 1);
  eq(game.view().canUndo, false);
});

test("通关后继续移动为 no-op", () => {
  const game = createGameController();
  game.start("p01");
  for (let i = 0; i < 5; i += 1) game.move("right");
  eq(game.move("left"), false);
  eq(game.view().state.steps, 5);
});

test("切换关卡会重置撤销栈", () => {
  const game = createGameController();
  game.start("p01");
  game.move("right");
  eq(game.view().canUndo, true);
  game.start("p02");
  eq(game.view().canUndo, false);
  eq(game.view().state.steps, 0);
  eq(game.view().state.levelId, "p02");
});
