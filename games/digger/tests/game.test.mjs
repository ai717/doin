import test from "node:test";
import assert from "node:assert/strict";

import { createGameController } from "../js/game.mjs";
import { LEVELS } from "../js/levels.mjs";

const eq = assert.strictEqual;

test("控制器启动、视图与非法关卡", () => {
  const game = createGameController();
  eq(game.start("nope"), false);
  eq(game.view().state, null);
  eq(game.start("d01"), true);
  const view = game.view();
  eq(view.state.levelId, "d01");
  eq(view.level.id, "d01");
  eq(view.paused, false);
  eq(view.canPump, true);
  eq(view.canMove, true);
  eq(game.levelId, "d01");
  eq(view.state.player.row, -1);
});

test("方向输入经固定步长推进后挖开泥土", () => {
  const game = createGameController();
  game.start("d01");
  eq(game.move("down"), true);
  for (let i = 0; i < 8; i += 1) game.tick(16.7);
  const state = game.view().state;
  assert.ok(state.player.row >= 0);
  eq(state.grid[0][8], 1);
  eq(game.stop("down"), true);
});

test("暂停会冻结状态，恢复后继续推进", () => {
  const game = createGameController();
  game.start("d01");
  game.move("down");
  game.tick(50);
  const before = game.view().state;
  game.pause(true);
  game.tick(2000);
  eq(game.view().state, before);
  eq(game.view().paused, true);
  game.pause(false);
  game.tick(200);
  assert.notEqual(game.view().state, before);
});

test("打气事件进入出站队列并只出站一次", () => {
  const game = createGameController();
  game.start("d01");
  eq(game.firePump(), true);
  const events = game.drainEvents();
  assert.ok(events.length >= 1);
  assert.equal(events[0].type, "pump-miss");
  eq(game.drainEvents().length, 0);
});

test("挖掘事件会被控制器收集", () => {
  const game = createGameController();
  game.start("d01");
  game.move("down");
  for (let i = 0; i < 10; i += 1) game.tick(50);
  const events = game.drainEvents();
  assert.ok(events.some((event) => event.type === "dig"));
});

test("松开方向键后玩家停止移动", () => {
  const game = createGameController();
  game.start("d01");
  game.move("right");
  game.tick(120);
  const col = game.view().state.player.col;
  game.stop("right");
  game.tick(600);
  eq(game.view().state.player.col, col);
});

test("重开重置关卡状态但保留关卡选择", () => {
  const game = createGameController();
  game.start("d03");
  game.move("down");
  game.tick(300);
  const before = game.view().state;
  eq(game.restart(), true);
  const after = game.view().state;
  assert.notEqual(after, before);
  eq(after.levelId, "d03");
  eq(after.player.row, -1);
  eq(after.score, 0);
  eq(after.fossilsGot, 0);
});

test("暂停时拒绝移动与打气", () => {
  const game = createGameController();
  game.start("d01");
  game.pause(true);
  eq(game.move("down"), false);
  eq(game.firePump(), false);
  eq(game.view().state.player.row, -1);
});

test("视图与关卡数据一致", () => {
  const game = createGameController();
  game.start("d20");
  const view = game.view();
  eq(view.state.chapter, LEVELS[19].chapter);
  eq(view.state.monsters.length, LEVELS[19].monsters.length);
  eq(view.state.fossils.length, 3);
});
