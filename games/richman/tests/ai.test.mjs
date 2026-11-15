// AI 决策测试：三档风格差异、只读不改盘、给出的动作必被引擎接受、
// 用 AI 对 AI（双方都当人类驱动）整局验证不抛错不卡死。

import test from "node:test";
import assert from "node:assert/strict";
import { applyAction, createMatch, legalActions, currentPlayer } from "../js/engine.mjs";
import { aiDecide } from "../js/ai.mjs";
import { mulberry32 } from "../js/engine.mjs";
import { makePlayers, stepOnce } from "./walk.mjs";

const rngFor = (seed) => mulberry32(seed);

function aiMatch(level, mode = "quick") {
  const state = createMatch({
    seed: 55,
    mode,
    players: makePlayers(mode, level === "both-sides" ? "skilled" : level),
  });
  return state;
}

test("aiDecide never mutates the board", () => {
  const state = aiMatch("skilled");
  const snapshot = structuredClone(state);
  aiDecide(state, "p2", rngFor(1));
  aiDecide(state, "p2", rngFor(2));
  assert.deepEqual(state, snapshot);
});

test("aiDecide returns only legal actions the engine accepts", () => {
  for (const level of ["novice", "skilled", "master"]) {
    let state = aiMatch(level, "duo");
    const rng = rngFor(level.length * 111);
    let guard = 0;
    while (!state.over && guard++ < 600) {
      const player = currentPlayer(state);
      const action =
        player.ai && !player.human ? aiDecide(state, player.id, rng) : null;
      if (action) {
        const legal = legalActions(state).some(
          (candidate) => JSON.stringify(candidate) === JSON.stringify(action),
        );
        assert.ok(legal, `${level} produced illegal action ${JSON.stringify(action)} at phase ${state.phase}`);
        state = applyAction(state, action).state;
        continue;
      }
      // 人类侧由 stepOnce 兜底推进
      const next = stepOnce(state, (actions) => actions[0]);
      state = next.state;
      if (!next.changed) break;
    }
    assert.ok(state.over, `${level} match must terminate`);
  }
});

test("novice AI usually declines tight buys; master buys set-completing tiles", () => {
  // novice：现金刚好够时大概率不买（留 150 应急 + 70% 概率）
  let declined = 0;
  let offered = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    const state = aiMatch("novice");
    state.turn = 1; // 轮到 AI
    state.lands[1].owner = null;
    state.pending = { kind: "buy", tile: 1 };
    state.phase = "act";
    state.players[1].cash = 140; // 刚好够 100，余 40 < 150 → 必放弃
    const action = aiDecide(state, "p2", rngFor(seed));
    offered += 1;
    if (action?.type === "skip") declined += 1;
  }
  assert.equal(declined, offered, "novice with <150 reserve never buys");

  // master：差一块成套时，哪怕只剩 60 余量也买
  let masterBuys = 0;
  for (let seed = 1; seed <= 20; seed += 1) {
    const state = aiMatch("master");
    state.turn = 1;
    state.lands[1].owner = "p2";
    state.lands[2].owner = "p2";
    state.lands[4].owner = null;
    state.pending = { kind: "buy", tile: 4 };
    state.phase = "act";
    state.players[1].cash = 160; // 240 块红地不适用，这里用蓝组第三块（价 100）
    state.pending = { kind: "buy", tile: 4 };
    state.players[1].cash = 160;
    const action = aiDecide(state, "p2", rngFor(seed));
    if (action?.type === "buy") masterBuys += 1;
  }
  assert.equal(masterBuys, 20, "master always completes a set when it can");
});

test("master prefers the best dice value with remote dice", () => {
  const state = aiMatch("master");
  state.turn = 1;
  state.players[1].cards = ["card_dice"];
  state.lands[2].owner = "p2"; // 前方 2 格是自家地
  const action = aiDecide(state, "p2", rngFor(7));
  assert.equal(action.type, "useCard");
  assert.equal(action.card, "card_dice");
  assert.equal(action.payload.value, 2, "lands on own tile 2 steps ahead");
});

test("AI uses equalizer only when far behind (master)", () => {
  const state = aiMatch("master");
  state.turn = 1;
  state.players[1].cards = ["card_equal"];
  state.players[1].cash = 200;
  state.players[0].cash = 2400; // 差距巨大
  const action = aiDecide(state, "p2", rngFor(3));
  assert.deepEqual({ type: action.type, card: action.card }, { type: "useCard", card: "card_equal" });

  const state2 = aiMatch("master");
  state2.turn = 1;
  state2.players[1].cards = ["card_equal"];
  state2.players[1].cash = 2000;
  state2.players[0].cash = 1500; // AI 领先 → 用均富卡是负收益
  const action2 = aiDecide(state2, "p2", rngFor(3));
  assert.ok(!action2 || action2.card !== "card_equal", "master never equalizes while ahead");
});

test("AI picks a block tile and completes both swap steps", () => {
  let state = aiMatch("skilled");
  state.turn = 1;
  state.players[1].cards = ["card_roadblock"];
  state.players[0].pos = 10;
  let action = aiDecide(state, "p2", rngFor(9));
  assert.equal(action.type, "useCard");
  assert.equal(action.card, "card_roadblock");
  state = applyAction(state, action).state;
  action = aiDecide(state, "p2", rngFor(9));
  assert.equal(action.type, "blockPick");
  assert.ok([11, 12, 13].includes(action.tile));
  state = applyAction(state, action).state;
  assert.equal(state.blocks.length, 1);

  let state2 = aiMatch("skilled");
  state2.turn = 1;
  state2.players[1].cards = ["card_swap"];
  state2.lands[1].owner = "p2"; // p2 的蓝地（便宜，未成套）
  state2.lands[19].owner = "p1"; // p1 的红地（贵，未成套）→ 好交易
  let step = aiDecide(state2, "p2", rngFor(4));
  assert.equal(step.card, "card_swap");
  state2 = applyAction(state2, step).state;
  step = aiDecide(state2, "p2", rngFor(4));
  assert.equal(step.type, "swapPick");
  assert.equal(step.tile, 1, "offers its own cheapest land");
  state2 = applyAction(state2, step).state;
  step = aiDecide(state2, "p2", rngFor(4));
  assert.equal(step.type, "swapPick");
  assert.equal(step.tile, 19, "takes the rival land");
});

test("full AI-vs-AI matches across tiers terminate cleanly", () => {
  // 把双方都设为 AI（人类位由 stepOnce 兜底当成自动玩家）
  for (const level of ["novice", "skilled", "master"]) {
    let state = createMatch({
      seed: level === "master" ? 8 : 3,
      mode: "duo",
      players: [
        { id: "p1", human: false, ai: level },
        { id: "p2", human: false, ai: level },
        { id: "p3", human: false, ai: level },
      ],
    });
    const rng = rngFor(level.length);
    let steps = 0;
    while (!state.over && steps < 800) {
      const player = currentPlayer(state);
      const action = aiDecide(state, player.id, rng);
      if (action) {
        state = applyAction(state, action).state;
      } else {
        state = stepOnce(state, (actions) => actions[0]).state;
      }
      steps += 1;
    }
    assert.ok(state.over, `${level} trio must terminate`);
  }
});
