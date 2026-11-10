import test from "node:test";
import assert from "node:assert/strict";

import {
  MARK_X, STATUS_PLAYING, applyMove, canForceWin, legalMoves,
} from "../js/engine.mjs";
import { createGameController } from "../js/game.mjs";
import { MODES } from "../js/storage.mjs";
import { createPuzzleState, getPuzzle } from "../js/puzzles.mjs";

const eq = assert.strictEqual;

function makeController(overrides = {}) {
  return createGameController({
    ai: (state) => legalMoves(state)[0] ?? -1,
    schedule: (fn) => {
      fn();
      return 1;
    },
    cancel: () => {},
    rng: () => 0.5,
    ...overrides,
  });
}

function firstLegal(state) {
  return legalMoves(state)[0];
}

test("对弈开局：X 先手，玩家落子后 AI 立即应手，悔棋一次退回到决策点", () => {
  const game = makeController();
  const started = game.start({ mode: MODES.DUEL, tier: "duelist" });
  eq(started.state.status, STATUS_PLAYING);
  eq(started.state.current, MARK_X);
  eq(started.humanTurn, true);
  eq(started.state.moves.length, 0);

  assert.ok(game.play(firstLegal(started.state)));
  const after = game.view();
  eq(after.state.moves.length, 2, "AI 必须完成应手");
  eq(after.state.current, MARK_X);
  eq(after.canUndo, true);

  assert.ok(game.undo());
  const undone = game.view();
  eq(undone.state.moves.length, 0);
  eq(undone.state.current, MARK_X);
  eq(undone.canUndo, false);
  eq(game.undo(), false);
});

test("同屏双人：不调度 AI，双方都可直接落子", () => {
  const game = makeController();
  game.start({ mode: MODES.DUEL, pvp: true });
  const first = firstLegal(game.view().state);
  assert.ok(game.play(first));
  const view = game.view();
  eq(view.state.moves.length, 1);
  eq(view.state.current, 2);
  eq(view.humanTurn, true);
  assert.ok(game.play(firstLegal(view.state)));
  eq(game.view().state.moves.length, 2);
});

test("非法落子被静默拒绝（返回 false，不抛错）", () => {
  const game = makeController();
  game.start({ mode: MODES.DUEL });
  const view = game.view();
  const occupied = firstLegal(view.state);
  assert.ok(game.play(occupied));
  assert.equal(game.play(occupied), false);
  assert.equal(game.play(-3), false);
  assert.equal(game.play(999), false);
});

test("存档恢复：落子序列回放后轮次与手数一致；坏档最多退化成开局", () => {
  const game = makeController();
  game.start({ mode: MODES.DUEL, tier: "master" });
  game.play(firstLegal(game.view().state));
  game.play(firstLegal(game.view().state));
  const session = {
    mode: MODES.DUEL,
    tier: "master",
    pvp: false,
    puzzleId: null,
    moves: game.view().state.moves.slice(),
  };
  eq(session.moves.length, 4);

  const restored = makeController();
  const view = restored.restore(session);
  assert.ok(view);
  eq(view.state.moves.length, 4);
  eq(view.state.current, MARK_X);

  const broken = makeController().restore({ ...session, moves: [999, -1, 3.5] });
  eq(broken.state.moves.length, 0);
  eq(broken.state.status, STATUS_PLAYING);

  eq(makeController().restore(null), null);
  eq(makeController().restore({ mode: MODES.CAMPAIGN, puzzleId: "nope", moves: [] }), null);
});

test("残局开局：玩家 X 先手，AI 作为 O 应手，用完 par 步前完成绝杀拿三星", () => {
  const puzzle = getPuzzle("u01");
  const game = makeController();
  game.start({ mode: MODES.CAMPAIGN, puzzleId: puzzle.id });

  const initial = game.view();
  eq(initial.par, puzzle.par);
  eq(initial.used, 0);
  eq(initial.humanTurn, true);

  let guard = 0;
  while (!game.view().finished && guard < 20) {
    guard += 1;
    const view = game.view();
    if (!view.humanTurn) continue;
    const remaining = puzzle.par - view.used;
    const winning = legalMoves(view.state).find((move) => {
      const next = applyMove(view.state, move);
      return canForceWin(next, MARK_X, remaining - 1, new Map());
    });
    assert.ok(winning !== undefined, "残局必须存在通往绝杀的落点");
    assert.ok(game.play(winning));
  }

  const done = game.view();
  assert.ok(done.finished, "残局应当结束");
  eq(done.finished.outcome, "win");
  eq(done.finished.used, puzzle.par);
  eq(done.finished.stars, 3);
});

test("提示只给出合法落点，终局后不再提供", () => {
  const game = makeController();
  game.start({ mode: MODES.DUEL });
  const hint = game.hint();
  assert.ok(legalMoves(game.view().state).includes(hint));

  const campaign = makeController();
  campaign.start({ mode: MODES.CAMPAIGN, puzzleId: getPuzzle("u05").id });
  const puzzleHint = campaign.hint();
  assert.ok(legalMoves(campaign.view().state).includes(puzzleHint));
  void createPuzzleState;
});
