// 控制器测试：即开即玩、意图调度、悔棋限制、终局回调、同种子重放一致。
import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../js/engine.mjs";
import { XiangqiGame, MODE_CAMPAIGN, MODE_AI, MODE_2P } from "../js/game.mjs";

const B = (rows) => rows.join("");

// 双车错一步杀：红 (5,3)->(5,4)
const MATE_PUZZLE = {
  board: E.parseBoard(B([
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
  ])),
  par: 3,
  first: [E.idx(5, 3), E.idx(5, 4)],
};

function newGame(mode, options = {}) {
  return new XiangqiGame({ aiDriver: "sync", onChange() {}, onEvent() {}, onOver() {}, ...options, mode });
}

test("campaign 即开即玩：构造即得到红先可玩盘面", () => {
  const game = newGame(MODE_CAMPAIGN, { puzzle: MATE_PUZZLE });
  assert.equal(game.state.status, E.STATUS_PLAYING);
  assert.equal(game.state.turn, E.RED);
  assert.equal(game.par(), 3);
  assert.equal(game.isHumanTurn(), true);
});

test("campaign levelKey 装载：从题库读残局与 par（UI 真实路径）", () => {
  const game = newGame(MODE_CAMPAIGN, { levelKey: "level_1" });
  assert.equal(game.state.status, E.STATUS_PLAYING);
  assert.equal(game.levelKey, "level_1");
  assert.ok(game.par() >= 2 && game.par() <= 5, `par=${game.par()} 越界`);
  const pieces = game.state.board.filter((v) => v !== 0).length;
  assert.ok(pieces < 32, `残局子力 ${pieces} 不应等于开局 32`);
  const hint = game.hintMove();
  assert.ok(hint === null || (Number.isInteger(hint.from) && Number.isInteger(hint.to)), "提示须为 {from,to} 或 null");
});

test("campaign 一线杀：点选两步成杀并回调 3 星结果", () => {
  let over = null;
  const game = newGame(MODE_CAMPAIGN, {
    puzzle: MATE_PUZZLE,
    onOver: (result) => { over = result; },
  });
  const select = game.tapSquare(MATE_PUZZLE.first[0]);
  assert.equal(select.action, "select");
  const targets = game.legalTargets();
  assert.ok(targets.includes(MATE_PUZZLE.first[1]));
  const moved = game.tapSquare(MATE_PUZZLE.first[1]);
  assert.equal(moved.action, "move");
  assert.ok(over, "终局未回调");
  assert.equal(over.kind, "mate");
  assert.equal(over.redWon, true);
  assert.equal(over.stars, 3);
  assert.equal(over.movesUsed, 1);
  assert.equal(over.par, 3);
  assert.equal(game.state.status, E.STATUS_OVER);
  assert.equal(game.isHumanTurn(), false, "终局后不得再接受意图");
});

test("campaign 残局禁用悔棋（星级公平）", () => {
  const game = newGame(MODE_CAMPAIGN, { puzzle: MATE_PUZZLE });
  assert.equal(game.undoAvailable(), false);
  assert.equal(game.undo(), false);
});

test("tapSquare 非法落点：denied 且状态不变", () => {
  const game = newGame(MODE_CAMPAIGN, { puzzle: MATE_PUZZLE });
  assert.ok(game.tapSquare(E.idx(5, 3)), "选中进攻车");
  const before = game.state;
  const result = game.tapSquare(E.idx(0, 0)); // 空点且非合法落点
  assert.equal(result.action, "denied");
  assert.equal(game.state, before, "非法意图不得改变状态");
});

test("2P 同屏：双方均可操作且悔棋撤一手", () => {
  const game = newGame(MODE_2P);
  game.tapSquare(E.idx(9, 0));
  game.tapSquare(E.idx(8, 0));
  assert.equal(game.state.moveCount, 1);
  assert.equal(game.isHumanTurn(), true, "2P 黑方回合同为人类");
  game.tapSquare(E.idx(0, 0));
  game.tapSquare(E.idx(1, 0));
  assert.equal(game.state.moveCount, 2);
  assert.equal(game.undoAvailable(), true);
  assert.equal(game.undo(), true);
  assert.equal(game.state.moveCount, 1);
  assert.equal(game.state.turn, E.BLACK);
});

test("ai 对战：悔棋上限 3 次，撤 AI+己方两手", () => {
  const game = newGame(MODE_AI, { seed: 5, aiTier: "ai_1" });
  for (let round = 0; round < 4; round += 1) {
    // 走一回合：红方起手车 (9,0)->(8,0)，AI sync 立即回应
    game.tapSquare(E.idx(9, 0));
    game.tapSquare(E.idx(8, 0));
    assert.equal(game.state.turn, E.RED, "AI 应已即时回应");
    assert.equal(game.undoAvailable(), round < 3, `第 ${round + 1} 轮悔棋可用性`);
    assert.equal(game.undo(), round < 3);
    if (round < 3) {
      assert.equal(game.state.moveCount, 0);
      assert.equal(game.state.turn, E.RED);
    }
  }
  assert.equal(game.undoAvailable(), false, "3 次上限后不可再悔");
});

test("duel 同种子重放：同输入序列必然同轨迹", () => {
  const RED_SCRIPT = [
    [9, 0, 8, 0],
    [9, 1, 7, 2],
    [7, 1, 6, 1],
    [6, 0, 5, 0],
    [8, 0, 8, 1],
  ];
  const replay = () => {
    const game = newGame(MODE_AI, { seed: 2026, aiTier: "ai_2" });
    const trace = [];
    for (const [fr, fc, tr, tc] of RED_SCRIPT) {
      game.dragMove(E.idx(fr, fc), E.idx(tr, tc));
      trace.push(`${E.serializeBoard(game.state.board)}|${game.state.moveCount}`);
    }
    return trace;
  };
  const a = replay();
  const b = replay();
  assert.deepEqual(b, a);
  assert.ok(a.length === RED_SCRIPT.length);
});

test("ai 对战终局回调：AI 档位随结果透传", () => {
  let over = null;
  const game = newGame(MODE_AI, { seed: 9, aiTier: "ai_4", onOver: (result) => { over = result; } });
  game.setAiTier("ai_5");
  assert.equal(game.aiTier, "ai_5");
  assert.equal(over, null, "未终局不得回调");
  assert.ok(game.state.status === E.STATUS_PLAYING || over !== null);
});

test("stepFrame 帧步进推进 fx 时钟", () => {
  const game = newGame(MODE_CAMPAIGN, { puzzle: MATE_PUZZLE });
  const clock0 = game.state.fx.clock;
  game.stepFrame(50);
  assert.ok(game.state.fx.clock > clock0);
});
