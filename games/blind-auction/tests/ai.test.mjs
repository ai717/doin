// AI 性格池测试：8 性格参数完整、easy 池约束、出价确定性、出价范围、伪装引擎。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PERSONAS,
  PERSONA_IDS,
  EASY_POOL,
  BLUFF_TABLE,
  pickPersonas,
  createAiPlayers,
  createAiPlayersFrom,
  computeAiBid,
  estimateAiBidRange,
  emotionText,
} from "../js/ai.mjs";
import { createGame, mulberry32, bid, resolveRound, openCrate, nextRound, START_CASH, PLAYER_COUNT, ROUNDS } from "../js/engine.mjs";
import { createHumanPlayer } from "../js/ai.mjs";

function makeGame(seed = 11, difficulty = "standard", character = "detective", personas = ["gambler", "cautious", "oracle"]) {
  const human = createHumanPlayer(character);
  const players = [human, ...createAiPlayersFrom(personas)];
  return createGame(seed, { difficulty, character }, players);
}

test("8 个性格参数完整（字段非空）", () => {
  assert.equal(PERSONA_IDS.length, 8);
  for (const id of PERSONA_IDS) {
    const p = PERSONAS[id];
    assert.ok(p, `缺性格 ${id}`);
    assert.ok(p.nameZh && p.nameEn && p.titleZh && p.titleEn);
    assert.ok(typeof p.aggression === "number" && p.aggression > 0);
    assert.ok(typeof p.noise === "number" && p.noise >= 0);
    assert.ok(Number.isInteger(p.intel) && p.intel >= 0);
    assert.ok(p.emoWinZh && p.emoLoseZh && p.emoWinEn && p.emoLoseEn);
  }
});

test("easy 难度性格池只从子集抽取，且返回 3 个", () => {
  for (const seed of [1, 2, 3, 42, 99]) {
    const picked = pickPersonas(mulberry32(seed), "easy");
    assert.equal(picked.length, PLAYER_COUNT - 1);
    for (const id of picked) {
      assert.ok(EASY_POOL.includes(id), `easy 池抽到 ${id}`);
    }
  }
});

test("standard/hard 从全池抽取", () => {
  for (const difficulty of ["standard", "hard"]) {
    const picked = pickPersonas(mulberry32(5), difficulty);
    assert.equal(picked.length, PLAYER_COUNT - 1);
    for (const id of picked) assert.ok(PERSONA_IDS.includes(id));
  }
});

test("createAiPlayers / createAiPlayersFrom 构建合法 AI 玩家", () => {
  const ais = createAiPlayers(mulberry32(9), "standard");
  assert.equal(ais.length, 3);
  for (const ai of ais) {
    assert.equal(ai.kind, "ai");
    assert.equal(ai.cash, START_CASH);
    assert.ok(PERSONAS[ai.personaId]);
  }
  const fixed = createAiPlayersFrom(["rookie", "rookie", "rookie"]);
  assert.deepEqual(fixed.map((a) => a.personaId), ["rookie", "rookie", "rookie"]);
});

test("AI 出价确定性：同 seed 同状态同结果", () => {
  const state = makeGame(777);
  const a = computeAiBid(state, 1);
  const b = computeAiBid(state, 1);
  assert.equal(a, b);
});

test("AI 出价范围合法：0 ≤ 出价 ≤ 现金（全程逐回合推进验证）", () => {
  for (const seed of [1, 5, 42, 777, 2026]) {
    let state = makeGame(seed);
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 1; i < PLAYER_COUNT; i++) {
        const amount = computeAiBid(state, i) ?? 0;
        assert.ok(amount >= 0 && amount <= state.players[i].cash, `seed ${seed} r${round} p${i} 出价 ${amount} 越界`);
      }
      let next = state;
      for (let i = 0; i < PLAYER_COUNT; i++) {
        const amount = i === 0 ? 0 : (computeAiBid(next, i) ?? 0);
        next = bid(next, i, amount) ?? next;
      }
      next = resolveRound(next) ?? next;
      next = openCrate(next) ?? next;
      next = nextRound(next) ?? next;
      state = next;
    }
    assert.equal(state.phase, "done");
  }
});

test("AI 出价随性格分化（同局面不同出价）", () => {
  // 首回合预期估值高时出价可能全部顶满现金，因此遍历多 seed 各回合找可区分局面
  let distinguished = false;
  for (let s = 100; s < 160; s++) {
    const state = makeGame(s);
    for (let round = 0; round < ROUNDS; round++) {
      const amounts = new Set();
      for (let i = 1; i < PLAYER_COUNT; i++) amounts.add(computeAiBid(state, i));
      if (amounts.size >= 2) { distinguished = true; break; }
    }
    if (distinguished) break;
  }
  assert.ok(distinguished, "遍历 seed 未找到性格出价区分的局面");
});

test("hard 伪装引擎：后两回合打破模式（出价行为与模式期不同）", () => {
  // 同一回合数据下比较模式期（roundIndex=1）与伪装期（roundIndex=3）
  // deriveRng 盐含 roundIndex + BLUFF_TABLE 修正 → 后两回合决策必然改变
  let changed = false;
  for (const seed of [1, 7, 42, 2024, 20240925, 777]) {
    const base = makeGame(seed, "hard");
    const modeState = { ...base, roundIndex: 1 };
    const bluffState = { ...base, roundIndex: 3 };
    for (let i = 1; i < PLAYER_COUNT; i++) {
      if (computeAiBid(modeState, i) !== computeAiBid(bluffState, i)) { changed = true; break; }
    }
    if (changed) break;
  }
  assert.ok(changed, "hard 局后两回合出价未出现任何改变");
});

test("BLUFF_TABLE 覆盖 8 个性格", () => {
  for (const id of PERSONA_IDS) {
    assert.ok(id in BLUFF_TABLE, `BLUFF_TABLE 缺 ${id}`);
  }
});

test("estimateAiBidRange: 返回合法区间 lo ≤ hi，且在现金内", () => {
  const state = makeGame();
  for (let i = 1; i < PLAYER_COUNT; i++) {
    const range = estimateAiBidRange(state, i);
    assert.ok(range);
    assert.ok(range.lo >= 0 && range.lo <= range.hi && range.hi <= state.players[i].cash);
  }
  assert.equal(estimateAiBidRange(state, 0), null); // 人类不可试探
});

test("emotionText: 中英情绪文本齐全", () => {
  for (const id of PERSONA_IDS) {
    assert.ok(emotionText(id, "win", "zh").length > 0);
    assert.ok(emotionText(id, "lose", "zh").length > 0);
    assert.ok(emotionText(id, "win", "en").length > 0);
    assert.ok(emotionText(id, "lose", "en").length > 0);
  }
  assert.ok(emotionText(null, "win", "zh").length > 0);
  assert.ok(emotionText(null, "lose", "en").length > 0);
});
