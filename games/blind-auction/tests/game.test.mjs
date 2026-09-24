// 完整对局流程与 1000+ 步随机游走测试（AGENTS.md 算法健全性铁律）。
// 任意合法操作序列下：不抛错、不卡死、现金永不为负、phase 严格流转、终局后 no-op。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  bid,
  useSkill,
  resolveRound,
  openCrate,
  nextRound,
  mulberry32,
  humanIndex,
  START_CASH,
  ROUNDS,
  PLAYER_COUNT,
} from "../js/engine.mjs";
import { createHumanPlayer, createAiPlayersFrom, computeAiBid } from "../js/ai.mjs";
import { buildGame } from "../js/game.mjs";
import { getChallenge, CHALLENGES, challengeStars } from "../js/challenge.mjs";

function playersFor(personas) {
  return [createHumanPlayer("detective"), ...createAiPlayersFrom(personas)];
}

function fullGame(seed, personas = ["gambler", "cautious", "oracle"]) {
  let state = createGame(seed, { difficulty: "standard", character: "detective" }, playersFor(personas));
  for (let r = 0; r < ROUNDS; r++) {
    state = bid(state, 0, Math.floor(state.players[0].cash / 2)) ?? state;
    for (let i = 1; i < PLAYER_COUNT; i++) {
      state = bid(state, i, computeAiBid(state, i) ?? 0) ?? state;
    }
    state = resolveRound(state) ?? state;
    for (const p of state.players) assert.ok(p.cash >= 0, "现金为负（结算后）");
    state = openCrate(state) ?? state;
    state = nextRound(state) ?? state;
  }
  return state;
}

test("完整对局：五回合打满进入终局，排名与资产一致", () => {
  for (const seed of [1, 9, 42, 777, 20240925]) {
    const state = fullGame(seed);
    assert.equal(state.phase, "done");
    assert.equal(state.roundIndex, ROUNDS - 1);
    assert.equal(state.result.rank.length, PLAYER_COUNT);
    // 排名第一名资产 ≥ 其余
    const first = state.result.assets[0];
    for (const a of state.result.assets.slice(1)) assert.ok(first.asset >= a.asset);
  }
});

test("1000 步随机游走：任意合法序列下不抛错、不卡死、不变量不破", () => {
  const rng = mulberry32(2024092501);
  let steps = 0;
  for (let game = 0; game < 400; game++) {
    const seed = Math.floor(rng() * 0x7fffffff);
    const character = ["detective", "expert", "gossip", "hoarder"][Math.floor(rng() * 4)];
    const difficulty = ["easy", "standard", "hard"][Math.floor(rng() * 3)];
    const personas = (() => {
      const pool = ["cautious", "gambler", "collector", "scavenger", "shark", "oracle", "rookie", "speculator"];
      const picked = [...pool].sort(() => rng() - 0.5).slice(0, 3);
      return picked;
    })();
    const human = createHumanPlayer(character);
    const players = [human, ...createAiPlayersFrom(personas)];
    let state = createGame(seed, { difficulty, character }, players);
    for (let r = 0; r < ROUNDS; r++) {
      // 随机出价（含边界 0 与全现金）
      const roll = rng();
      const amount = roll < 0.2 ? 0 : roll < 0.4 ? state.players[0].cash : Math.floor(rng() * (state.players[0].cash + 1));
      state = bid(state, 0, amount) ?? state;
      // 随机技能尝试（含非法目标）
      if (rng() < 0.6) {
        const target = rng() < 0.8 ? 1 + Math.floor(rng() * 3) : 99; // 合法目标或非法目标
        state = useSkill(state, 0, target) ?? state;
      }
      // AI 出价（含确定性函数）
      for (let i = 1; i < PLAYER_COUNT; i++) {
        const aiAmount = computeAiBid(state, i) ?? 0;
        state = bid(state, i, aiAmount) ?? state;
      }
      // 结算：未出价者视同 0
      state = resolveRound(state) ?? state;
      // 不变式：现金永不为负
      for (const p of state.players) {
        assert.ok(p.cash >= 0, `game ${game} r${r} 现金为负: ${p.cash}`);
      }
      state = openCrate(state) ?? state;
      // 回合内 phase 合法
      assert.ok(["reveal", "open"].includes(state.phase) || r === ROUNDS - 1, "phase 流转异常");
      state = nextRound(state) ?? state;
      steps += 6;
    }
    assert.equal(state.phase, "done");
    // 终局后一切操作 no-op
    assert.equal(bid(state, 0, 100), null);
    assert.equal(resolveRound(state), null);
    assert.equal(openCrate(state), null);
    assert.equal(nextRound(state), null);
  }
  assert.ok(steps >= 1000, `随机游走步数不足：${steps}`);
});

test("随机游走：任意 seed 下 AI 均能在全程出价（不卡死）", () => {
  const rng = mulberry32(777);
  for (let i = 0; i < 60; i++) {
    const seed = Math.floor(rng() * 0x7fffffff);
    const state = fullGame(seed, ["shark", "collector", "rookie"]);
    assert.equal(state.phase, "done");
  }
});

test("挑战局确定性：同 seed 同 personas 重放一致", () => {
  const chal = getChallenge(2);
  assert.ok(chal);
  const a = buildGame(chal.seed, { difficulty: chal.difficulty, character: chal.character, personas: chal.personas, mode: "challenge", challengeId: chal.id });
  const b = buildGame(chal.seed, { difficulty: chal.difficulty, character: chal.character, personas: chal.personas, mode: "challenge", challengeId: chal.id });
  assert.deepEqual(a.state.rounds, b.state.rounds);
  assert.deepEqual(a.state.players.map((p) => p.personaId), b.state.players.map((p) => p.personaId));
  assert.equal(humanIndex(a.state), 0);
});

test("12 关残局数据齐备且角色/难度合法", () => {
  assert.equal(CHALLENGES.length, 12);
  for (const chal of CHALLENGES) {
    assert.ok(Number.isInteger(chal.seed) && chal.seed > 0);
    assert.ok(["easy", "standard", "hard"].includes(chal.difficulty));
    assert.ok(["detective", "expert", "gossip", "hoarder"].includes(chal.character));
    assert.equal(chal.personas.length, 3);
    assert.ok(chal.personas.every((p) => ["cautious", "gambler", "collector", "scavenger", "shark", "oracle", "rookie", "speculator"].includes(p)));
  }
});

test("挑战局星级函数", () => {
  assert.equal(challengeStars(0), 3);
  assert.equal(challengeStars(1), 2);
  assert.equal(challengeStars(2), 1);
  assert.equal(challengeStars(3), 1);
});
