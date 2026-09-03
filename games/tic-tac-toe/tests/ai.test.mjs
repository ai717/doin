import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY,
  PLAYER_O,
  PLAYER_X,
  STATUS_DRAW,
  STATUS_WON,
  applyMove,
  createState,
  legalMoves,
} from "../js/engine.mjs";
import {
  DIFFICULTY_EASY,
  DIFFICULTY_MASTER,
  DIFFICULTY_NORMAL,
  DIFFICULTY_META,
  chooseMove,
  evaluate,
  findImmediateWin,
  rankMoves,
} from "../js/ai.mjs";

// 可复现的伪随机源，保证测试不会因为 Math.random 抖动而偶发失败。
function seeded(seed = 1) {
  let value = seed >>> 0 || 1;
  return () => {
    value ^= value << 13;
    value >>>= 0;
    value ^= value >> 17;
    value ^= value << 5;
    value >>>= 0;
    return value / 0x100000000;
  };
}

function play(state, ...indices) {
  let next = state;
  for (const index of indices) next = applyMove(next, index);
  return next;
}

function playout(config, policyX, policyO) {
  let state = createState(config);
  while (state.status === "playing") {
    const isX = state.current === PLAYER_X;
    const policy = isX ? policyX : policyO;
    let move;
    if (policy.kind === "random") {
      const moves = legalMoves(state);
      move = moves[Math.floor(policy.rng() * moves.length)];
    } else {
      move = chooseMove(state, { difficulty: policy.difficulty, aiPlayer: state.current, rng: policy.rng });
    }
    if (move < 0 || applyMove(state, move) === state) break;
    state = applyMove(state, move);
  }
  return state;
}

test("findImmediateWin: 识别一步成线与混合死线", () => {
  // X 占 0,1；O 占 4,5。轮到 X，落 2 即成线。
  const state = play(createState({ size: 3 }), 0, 4, 1, 5);
  assert.equal(findImmediateWin(state, PLAYER_X), 2);
  assert.equal(findImmediateWin(state, PLAYER_O), 3);
  // 每条线都被双方混住，谁都一步成不了线
  const mixed = play(createState({ size: 3 }), 0, 4, 1, 2);
  assert.equal(findImmediateWin(mixed, PLAYER_X), -1);
  assert.equal(findImmediateWin(play(createState({ size: 3 }), 0, 4, 1), PLAYER_X), 2);
});

test("findImmediateWin: 4x4 需要三缺一才算威胁", () => {
  // 只占两格不构成威胁
  const two = play(createState({ size: 4 }), 0, 4, 1, 5);
  assert.equal(findImmediateWin(two, PLAYER_X), -1);
  // 三缺一才触发
  const three = play(two, 2, 6);
  assert.equal(findImmediateWin(three, PLAYER_X), 3);
});

test("evaluate: 从指定视角给局面打分，混合线记 0", () => {
  const state = play(createState({ size: 3 }), 0, 3, 1);
  assert.ok(evaluate(state, PLAYER_X) > 0);
  assert.ok(evaluate(state, PLAYER_O) < 0);
  // X 同样占两子，但每条线都被对手污染 —— 潜力应显著更低
  const blocked = {
    size: 3,
    winLength: 3,
    board: [PLAYER_X, EMPTY, EMPTY, PLAYER_O, PLAYER_O, EMPTY, EMPTY, EMPTY, PLAYER_X],
  };
  assert.ok(evaluate(blocked, PLAYER_X) < evaluate(state, PLAYER_X));
});

test("rankMoves: 覆盖全部合法走法、按 AI 视角降序，胜手排第一", () => {
  // X 占 0,1 / O 占 3,4，轮到 X —— 落 2 即胜，分数应接近终局分值
  const state = play(createState({ size: 3 }), 0, 3, 1, 4);
  const ranked = rankMoves(state, PLAYER_X, { maxDepth: 6, budgetMs: 200 });
  assert.equal(ranked.length, legalMoves(state).length);
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].score >= ranked[i].score);
  }
  assert.equal(ranked[0].move, 2);
  assert.ok(ranked[0].score > 90000);
});

test("guard: 大师档能赢就赢，不会去堵对手的无关威胁", () => {
  const state = play(createState({ size: 3 }), 0, 4, 1, 5);
  const move = chooseMove(state, { difficulty: DIFFICULTY_MASTER, aiPlayer: PLAYER_X, rng: () => 0 });
  assert.equal(move, 2);
});

test("guard: 大师档自己没胜手时必堵对手", () => {
  const state = play(createState({ size: 3 }), 0, 4, 1);
  assert.equal(chooseMove(state, { difficulty: DIFFICULTY_MASTER, aiPlayer: PLAYER_O, rng: () => 0 }), 2);
  assert.equal(chooseMove(state, { difficulty: DIFFICULTY_NORMAL, aiPlayer: PLAYER_O, rng: () => 0 }), 2);
});

test("难度不影响大师档的确定性：rng 变化结果一致", () => {
  const state = play(createState({ size: 3 }), 0, 4, 1);
  const a = chooseMove(state, { difficulty: DIFFICULTY_MASTER, aiPlayer: PLAYER_O, rng: () => 0 });
  const b = chooseMove(state, { difficulty: DIFFICULTY_MASTER, aiPlayer: PLAYER_O, rng: () => 0.99 });
  assert.equal(a, b);
});

test("ε-greedy: 轻松档抽到失误时不会选最优手", () => {
  const state = play(createState({ size: 3 }), 0, 4, 1, 5, 6, 8);
  const best = rankMoves(state, PLAYER_X, { maxDepth: 4, budgetMs: 200 })[0].move;
  const missed = chooseMove(state, { difficulty: DIFFICULTY_EASY, aiPlayer: PLAYER_X, rng: () => 0.01 });
  const taken = chooseMove(state, { difficulty: DIFFICULTY_EASY, aiPlayer: PLAYER_X, rng: () => 0.99 });
  assert.notEqual(missed, best);
  assert.equal(taken, best);
});

test("chooseMove: 只剩一个空位时无需搜索", () => {
  // 走到只剩 8 且无人成线的平局前夜：每条线都被双方混住
  const state = play(createState({ size: 3 }), 0, 1, 2, 4, 3, 5, 7, 6);
  assert.equal(state.status, "playing");
  assert.deepEqual(legalMoves(state), [8]);
  assert.equal(chooseMove(state, { difficulty: DIFFICULTY_MASTER, aiPlayer: PLAYER_X, rng: () => 0 }), 8);
});

test("chooseMove: 终局返回 -1", () => {
  const won = play(createState({ size: 3 }), 0, 3, 1, 4, 2);
  assert.equal(chooseMove(won, { difficulty: DIFFICULTY_MASTER, aiPlayer: PLAYER_X, rng: () => 0 }), -1);
});

test("大师档 3x3 不可战胜：先后手各 60 局对随机对手均不败", () => {
  for (const masterPlayer of [PLAYER_X, PLAYER_O]) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const rng = seeded(seed * 7919);
      const policy =
        masterPlayer === PLAYER_X
          ? [{ difficulty: DIFFICULTY_MASTER, rng: seeded(seed) }, { kind: "random", rng }]
          : [{ kind: "random", rng }, { difficulty: DIFFICULTY_MASTER, rng: seeded(seed) }];
      const result = playout({ size: 3 }, policy[0], policy[1]);
      assert.notEqual(result.winner, masterPlayer === PLAYER_X ? PLAYER_O : PLAYER_X,
        "master lost as " + masterPlayer + " on seed " + seed);
    }
  }
});

test("大师档 3x3 自对弈必平局", () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const result = playout(
      { size: 3 },
      { difficulty: DIFFICULTY_MASTER, rng: seeded(seed) },
      { difficulty: DIFFICULTY_MASTER, rng: seeded(seed + 500) },
    );
    assert.equal(result.status, STATUS_DRAW, "self-play diverged on seed " + seed);
  }
});

test("4x4 普通档强度：对随机对手 6 局至少赢 5 局", () => {
  let wins = 0;
  for (let seed = 1; seed <= 6; seed += 1) {
    const result = playout(
      { size: 4 },
      { difficulty: DIFFICULTY_NORMAL, rng: seeded(seed) },
      { kind: "random", rng: seeded(seed * 31) },
    );
    if (result.winner === PLAYER_X) wins += 1;
  }
  assert.ok(wins >= 5, "expected at least 5 wins, got " + wins);
});

test("性能预算：4x4 空盘大师档一步不超过 1.5 秒", () => {
  const empty = createState({ size: 4 });
  const started = Date.now();
  chooseMove(empty, { difficulty: DIFFICULTY_MASTER, aiPlayer: PLAYER_X, rng: () => 0.5 });
  assert.ok(Date.now() - started < 1500, "search exceeded budget");
});

test("难度元数据齐全且失误率递减", () => {
  assert.ok(DIFFICULTY_META[DIFFICULTY_EASY].mistakeRate > DIFFICULTY_META[DIFFICULTY_NORMAL].mistakeRate);
  assert.ok(DIFFICULTY_META[DIFFICULTY_NORMAL].mistakeRate > DIFFICULTY_META[DIFFICULTY_MASTER].mistakeRate);
  assert.equal(DIFFICULTY_META[DIFFICULTY_MASTER].mistakeRate, 0);
  assert.equal(DIFFICULTY_META[DIFFICULTY_EASY].guard, false);
  assert.ok(DIFFICULTY_META[DIFFICULTY_MASTER].factor > DIFFICULTY_META[DIFFICULTY_EASY].factor);
});
