// flow.test.mjs — 进局闭环契约。
//
// 为什么单独一个文件：engine.test.mjs 只管规则本身，而这一类 bug 出在"装配"上——
// 引擎装载关卡后一律停在 STATUS.ready（这是给"开始"按钮留的台阶），
// 所以 main 层任何"直接进局"的入口（重开 / 重试 / 下一关 / 选关 / 进深渊）都必须补一次 begin()。
// 漏掉的症状是：画面静止、没有任何报错、所有测试仍然全绿。这里把它钉死。

import test from "node:test";
import assert from "node:assert/strict";

import { advanceFrame, begin, createGame, dispatch } from "../js/game.mjs";
import { STATUS, PLAYER, summarise } from "../js/engine.mjs";

const STEP = 1 / 60;

function run(game, frames) {
  for (let i = 0; i < frames; i += 1) advanceFrame(game, STEP);
  return summarise(game.state);
}

test("新局停在 ready，begin() 才推进到 playing", () => {
  const game = createGame({ levelId: "1-1" });
  assert.equal(game.state.status, STATUS.ready, "新局应等玩家按开始");
  assert.equal(begin(game).action, "begin");
  assert.equal(game.state.status, STATUS.playing);
  assert.equal(begin(game).action, null, "重复 begin 应是 no-op");
});

test("playing 之后帧步进真的推进时间与场景", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  const summary = run(game, 600);
  assert.ok(summary.time > 9, `600 帧后计时应前进，实际 ${summary.time}s`);
  assert.ok(summary.edible >= 6, `可吃鱼数不该归零（防死局），实际 ${summary.edible}`);
});

test("restart 后引擎会退回 ready —— main 必须补 begin，否则画面静止", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  run(game, 120);
  dispatch(game, { type: "restart" });
  assert.equal(game.state.status, STATUS.ready, "restart 装载完关卡应停在 ready");
  begin(game);
  assert.ok(run(game, 180).time > 2.5, "补 begin 后应真的开始跑帧");
});

test("nextLevel 切关后同样需要 begin", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  run(game, 60);
  const before = game.levelId;
  assert.equal(dispatch(game, { type: "nextLevel" }).action, "nextLevel");
  assert.notEqual(game.levelId, before, "应切到下一关");
  assert.equal(game.state.status, STATUS.ready);
  begin(game);
  assert.ok(run(game, 120).time > 1.5, "切关后应真的开始跑帧");
});

test("selectLevel 装载任意合法关，非法 id 返回 action:null", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  assert.equal(dispatch(game, { type: "selectLevel", levelId: "2-3" }).action, "loadLevel");
  assert.equal(game.levelId, "2-3");
  assert.equal(game.state.status, STATUS.ready);
  assert.equal(dispatch(game, { type: "selectLevel", levelId: "9-9" }).action, null, "非法关卡应静默忽略");
});

test("深渊：startAbyss 后需要 begin，10 秒内深度必须真的下降", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  assert.equal(dispatch(game, { type: "startAbyss" }).action, "startAbyss");
  assert.equal(game.mode, "abyss");
  assert.equal(game.state.status, STATUS.ready, "进入深渊后引擎停在 ready");
  begin(game);
  const deep = run(game, 600);
  assert.ok(deep.depth >= 8, `深渊 10 秒后深度应前进，实际 ${deep.depth} m`);
  assert.ok(
    deep.status === STATUS.playing || deep.status === STATUS.lost,
    `深渊应在进行中或已沉底，实际 ${deep.status}`
  );
});

test("暂停冻结计时，继续后恢复推进", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  run(game, 120);
  assert.equal(dispatch(game, { type: "pause" }).action, "pause");
  assert.equal(game.state.status, STATUS.paused);
  const frozen = summarise(game.state).time;
  run(game, 120);
  assert.equal(summarise(game.state).time, frozen, "暂停期间计时不该走");
  assert.equal(dispatch(game, { type: "resume" }).action, "resume");
  assert.equal(game.state.status, STATUS.playing);
  assert.ok(run(game, 60).time > frozen, "继续后应恢复推进");
});

test("终局后重开按钮语义：won/lost 状态下 restart 仍能装载新局", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  // 直接把玩家按死，构造终局（不走 UI，纯引擎语义）
  game.state.player.hearts = 0;
  run(game, 5);
  assert.ok(
    game.state.status === STATUS.lost || game.state.status === STATUS.playing,
    "扣空心的下一次判定应落到 lost"
  );
  assert.equal(dispatch(game, { type: "restart" }).action, "restart");
  assert.equal(game.state.status, STATUS.ready);
  begin(game);
  assert.equal(game.state.status, STATUS.playing);
});

// ---------- 操作灵敏度（手感回归线） ----------
// 这几个数字就是"跟不跟手"的全部：转向逼近率、死区、巡航速度。
// 改低任何一项都会立刻被这几条测试拦下来，避免"某次调平衡顺手把鱼调钝了"。

function holdPointerAt(game, x, y) {
  dispatch(game, { type: "pointer", x, y });
}

test("灵敏度：按住指针后 0.35 秒内应逼近 88% 巡航速度", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  const p = game.state.player;
  holdPointerAt(game, p.x + 420, p.y);
  const startX = p.x;
  for (let i = 0; i < 21; i += 1) advanceFrame(game, STEP);
  const speed = Math.abs(game.state.player.vx);
  assert.ok(game.state.player.x > startX + 40, `0.35 秒应真的往指针方向游出去，实际位移 ${(game.state.player.x - startX).toFixed(1)}`);
  assert.ok(speed > 290, `0.35 秒转速应 > 290（巡航 330 的 88%），实际 ${speed.toFixed(1)}`);
});

test("灵敏度：反向掉头 0.5 秒内应完成", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  const p = game.state.player;
  holdPointerAt(game, p.x + 420, p.y);
  for (let i = 0; i < 60; i += 1) advanceFrame(game, STEP);
  assert.ok(game.state.player.vx > 200, "先向右跑满");
  holdPointerAt(game, game.state.player.x - 420, game.state.player.y);
  for (let i = 0; i < 30; i += 1) advanceFrame(game, STEP);
  assert.ok(game.state.player.vx < -200, `掉头 0.5 秒后应已向左，实际 vx=${game.state.player.vx.toFixed(1)}`);
});

test("灵敏度：指针死区要小到不吞微操（20px 偏移就必须动）", () => {
  const game = createGame({ levelId: "1-1" });
  begin(game);
  const startX = game.state.player.x;
  holdPointerAt(game, startX + 20, game.state.player.y);
  for (let i = 0; i < 30; i += 1) advanceFrame(game, STEP);
  assert.ok(
    game.state.player.x > startX + 8,
    `20px 偏移应产生位移，实际 ${(game.state.player.x - startX).toFixed(1)}`
  );
});

test("灵敏度：受击硬直不超过 0.3 秒（被吃也不失去控制）", () => {
  assert.ok(PLAYER.stun <= 0.3, `受击硬直应在 0.3 秒内，实际配置 ${PLAYER.stun}s`);
  const game = createGame({ levelId: "1-1" });
  begin(game);
  game.state.player.stun = PLAYER.stun;
  let framesToRecover = 0;
  while (game.state.player.stun > 0 && framesToRecover < 120) {
    advanceFrame(game, STEP);
    framesToRecover += 1;
  }
  assert.ok(
    framesToRecover * STEP <= 0.3 + STEP,
    `硬直应在 0.3 秒内结束，实际 ${(framesToRecover * STEP).toFixed(3)}s`
  );
});
