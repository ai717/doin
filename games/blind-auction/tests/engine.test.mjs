// engine 纯函数规则测试：行情/仓库生成、出价合法性、结算、截胡、开箱、终局、技能、确定性。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  bid,
  forceBidZero,
  useSkill,
  resolveRound,
  openCrate,
  nextRound,
  mulberry32,
  deriveRng,
  estimateCrate,
  estimateRange,
  humanIndex,
  visiblePrivateHints,
  GUARANTEE_SUM,
  ROUNDS,
  PLAYER_COUNT,
  START_CASH,
  SNIPER_MULT,
  SNIPER_PAY,
  MIN_COEF,
  MAX_COEF,
  MIN_VALUE,
  MAX_VALUE,
} from "../js/engine.mjs";
import { createHumanPlayer, createAiPlayers, pickPersonas } from "../js/ai.mjs";

function makeGame(seed = 42, character = "detective", difficulty = "standard", personas = ["gambler", "cautious", "oracle"]) {
  const human = createHumanPlayer(character);
  const players = [human];
  for (const personaId of personas) {
    players.push({ kind: "ai", personaId, intelLevel: 1, cash: START_CASH, character: null });
  }
  return createGame(seed, { difficulty, character }, players);
}

function playToEnd(game) {
  let state = game;
  for (let r = 0; r < ROUNDS; r++) {
    state = bid(state, 0, 0) ?? state;
    state = resolveRound(state);
    state = openCrate(state);
    state = nextRound(state);
  }
  return state;
}

test("createGame: 生成 5 回合、4 玩家、初始 phase=bid、行情与仓库齐备", () => {
  const state = makeGame();
  assert.equal(state.rounds.length, ROUNDS);
  assert.equal(state.players.length, PLAYER_COUNT);
  assert.equal(state.phase, "bid");
  assert.equal(state.roundIndex, 0);
  assert.ok(state.market.coef);
  assert.ok(state.crate.publicHints.length >= 3);
  assert.ok(Object.keys(state.market.publicReport.hot).length >= 0);
});

test("无死局保证：5 箱真值总和 ≥ 6000", () => {
  for (const seed of [1, 7, 42, 99, 1234, 5678, 9999, 20240925]) {
    const state = makeGame(seed);
    const sum = state.rounds.reduce((acc, rd) => acc + rd.crate.trueValue, 0);
    assert.ok(sum >= GUARANTEE_SUM, `seed ${seed} 总和 ${sum} < ${GUARANTEE_SUM}`);
  }
});

test("真值范围与系数范围合法", () => {
  const state = makeGame();
  for (const rd of state.rounds) {
    assert.ok(rd.crate.trueValue >= MIN_VALUE && rd.crate.trueValue <= MAX_VALUE);
    for (const cat of Object.keys(rd.market.coef)) {
      assert.ok(rd.market.coef[cat] >= MIN_COEF && rd.market.coef[cat] <= MAX_COEF);
    }
  }
});

test("bid: 合法出价生效，非法返回 null", () => {
  const state = makeGame();
  const ok = bid(state, 0, 500);
  assert.ok(ok);
  assert.equal(ok.bids[0], 500);
  // 超现金
  assert.equal(bid(state, 0, START_CASH + 1), null);
  // 负数
  assert.equal(bid(state, 0, -1), null);
  // 非整数
  assert.equal(bid(state, 0, 123.5), null);
  // AI 也能出价（合法操作铁律）
  assert.ok(bid(state, 1, 300));
});

test("resolveRound: 价高者得，支付自己的出价", () => {
  let state = makeGame();
  state = bid(state, 0, 1000) ?? state;
  state = bid(state, 1, 600) ?? state;
  state = bid(state, 2, 300) ?? state;
  state = bid(state, 3, 100) ?? state;
  const next = resolveRound(state);
  assert.equal(next.reveal.winner, 0);
  assert.equal(next.reveal.pay, 1000);
  assert.equal(next.players[0].cash, START_CASH - 1000);
  assert.equal(next.phase, "reveal");
});

test("resolveRound: 2 倍截胡 → 支付第二名 × 1.5", () => {
  let state = makeGame();
  state = bid(state, 0, 2000) ?? state;   // 第一
  state = bid(state, 1, 800) ?? state;    // 第二（2000 ≥ 800×2）
  state = bid(state, 2, 500) ?? state;
  state = bid(state, 3, 100) ?? state;
  const next = resolveRound(state);
  assert.ok(next.reveal.snipe);
  assert.equal(next.reveal.pay, Math.ceil(800 * SNIPER_PAY));
  assert.equal(next.players[0].cash, START_CASH - Math.ceil(800 * SNIPER_PAY));
});

test("resolveRound: 第二名出价 0 时不触发截胡（低价捡漏成立）", () => {
  let state = makeGame();
  state = bid(state, 0, 1500) ?? state;
  state = bid(state, 1, 0) ?? state;
  state = bid(state, 2, 0) ?? state;
  state = bid(state, 3, 0) ?? state;
  const next = resolveRound(state);
  assert.equal(next.reveal.snipe, false);
  assert.equal(next.reveal.pay, 1500);
});

test("resolveRound: 同额平局索引小（先出价者）优先", () => {
  let state = makeGame();
  state = bid(state, 0, 500) ?? state;
  state = bid(state, 1, 500) ?? state;
  state = bid(state, 2, 100) ?? state;
  state = bid(state, 3, 100) ?? state;
  const next = resolveRound(state);
  assert.equal(next.reveal.winner, 0);
});

test("resolveRound: 未出价者视同 0（forceBidZero 与结算兜底）", () => {
  let state = makeGame();
  state = bid(state, 0, 400) ?? state;
  state = bid(state, 1, 300) ?? state;
  state = forceBidZero(state, 2) ?? state;
  const next = resolveRound(state); // player 3 未出价 → 0
  assert.equal(next.players[3].cash, START_CASH);
  assert.ok(next.reveal);
});

test("resolveRound: 结算后现金永不为负（出价受现金约束）", () => {
  let state = makeGame();
  for (let i = 0; i < PLAYER_COUNT; i++) {
    const cash = state.players[i].cash;
    state = bid(state, i, cash) ?? state;
  }
  const next = resolveRound(state);
  for (const p of next.players) assert.ok(p.cash >= 0);
});

test("openCrate: 开箱价值 = 真值 × 行情系数，盈亏正确", () => {
  let state = makeGame();
  state = bid(state, 0, 1000) ?? state;
  state = bid(state, 1, 500) ?? state;
  state = bid(state, 2, 200) ?? state;
  state = bid(state, 3, 100) ?? state;
  state = resolveRound(state);
  const crate = state.crate;
  const expected = Math.round(crate.trueValue * state.market.coef[crate.category]);
  const next = openCrate(state);
  assert.equal(next.open.value, expected);
  assert.equal(next.open.profit, expected - next.reveal.pay);
  assert.equal(next.players[0].cash, START_CASH - next.reveal.pay + expected);
  assert.equal(next.phase, "open");
});

test("nextRound: 回合推进，终局 phase=done 且 result 排名正确", () => {
  const state = playToEnd(makeGame());
  assert.equal(state.phase, "done");
  assert.ok(state.result);
  assert.equal(state.result.rank.length, PLAYER_COUNT);
  // 排名按资产降序
  const assets = state.result.assets.map((a) => a.asset);
  for (let i = 1; i < assets.length; i++) assert.ok(assets[i - 1] >= assets[i]);
});

test("终局后一切操作 no-op（返回 null）", () => {
  const state = playToEnd(makeGame());
  assert.equal(bid(state, 0, 100), null);
  assert.equal(resolveRound(state), null);
  assert.equal(openCrate(state), null);
  assert.equal(nextRound(state), null);
  assert.equal(useSkill(state, 0, null), null);
});

test("useSkill: detective 解锁锁定私密提示，每回合 1 次", () => {
  let state = makeGame(7, "detective");
  const hiddenBefore = visiblePrivateHints(state, 0);
  const next = useSkill(state, 0, null);
  assert.ok(next);
  assert.ok(next.players[0].skillUsed);
  const hiddenAfter = visiblePrivateHints(next, 0);
  assert.ok(hiddenAfter.length > hiddenBefore.length);
  // 已用后再次使用 → null
  assert.equal(useSkill(next, 0, null), null);
});

test("useSkill: expert 收窄估值区间", () => {
  let state = makeGame(7, "expert");
  const next = useSkill(state, 0, null);
  assert.ok(next.players[0].estimateNarrow);
});

test("useSkill: gossip 需要合法 AI 目标", () => {
  let state = makeGame(7, "gossip");
  assert.equal(useSkill(state, 0, null), null); // 无目标
  assert.equal(useSkill(state, 0, 5), null); // 越界
  const next = useSkill(state, 0, 1);
  assert.ok(next);
  assert.equal(next.players[0].gossipTarget, 1);
});

test("useSkill: hoarder 无主动技能", () => {
  const state = makeGame(7, "hoarder");
  assert.equal(useSkill(state, 0, null), null);
});

test("useSkill: 非 bid 阶段不可用", () => {
  let state = makeGame();
  state = bid(state, 0, 100) ?? state;
  state = resolveRound(state);
  assert.equal(useSkill(state, 0, null), null);
});

test("estimateCrate / estimateRange 基本性质", () => {
  const state = makeGame();
  const hints = [...state.crate.publicHints, ...state.crate.privateHints[0]];
  const est = estimateCrate(state.crate, hints);
  assert.ok(est.value > 0);
  assert.ok(est.confidence > 0 && est.confidence <= 1);
  const range = estimateRange(state.crate, hints, false);
  assert.ok(range.lo <= est.value && est.value <= range.hi);
  const narrow = estimateRange(state.crate, hints, true);
  assert.ok((narrow.hi - narrow.lo) <= (range.hi - range.lo) * 0.6);
});

test("确定性：同种子生成完全相同的对局", () => {
  const a = makeGame(20240925);
  const b = makeGame(20240925);
  assert.deepEqual(a.rounds, b.rounds);
  assert.deepEqual(a.players.map((p) => p.personaId), b.players.map((p) => p.personaId));
});

test("PRNG：mulberry32 与 deriveRng 确定性", () => {
  const r1 = mulberry32(123);
  const r2 = mulberry32(123);
  const seqA = Array.from({ length: 10 }, () => r1());
  const seqB = Array.from({ length: 10 }, () => r2());
  assert.deepEqual(seqA, seqB);
  const d1 = deriveRng(123, "ai", 1, 0);
  const d2 = deriveRng(123, "ai", 1, 0);
  assert.equal(d1(), d2());
});

test("humanIndex 返回人类玩家", () => {
  const state = makeGame();
  assert.equal(humanIndex(state), 0);
  assert.equal(state.players[0].kind, "human");
});
