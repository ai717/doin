import test from "node:test";
import assert from "node:assert/strict";

import { createGameController } from "../js/game.mjs";
import { LEVELS, getLevel } from "../js/levels.mjs";
import { STATUS_AIM, STATUS_FLIGHT, STATUS_WON } from "../js/engine.mjs";

const eq = assert.strictEqual;

function drive(game, maxTicks = 4000) {
  let ticks = 0;
  while (ticks < maxTicks) {
    const state = game.view().state;
    if (state.status !== STATUS_FLIGHT && state.status !== "fever") break;
    game.tick(16.7);
    ticks += 1;
  }
  return game.view();
}

test("开局即瞄准态，瞄准可微调、发射进入飞行态", () => {
  const game = createGameController();
  eq(game.start("p01"), true);
  const view = game.view();
  eq(view.state.status, STATUS_AIM);
  eq(view.canFire, true);
  eq(view.state.ballsLeft, 10);

  eq(game.aim(35), true);
  eq(game.view().state.aim, 35);
  eq(game.nudge(0.5), true);
  eq(game.view().state.aim, 35.5);
  eq(game.aim(999), true);
  eq(game.view().state.aim, 80);

  eq(game.shoot(), true);
  eq(game.view().state.status, STATUS_FLIGHT);
  eq(game.view().state.ballsLeft, 9);
  eq(game.view().canFire, false);
  eq(game.shoot(), false, "飞行中不可再次发射");
  eq(game.aim(0), false, "飞行中不可改瞄准角度");
});

test("暂停后状态冻结，恢复后继续推进", () => {
  const game = createGameController();
  game.start("p01");
  game.shoot();
  const before = game.view().state;
  game.pause(true);
  eq(game.view().paused, true);
  game.tick(500);
  eq(game.view().state, before, "暂停期间状态引用必须保持不变");
  eq(game.view().canFire, false);
  game.pause(false);
  game.tick(16.7);
  assert.notStrictEqual(game.view().state, before, "恢复后物理继续推进");
});

test("快进只在飞行/狂喜态生效", () => {
  const game = createGameController();
  game.start("p01");
  game.setFast(true);
  eq(game.view().fastForward, false, "瞄准态不允许快进");
  game.shoot();
  game.setFast(true);
  eq(game.view().fastForward, true);
  game.setFast(false);
  eq(game.view().fastForward, false);
});

test("重开与切关：状态与弹珠数重置", () => {
  const game = createGameController();
  game.start("p01");
  game.aim(20);
  game.shoot();
  game.restart();
  const restarted = game.view();
  eq(restarted.state.status, STATUS_AIM);
  eq(restarted.state.ballsLeft, 10);
  eq(restarted.state.score, 0);
  eq(restarted.state.aim, 0);

  eq(game.start("p05"), true);
  eq(game.levelId, "p05");
  eq(game.view().state.orangeTotal, getLevel("p05").orangeTotal);
  eq(game.start("nope"), false);
});

test("事件出站：发射与命中音效事件只消费一次", () => {
  const game = createGameController();
  game.start("p01");
  game.shoot();
  const first = game.drainEvents();
  assert.ok(first.some((event) => event.type === "fire"));
  eq(game.drainEvents().length, 0);

  const view = drive(game);
  assert.ok(view.state.status === STATUS_AIM);
});

test("按内置解算序列驱动控制器，可完整清关并产生结算", () => {
  const level = LEVELS[0];
  const game = createGameController();
  game.start(level.id);
  for (const angle of level.solution) {
    const view = game.view();
    if (view.result) break;
    eq(game.aim(angle), true);
    eq(game.shoot(), true);
    const after = drive(game);
    if (after.result) break;
  }
  const final = game.view();
  assert.ok(final.result, "按解算序列应当产生结算");
  eq(final.result.outcome, "clear");
  eq(final.state.status, STATUS_WON);
  assert.ok(final.result.stars >= 1 && final.result.stars <= 3);
});
