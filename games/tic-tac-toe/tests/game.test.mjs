import test from "node:test";
import assert from "node:assert/strict";
import { PLAYER_O, PLAYER_X, STATUS_DRAW, STATUS_PLAYING, STATUS_WON, createState } from "../js/engine.mjs";
import { MODES } from "../js/storage.mjs";
import { THINK_MAX_MS, THINK_MIN_MS, createGameController } from "../js/game.mjs";

// 把定时器换成手动队列，让 AI 的延迟调度在测试里变成可控的一步。
function harness(options = {}) {
  const queue = [];
  const controller = createGameController({
    rng: options.rng ?? (() => 0),
    schedule: (fn, ms) => {
      queue.push({ fn, ms });
      return queue.length - 1;
    },
    cancel: (handle) => {
      if (queue[handle]) queue[handle].cancelled = true;
    },
    ai: options.ai,
  });
  let view = null;
  controller.setOnChange((next) => {
    view = next;
  });
  return {
    controller,
    start: (opts) => {
      view = controller.start(opts);
      return view;
    },
    flush: () => {
      let guard = 0;
      while (queue.length && guard < 100) {
        const job = queue.shift();
        if (job.cancelled) continue;
        job.fn();
        guard += 1;
      }
    },
    pending: () => queue.length,
    last: () => queue[queue.length - 1],
    view: () => view,
  };
}

// 固定策略的 AI，方便断言回合流转而不受搜索结果影响
function scripted(moves) {
  let cursor = 0;
  return () => moves[cursor++ % moves.length];
}

test("开局：默认人机 3x3，玩家持红 X 先手", () => {
  const h = harness();
  const view = h.start();
  assert.equal(view.config.mode, MODES.PVE);
  assert.equal(view.config.size, 3);
  assert.equal(view.config.humanMark, PLAYER_X);
  assert.equal(view.config.aiMark, PLAYER_O);
  assert.equal(view.state.current, PLAYER_X);
  assert.equal(view.humanTurn, true);
  assert.equal(view.thinking, false);
  assert.equal(h.pending(), 0, "玩家先手时不应调度 AI");
});

test("AI 回合：玩家落子后被调度，思考延迟落在 250–550ms", () => {
  const h = harness({ ai: scripted([8]) });
  h.start();
  assert.equal(h.controller.play(0), true);
  assert.equal(h.view().thinking, true);
  assert.ok(h.last().ms >= THINK_MIN_MS);
  assert.ok(h.last().ms <= THINK_MAX_MS);

  h.flush();
  assert.equal(h.view().thinking, false);
  assert.equal(h.view().state.board[8], PLAYER_O);
  assert.equal(h.view().humanTurn, true);
});

test("思考中拒绝玩家落子，也禁止悔棋", () => {
  const h = harness({ ai: scripted([8]) });
  h.start();
  h.controller.play(0);
  assert.equal(h.view().thinking, true);
  assert.equal(h.controller.play(1), false);
  assert.equal(h.view().canUndo, false);
  h.flush();
  assert.equal(h.view().canUndo, true);
});

test("先后手每局自动轮换，显式指定优先", () => {
  const h = harness();
  assert.equal(h.start().config.firstPlayer, PLAYER_X);
  assert.equal(h.start().config.firstPlayer, PLAYER_O);
  assert.equal(h.start().config.firstPlayer, PLAYER_X);
  assert.equal(h.start({ firstPlayer: PLAYER_O }).config.firstPlayer, PLAYER_O);
});

test("AI 先手时开局即进入思考", () => {
  const h = harness({ ai: scripted([4]) });
  h.start({ firstPlayer: PLAYER_O });
  assert.equal(h.view().thinking, true);
  h.flush();
  assert.equal(h.view().state.board[4], PLAYER_O);
});

test("悔棋：人机模式一次撤销「玩家那一手 + AI 的回应」", () => {
  const h = harness({ ai: scripted([8, 7]) });
  h.start();
  h.controller.play(0);
  h.flush();
  h.controller.play(1);
  h.flush();

  assert.deepEqual(h.view().state.moves, [0, 8, 1, 7]);
  assert.equal(h.controller.undo(), true);
  assert.deepEqual(h.view().state.moves, [0, 8]);
  assert.equal(h.view().humanTurn, true);
  assert.equal(h.controller.undo(), true);
  assert.deepEqual(h.view().state.moves, []);
  assert.equal(h.controller.undo(), false, "没有历史时悔棋应失败");
});

test("悔棋会取消尚未执行的 AI 思考", () => {
  const h = harness({ ai: scripted([8]) });
  h.start();
  h.controller.play(0);
  assert.equal(h.pending(), 1);
  assert.equal(h.controller.undo(), true);
  assert.equal(h.view().thinking, false);
  assert.deepEqual(h.view().state.moves, []);
  h.flush();
  assert.deepEqual(h.view().state.moves, [], "被撤销的 AI 手不应补落");
});

test("双人同屏：不调度 AI，悔棋只退一步", () => {
  const h = harness();
  h.start({ mode: MODES.PVP });
  assert.equal(h.controller.play(0), true);
  assert.equal(h.pending(), 0, "双人模式不应调度 AI");
  assert.equal(h.controller.play(1), true);
  assert.deepEqual(h.view().state.moves, [0, 1]);
  assert.equal(h.controller.undo(), true);
  assert.deepEqual(h.view().state.moves, [0]);
});

test("终局：停止调度 AI，落子与悔棋均失效", () => {
  const h = harness({ ai: scripted([3, 6]) });
  h.start();
  h.controller.play(0);
  h.flush();
  h.controller.play(1);
  h.flush();
  h.controller.play(2);
  assert.equal(h.view().state.status, STATUS_WON);
  assert.equal(h.pending(), 0);
  assert.equal(h.controller.play(4), false);
  assert.equal(h.view().canUndo, false);
  assert.equal(h.controller.undo(), false, "已结算的一局不允许悔棋");
});

test("结算：人机出分，双人同屏不计分", () => {
  const h = harness({ ai: scripted([3, 6]) });
  h.start({ difficulty: "normal" });
  h.controller.play(0);
  h.flush();
  h.controller.play(1);
  h.flush();
  h.controller.play(2);

  const won = h.controller.result(0);
  assert.equal(won.outcome, "win");
  assert.equal(won.score.base, 100);
  assert.ok(won.score.total >= 100);

  const pvp = harness();
  pvp.start({ mode: MODES.PVP });
  // X 抢下行 0：0,1,2；O 走 3,4 来不及拦
  for (const move of [0, 3, 1, 4, 2]) assert.equal(pvp.controller.play(move), true);
  assert.equal(pvp.view().state.status, STATUS_WON);
  assert.equal(pvp.controller.result(0), null, "双人模式不结算积分");
});

test("restore: 回放存档中的落子序列并续上回合", () => {
  const h = harness({ ai: scripted([8]) });
  const view = h.controller.restore({
    size: 3,
    winLength: 3,
    mode: MODES.PVE,
    difficulty: "normal",
    aiMark: PLAYER_O,
    firstPlayer: PLAYER_X,
    moves: [4, 0],
  });
  assert.deepEqual(view.state.moves, [4, 0]);
  assert.equal(view.state.current, PLAYER_X);
  assert.equal(h.view().humanTurn, true);
  h.flush();
  assert.deepEqual(h.view().state.moves, [4, 0]);
});

test("restore: 恢复到已终局的存档时直接给出结算", () => {
  const h = harness();
  h.controller.restore({
    size: 3,
    winLength: 3,
    mode: MODES.PVE,
    difficulty: "master",
    aiMark: PLAYER_O,
    firstPlayer: PLAYER_X,
    moves: [0, 3, 1, 4, 2],
  });
  assert.equal(h.view().state.status, STATUS_WON);
  assert.equal(h.view().finished.outcome, "win");
  assert.equal(h.controller.result(0).score.factor, 1.6);
});

test("restore: 空 session 返回 null 而不是抛错", () => {
  const h = harness();
  assert.equal(h.controller.restore(null), null);
});

test("4x4 整局可跑通并正确结算", () => {
  const h = harness({ ai: scripted([4, 5, 6]) });
  h.start({ size: 4 });
  for (const move of [0, 1, 2, 3]) {
    if (h.view().state.status !== STATUS_PLAYING) break;
    assert.equal(h.controller.play(move), true);
    h.flush();
  }
  assert.equal(h.view().state.status, STATUS_WON);
  assert.deepEqual(h.view().state.winLine, [0, 1, 2, 3]);
  assert.equal(h.view().finished.outcome, "win");
  assert.ok(h.controller.result(0).score.total > 0);
  assert.equal(h.controller.play(8), false, "终局后不应接受落子");
});

test("switch: 切换设置会重建对局并清空历史", () => {
  const h = harness({ ai: scripted([8]) });
  h.start();
  h.controller.play(0);
  h.flush();
  assert.equal(h.view().canUndo, true);
  h.start({ size: 4, difficulty: "master" });
  assert.equal(h.view().config.size, 4);
  assert.equal(h.view().config.difficulty, "master");
  assert.equal(h.view().canUndo, false);
  assert.equal(h.view().state.board.length, 16);
});
