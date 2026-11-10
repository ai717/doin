import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY, MARK_O, MARK_X, applyMove, cellIndex, createEmptyState, createState, legalMoves,
} from "../js/engine.mjs";
import {
  TIERS, TIER_META, chooseMove, evaluate, mulberry32, scoreMove,
} from "../js/ai.mjs";

const eq = assert.strictEqual;

function build(xs = [], os = [], options = {}) {
  const cells = new Array(81).fill(EMPTY);
  for (const index of xs) cells[index] = MARK_X;
  for (const index of os) cells[index] = MARK_O;
  return createState({ cells, ...options });
}

// O 已占 big0 / big1，big2 只差 20 号位即可完成大九宫三连。
function oReadyToWin() {
  return build(
    [45, 46, 54, 55, 63, 64, 72, 73, 36],
    [0, 1, 2, 9, 10, 11, 18, 19],
    { active: -1, current: MARK_O },
  );
}

// X 已占 big0 / big1，big2 只差 20 号位；轮到 O，必须封堵 20 号位。
function xThreatens() {
  return build(
    [0, 1, 2, 9, 10, 11, 18, 19, 36],
    [45, 46, 54, 55, 63, 64, 72, 73],
    { active: 2, current: MARK_O },
  );
}

test("四档 AI 都只返回合法落点（随机局面抽样）", () => {
  const rng = mulberry32(91);
  let state = createEmptyState();
  for (let ply = 0; ply < 6; ply += 1) {
    const moves = legalMoves(state);
    state = applyMove(state, moves[Math.floor(rng() * moves.length)]);
  }
  for (const tier of TIERS) {
    const move = chooseMove(state, {
      tier,
      aiMark: state.current,
      rng: mulberry32(7),
      budget: 120,
    });
    assert.ok(legalMoves(state).includes(move), `${tier} 返回了非法落点 ${move}`);
  }
});

test("终局或空状态返回 -1", () => {
  eq(chooseMove(null, { tier: "novice" }), -1);
  const done = build([0, 1, 2, 9, 10, 11, 18, 19], [45, 46, 54, 55, 63, 64, 72, 73], {
    active: 2,
    current: MARK_X,
  });
  const over = applyMove(done, 20);
  eq(chooseMove(over, { tier: "master" }), -1);
});

test("所有 AI 都会抓住一手定胜负的机会", () => {
  const state = oReadyToWin();
  for (const tier of TIERS) {
    const move = chooseMove(state, { tier, aiMark: MARK_O, rng: mulberry32(3), budget: 150 });
    eq(move, 20, `${tier} 应该直接落 20 号位完成绝杀`);
  }
});

test("棋馆门生不会把一步杀机会留给对手", () => {
  const state = xThreatens();
  const move = chooseMove(state, { tier: "duelist", aiMark: MARK_O, rng: mulberry32(5) });
  assert.ok(legalMoves(state).includes(move));
  const next = applyMove(state, move);
  for (const reply of legalMoves(next)) {
    const after = applyMove(next, reply);
    assert.notEqual(
      after.status === "won" && after.winner === MARK_X,
      true,
      `AI 落子 ${move} 后仍被 X 一手绝杀`,
    );
  }
});

test("注入同一 PRNG 时决策完全可复现", () => {
  const state = createEmptyState();
  const a = chooseMove(state, { tier: "master", rng: mulberry32(1234) });
  const b = chooseMove(state, { tier: "master", rng: mulberry32(1234) });
  eq(a, b);
  const c = chooseMove(state, { tier: "infallible", rng: mulberry32(99), budget: 160 });
  const d = chooseMove(state, { tier: "infallible", rng: mulberry32(99), budget: 160 });
  eq(c, d);
});

test("静态评估：占据大格与即将三连的一方得分更高", () => {
  const good = build([0, 1, 2, 9, 10, 18, 19], [45, 46, 54, 55, 63, 64, 72], {
    active: 2,
    current: MARK_X,
  });
  const bad = build([45, 46, 54, 55, 63, 64, 72], [0, 1, 2, 9, 10, 18, 19], {
    active: 2,
    current: MARK_X,
  });
  assert.ok(evaluate(good, MARK_X) > evaluate(bad, MARK_X));
});

test("单步评分：立即占领大格优于无关落子", () => {
  const state = build([0, 1, 9, 10], [45, 46, 54, 55], { current: MARK_X });
  assert.ok(scoreMove(state, 2, MARK_X) > scoreMove(state, 80, MARK_X));
});

test("MCTS 预算合法化：极低预算也不会返回非法值", () => {
  const state = createEmptyState();
  const move = chooseMove(state, { tier: "infallible", aiMark: MARK_X, rng: mulberry32(2), budget: 1 });
  assert.ok(move >= 0 && move < 81);
  assert.ok(TIER_META.infallible.iterations > 0);
  void cellIndex;
});
