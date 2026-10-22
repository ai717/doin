// 规则引擎测试：走法生成、特殊规则、终局判定、不变式与 ≥1000 步随机游走。
import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";
import { mulberry32 } from "../js/rng.mjs";

const B = (rows) => rows.join("");

test("开局红方合法着法数 = 44", () => {
  const state = E.createState();
  assert.equal(E.legalMoves(state.board, E.RED).length, 44);
});

test("马蹩腿：初始马只有两个跳点", () => {
  const state = E.createState();
  const targets = E.legalMoves(state.board, E.RED)
    .filter((m) => m.from === E.idx(9, 1))
    .map((m) => E.cellName(m.to));
  assert.deepEqual(targets.sort(), ["a7", "c7"]);
});

test("象塞眼与不过河", () => {
  const state = E.createState();
  const targets = E.legalMoves(state.board, E.RED)
    .filter((m) => m.from === E.idx(9, 2))
    .map((m) => E.cellName(m.to));
  assert.deepEqual(targets.sort(), ["a7", "e7"]);
  // 黑象不过河：黑象在 (0,2) 只能到己半场 (2,0)/(2,4)；黑王 (0,5) 避开与红帅同列照面
  const board = E.parseBoard(B([
    "..b..k.b.",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    "....K....",
  ]));
  const blackTargets = E.legalMoves(board, E.BLACK)
    .filter((m) => m.from === E.idx(0, 2))
    .map((m) => E.cellName(m.to));
  assert.deepEqual(blackTargets.sort(), ["a2", "e2"]);
});

test("炮翻山：隔一子恰好吃、无架直行不吃", () => {
  const state = E.createState();
  const moves = E.legalMoves(state.board, E.RED).filter((m) => m.from === E.idx(7, 1));
  const tos = moves.map((m) => E.cellName(m.to));
  // 上行：b6..b3 直行，黑炮 b2 是炮架，b0 黑马是隔架目标
  assert.ok(tos.includes("b0"));
  assert.ok(!tos.includes("b2"));
  assert.ok(tos.includes("b8")); // 下行直行
  assert.equal(moves.length, 12);
});

test("将帅照面：同列无阻挡视为被将", () => {
  const board = E.parseBoard(B([
    "....k....",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    ".........",
    "....K....",
  ]));
  assert.equal(E.inCheck(board, E.RED), true);
  assert.equal(E.inCheck(board, E.BLACK), true);
});

test("应将强制：被将军时只能走解将着法", () => {
  // 黑车过河将军红帅（中路兵已抽空），红方仅能应将
  const board = E.parseBoard(B([
    "rnb.k.bnr",
    ".........",
    ".c.....c.",
    "p.p.p.p.p",
    "....r....",
    ".........",
    "P.P.P..P.",
    ".C.....C.",
    ".........",
    "RNBAKABNR",
  ]));
  const moves = E.legalMoves(board, E.RED);
  // 所有合法着法必须解除将军
  for (const move of moves) {
    const captured = E.makeMove(board, move);
    const g = E.generalIndex(board, E.RED);
    assert.equal(E.isAttacked(board, g, E.BLACK), false, `${E.cellName(move.from)}-${E.cellName(move.to)} 未解将`);
    E.unmakeMove(board, move, captured);
  }
  assert.ok(moves.length > 0 && moves.length < 44);
});

test("双车错一步杀：applyMove 判定 mate", () => {
  // 黑王 bare；红车 (5,3)->(5,4) 沿河将军，双兵锁王门、双车护兵
  const board = E.parseBoard(B([
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
  const state = E.createState({ board, turn: E.RED });
  const move = { from: E.idx(5, 3), to: E.idx(5, 4) };
  assert.ok(E.isLegalMove(state.board, E.RED, move));
  const next = E.applyMove(state, move);
  assert.equal(next.status, E.STATUS_OVER);
  assert.equal(next.result.kind, E.RESULT_MATE);
  assert.equal(next.result.winner, E.RED);
});

test("一步杀局面：杀着枚举与 mate 判定一致", () => {
  const board = E.parseBoard(B([
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
  const state = E.createState({ board, turn: E.RED });
  const moves = E.legalMoves(state.board, E.RED);
  const mates = moves.filter((m) => {
    const next = E.applyMove(state, m);
    return next.status === E.STATUS_OVER && next.result?.kind === E.RESULT_MATE;
  });
  // 双车锁边、沿河车、双兵底线均可成杀 —— 枚举 ≥2 且包含沿河车杀着
  assert.ok(mates.length >= 2);
  assert.ok(mates.some((m) => m.from === E.idx(5, 3) && m.to === E.idx(5, 4)));
});

test("困毙判负：红走子后黑无子可动且未被将军", () => {
  // 黑王 (0,4)：走前仅 (0,3) 可走（红帅 (9,2) 避开 col3/col4 照面线）；
  // 红马 (4,1)->(2,2) 后 (0,3) 被马控、(0,5)/(1,4) 被过河兵 (1,5) 控制 —— 困毙
  const board = E.parseBoard(B([
    "....k....",
    ".....P...",
    ".........",
    ".........",
    ".N.......",
    ".........",
    ".........",
    ".........",
    ".........",
    "..K......",
  ]));
  const state = E.createState({ board, turn: E.RED });
  assert.ok(E.legalMoves(board, E.BLACK).length > 0, "走前黑方须有应对");
  const next = E.applyMove(state, { from: E.idx(4, 1), to: E.idx(2, 2) });
  assert.equal(next.status, E.STATUS_OVER);
  assert.equal(next.result.kind, E.RESULT_STALEMATE);
  assert.equal(next.result.winner, E.RED);
});

test("三次重复局面判和", () => {
  // 双车与黑王各自来回横跳，8 步后回到初始局面（红帅 (9,3) 避开与黑王同列照面）
  const state0 = E.createState({
    board: E.parseBoard(B([
      "....k....",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      "R........",
      "...K.....",
    ])),
  });
  let s = state0;
  s = E.applyMove(s, { from: E.idx(8, 0), to: E.idx(7, 0) });
  s = E.applyMove(s, { from: E.idx(0, 4), to: E.idx(0, 5) });
  s = E.applyMove(s, { from: E.idx(7, 0), to: E.idx(8, 0) });
  s = E.applyMove(s, { from: E.idx(0, 5), to: E.idx(0, 4) });
  s = E.applyMove(s, { from: E.idx(8, 0), to: E.idx(7, 0) });
  s = E.applyMove(s, { from: E.idx(0, 4), to: E.idx(0, 5) });
  s = E.applyMove(s, { from: E.idx(7, 0), to: E.idx(8, 0) });
  s = E.applyMove(s, { from: E.idx(0, 5), to: E.idx(0, 4) });
  assert.equal(s.status, E.STATUS_OVER);
  assert.equal(s.result.kind, E.RESULT_REPETITION);
  assert.equal(s.result.winner, null);
});

test("长将判负：三次重复且行棋方连续将军", () => {
  // 直接构造状态：红方 checkStreak=2、目标局面重复计数=2；红车再将军一次即长将
  const state = E.createState({
    board: E.parseBoard(B([
      "....k....",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      "....R....",
      "K........",
    ])),
    turn: E.RED,
  });
  state.checkStreak[E.RED] = 2;
  const key = E.positionKey(E.parseBoard(B([
    "....k....",
    ".........",
    ".........",
    ".........",
    "....R....",
    ".........",
    ".........",
    ".........",
    ".........",
    "K........",
  ])), E.BLACK);
  state.posCounts[key] = 2;
  const next = E.applyMove(state, { from: E.idx(8, 4), to: E.idx(4, 4) });
  assert.equal(next.status, E.STATUS_OVER);
  assert.equal(next.result.kind, E.RESULT_PERPETUAL);
  assert.equal(next.result.winner, E.BLACK);
});

test("无攻子残局判和", () => {
  // 红帅(9,4)+士(9,3) vs 黑将(0,4)+士(1,4)：黑士挡住将帅同列照面；
  // 红士 (9,3)->(8,4) 后双方均无车马炮兵 —— 无攻子判和
  let state = E.createState({
    board: E.parseBoard(B([
      "....k....",
      "....a....",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      ".........",
      "...AK....",
    ])),
    turn: E.RED,
  });
  state = E.applyMove(state, { from: E.idx(9, 3), to: E.idx(8, 4) });
  assert.equal(state.status, E.STATUS_OVER);
  assert.equal(state.result.kind, E.RESULT_BARE);
  assert.equal(state.result.winner, null);
});

test("非法意图静默忽略：applyMove 返回原引用", () => {
  const state = E.createState();
  const same = E.applyMove(state, { from: E.idx(9, 0), to: E.idx(4, 0) }); // 车撞自家炮
  assert.equal(same, state);
  const same2 = E.applyMove(state, { from: E.idx(0, 0), to: E.idx(9, 0) }); // 不是红方棋子
  assert.equal(same2, state);
});

test("终局后操作一律 no-op", () => {
  const board = E.parseBoard(B([
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
  let state = E.createState({ board, turn: E.RED });
  state = E.applyMove(state, { from: E.idx(5, 3), to: E.idx(5, 4) });
  assert.equal(state.status, E.STATUS_OVER);
  const same = E.applyMove(state, { from: E.idx(1, 0), to: E.idx(0, 0) });
  assert.equal(same, state);
});

test("悔棋快照回滚：逐步撤销回到初始盘面", () => {
  let state = E.createState();
  const rng = mulberry32(20261019);
  const played = [];
  for (let i = 0; i < 12; i += 1) {
    const moves = E.legalMoves(state.board, state.turn);
    if (moves.length === 0 || state.status !== E.STATUS_PLAYING) break;
    const move = moves[Math.floor(rng() * moves.length)];
    played.push(move);
    state = E.applyMove(state, move);
  }
  assert.ok(state.history.length >= 12);
  for (let i = 0; i < played.length; i += 1) {
    state = E.undoMove(state);
  }
  assert.equal(E.serializeBoard(state.board), E.serializeBoard(E.parseBoard(E.START_BOARD)));
  assert.equal(state.turn, E.RED);
  assert.equal(state.moveCount, 0);
});

test("stepFrame 固定步长：100ms 推进 12 步且余数入 accumulator", () => {
  const state = E.createState();
  const next = E.stepFrame(state, 100);
  assert.ok(Math.abs(next.fx.clock - 100) < 1000 / 120, `clock=${next.fx.clock}`);
  assert.ok(next.fx.acc >= 0 && next.fx.acc < 1000 / 120);
  // 确定性：同输入同输出
  const again = E.stepFrame(state, 100);
  assert.equal(again.fx.clock, next.fx.clock);
});

test("随机游走 ≥1000 步：状态机不崩、不变式守恒", () => {
  const GAMES = 5;
  const STEPS = 400; // 5 × 400 = 2000 步
  let totalSteps = 0;
  for (let g = 0; g < GAMES; g += 1) {
    let state = E.createState();
    const rng = mulberry32(0xa11ce + g);
    let lastPieceCount = 32;
    for (let step = 0; step < STEPS; step += 1) {
      if (state.status !== E.STATUS_PLAYING) break;
      const moves = E.legalMoves(state.board, state.turn);
      if (moves.length === 0) break;
      const move = moves[Math.floor(rng() * moves.length)];
      const before = state;
      const next = E.applyMove(state, move);
      assert.notEqual(next, before, "合法着法必须执行");
      state = next;
      totalSteps += 1;
      // 不变式：棋子数守恒（只减不增）
      let count = 0;
      for (const piece of state.board) if (piece !== 0) count += 1;
      assert.ok(count <= lastPieceCount && count >= 2);
      lastPieceCount = count;
      // 不变式：双方将帅在盘（终局除外）
      if (state.status === E.STATUS_PLAYING) {
        assert.ok(E.generalIndex(state.board, E.RED) >= 0);
        assert.ok(E.generalIndex(state.board, E.BLACK) >= 0);
        assert.ok(state.turn === E.RED || state.turn === E.BLACK);
      } else {
        assert.ok(state.result);
      }
    }
  }
  assert.ok(totalSteps >= 1000, `随机游走步数不足: ${totalSteps}`);
});
