import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  stepFrame,
  initServe,
  COURT_WIDTH,
  COURT_HEIGHT,
  PADDLE_WIDTH,
  MODES,
  DIFFICULTIES
} from "../js/engine.mjs";

test("engine: 初始状态符合规范与默认值", () => {
  const state = createInitialState();
  assert.equal(state.status, "serving");
  assert.equal(state.scoreTop, 0);
  assert.equal(state.scoreBottom, 0);
  assert.equal(state.targetScore, 5);
  assert.equal(state.mode, MODES.PVE);
  assert.equal(state.difficulty, DIFFICULTIES.NORMAL);
  assert.equal(state.bottomPaddle.x, COURT_WIDTH / 2);
});

test("engine: 连续发球与倒计时转 playing 状态", () => {
  const state = createInitialState();
  assert.equal(state.status, "serving");

  // stepFrame 步进 1.0s (大于 0.8s 倒计时)
  const { state: next, events } = stepFrame(state, 1.0);
  assert.equal(next.status, "playing");
  assert.ok(events.some((e) => e.type === "serve"));
});

test("engine: 挡板碰撞与多段角度切角判定", () => {
  const state = createInitialState();
  state.status = "playing";
  // 将球置于即将撞击下方挡板的位置
  state.ball.x = COURT_WIDTH / 2;
  state.ball.y = state.bottomPaddle.y - state.bottomPaddle.height / 2 - 2;
  state.ball.vx = 0;
  state.ball.vy = 200; // 向下飞

  const { state: next, events } = stepFrame(state, 0.05);
  const hitEvent = events.find((e) => e.type === "paddle_hit");
  assert.ok(hitEvent, "应触发 paddle_hit 事件");
  assert.equal(hitEvent.hitter, "bottom");
  assert.ok(next.ball.vy < 0, "回球垂直速度应变为向上");
  assert.equal(next.rallies, 1);
});

test("engine: 越过底线得分与终局判定", () => {
  const state = createInitialState({ targetScore: 3 });
  state.status = "playing";
  state.scoreBottom = 2; // 再得 1 分即胜利

  // 球飞过上方底线
  state.ball.x = COURT_WIDTH / 2;
  state.ball.y = -10;
  state.ball.vy = -300;

  const { state: next, events } = stepFrame(state, 0.05);
  const scoreEvent = events.find((e) => e.type === "score");
  assert.ok(scoreEvent, "应触发 score 事件");
  assert.equal(scoreEvent.scorer, "bottom");
  assert.equal(next.scoreBottom, 3);
  assert.equal(next.status, "won");
  assert.equal(next.winner, "bottom");
});

test("engine: 1000 步随机游走不变式测试（防崩溃、防穿模、状态自洽）", () => {
  let state = createInitialState();
  const dt = 0.016;

  for (let i = 0; i < 1000; i++) {
    // 随机模拟玩家输入
    const randomInput = {
      bottom: {
        targetX: Math.random() * COURT_WIDTH,
        moveDirection: Math.floor(Math.random() * 3) - 1
      },
      top: {
        targetX: Math.random() * COURT_WIDTH,
        moveDirection: Math.floor(Math.random() * 3) - 1
      }
    };

    const res = stepFrame(state, dt, randomInput);
    state = res.state;

    // 不变式 1：坐标与速度必须为有限数值
    assert.ok(Number.isFinite(state.ball.x));
    assert.ok(Number.isFinite(state.ball.y));
    assert.ok(Number.isFinite(state.bottomPaddle.x));
    assert.ok(Number.isFinite(state.topPaddle.x));

    // 不变式 2：挡板永不出界
    assert.ok(state.bottomPaddle.x >= state.bottomPaddle.width / 2);
    assert.ok(state.bottomPaddle.x <= COURT_WIDTH - state.bottomPaddle.width / 2);

    // 若一方获胜，重启新局继续游走
    if (state.status === "won") {
      initServe(state, 1);
    }
  }
});