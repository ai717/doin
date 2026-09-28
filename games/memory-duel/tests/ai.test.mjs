// AI 决策与记忆系统单测
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, createRng } from "../js/engine.mjs";
import {
  createAiMemory,
  updateAiMemory,
  findKnownPair,
  decideAiAction,
  AI_TIERS,
} from "../js/ai.mjs";

test("AI 记忆容量淘汰机制 (Novice 限制 4 张，超出淘汰最旧记录)", () => {
  let memory = createAiMemory();
  const game = createGame({ pairCount: 10 });
  // 模拟翻开 6 张牌
  for (let i = 0; i < 6; i++) {
    game.board[i].state = "revealed";
    memory = updateAiMemory(memory, game, "novice", i + 1);
    game.board[i].state = "hidden";
  }

  // Novice 限制为 4
  assert.equal(memory.knownCards.size, 4);
  // 最早的 0 和 1 号牌应该被淘汰
  assert.equal(memory.knownCards.has(0), false);
  assert.equal(memory.knownCards.has(1), false);
  assert.equal(memory.knownCards.has(4), true);
  assert.equal(memory.knownCards.has(5), true);
});

test("AI 已知配对时，Master 100% 决定翻出已知对", () => {
  const game = createGame({ pairCount: 10, seed: 123 });
  game.activePlayer = "opponent";
  game.turnPhase = "action_select";

  let memory = createAiMemory();
  const totem = game.board[0].totem;
  const matchIdx = game.board.findIndex((c, i) => i !== 0 && c.totem === totem);

  memory.knownCards.set(0, { totem, time: 1 });
  memory.knownCards.set(matchIdx, { totem, time: 1 });

  const rng = () => 0.5; // 固定 rng
  const decision = decideAiAction(game, memory, "master", rng);
  assert.ok(decision);
  assert.equal(decision.type, "flip");
  assert.equal(decision.targetIndex, 0);

  // 模拟翻开第 1 张后，第二张翻牌决策
  game.turnPhase = "first_flipped";
  game.selectedFirstIndex = 0;
  const decision2 = decideAiAction(game, memory, "master", rng);
  assert.ok(decision2);
  assert.equal(decision2.type, "flip");
  assert.equal(decision2.targetIndex, matchIdx);
});

test("玩家有未上锁对且 AI 拥有 2 SP，Master 优先偷牌", () => {
  const game = createGame({ pairCount: 10, seed: 456 });
  game.activePlayer = "opponent";
  game.turnPhase = "action_select";
  game.players.player.pairs = 2;
  game.players.player.lockedPairs = 0;
  game.players.opponent.sp = 5;

  const memory = createAiMemory(); // 无已知对
  const decision = decideAiAction(game, memory, "master", () => 0.5);
  assert.ok(decision);
  assert.equal(decision.type, "steal");
});

test("AI 拥有未上锁对且玩家有 2 SP 威胁，Master 优先上锁", () => {
  const game = createGame({ pairCount: 10, seed: 789 });
  game.activePlayer = "opponent";
  game.turnPhase = "action_select";
  game.players.opponent.pairs = 2;
  game.players.opponent.lockedPairs = 0;
  game.players.opponent.sp = 5;
  game.players.player.sp = 3; // 玩家有偷牌资本

  const memory = createAiMemory();
  const decision = decideAiAction(game, memory, "master", () => 0.5);
  assert.ok(decision);
  assert.equal(decision.type, "lock");
});
