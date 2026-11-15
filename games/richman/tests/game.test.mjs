// 控制器测试：计时队列、暂停冻结、AI 自动回合、人类动作门禁、
// 整局跑通到结算（DOM-free，纯逻辑验证）。

import test from "node:test";
import assert from "node:assert/strict";
import { createGame, buildPlayers } from "../js/game.mjs";

function drive(game, { humanPolicy = "buy", maxTicks = 4000 } = {}) {
  let ticks = 0;
  while (!game.over && ticks < maxTicks) {
    game.tick(300);
    ticks += 1;
    const state = game.state;
    if (!state || state.over) break;
    const player = state.players[state.turn];
    if (game.paused) return "paused";
    if (player.human) {
      if (state.phase === "pre" && !state.pending) {
        game.playerAction({ type: "roll" });
      } else if (state.phase === "act" && state.pending) {
        const kind = state.pending.kind;
        if (kind === "shop") game.playerAction({ type: "skip" });
        else game.playerAction({ type: humanPolicy === "buy" ? kind === "buy" ? "buy" : "skip" : "skip" });
      }
    }
  }
  return game.over ? "over" : "timeout";
}

test("buildPlayers: mode shape (quick/duo/2p)", () => {
  assert.equal(buildPlayers("quick", "novice").length, 2);
  assert.equal(buildPlayers("duo", "master").length, 3);
  assert.deepEqual(
    buildPlayers("2p").map((p) => p.human),
    [true, true],
  );
  assert.equal(buildPlayers("quick", "skilled")[1].ai, "skilled");
});

test("newMatch: instant play, human first, ready board", () => {
  const game = createGame({});
  const snap = game.newMatch({ mode: "quick", ai: "novice", seed: 5 });
  assert.equal(snap.state.players.length, 2);
  assert.equal(snap.state.players[0].human, true);
  assert.equal(snap.state.phase, "pre");
  assert.equal(snap.myTurn, true);
  assert.equal(snap.paused, false);
  assert.equal(snap.state.round, 1);
  // 新手局自动关闭狠卡
  assert.ok(!snap.state.shopStock.includes("card_tax"));
});

test("human roll dispatches and schedules the walk; arrive auto-fires", () => {
  const game = createGame({});
  game.newMatch({ mode: "quick", ai: "skilled", seed: 11 });
  game.state.players[0].cards.push("card_dice");
  game.playerAction({ type: "useCard", card: "card_dice", payload: { value: 3 } });
  game.playerAction({ type: "roll" });
  assert.equal(game.state.phase, "moving");
  assert.ok(game.state.move.path.length === 3);
  // 时间推进：行进 + 停留后自动 arrive
  for (let i = 0; i < 12; i += 1) game.tick(120);
  assert.equal(game.state.phase, "act");
});

test("pause freezes the timeline; resume continues without drift", () => {
  const game = createGame({});
  game.newMatch({ mode: "quick", ai: "skilled", seed: 21 });
  game.state.players[0].cards.push("card_dice");
  game.playerAction({ type: "useCard", card: "card_dice", payload: { value: 4 } });
  game.playerAction({ type: "roll" });
  game.pause();
  assert.equal(game.paused, true);
  const before = structuredClone(game.state);
  for (let i = 0; i < 30; i += 1) game.tick(300); // 暂停中时间一分都不走
  assert.deepEqual(game.state, before);
  game.playerAction({ type: "roll" }); // 暂停时玩家动作被拦
  assert.deepEqual(game.state, before);
  game.resume();
  assert.equal(game.paused, false);
  for (let i = 0; i < 20; i += 1) game.tick(150);
  assert.equal(game.state.phase, "act");
});

test("playerAction rejected when it is not the human's turn", () => {
  const game = createGame({});
  game.newMatch({ mode: "quick", ai: "skilled", seed: 33 });
  // p1 掷完立刻结束回合，把控制权交给 AI
  game.state.players[0].cards.push("card_dice");
  game.playerAction({ type: "useCard", card: "card_dice", payload: { value: 1 } });
  game.playerAction({ type: "roll" });
  for (let i = 0; i < 14; i += 1) game.tick(150);
  if (game.state.pending) game.playerAction({ type: "skip" });
  for (let i = 0; i < 8; i += 1) game.tick(200);
  game.playerAction({ type: "endTurn" });
  if (game.state.players[game.state.turn].ai) {
    const before = game.state; // 引用捕获：被拒动作必须原样返回同一对象
    game.playerAction({ type: "roll" }); // 轮到 AI：人类动作无效
    assert.equal(game.state, before);
    // AI 在思考延迟后自己行动
    for (let i = 0; i < 20; i += 1) game.tick(150);
    assert.notEqual(game.state, before);
  }
});

test("full quick match runs to a result with both sides playing", () => {
  const results = [];
  const game = createGame({ onOver: (result) => results.push(result) });
  game.newMatch({ mode: "quick", ai: "master", seed: 2024 });
  const outcome = drive(game);
  assert.equal(outcome, "over");
  assert.equal(results.length, 1);
  const result = results[0];
  assert.ok(["last_standing", "round_limit", "draw", "human_out"].includes(result.reason));
  assert.equal(result.players.length, 2);
  assert.ok(result.rounds <= 31);
  const worths = result.players.map((entry) => entry.worth);
  assert.ok(worths.every((worth) => Number.isFinite(worth) && worth >= 0));
  if (result.reason === "round_limit") {
    const winner = result.players.find((entry) => entry.id === result.winner);
    const best = Math.max(...worths);
    assert.equal(winner.worth, best);
  }
});

test("duo match: human vs two AIs terminates and reports three players", () => {
  const game = createGame({});
  game.newMatch({ mode: "duo", ai: "skilled", seed: 77 });
  const outcome = drive(game, { humanPolicy: "skip" });
  assert.equal(outcome, "over");
  const state = game.state;
  assert.equal(state.players.length, 3);
  const aiCount = state.players.filter((entry) => entry.ai).length;
  assert.equal(aiCount, 2);
});

test("2p local mode: both seats are human and turns alternate", () => {
  const game = createGame({});
  game.newMatch({ mode: "2p", seed: 9 });
  assert.ok(game.state.players.every((entry) => entry.human));
  game.state.players[0].cards.push("card_dice");
  game.playerAction({ type: "useCard", card: "card_dice", payload: { value: 2 } });
  game.playerAction({ type: "roll" });
  for (let i = 0; i < 14; i += 1) game.tick(150);
  if (game.state.pending) game.playerAction({ type: "skip" });
  for (let i = 0; i < 10; i += 1) game.tick(200);
  game.playerAction({ type: "endTurn" });
  assert.equal(game.state.turn, 1);
  assert.equal(game.state.players[1].human, true);
});

test("onEvent fires engine events in order during a human turn", () => {
  const seen = [];
  const game = createGame({ onEvent: (event) => seen.push(event.type) });
  game.newMatch({ mode: "quick", ai: "novice", seed: 101 });
  game.state.players[0].cards.push("card_dice");
  game.playerAction({ type: "useCard", card: "card_dice", payload: { value: 1 } });
  game.playerAction({ type: "roll" });
  for (let i = 0; i < 16; i += 1) game.tick(150);
  if (game.state.pending) game.playerAction({ type: "buy" });
  for (let i = 0; i < 10; i += 1) game.tick(200);
  assert.ok(seen.includes("dice"));
  assert.ok(seen.includes("hop"));
  assert.ok(seen.includes("cardUsed"));
  assert.ok(seen.includes("stamp"));
});

test("newMatch resets previous pending timers (generation guard)", () => {
  const game = createGame({});
  game.newMatch({ mode: "quick", ai: "skilled", seed: 1 });
  game.state.players[0].cards.push("card_dice");
  game.playerAction({ type: "useCard", card: "card_dice", payload: { value: 6 } });
  game.playerAction({ type: "roll" });
  // 中途开新局：旧 arrive 调度必须作废
  game.newMatch({ mode: "quick", ai: "skilled", seed: 2 });
  for (let i = 0; i < 20; i += 1) game.tick(200);
  assert.equal(game.state.phase, "pre", "stale arrive from previous match must not fire");
  assert.equal(game.state.players[0].pos, 0);
});

test("deterministic given the same seed and same human actions", () => {
  function run() {
    const log = [];
    const game = createGame({ onEvent: (event) => log.push(event.type) });
    game.newMatch({ mode: "quick", ai: "skilled", seed: 424242 });
    drive(game, { humanPolicy: "buy" });
    const state = game.state;
    return JSON.stringify({
      over: state.over,
      winner: state.winner,
      reason: state.overReason,
      cash: state.players.map((p) => p.cash),
      owners: Object.entries(state.lands).map(([tile, land]) => [tile, land.owner, land.level]),
      log,
    });
  }
  assert.equal(run(), run());
});
