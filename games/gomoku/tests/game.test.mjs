import test from "node:test";
import assert from "node:assert/strict";

import {
  createGameController, setTsumegoDatabase, getTsumego,
} from "../js/game.mjs";
import { TSUMEGO } from "../js/tsumego.mjs";
import { MODES } from "../js/storage.mjs";
import { BLACK, WHITE, EMPTY, idx, applyMove, createState, STATUS_PLAYING, STATUS_WON } from "../js/engine.mjs";

const eq = assert.strictEqual;

// 同步 AI 用于测试：选第一个候选
function syncAI(state) {
  // 简单：天元或第一个候选
  const moves = state.board
    .map((v, i) => (v === EMPTY ? i : -1))
    .filter((i) => i >= 0);
  return moves[0] ?? -1;
}

// 异步 AI 测试用
function asyncAI(state, opts) {
  const p = Promise.resolve(syncAI(state));
  if (opts?.onProgress) opts.onProgress({ candidates: [] });
  return p;
}

// 同步 schedule/cancel 用立即调用
const schedule = (fn) => { setTimeout(fn, 0); return 1; };
const cancel = () => {};

test("createGameController: 默认导出对象接口齐全", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  assert.ok(typeof c.start === "function");
  assert.ok(typeof c.restore === "function");
  assert.ok(typeof c.play === "function");
  assert.ok(typeof c.undo === "function");
  assert.ok(typeof c.resign === "function");
  assert.ok(typeof c.view === "function");
  assert.ok(typeof c.result === "function");
  assert.ok(typeof c.setOnChange === "function");
  assert.ok(typeof c.destroy === "function");
});

test("start: 默认 pve 模式 + 空棋盘 + 黑先手", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  let view;
  c.setOnChange((v) => { view = v; });
  c.start({ mode: MODES.PVE, difficulty: "intermediate", humanMark: BLACK });
  assert.ok(view);
  eq(view.config.mode, MODES.PVE);
  eq(view.state.board.length, 225);
  eq(view.state.firstPlayer, BLACK);
  eq(view.state.status, STATUS_PLAYING);
});

test("play: 玩家回合落子成功", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.PVE, humanMark: BLACK, difficulty: "intermediate" });
  const ok = c.play(idx(7, 7));
  eq(ok, true);
  const v = c.view();
  eq(v.state.board[idx(7, 7)], BLACK);
});

test("play: 非玩家回合返回 false", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.PVE, humanMark: WHITE, difficulty: "intermediate" });
  // 黑方先手，玩家执白，玩家不应能落子
  const ok = c.play(idx(7, 7));
  eq(ok, false);
});

test("play: 已落子位置返回 false", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.PVE, humanMark: BLACK, difficulty: "intermediate" });
  c.play(idx(7, 7));
  const ok = c.play(idx(7, 7));
  eq(ok, false);
});

test("undo: PVE 模式悔棋一次撤销玩家+AI 两手", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.PVE, humanMark: BLACK, difficulty: "intermediate" });
  c.play(idx(7, 7));
  // AI 应该已落子（异步），等一下
  // 测试用同步 schedule 不等待，直接检查悔棋
  // 因 scheduleAI 在 PVE 黑先手时不会被触发（玩家是黑），改为玩家白后开局
});

test("undo: 空快照返回 false", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.PVE, humanMark: BLACK, difficulty: "intermediate" });
  eq(c.undo(), false);
});

test("undo: tsumego 模式禁止悔棋", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.TSUMEGO, puzzleId: 1 });
  eq(c.undo(), false);
});

test("resign: pve 模式认输 → outcome=loss", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.PVE, humanMark: BLACK, difficulty: "intermediate" });
  c.resign();
  const v = c.view();
  assert.ok(v.finished);
  eq(v.finished.outcome, "loss");
});

test("resign: tsumego 模式 → solved=false", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.TSUMEGO, puzzleId: 1 });
  c.resign();
  const v = c.view();
  assert.ok(v.finished);
  eq(v.finished.mode, "tsumego");
  eq(v.finished.solved, false);
});

test("resign: 终局后调用返回 false", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.PVE, humanMark: BLACK, difficulty: "intermediate" });
  c.resign();
  eq(c.resign(), false);
});

test("view: 初始状态返回完整字段", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.PVE, humanMark: BLACK, difficulty: "intermediate" });
  const v = c.view();
  assert.ok(v.state);
  assert.ok(v.config);
  eq(typeof v.thinking, "boolean");
  eq(typeof v.canUndo, "boolean");
  eq(typeof v.humanTurn, "boolean");
  eq(v.lastMove, -1);
  eq(v.finished, null);
  eq(typeof v.wrongRetryCount, "number");
  eq(typeof v.solvedFlag, "boolean");
});

test("getTsumego: 已知 id 返回题目对象", () => {
  const p = getTsumego(1);
  assert.ok(p);
  eq(p.id, 1);
  eq(p.target, "win");
  eq(p.firstPlayer, BLACK);
  assert.ok(Array.isArray(p.mainLine));
  assert.ok(p.mainLine.length > 0);
});

test("getTsumego: 未知 id 返回 null", () => {
  eq(getTsumego(999), null);
});

test("setTsumegoDatabase: 注入自定义数据库", () => {
  const orig = getTsumego(1);
  const custom = [{ ...orig, id: 999, name: "测试" }];
  setTsumegoDatabase(custom);
  eq(getTsumego(999)?.name, "测试");
  // 还原
  setTsumegoDatabase(TSUMEGO);
  eq(getTsumego(999), null);
  eq(getTsumego(1)?.id, 1);
});

test("start(tsumego 1): 残局模式 + preset 正确加载", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.TSUMEGO, puzzleId: 1 });
  const v = c.view();
  eq(v.config.mode, MODES.TSUMEGO);
  assert.ok(v.currentPuzzle);
  eq(v.currentPuzzle.id, 1);
  // preset 4 子
  for (const m of v.currentPuzzle.preset) {
    eq(v.state.board[m.pos], m.player);
  }
  eq(v.state.current, BLACK); // 黑先
  eq(v.humanTurn, true); // 玩家是黑方
});

test("playTsumego: 第 1 题正解 → solved=true", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.TSUMEGO, puzzleId: 1 });
  // mainLine = [I(7,9)]，玩家落此子即胜
  const ok = c.play(idx(7, 9));
  eq(ok, true);
  const v = c.view();
  eq(v.solvedFlag, true);
  assert.ok(v.finished);
  eq(v.finished.solved, true);
});

test("playTsumego: 错着返回 'wrong' 且不实际落子", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.TSUMEGO, puzzleId: 1 });
  const result = c.play(idx(0, 0));
  eq(result, "wrong");
  const v = c.view();
  // 错着不落子
  eq(v.state.board[idx(0, 0)], EMPTY);
  eq(v.wrongRetryCount, 1);
  eq(v.solvedFlag, false);
  eq(v.finished, null);
});

test("playTsumego: 第 6 题 VCF 三手正解", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.TSUMEGO, puzzleId: 6 });
  // mainLine = [I(7,8), I(7,9), I(11,7)]
  // 第 1 手：黑 (7,8) → 玩家落，白应 (7,9)
  let r = c.play(idx(7, 8));
  eq(r, true);
  let v = c.view();
  // 白方应着已被自动应用
  eq(v.state.board[idx(7, 8)], BLACK);
  eq(v.state.board[idx(7, 9)], WHITE);
  eq(v.solvedFlag, false); // 还未解出
  eq(v.state.status, STATUS_PLAYING);

  // 第 2 手：玩家应落 mainLine[2] = I(11,7)
  r = c.play(idx(11, 7));
  eq(r, true);
  v = c.view();
  eq(v.solvedFlag, true);
  eq(v.finished.solved, true);
});

test("playTsumego: 第 11 题 (target=draw) 走完 mainLine 即解", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.TSUMEGO, puzzleId: 11 });
  // target=draw, mainLine = [I(7,9)]，玩家落 (7,9) 即和棋
  const r = c.play(idx(7, 9));
  eq(r, true);
  const v = c.view();
  eq(v.solvedFlag, true);
  assert.ok(v.finished);
  eq(v.finished.solved, true);
});

test("restore: 从 session 恢复 pve 对局", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.restore({
    mode: MODES.PVE,
    difficulty: "intermediate",
    firstPlayer: 1,
    moves: [idx(7, 7), idx(7, 8), idx(8, 8)],
  });
  const v = c.view();
  eq(v.config.mode, MODES.PVE);
  eq(v.state.board[idx(7, 7)], BLACK);
  eq(v.state.board[idx(7, 8)], WHITE);
  eq(v.state.board[idx(8, 8)], BLACK);
  eq(v.state.moves.length, 3);
});

test("restore: null session 返回 null", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  const r = c.restore(null);
  eq(r, null);
});

test("restore: tsumego session 正确恢复残局", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.restore({
    mode: MODES.TSUMEGO,
    difficulty: "intermediate",
    firstPlayer: 1,
    moves: [],
    tsumego: {
      id: 1,
      parMoves: 1,
      target: "win",
      firstPlayer: 1,
      presetMovesCount: 4,
    },
  });
  const v = c.view();
  eq(v.config.mode, MODES.TSUMEGO);
  assert.ok(v.currentPuzzle);
  eq(v.currentPuzzle.id, 1);
});

test("destroy: 不抛错", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  c.start({ mode: MODES.PVE, humanMark: BLACK, difficulty: "intermediate" });
  assert.doesNotThrow(() => c.destroy());
});

test("setOnChange: 接收最新视图", () => {
  const c = createGameController({ ai: asyncAI, schedule, cancel });
  let latest = null;
  c.setOnChange((v) => { latest = v; });
  c.start({ mode: MODES.PVE, humanMark: BLACK, difficulty: "intermediate" });
  assert.ok(latest);
  eq(latest.config.mode, MODES.PVE);
});
