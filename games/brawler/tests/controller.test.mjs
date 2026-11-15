import test from "node:test";
import assert from "node:assert/strict";

import {
  createGame,
  currentMatch,
  dispatch,
  restart,
  selectLevel,
  selectMode,
  selectPlayers,
  setPaused,
  start,
  tick,
} from "../js/game.mjs";
import { STATUS } from "../js/engine.mjs";

function run(game, seconds) {
  const frames = Math.round(seconds * 60);
  let last = null;
  for (let i = 0; i < frames; i += 1) last = tick(game, 1 / 60);
  return last;
}

test("控制器默认即开即打：首关、单人、未开始前 match 为空", () => {
  const game = createGame();
  assert.equal(game.mode, "story");
  assert.equal(game.players, 1);
  assert.equal(game.levelId, "level_01");
  assert.equal(game.match, null);
  assert.equal(game.paused, false);
  start(game);
  assert.ok(game.match);
  assert.equal(currentMatch(game).levelId, "level_01");
  assert.equal(currentMatch(game).players.length, 1);
  assert.equal(game.session, 1);
});

test("暂停冻结时间与操作，但允许记录移动输入", () => {
  const game = createGame();
  start(game);
  run(game, 0.5);
  const player = currentMatch(game).players[0];
  const x = player.x;
  assert.equal(setPaused(game, true), true);
  const time = currentMatch(game).time;
  const result = dispatch(game, { action: "light" });
  assert.equal(result.action, null);
  run(game, 0.4);
  assert.equal(currentMatch(game).time, time);
  dispatch(game, { type: "input", mx: 1, mz: 0 });
  assert.equal(player.input.mx, 1);
  assert.equal(player.x, x);
  setPaused(game, false);
  run(game, 0.5);
  assert.ok(player.x > x);
});

test("启动即产生第一波事件，且事件在 tick 后清空", () => {
  const game = createGame();
  start(game);
  assert.ok(currentMatch(game).events.some((event) => event.type === "wave"));
  const first = tick(game, 1 / 60);
  assert.ok(first.events.some((event) => event.type === "wave"));
  const second = tick(game, 1 / 60);
  assert.equal(second.events.length, 0);
});

test("终局结算只 fresh 一次，后续 tick 仍返回同一结果", () => {
  const game = createGame();
  start(game);
  currentMatch(game).status = STATUS.cleared;
  currentMatch(game).ko = 4;
  const first = tick(game, 1 / 60);
  assert.equal(first.fresh, true);
  assert.equal(first.result.outcome, "clear");
  const second = tick(game, 1 / 60);
  assert.equal(second.fresh, false);
  assert.equal(second.result, first.result);
});

test("切换模式/关卡/人数会重建对局并重置暂停", () => {
  const game = createGame();
  start(game);
  setPaused(game, true);
  assert.equal(selectMode(game, "arcade"), "arcade");
  start(game, { mode: "arcade" });
  assert.equal(currentMatch(game).mode, "arcade");
  assert.equal(game.paused, false);
  assert.equal(currentMatch(game).timeLeft, 180);

  selectMode(game, "story");
  selectPlayers(game, 2);
  selectLevel(game, "level_05");
  start(game);
  assert.equal(currentMatch(game).levelId, "level_05");
  assert.equal(currentMatch(game).players.length, 2);
  assert.equal(currentMatch(game).mode, "coop");
});

test("restart 保留关卡与模式但重置对局进度", () => {
  const game = createGame({ levelId: "level_04", players: 2 });
  start(game);
  run(game, 2);
  const before = currentMatch(game);
  before.ko = 9;
  before.players[0].hp = 12;
  before.status = STATUS.lost;
  restart(game);
  const after = currentMatch(game);
  assert.equal(after.levelId, "level_04");
  assert.equal(after.players.length, 2);
  assert.equal(after.ko, 0);
  assert.equal(after.players[0].hp, 100);
  assert.equal(after.status, STATUS.playing);
  assert.notEqual(before, after);
});

test("暂停状态下 tick 不产生事件也不推进", () => {
  const game = createGame();
  start(game);
  run(game, 0.2);
  setPaused(game, true);
  const time = currentMatch(game).time;
  const out = tick(game, 1 / 60);
  assert.deepEqual(out.events, []);
  assert.equal(currentMatch(game).time, time);
  setPaused(game, false);
});
