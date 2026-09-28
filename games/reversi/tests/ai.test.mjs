import test from "node:test";
import assert from "node:assert/strict";

import {
  BLACK, WHITE, EMPTY, CELL_COUNT,
  other, legalMoves, countDiscs, standardBoard, emptyBoard, indexOf, placeDisc,
  createState, applyMove, STATUS_PLAYING, squareKind, isCorner, isXSquare, isCSquare,
  formatBoard, parseBoard, finalScore,
} from "../js/engine.mjs";
import { solveExact, finalDiff, PERFECT_LIMIT } from "../js/solver.mjs";
import {
  TIERS, TIER_KEYS, TIER_NOVICE, TIER_DUELIST, TIER_VIRTUOSO, TIER_INFALLIBLE,
  tierConfig, SQUARE_TABLE, phaseOf, phaseWeights, STABILITY_EMPTY_LIMIT,
  squareValue, mobilityValue, stabilityValue, cornerValue, parityValue, discValue,
  evaluate, evaluateSimple, evaluateFlips, chooseMove, think,
} from "../js/ai.mjs";
import { mulberry32 } from "../js/rng.mjs";

const eq = assert.strictEqual;
const de = assert.deepStrictEqual;

// 随机走到指定空位数（确定性种子），作为"真实中残局"局面来源。
function positionWithEmpties(seed, target) {
  const rng = mulberry32(seed);
  let state = createState();
  let guard = 0;
  while (state.status === STATUS_PLAYING && countDiscs(state.board).empty > target && guard < 300) {
    guard += 1;
    const moves = legalMoves(state.board, state.current);
    state = applyMove(state, moves[Math.floor(rng() * moves.length)]);
  }
  return state;
}

// 用权威求解器复算"某一手走完之后的精确终局值" —— 度量 AI 着法质量的唯一标尺。
function exactValueAfter(board, player, move) {
  const child = placeDisc(board, move, player);
  return -solveExact(child, other(player)).score;
}

// 手写的夹击扫描参照实现：用来独立复核 engine.flipsFor 的翻转集合大小。
function flipsOfReference(board, index, player) {
  const out = [];
  const row = Math.floor(index / 8);
  const col = index % 8;
  const foe = other(player);
  for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
    const run = [];
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === foe) {
      run.push(r * 8 + c);
      r += dr;
      c += dc;
    }
    if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === player) out.push(...run);
  }
  return out.length;
}

// ─── 档位配置契约（PRD §3.3 表）───────────────────────────────────
test("四档阶梯配置：深度与完美区间单调递增，失误率单调递减，无谬零失误", () => {
  eq(TIERS.length, 4);
  eq(new Set(TIER_KEYS).size, 4);
  de(TIER_KEYS, [TIER_NOVICE, TIER_DUELIST, TIER_VIRTUOSO, TIER_INFALLIBLE]);

  const expected = [
    { key: TIER_NOVICE, depth: 1, perfectEmpties: 0, evaluator: "flips", blunderRate: 0.35 },
    { key: TIER_DUELIST, depth: 3, perfectEmpties: 6, evaluator: "simple", blunderRate: 0.15 },
    { key: TIER_VIRTUOSO, depth: 6, perfectEmpties: 10, evaluator: "full", blunderRate: 0.03 },
    { key: TIER_INFALLIBLE, depth: 10, perfectEmpties: 14, evaluator: "full", blunderRate: 0 },
  ];
  for (let i = 0; i < expected.length; i += 1) {
    const cfg = tierConfig(expected[i].key);
    for (const [field, value] of Object.entries(expected[i])) eq(cfg[field], value, `${cfg.key}.${field}`);
    if (i > 0) {
      assert.ok(cfg.depth > expected[i - 1].depth, "搜索深度必须逐档递增");
      assert.ok(cfg.perfectEmpties > expected[i - 1].perfectEmpties, "完美区间必须逐档扩大");
      assert.ok(cfg.blunderRate < expected[i - 1].blunderRate, "失误率必须逐档递减");
    }
    assert.ok(cfg.thinkMin < cfg.thinkMax, "思考时长上下限必须有序");
    assert.ok(cfg.thinkMax <= 5000, "单步思考绝不超过 5 秒");
  }
  eq(tierConfig(TIER_INFALLIBLE).blunderRate, 0);
  eq(tierConfig("不存在的档").key, TIER_NOVICE); // 未知档位安全回落
  eq(PERFECT_LIMIT, tierConfig(TIER_INFALLIBLE).perfectEmpties);
});

// ─── 棋格表与引擎的棋格分类必须同源 ───────────────────────────────
test("加权棋格表与 engine 的棋格分类严格一致（角 100 / X −80 / C −20 / 边 5|10 / 内圈 1|−2）", () => {
  eq(SQUARE_TABLE.length, CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i += 1) {
    const kind = squareKind(i);
    const value = SQUARE_TABLE[i];
    if (kind === "corner") eq(value, 100, `角位 ${i}`);
    else if (kind === "x") eq(value, -80, `X 位 ${i}`);
    else if (kind === "c") eq(value, -20, `C 位 ${i}`);
    else if (kind === "edge") assert.ok(value === 5 || value === 10, `边位 ${i} = ${value}`);
    else assert.ok(value === 1 || value === -2, `内圈 ${i} = ${value}`);
  }
  eq(SQUARE_TABLE.length, 64);
  assert.ok(Object.isFrozen(SQUARE_TABLE), "棋格表必须冻结，防止运行时被改");
  // 每个角、X、C 位的分类与引擎查询函数一致
  eq(isCorner(indexOf(0, 0)), true);
  eq(isXSquare(indexOf(1, 1)), true);
  eq(isCSquare(indexOf(0, 1)), true);
});

// ─── 阶段化权重：本作 AI 的灵魂 ──────────────────────────────────
test("阶段化权重：中局绝不给子数正权重，开局 parity 为 0，尾声才对等计入", () => {
  eq(phaseOf(1), "opening");
  eq(phaseOf(20), "opening");
  eq(phaseOf(21), "midgame");
  eq(phaseOf(45), "midgame");
  eq(phaseOf(46), "endgame");

  // ★ 核心断言：中局（且空位充裕）时子数权重必须为 0 —— 中盘领先子数是负资产
  for (const played of [1, 10, 21, 30, 45]) {
    const empties = 60 - played;
    if (empties <= 18) continue;
    const w = phaseWeights(played, empties);
    eq(w.disc, 0, `手数 ${played}（空位 ${empties}）不得给子数正权重`);
    eq(w.discAllowed, false);
  }
  // 开局 parity 权重为 0，尾声最高
  eq(phaseWeights(1, 59).parity, 0);
  eq(phaseWeights(10, 50).parity, 0);
  assert.ok(phaseWeights(46, 14).parity > 0, "尾声奇偶性必须有正权重");
  assert.ok(phaseWeights(46, 14).parity > phaseWeights(21, 39).parity, "奇偶性权重随阶段升高");

  // 子数放行的两个条件：手数 ≥ 46 或 空位 ≤ 18
  eq(phaseWeights(46, 14).discAllowed, true);
  assert.ok(phaseWeights(46, 14).disc > 0);
  assert.ok(phaseWeights(42, 18).disc > 0, "空位 ≤ 18 时即使还在中局也放行子数");
  eq(phaseWeights(42, 19).disc, 0);
  assert.ok(phaseWeights(46, 14).disc >= phaseWeights(42, 18).disc, "越接近终局，子数权重越高");

  // 各阶段权重都为正（除被禁止的子数项）
  for (const [played, empties] of [[5, 55], [25, 35], [50, 10]]) {
    const w = phaseWeights(played, empties);
    assert.ok(w.square > 0 && w.mobility > 0 && w.stability > 0 && w.corner > 0 && w.parity >= 0, `${w.phase} 权重`);
  }
  // 机动性在开局最重，稳定子在尾声最重
  assert.ok(phaseWeights(5, 55).mobility > phaseWeights(50, 10).mobility);
  assert.ok(phaseWeights(50, 10).stability > phaseWeights(5, 55).stability);
});

// ─── 各评估因子的方向性 ───────────────────────────────────────────
test("评估因子方向性：占角为正、被对手占角为负、机动性随落点单调", () => {
  const mine = standardBoard();
  mine[indexOf(0, 0)] = BLACK;
  const foe = standardBoard();
  foe[indexOf(0, 0)] = WHITE;

  assert.ok(cornerValue(mine, BLACK) > 0, "占一个角应为正");
  assert.ok(cornerValue(foe, BLACK) < 0, "对手占角应为负");
  eq(cornerValue(mine, BLACK), -cornerValue(mine, WHITE), "角保有必须零和");

  // 角 + 护卫边 > 孤零零一个角
  const guarded = standardBoard();
  guarded[indexOf(0, 0)] = BLACK;
  guarded[indexOf(0, 1)] = BLACK;
  guarded[indexOf(0, 2)] = BLACK;
  assert.ok(cornerValue(guarded, BLACK) > cornerValue(mine, BLACK), "护卫边必须加分");

  // 两角 > 一角
  const two = standardBoard();
  two[indexOf(0, 0)] = BLACK;
  two[indexOf(0, 7)] = BLACK;
  assert.ok(cornerValue(two, BLACK) > cornerValue(mine, BLACK));

  // 棋格分：给己方角加分，给对手角减分，且严格零和
  assert.ok(squareValue(mine, BLACK) > squareValue(foe, BLACK));
  eq(squareValue(mine, BLACK), -squareValue(mine, WHITE));
  assert.ok(squareValue(mine, BLACK) <= 100 && squareValue(mine, BLACK) >= -100, "棋格分必须归一到 ±100");

  // 机动性：随机残局里，合法着法多的一方必然为正，对手必然为负
  const state = positionWithEmpties(31337, 12);
  const mobBlack = mobilityValue(state.board, BLACK);
  eq(mobBlack, -mobilityValue(state.board, WHITE), "机动性必须零和");
  const diff = legalMoves(state.board, BLACK).length - legalMoves(state.board, WHITE).length;
  eq(Math.sign(mobBlack), Math.sign(diff));

  // 奇偶性
  eq(parityValue(5), 1);
  eq(parityValue(6), -1);
  eq(parityValue(1), 1);

  // 子数对等
  const board = emptyBoard();
  for (let i = 0; i < 30; i += 1) board[i] = BLACK;
  for (let i = 30; i < 50; i += 1) board[i] = WHITE;
  assert.ok(discValue(board, BLACK) > 0);
  eq(discValue(board, BLACK), -discValue(board, WHITE), "子数对等必须零和");
});

test("稳定子因子：昂贵项在空位过多时短路为 0，空位进入尾声才真正参与评估", () => {
  const board = new Array(CELL_COUNT).fill(BLACK); // 满盘同色 ⇒ 全部稳定
  eq(stabilityValue(board, BLACK, 0), 100);
  eq(stabilityValue(board, WHITE, 0), -100);
  // 空位超过阈值时短路（阈值由 benchmark 实测确定）
  eq(stabilityValue(board, BLACK, STABILITY_EMPTY_LIMIT + 1), 0);
  eq(stabilityValue(board, BLACK, STABILITY_EMPTY_LIMIT), 100);
  assert.ok(STABILITY_EMPTY_LIMIT >= 20 && STABILITY_EMPTY_LIMIT <= 45, "阈值必须落在实测区间内");

  const half = new Array(CELL_COUNT).fill(BLACK);
  half[indexOf(4, 4)] = WHITE;
  assert.ok(stabilityValue(half, BLACK, 40) === 0, "空位 40 时应短路");
  assert.ok(stabilityValue(half, BLACK, 8) !== 0, "空位 8 时不应短路");
});

test("evaluate / evaluateSimple / evaluateFlips：口径不同、方向一致、绝不含随机", () => {
  const state = positionWithEmpties(2468, 16);
  const full = evaluate(state.board, state.current);
  const simple = evaluateSimple(state.board, state.current);
  assert.ok(Number.isInteger(full) && Number.isInteger(simple));
  eq(evaluate(state.board, state.current), full, "同局面必须同分（严禁随机）");
  eq(evaluateSimple(state.board, state.current), simple);

  // 棋手档只开两项：等价于两项各半
  eq(evaluateSimple(state.board, state.current), Math.round((squareValue(state.board, state.current) + mobilityValue(state.board, state.current)) / 2));

  // 见习档只认翻转数：口径必须等于"被夹住翻转的棋子数"
  const moves = legalMoves(state.board, state.current);
  const occupied = state.board.findIndex((cell) => cell !== EMPTY);
  for (const move of moves) {
    const flips = evaluateFlips(state.board, state.current, move);
    const child = placeDisc(state.board, move, state.current);
    const key = state.current === BLACK ? "black" : "white";
    eq(flips, countDiscs(child)[key] - countDiscs(state.board)[key] - 1, `翻转数口径 ${move}`);
    eq(flips, flipsOfReference(state.board, move, state.current), `翻转集合大小 ${move}`);
    assert.ok(flips >= 1);
  }
  eq(evaluateFlips(state.board, state.current, occupied), 0, "已有子格翻转数为 0");
  const illegal = state.board.findIndex((cell, i) => cell === EMPTY && !moves.includes(i));
  if (illegal >= 0) eq(evaluateFlips(state.board, state.current, illegal), 0, "非法空格翻转数为 0");

  // 阶段权重切换后，同一盘面的分数会变（说明阶段真的参与了打分）
  const early = phaseWeights(3, 57);
  const late = phaseWeights(57, 3);
  assert.notDeepEqual(early, late);
});

// ─── 完美区间：AI 必须与权威求解器逐位一致 ────────────────────────
test("完美区间交叉验证：空位 ≤ 档位阈值时，AI 的分数与最优首手都必须来自求解器", () => {
  for (let seed = 1; seed <= 14; seed += 1) {
    const target = 4 + (seed % 5); // 4..8
    const state = positionWithEmpties(seed * 104729, target);
    const empties = countDiscs(state.board).empty;
    if (empties !== target) continue;
    const exact = solveExact(state.board, state.current);

    for (const key of [TIER_DUELIST, TIER_VIRTUOSO, TIER_INFALLIBLE]) {
      const cfg = tierConfig(key);
      if (empties > cfg.perfectEmpties) continue;
      const ai = chooseMove(state.board, state.current, key);
      eq(ai.exact, true, `${key} 在空位 ${empties} 必须走完美求解路径`);
      eq(ai.score, exact.score, `${key} seed=${seed} 分数必须等于精确终局值`);
      assert.ok(exact.moves.includes(ai.move), `${key} seed=${seed} 首手 ${ai.move} 不在最优集合 ${exact.moves}`);
      // 权威标尺复核：这一手的真实终局值必须等于最优分
      eq(exactValueAfter(state.board, state.current, ai.move), exact.score, `${key} seed=${seed} 首手实际值`);
    }
  }
});

test("无谬档零失误：同一局面重复求解逐位一致，且永远落在最优首手集合内", async () => {
  const state = positionWithEmpties(90210, 9);
  const exact = solveExact(state.board, state.current);
  const first = chooseMove(state.board, state.current, TIER_INFALLIBLE);
  for (let i = 0; i < 8; i += 1) {
    const again = chooseMove(state.board, state.current, TIER_INFALLIBLE);
    eq(again.move, first.move, "零失误档不得有随机分支");
    eq(again.score, first.score);
    eq(again.nodes, first.nodes);
  }
  assert.ok(exact.moves.includes(first.move));
  eq(first.blundered, undefined);

  // 无谬档不得在完美区间之外"声称完美"。
  // 中局深搜必须走分块异步 + 总预算，否则不限预算的 depth-10 会把测试拖到分钟级。
  const midgame = positionWithEmpties(4242, 30);
  const mid = await think(midgame.board, midgame.current, TIER_INFALLIBLE, {
    totalMs: 80,
    yielder: async () => {},
  });
  eq(mid.exact, false, "空位 30 时不得声称完美求解");
  assert.ok(legalMoves(midgame.board, midgame.current).includes(mid.move));
});

// ─── 随机只出现在该出现的地方，且必须可复现 ──────────────────────
test("见习档：只按翻转数挑点，并列时由注入的 rng 决定且同种子必然同结果", () => {
  const state = positionWithEmpties(777, 14);
  const moves = legalMoves(state.board, state.current);
  const flips = moves.map((move) => evaluateFlips(state.board, state.current, move));
  const best = Math.max(...flips);
  const winners = moves.filter((m, i) => flips[i] === best);

  for (let seed = 1; seed <= 12; seed += 1) {
    const a = chooseMove(state.board, state.current, TIER_NOVICE, { rng: mulberry32(seed) });
    const b = chooseMove(state.board, state.current, TIER_NOVICE, { rng: mulberry32(seed) });
    eq(a.move, b.move, "同种子必须同结果");
    eq(a.score, best, "见习档的高分必须等于最大翻转数");
    assert.ok(winners.includes(a.move) || a.blundered === true, "并列时必须落在最大翻转集合内");
  }
  // 不注入 rng 时退化为确定性取首
  const noRng = chooseMove(state.board, state.current, TIER_NOVICE);
  eq(noRng.move, winners[0]);
});

test("失误注入可复现：同种子两次完全一致，不同档位失误率不同（无谬恒不失误）", () => {
  const state = positionWithEmpties(5150, 40);

  for (const key of [TIER_NOVICE, TIER_DUELIST, TIER_VIRTUOSO]) {
    const a = chooseMove(state.board, state.current, key, { rng: mulberry32(20260928) });
    const b = chooseMove(state.board, state.current, key, { rng: mulberry32(20260928) });
    eq(a.move, b.move, `${key} 同种子必须同结果`);
    eq(Boolean(a.blundered), Boolean(b.blundered));
  }

  // 统计口径：同一局面下，无谬档零次失误；见习档必然出现明显失误。
  // 见习档只看一层，很便宜；无谬档改在小空位盘面上抽查（完美求解，微秒级），
  // 避免在 40 空位上跑不限预算的深搜把测试拖死。
  const cheap = positionWithEmpties(5150, 40);
  const small = positionWithEmpties(5150, 7);
  let noviceBlunders = 0;
  for (let seed = 1; seed <= 100; seed += 1) {
    const n = chooseMove(cheap.board, cheap.current, TIER_NOVICE, { rng: mulberry32(seed) });
    if (n.blundered) noviceBlunders += 1;
    const i = chooseMove(small.board, small.current, TIER_INFALLIBLE, { rng: mulberry32(seed) });
    eq(i.blundered, undefined, "无谬档无论什么种子都不得主动走劣着");
  }
  assert.ok(noviceBlunders >= 15, `见习档失误次数过低：${noviceBlunders}`);
  assert.ok(noviceBlunders <= 60, `见习档失误次数过高：${noviceBlunders}`);
});

// ─── 异步分块 ─────────────────────────────────────────────────────
test("异步分块：完美区间内结果与同步版逐位一致，并在切片边界让出主线程", async () => {
  const state = positionWithEmpties(13579, 8);
  const sync = chooseMove(state.board, state.current, TIER_INFALLIBLE);

  let yields = 0;
  let segStart = Date.now();
  let maxBlock = 0;
  const async = await think(state.board, state.current, TIER_INFALLIBLE, {
    yieldMs: 0, // 每个切片边界都让步，逼出最大的让步次数
    yielder: async () => {
      const block = Date.now() - segStart;
      if (block > maxBlock) maxBlock = block;
      yields += 1;
      segStart = Date.now();
    },
  });

  eq(async.move, sync.move, "异步版不得算出不同的棋");
  eq(async.score, sync.score);
  eq(async.nodes, sync.nodes);
  eq(async.exact, true);
  assert.ok(yields > 0, "完美区间也必须分块让步（按根着法切片）");
  eq(async.yields, yields);
  eq(async.aborts, 0, "完美区间不得发生中止");
  eq(async.budgetExhausted, false);
});

test("异步分块：非完美区间遵守总预算，绝不无限拖住主线程", async () => {
  const state = positionWithEmpties(24680, 32);
  let yields = 0;
  const started = Date.now();
  const result = await think(state.board, state.current, TIER_INFALLIBLE, {
    totalMs: 200,
    yielder: async () => {
      yields += 1;
    },
  });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 2000, `总预算 200ms 却耗时 ${elapsed}ms`);
  assert.ok(yields > 0, "长搜索必须发生让步");
  assert.ok(result.depth >= 1, "至少要完成一层搜索");
  assert.ok(result.depth <= tierConfig(TIER_INFALLIBLE).depth);
  assert.ok(legalMoves(state.board, state.current).includes(result.move), "必须在合法着法内");
});

test("AI 永不给出非法着法：完整对局与随机局面双重覆盖", async () => {
  // ① 快档（见习 / 棋手）不限预算下完整对局：每一手都必须被引擎接受，且必然打到终局
  for (const key of [TIER_NOVICE, TIER_DUELIST]) {
    const rng = mulberry32(0xc0ffee);
    let state = createState();
    let guard = 0;
    while (state.status === STATUS_PLAYING && guard < 200) {
      guard += 1;
      const legal = legalMoves(state.board, state.current);
      const result = chooseMove(state.board, state.current, key, { rng });
      assert.ok(legal.includes(result.move), `${key} 第 ${guard} 手 ${result.move} 非法`);
      const next = applyMove(state, result.move);
      assert.notStrictEqual(next, state, `${key} 第 ${guard} 手未被引擎接受`);
      eq(next.moves.length, state.moves.length + 1, `${key} 步数必须 +1`);
      state = next;
    }
    eq(state.status, "over", `${key} 必须打到终局`);
    const score = finalScore(state.board);
    // WOF 口径：只要分出胜负，终局比分合计恒为 64（余空归胜方）
    if (score.black !== score.white) eq(score.black + score.white, 64, `${key} 终局比分必须合计 64`);
    assert.ok(countDiscs(state.board).empty >= 0);
  }

  // ② 高档位：分块异步 + 小预算，在中局同样不得给出非法着法（单局 60 手太贵，改抽查局面）
  for (let seed = 1; seed <= 10; seed += 1) {
    const state = positionWithEmpties(seed * 977, 24 + (seed % 6));
    const legal = legalMoves(state.board, state.current);
    if (legal.length === 0) continue;
    for (const key of [TIER_VIRTUOSO, TIER_INFALLIBLE]) {
      const result = await think(state.board, state.current, key, {
        totalMs: 60,
        yielder: async () => {},
      });
      assert.ok(legal.includes(result.move), `${key} seed=${seed} 给出非法着法 ${result.move}`);
    }
  }

  // ③ 廉价档位在杂乱局面下的批量抽查
  for (let seed = 1; seed <= 30; seed += 1) {
    const state = positionWithEmpties(seed * 977, 30 + (seed % 4));
    const legal = legalMoves(state.board, state.current);
    if (legal.length === 0) continue;
    for (const key of [TIER_NOVICE, TIER_DUELIST]) {
      const result = chooseMove(state.board, state.current, key, { rng: mulberry32(seed) });
      assert.ok(legal.includes(result.move), `${key} seed=${seed} 给出非法着法 ${result.move}`);
    }
  }
});

// ─── 棋力梯度：用权威求解器度量着法质量（机器无关、确定性）───────
test("棋力梯度：四档在同一批中残局上的真实终局值均值必须逐档递增，无谬档 100% 最优", () => {
  const stats = new Map(TIER_KEYS.map((key) => [key, { sum: 0, optimal: 0, n: 0 }]));
  let optimalSum = 0;
  let positions = 0;

  for (let seed = 1; seed <= 12; seed += 1) {
    const target = 9 + (seed % 4); // 9..12 空位
    const state = positionWithEmpties(seed * 7919, target);
    const empties = countDiscs(state.board).empty;
    if (empties !== target) continue;
    positions += 1;
    const optimal = solveExact(state.board, state.current).score;
    optimalSum += optimal;

    for (const key of TIER_KEYS) {
      const result = chooseMove(state.board, state.current, key);
      const value = result.move < 0 ? optimal : exactValueAfter(state.board, state.current, result.move);
      const bucket = stats.get(key);
      bucket.sum += value;
      bucket.n += 1;
      if (value === optimal) bucket.optimal += 1;
    }
  }

  assert.ok(positions >= 10, `有效局面过少：${positions}`);
  const mean = (key) => stats.get(key).sum / stats.get(key).n;
  const lines = TIER_KEYS.map((key) => `${key}=${mean(key).toFixed(2)}(${stats.get(key).optimal}/${stats.get(key).n})`).join(" ");
  const optimalMean = optimalSum / positions;

  // ★ 无谬档必须在完美区间内 100% 走到最优
  eq(stats.get(TIER_INFALLIBLE).optimal, positions, `无谬档未达到全最优：${lines}`);
  eq(mean(TIER_INFALLIBLE), optimalMean, `无谬档均值必须等于最优均值：${lines}`);

  // ★ 阶梯必须可见：均值逐档递增
  assert.ok(mean(TIER_DUELIST) > mean(TIER_NOVICE), `棋手档未强于见习档：${lines}`);
  assert.ok(mean(TIER_VIRTUOSO) > mean(TIER_DUELIST), `名手档未强于棋手档：${lines}`);
  assert.ok(mean(TIER_INFALLIBLE) > mean(TIER_VIRTUOSO), `无谬档未强于名手档：${lines}`);
  assert.ok(stats.get(TIER_VIRTUOSO).optimal >= Math.ceil(positions / 2), `名手档最优率过低：${lines}`);
  assert.ok(stats.get(TIER_NOVICE).optimal < stats.get(TIER_VIRTUOSO).optimal, `见习档不该与名手档持平：${lines}`);
});

// ─── 性能护栏 ─────────────────────────────────────────────────────
test("性能：中局评估在预算内，完美区间求解在 1 秒内返回", () => {
  const midgame = positionWithEmpties(1123, 40);
  const t0 = Date.now();
  for (let i = 0; i < 100; i += 1) evaluate(midgame.board, midgame.current);
  const perEval = (Date.now() - t0) / 100;
  assert.ok(perEval < 8, `单次评估 ${perEval.toFixed(2)}ms 过慢`);

  const endgame = positionWithEmpties(9988, PERFECT_LIMIT);
  eq(countDiscs(endgame.board).empty, PERFECT_LIMIT);
  const t1 = Date.now();
  const result = chooseMove(endgame.board, endgame.current, TIER_INFALLIBLE);
  const elapsed = Date.now() - t1;
  eq(result.exact, true);
  assert.ok(elapsed < 3000, `无谬档在 ${PERFECT_LIMIT} 空位耗时 ${elapsed}ms`);
  eq(result.score, solveExact(endgame.board, endgame.current).score);
});

test("局面工具：parseBoard/formatBoard 与 AI 输入输出兼容", () => {
  const state = positionWithEmpties(4321, 20);
  const text = formatBoard(state.board);
  eq(text.length, CELL_COUNT);
  de(parseBoard(text), state.board);
  const result = chooseMove(state.board, state.current, TIER_DUELIST);
  assert.ok(result.move >= 0 && result.move < CELL_COUNT);
  assert.ok(result.nodes > 0);
  eq(finalDiff(state.board, BLACK), -finalDiff(state.board, WHITE));
});
