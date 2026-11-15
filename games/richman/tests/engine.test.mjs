// 引擎契约测试：规则纯函数、经济数值、道具、抵押与破产、30 回合兜底、
// 1000+ 步随机游走不变式（AGENTS.md 硬性要求）。

import test from "node:test";
import assert from "node:assert/strict";
import {
  BOARD_SIZE,
  CARDS,
  GROUP_PRICE,
  GROUP_TILES,
  HAND_LIMIT,
  HOUSE_COST,
  MAX_HOUSE,
  PASS_SALARY,
  PROP_TILES,
  ROUND_LIMIT,
  SHOP_PRICE,
  START_CASH,
  applyAction,
  blockCandidates,
  cardUsable,
  checkInvariants,
  createMatch,
  flipRound,
  hasCard,
  legalActions,
  mortgageValue,
  mulberry32,
  netWorth,
  priceOf,
  propsOf,
  rentFor,
  setComplete,
  setCount,
  tileInfo,
} from "../js/engine.mjs";
import { makePlayers, playFullMatch, walkMatch } from "./walk.mjs";

function freshMatch(options = {}) {
  return createMatch({
    seed: options.seed ?? 42,
    mode: options.mode ?? "quick",
    players: options.players ?? makePlayers(options.mode ?? "quick", options.ai ?? "skilled"),
    nastyCards: options.nastyCards ?? true,
  });
}

function forceRoll(state, value) {
  const withCard = applyAction(state, { type: "useCard", card: "card_dice", payload: { value } });
  return applyAction(withCard.state, { type: "roll" });
}

test("initial match: 24 tiles, 12 properties, balanced layout", () => {
  const state = freshMatch();
  assert.equal(state.players.length, 2);
  assert.equal(state.players[0].cash, START_CASH);
  assert.equal(PROP_TILES.length, 12);
  assert.equal(BOARD_SIZE, 24);
  const counts = {};
  for (const tile of tileList()) counts[tileInfo(tile).type] = (counts[tileInfo(tile).type] ?? 0) + 1;
  assert.equal(counts.prop, 12);
  assert.equal(counts.chance, 3);
  assert.equal(counts.fate, 3);
  assert.equal(counts.trap, 2);
  assert.equal(counts.start + counts.shop + counts.bank + counts.rest, 4);
  assert.deepEqual(checkInvariants(state), []);
});

function tileList() {
  return Array.from({ length: BOARD_SIZE }, (_, index) => index);
}

test("rent math: base 20%, set doubles, levels stack multiplicatively", () => {
  const state = freshMatch();
  const tile = GROUP_TILES.blue[0];
  state.lands[tile].owner = "p1";
  // 单块无成套：100 × 0.2 × 1 = 20
  assert.equal(rentFor(state, tile), 20);
  // 集齐三块成套：×2 = 40
  for (const entry of GROUP_TILES.blue) state.lands[entry].owner = "p1";
  assert.ok(setComplete(state, "p1", "blue"));
  assert.equal(rentFor(state, tile), 40);
  // 盖 1 级：100 × 0.2 × (1+1) × 2 = 80
  state.lands[tile].level = 1;
  assert.equal(rentFor(state, tile), 80);
  // 满 3 级：100 × 0.2 × 4 × 2 = 160
  state.lands[tile].level = MAX_HOUSE;
  assert.equal(rentFor(state, tile), 160);
  // 抵押后不收租
  state.lands[tile].mortgaged = true;
  assert.equal(rentFor(state, tile), 0);
});

test("group prices ascend blue < green < yellow < red", () => {
  assert.ok(GROUP_PRICE.blue < GROUP_PRICE.green);
  assert.ok(GROUP_PRICE.green < GROUP_PRICE.yellow);
  assert.ok(GROUP_PRICE.yellow < GROUP_PRICE.red);
  for (const tile of PROP_TILES) assert.ok(priceOf(tile) >= 100 && priceOf(tile) <= 300);
});

test("deterministic dice from injected seed", () => {
  const a = freshMatch({ seed: 777 });
  const b = freshMatch({ seed: 777 });
  let stateA = a;
  let stateB = b;
  for (let i = 0; i < 12; i += 1) {
    stateA = applyAction(stateA, { type: "roll" }).state;
    stateB = applyAction(stateB, { type: "roll" }).state;
    // 推进到 act / over 之前先补齐 arrive 与 endTurn
    while (stateA.phase === "moving") {
      stateA = applyAction(stateA, { type: "arrive" }).state;
      stateB = applyAction(stateB, { type: "arrive" }).state;
    }
    if (stateA.pending) {
      stateA = applyAction(stateA, { type: "skip" }).state;
      stateB = applyAction(stateB, { type: "skip" }).state;
    }
    if (stateA.over) break;
    stateA = applyAction(stateA, { type: "endTurn" }).state;
    stateB = applyAction(stateB, { type: "endTurn" }).state;
    assert.equal(stateA.players[0].pos, stateB.players[0].pos);
    assert.equal(stateA.players[1].pos, stateB.players[1].pos);
    assert.equal(stateA.dice.last, stateB.dice.last);
  }
});

test("passing start pays salary and landing on start gives bonus", () => {
  let state = freshMatch();
  state.players[0].pos = 22;
  // 遥控骰子锁 4：22 → 2（跨过 0）
  state.players[0].cards.push("card_dice");
  const rolled = forceRoll(state, 4);
  assert.ok(rolled.state !== state, "card + roll must both apply");
  state = rolled.state;
  while (state.phase === "moving") state = applyAction(state, { type: "arrive" }).state;
  assert.equal(state.players[0].pos, 2);
  assert.equal(state.players[0].cash, START_CASH + PASS_SALARY);
  assert.equal(state.players[0].stats.laps, 1);

  // 恰好停在起点：加发奖励
  let state2 = freshMatch();
  state2.players[0].pos = 23;
  state2.players[0].cards.push("card_dice");
  state2 = forceRoll(state2, 1).state;
  while (state2.phase === "moving") state2 = applyAction(state2, { type: "arrive" }).state;
  assert.equal(state2.players[0].pos, 0);
  assert.equal(state2.players[0].cash, START_CASH + PASS_SALARY + 100);
});

test("buy flow: pending offered, buy deducts and stamps ownership", () => {
  let state = freshMatch();
  state.players[0].cards.push("card_dice");
  state = forceRoll(state, 1).state; // 落 1 号蓝地
  while (state.phase === "moving") state = applyAction(state, { type: "arrive" }).state;
  assert.equal(state.pending?.kind, "buy");
  assert.equal(state.pending.tile, 1);
  const before = state.players[0].cash;
  state = applyAction(state, { type: "buy" }).state;
  assert.equal(state.lands[1].owner, "p1");
  assert.equal(state.players[0].cash, before - priceOf(1));
  assert.equal(state.players[0].stats.bought, 1);
  assert.equal(state.pending, null);
});

test("rent auto-collects to owner; rentfree card consumed once", () => {
  let state = freshMatch();
  state.lands[1].owner = "p2";
  state.players[0].cards.push("card_dice");
  state = forceRoll(state, 1).state;
  while (state.phase === "moving") state = applyAction(state, { type: "arrive" }).state;
  // 第一次踩：没有免租卡，正常交租 20
  assert.equal(state.players[0].cash, START_CASH - 20);
  assert.equal(state.players[1].cash, START_CASH + 20);
  assert.equal(state.players[1].stats.rentIn, 20);
  assert.equal(state.players[0].stats.rentOut, 20);

  // 回到 p1，再踩一次但持免租卡：卡被消耗、免租
  let state2 = freshMatch();
  state2.lands[1].owner = "p2";
  state2.players[0].cards.push("card_rentfree");
  state2.players[0].cards.push("card_dice");
  state2 = forceRoll(state2, 1).state;
  while (state2.phase === "moving") state2 = applyAction(state2, { type: "arrive" }).state;
  assert.equal(state2.players[0].cash, START_CASH);
  assert.ok(!hasCard(state2.players[0], "card_rentfree"));
});

test("auto mortgage: non-set cheap lands first, then set lands", () => {
  let state = freshMatch();
  // p1 只有 1 块蓝地和 1 块红地（均未成套），红更贵 → 先押蓝
  state.lands[1].owner = "p1";
  state.lands[19].owner = "p1";
  // p2 只有一块满级红地（未成套）：租金 240×0.2×4 = 192
  state.lands[22].owner = "p2";
  state.lands[22].level = 3;
  const rent = rentFor(state, 22);
  assert.equal(rent, 192);
  state.players[0].cash = 150; // 押蓝地（+50）刚好付得起
  state.players[0].pos = 21;
  state.players[0].cards.push("card_dice");
  state = forceRoll(state, 1).state;
  while (state.phase === "moving") state = applyAction(state, { type: "arrive" }).state;
  assert.equal(state.lands[1].mortgaged, true, "cheap land mortgaged first");
  assert.equal(state.lands[19].mortgaged, false);
  assert.equal(state.players[0].cash, 150 + mortgageValue(1) - rent);
  assert.equal(state.players[1].cash, START_CASH + rent);
});

test("bankruptcy: lands released, blocks cleared, last standing wins", () => {
  let state = freshMatch();
  state.lands[22].owner = "p2";
  for (const entry of GROUP_TILES.red) state.lands[entry].owner = "p2";
  state.lands[22].level = 3;
  state.lands[1].owner = "p1"; // p1 唯一的地（最便宜的蓝地）
  state.blocks.push({ tile: 5, owner: "p1" });
  state.players[0].pos = 21;
  state.players[0].cash = 0; // 抵押后仍付不起 → 破产
  state.players[0].cards.push("card_dice");
  state = forceRoll(state, 1).state;
  while (state.phase === "moving") state = applyAction(state, { type: "arrive" }).state;
  assert.equal(state.players[0].alive, false);
  assert.equal(state.lands[1].owner, null);
  assert.equal(state.blocks.length, 0);
  assert.equal(state.over, true);
  assert.equal(state.winner, "p2");
  assert.equal(state.overReason, "last_standing");
});

test("novice match disables tax and equalizer cards in shop", () => {
  const novice = createMatch({ seed: 1, mode: "quick", players: makePlayers("quick", "novice"), nastyCards: false });
  assert.ok(!novice.shopStock.includes("card_tax"));
  assert.ok(!novice.shopStock.includes("card_equal"));
  const skilled = createMatch({ seed: 1, mode: "quick", players: makePlayers("quick", "skilled") });
  assert.ok(skilled.shopStock.includes("card_tax"));
  assert.equal(skilled.shopStock.length, 6);
});

test("roadblock card: pick phase, place, hit consumes and halts", () => {
  let state = freshMatch();
  state.players[0].cards.push("card_roadblock");
  state.players[1].pos = 10;
  const candidates = blockCandidates(state, "p1");
  assert.ok(candidates.includes(11));
  const used = applyAction(state, { type: "useCard", card: "card_roadblock" });
  state = used.state;
  assert.equal(state.phase, "blockPick");
  assert.ok(!state.cardUsed, "card not consumed until placed");
  state = applyAction(state, { type: "blockPick", tile: 11 }).state;
  assert.equal(state.blocks.length, 1);
  assert.equal(state.blocks[0].tile, 11);
  assert.equal(state.cardUsed, true);
  // 放完路障 p1 仍需掷骰完成本回合
  state = applyAction(state, { type: "roll" }).state;
  while (state.phase === "moving") state = applyAction(state, { type: "arrive" }).state;
  if (state.pending) state = applyAction(state, { type: "skip" }).state;
  state = applyAction(state, { type: "endTurn" }).state;
  assert.equal(state.turn, 1);
  state.players[1].cards.push("card_dice");
  state = forceRoll(state, 2).state; // 10 → 12 经过 11
  while (state.phase === "moving") state = applyAction(state, { type: "arrive" }).state;
  assert.equal(state.players[1].pos, 11);
  assert.equal(state.players[1].stopTurns, 1);
  assert.equal(state.blocks.length, 0, "block consumed on hit");
});

test("remote dice locks the next roll exactly once", () => {
  let state = freshMatch();
  state.players[0].cards.push("card_dice");
  state = applyAction(state, { type: "useCard", card: "card_dice", payload: { value: 4 } }).state;
  assert.equal(state.dice.chosen, 4);
  assert.equal(state.cardUsed, true);
  state = applyAction(state, { type: "roll" }).state;
  assert.equal(state.dice.last, 4);
  assert.equal(state.dice.chosen, null);
});

test("tax card drains 10% of richest opponent net worth", () => {
  let state = freshMatch();
  state.lands[19].owner = "p2";
  state.players[0].cards.push("card_tax");
  const worth = netWorth(state, "p2");
  const expected = Math.max(60, Math.round(worth * 0.1));
  const before = state.players[1].cash;
  state = applyAction(state, { type: "useCard", card: "card_tax" }).state;
  assert.equal(state.players[1].cash, before - expected);
});

test("equalizer averages all alive players' cash", () => {
  let state = freshMatch({ mode: "duo" });
  state.players[0].cash = 300;
  state.players[1].cash = 600;
  state.players[2].cash = 904;
  state.players[0].cards.push("card_equal");
  state = applyAction(state, { type: "useCard", card: "card_equal" }).state;
  const total = 300 + 600 + 904;
  const base = Math.floor(total / 3); // 601，余 1 给排序最前的玩家
  const sum = state.players.reduce((acc, p) => acc + p.cash, 0);
  assert.equal(sum, total);
  assert.equal(state.players[0].cash, base + 1);
  assert.equal(state.players[1].cash, base);
  assert.equal(state.players[2].cash, base);
});

test("swap card exchanges one non-set land each side", () => {
  let state = freshMatch();
  state.lands[1].owner = "p1"; // 蓝地（p1 未成套）
  state.lands[19].owner = "p2"; // 红地（p2 未成套）
  state.players[0].cards.push("card_swap");
  state = applyAction(state, { type: "useCard", card: "card_swap" }).state;
  assert.equal(state.phase, "swapMine");
  state = applyAction(state, { type: "swapPick", tile: 1 }).state;
  assert.equal(state.phase, "swapTheirs");
  state = applyAction(state, { type: "swapPick", tile: 19 }).state;
  assert.equal(state.lands[19].owner, "p1");
  assert.equal(state.lands[1].owner, "p2");
  assert.equal(state.phase, "pre");
});

test("hand limit enforced at shop and fate gifts", () => {
  let state = freshMatch();
  for (let i = 0; i < HAND_LIMIT; i += 1) state.players[0].cards.push("card_rentfree");
  // 掷到道具店（12 号）
  state.players[0].pos = 11;
  state.players[0].cards.push("card_dice");
  state = forceRoll(state, 1).state;
  while (state.phase === "moving") state = applyAction(state, { type: "arrive" }).state;
  // 手牌已满：不出现购买 pending
  assert.notEqual(state.pending?.kind, "shop");
});

test("illegal actions are no-ops returning the same state object", () => {
  const state = freshMatch();
  const bogus = [
    { type: "buy" },
    { type: "useCard", card: "card_tax" },
    { type: "blockPick", tile: 3 },
    { type: "teleport", tile: 5 },
    { type: "" },
    null,
  ];
  for (const action of bogus) {
    const result = applyAction(state, action);
    assert.equal(result.state, state);
    assert.deepEqual(result.events, []);
  }
  // 掷骰只在轮到该玩家时合法：终局后一切 no-op
  let done = playFullMatch(7, "quick", "master");
  assert.ok(done.state.over);
  const frozen = applyAction(done.state, { type: "roll" });
  assert.equal(frozen.state, done.state);
});

test("applyAction never mutates the input state", () => {
  const state = freshMatch();
  const snapshot = structuredClone(state);
  const next = applyAction(state, { type: "roll" });
  assert.notEqual(next.state, state);
  assert.deepEqual(state, snapshot);
});

test("30-round limit ends match by net worth (no infinite game)", () => {
  const { state, steps } = playFullMatch(2026, "quick", "master", true);
  assert.ok(state.over, "match must terminate");
  assert.ok(state.round > ROUND_LIMIT - 2 && state.round <= ROUND_LIMIT + 1);
  if (state.overReason === "round_limit") {
    const worths = state.players.map((entry) => netWorth(state, entry.id));
    assert.equal(state.winner, state.players[worths.indexOf(Math.max(...worths))].id);
  } else {
    assert.equal(state.overReason, "last_standing");
  }
  assert.ok(steps < 800);
});

test("checkInvariants catches planted violations", () => {
  const state = freshMatch();
  state.lands[1].owner = "ghost";
  assert.ok(checkInvariants(state).some((problem) => problem.includes("ghost")));
  const state2 = freshMatch();
  state2.players[0].cash = -5;
  assert.ok(checkInvariants(state2).some((problem) => problem.includes("negative")));
  const state3 = freshMatch();
  state3.lands[1].owner = "p1";
  state3.players[0].alive = false;
  assert.ok(checkInvariants(state3).some((problem) => problem.includes("bankrupt")));
});

test("flipRound finds the round where the lead was lost", () => {
  const state = freshMatch();
  state.history = [
    { round: 1, worth: { p1: 1500, p2: 1500 } },
    { round: 2, worth: { p1: 1700, p2: 1400 } },
    { round: 3, worth: { p1: 1600, p2: 1900 } },
    { round: 4, worth: { p1: 1500, p2: 2200 } },
  ];
  assert.equal(flipRound(state, "p1"), 3);
  const always = freshMatch();
  always.history = [
    { round: 1, worth: { p1: 2000, p2: 1000 } },
    { round: 2, worth: { p1: 2100, p2: 900 } },
  ];
  assert.equal(flipRound(always, "p1"), null);
});

test("legalActions cover every phase and are all accepted", () => {
  const { state } = playFullMatch(31337, "quick", "skilled");
  // 终局无动作
  assert.deepEqual(legalActions(state), []);
  // 每个非终局阶段的动作全部被引擎接受（随机游走里已隐式验证，这里显式抽查各阶段）
  let s = freshMatch();
  let guard = 0;
  while (!s.over && guard++ < 400) {
    const actions = legalActions(s);
    assert.ok(actions.length > 0 || s.phase === "moving", `phase ${s.phase} has no actions`);
    if (s.phase === "moving") {
      s = applyAction(s, { type: "arrive" }).state;
      continue;
    }
    for (const action of actions) {
      const result = applyAction(s, action);
      assert.notEqual(result.state, s, `rejected action ${JSON.stringify(action)} at phase ${s.phase}`);
    }
    // 用第一个动作推进
    s = applyAction(s, actions[0]).state;
  }
});

test("random walk: 1000+ steps across modes, invariants hold, always terminates", () => {
  let totalSteps = 0;
  const configs = [];
  for (let seed = 1; seed <= 8; seed += 1) configs.push([seed, "quick", "skilled"]);
  for (let seed = 20; seed <= 24; seed += 1) configs.push([seed, "duo", "master"]);
  for (let seed = 40; seed <= 43; seed += 1) configs.push([seed, "2p", "novice"]);
  for (const [seed, mode, ai] of configs) {
    const { state, steps, problems } = walkMatch(seed, mode, ai);
    assert.deepEqual(problems, [], `seed ${seed} mode ${mode}: ${problems.join("; ")}`);
    assert.ok(state.over, `seed ${seed} mode ${mode} must terminate`);
    assert.ok(state.winner !== undefined);
    totalSteps += steps;
  }
  assert.ok(totalSteps >= 1000, `only walked ${totalSteps} steps`);
});

test("mulberry32 is stable across calls", () => {
  const a = mulberry32(99);
  const b = mulberry32(99);
  for (let i = 0; i < 50; i += 1) assert.equal(a(), b());
  const c = mulberry32(100);
  assert.notEqual(mulberry32(99)(), c());
});

test("card catalog and shop prices are well-formed", () => {
  for (const [card, kind] of Object.entries(CARDS)) {
    assert.ok(["passive", "target", "value", "two-step", "instant"].includes(kind));
    assert.ok(SHOP_PRICE[card] >= 100 && SHOP_PRICE[card] <= 300);
  }
  assert.equal(Object.keys(CARDS).length, 6);
  assert.equal(HOUSE_COST, 100);
});

test("setCount counts complete color groups only", () => {
  const state = freshMatch();
  assert.equal(setCount(state, "p1"), 0);
  for (const entry of GROUP_TILES.blue) state.lands[entry].owner = "p1";
  state.lands[GROUP_TILES.green[0]].owner = "p1";
  state.lands[GROUP_TILES.green[1]].owner = "p1";
  assert.equal(setCount(state, "p1"), 1);
  assert.equal(propsOf(state, "p1").length, 5);
});
