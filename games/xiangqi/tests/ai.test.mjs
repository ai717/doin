// 阶梯 AI 测试：档位配置、确定性、同步/异步一致、失误率分档、杀线不失误。
import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";
import { solve } from "../js/solver.mjs";
import { TIERS, TIER_DEFENDER, TIER_KEYS, tierConfig, chooseMove, think, AI_1 } from "../js/ai.mjs";
import { mulberry32 } from "../js/rng.mjs";

const B = (rows) => rows.join("");

// 红炮隔架吃黑车的得子局面（马做架：兵位无自吃车解，吃车唯一最优）
const WIN_CAPTURE = E.parseBoard(B([
  "....k....",
  ".........",
  "....r....",
  "....N....",
  "....C....",
  ".........",
  ".........",
  ".........",
  ".........",
  "...K.....",
]));
const CAPTURE_MOVE = { from: E.idx(4, 4), to: E.idx(2, 4) };

// 双车错一步杀局面（杀线：任何档位不得失误）
const MATE_IN_1 = E.parseBoard(B([
  "....k....",
  "R..P.P.R.",
  ".........",
  ".........",
  ".........",
  "...R.....",
  ".........",
  ".........",
  ".........",
  "...K.....",
]));

test("TIERS 配置与 PRD 分档一致", () => {
  assert.deepEqual(TIER_KEYS, ["ai_1", "ai_2", "ai_3", "ai_4", "ai_5"]);
  const rates = TIERS.map((tier) => tier.blunderRate);
  assert.deepEqual(rates, [0.3, 0.1, 0.05, 0, 0]);
  const depths = TIERS.map((tier) => tier.depth);
  assert.deepEqual(depths, [1, 1, 2, 3, 3]);
  assert.equal(TIERS[4].quiescence, true, "大师档吃子静默延伸");
  assert.equal(TIER_DEFENDER.blunderRate, 0);
  assert.equal(TIER_DEFENDER.depth, 2);
});

test("tierConfig：未知档位回退 ai_1", () => {
  assert.equal(tierConfig("nope").key, AI_1);
});

test("chooseMove：五档在开局均返回合法着法", () => {
  const board = E.parseBoard(E.START_BOARD);
  for (const tier of [...TIER_KEYS, TIER_DEFENDER.key]) {
    const outcome = chooseMove(board, E.RED, tier, { rng: mulberry32(11) });
    assert.ok(outcome.move, `${tier} 无着法`);
    assert.ok(
      E.legalMoves(board, E.RED).some((m) => m.from === outcome.move.from && m.to === outcome.move.to),
      `${tier} 返回非法着法`,
    );
  }
});

test("chooseMove：同种子确定性 —— 同局面同档逐位相同", () => {
  const a = chooseMove(WIN_CAPTURE, E.RED, "ai_2", { rng: mulberry32(42) });
  const b = chooseMove(WIN_CAPTURE, E.RED, "ai_2", { rng: mulberry32(42) });
  assert.deepEqual(b, a);
});

test("think（异步分块）与 chooseMove（同步）同种子结果一致", async () => {
  const sync = chooseMove(WIN_CAPTURE, E.RED, "ai_3", { rng: mulberry32(7) });
  const async = await think(WIN_CAPTURE, E.RED, "ai_3", { rng: mulberry32(7), yieldMs: 0 });
  assert.deepEqual(
    { move: async.move, score: async.score, blundered: async.blundered },
    { move: sync.move, score: sync.score, blundered: sync.blundered },
  );
});

test("高手/大师/防守档零失误：得子局面必吃车", () => {
  for (const tier of ["ai_4", "ai_5", TIER_DEFENDER.key]) {
    for (const seed of [1, 2, 3]) {
      const outcome = chooseMove(WIN_CAPTURE, E.RED, tier, { rng: mulberry32(seed) });
      assert.deepEqual(
        { from: outcome.move.from, to: outcome.move.to },
        { from: CAPTURE_MOVE.from, to: CAPTURE_MOVE.to },
        `${tier} seed=${seed} 未吃车`,
      );
      assert.notEqual(outcome.blundered, true, `${tier} seed=${seed} 被标记失误`);
    }
  }
});

test("新手档失误率分档：100 种子中明显偏离且多数仍走最优", () => {
  let blunders = 0;
  let captures = 0;
  for (let seed = 0; seed < 100; seed += 1) {
    const outcome = chooseMove(WIN_CAPTURE, E.RED, "ai_1", { rng: mulberry32(1000 + seed) });
    if (outcome.blundered) blunders += 1;
    if (outcome.move.from === CAPTURE_MOVE.from && outcome.move.to === CAPTURE_MOVE.to) captures += 1;
  }
  assert.ok(blunders >= 5, `新手档 100 局仅 ${blunders} 次失误，分档失效`);
  assert.ok(captures >= 50, `新手档仅 ${captures}/100 吃车，基线漂移`);
});

test("杀线不失误：一步杀局面任意档位必走杀着", () => {
  const winning = solve(MATE_IN_1, E.RED, 5).winningMoves;
  for (const tier of TIER_KEYS) {
    for (let seed = 0; seed < 20; seed += 1) {
      const outcome = chooseMove(MATE_IN_1, E.RED, tier, { rng: mulberry32(seed) });
      const hit = winning.some((m) => m.from === outcome.move.from && m.to === outcome.move.to);
      assert.ok(hit, `${tier} seed=${seed} 杀线失误`);
    }
  }
});
