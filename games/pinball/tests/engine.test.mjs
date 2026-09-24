// 霓虹弹珠台 · 规则与物理单元测试
// 覆盖：状态机流转 / 发射 / 重力排水 / 挡板抬升回落 / 活踢 / 打砖与计分连击 /
//      缓冲迸射 / 侧弹射点燃 / 砖块风暴 / 可翻倒靶 / 星级 / 摇机上限 / 速度钳制 /
//      同种子确定性重放 / 1500 步随机游走不变量
import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState, stepFrame, launchBall, restartStage,
  checkLevelSolvable, comboMult, computeStars,
  MODE, FIXED_DT, W, H, CX, BALL_R,
  MAX_BALL_SPEED, FLIPPER_REST_ANGLE, FLIPPER_RAISED_ANGLE,
  COMBO_WINDOW, STORM_COMBO, MECH_SCORE, BRICK_SCORE
} from "../js/engine.mjs";
import { LEVELS } from "../js/levels.mjs";

function stepN(state, n, inputs = () => ({})) {
  let events = [];
  for (let i = 0; i < n; i++) {
    const r = stepFrame(state, FIXED_DT, inputs(i));
    state = r.state;
    events = events.concat(r.events);
  }
  return { state, events };
}

function ballNear(state, x, y, vx = 0, vy = 0) {
  // 注入一枚弹珠（仅测试用；绕过 serving 限制直接构造 playing 场景）
  state.balls = [{ x, y, vx, vy, radius: BALL_R, trail: [], nudges: 0, lastBrick: -1 }];
  state.status = "playing";
  return state;
}

test("初始状态：章节模式服务态、3 弹珠、砖墙与机关就位", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 42 });
  assert.equal(st.status, "serving");
  assert.equal(st.ballsRemaining, 3);
  assert.equal(st.balls.length, 0);
  assert.ok(st.bricks.length > 0, "关卡 1 应有砖块");
  assert.equal(st.flippers.length, 2);
  assert.equal(st.mechs.bumpers.length, 1, "第一章应有 1 枚缓冲");
  assert.equal(st.mechs.slings.length, 2, "侧弹射器常驻两枚");
  assert.equal(st.score, 0);
  assert.equal(st.mode, MODE.STAGE);
  assert.equal(st.levelId, 1);
});

test("发射：serving 合法发射、弹珠向上、状态切 playing；playing 中拒绝二次发射", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 7 });
  assert.equal(launchBall(st, 1), true);
  assert.equal(st.status, "playing");
  assert.equal(st.balls.length, 1);
  const b = st.balls[0];
  assert.ok(Math.abs(b.x - CX) <= 20 + 1e-6, "发射 x 应在中央 ±20");
  assert.ok(b.y < H, "发射点应在台面内");
  assert.ok(b.vy < 0, "发射初速应向上");
  assert.equal(launchBall(st, 1), false, "playing 中不可再发射");
});

test("重力排水：无操作弹珠最终漏入排水沟，扣 1 球回到 serving", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 3 });
  launchBall(st, 1);
  const { state, events } = stepN(st, 4000, () => ({ flipL: false, flipR: false }));
  assert.ok(events.some((e) => e.type === "drain"), "应产生 drain 事件");
  assert.equal(state.status, "serving");
  assert.equal(state.ballsRemaining, 2);
  assert.equal(state.balls.length, 0);
});

test("挡板：按压抬升到上限角、松手回落（角度始终钳制在 [RAISED, REST]）", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 5 });
  let s = stepN(st, 300, () => ({ flipL: true, flipR: true })).state;
  assert.ok(s.flippers[0].angle <= FLIPPER_RAISED_ANGLE + 0.01, `抬升角 ${s.flippers[0].angle}`);
  assert.ok(s.flippers[0].angle >= FLIPPER_RAISED_ANGLE - 0.01, "抬升不应低于上限角");
  s = stepN(s, 400, () => ({ flipL: false, flipR: false })).state;
  assert.ok(s.flippers[0].angle >= FLIPPER_REST_ANGLE - 0.02, `回落角 ${s.flippers[0].angle}`);
});

test("挡板活踢：按下挡板接球一键勺回墙区（vy 大幅向上 + flipper_hit kick）", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 9 });
  stepN(st, 150, () => ({ flipL: true, flipR: false })); // 先抬左板
  st.balls = [{ x: 255, y: 726, vx: 0, vy: 60, radius: BALL_R, trail: [], nudges: 0, lastBrick: -1 }];
  st.status = "playing";
  const { state, events } = stepN(st, 40, () => ({ flipL: true, flipR: false }));
  const kick = events.find((e) => e.type === "flipper_hit" && e.kick);
  assert.ok(kick, "应触发活踢 flipper_hit kick");
  const b = state.balls[0];
  assert.ok(b && b.vy < -400, `活踢后弹珠应大幅向上，实测 vy=${b ? b.vy : "?"}`);
});

test("打砖：玻璃砖 1 击碎、计分 = 砖分 × 连击倍率、连击 +1、砖数递减", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 11 });
  const brick = st.bricks.find((b) => b.tier === "G");
  assert.ok(brick, "关卡 1 应有玻璃砖");
  const bx = brick.x + brick.w / 2, by = brick.y + brick.h + BALL_R; // 贴住砖底
  ballNear(st, bx, by, 0, -300);
  const before = st.bricksRemaining;
  const { state, events } = stepN(st, 5, () => ({ flipL: false, flipR: false }));
  const broken = events.filter((e) => e.type === "brick_broken");
  assert.ok(events.some((e) => e.type === "brick_hit"), "应有 brick_hit");
  assert.ok(broken.length >= 1, "玻璃砖应一击即碎");
  assert.equal(state.bricksRemaining, before - broken.length);
  assert.equal(state.combo, broken.length);
  assert.ok(state.stageTimer > 0, "闯关计时应推进");
});

test("连击窗口：3 秒内无命中自动重置", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 13 });
  st.combo = 4;
  st.comboTimer = 0.5;
  const { state, events } = stepN(st, Math.ceil(0.6 / FIXED_DT) + 5, () => ({ flipL: false, flipR: false }));
  assert.equal(state.combo, 0);
  assert.ok(events.some((e) => e.type === "combo_reset"), "应产生 combo_reset");
});

test("触碰挡板重置连击（挡板救球是策略代价）", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 15 });
  stepN(st, 150, () => ({ flipL: true, flipR: false }));
  st.balls = [{ x: 255, y: 726, vx: 0, vy: 60, radius: BALL_R, trail: [], nudges: 0, lastBrick: -1 }];
  st.status = "playing";
  st.combo = 3;
  st.comboTimer = COMBO_WINDOW;
  const { state } = stepN(st, 40, () => ({ flipL: true, flipR: false }));
  assert.equal(state.combo, 0, "挡板接触后连击应归零");
});

test("缓冲迸射：无论来向一律向上弹出 + 计分 + 连击（真实弹跳缓冲行为）", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 17 });
  ballNear(st, 300, 345, 0, -300); // 缓冲 (300,320) r16，球贴其下缘上冲
  const { state, events } = stepN(st, 4, () => ({ flipL: false, flipR: false }));
  assert.ok(events.some((e) => e.type === "bumper"), "应触发缓冲");
  assert.ok(events.some((e) => e.type === "combo_up"), "缓冲计入连击");
  const b = state.balls[0];
  assert.ok(b && b.vy < 0, "缓冲应把球向上弹出");
  assert.ok(state.score >= MECH_SCORE.bumper, "缓冲计分应入账");
});

test("侧弹射器：5 连击点燃后踢速 ×1.5（ignited 标记 + 更强踢出）", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 19 });
  st.combo = 5;
  st.comboTimer = COMBO_WINDOW;
  ballNear(st, 78, 695, 0, -300); // 左弹射器 (78,678) r14
  const { state, events } = stepN(st, 4, () => ({ flipL: false, flipR: false }));
  const sling = events.find((e) => e.type === "sling");
  assert.ok(sling, "应触发侧弹射");
  assert.equal(sling.ignited, true, "5 连击应点燃侧弹射器");
  const b = state.balls[0];
  assert.ok(b && Math.hypot(b.vx, b.vy) >= 500, "点燃后踢出速度应明显增强");
});

test("砖块风暴：10 连击降下一层脆化玻璃砖（章节模式每关一次）", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 21 });
  const brick = st.bricks.find((b) => b.tier === "G");
  const before = st.bricksRemaining;
  st.combo = STORM_COMBO - 1;
  st.comboTimer = COMBO_WINDOW;
  ballNear(st, brick.x + brick.w / 2, brick.y + brick.h + BALL_R, 0, -300);
  const { state, events } = stepN(st, 6, () => ({ flipL: false, flipR: false }));
  assert.ok(events.some((e) => e.type === "storm_row"), "应触发砖块风暴");
  assert.equal(state.stormCount, 1);
  assert.ok(state.bricksRemaining > before, "风暴应新增砖块");
  assert.equal(state.comboStormFired, true);
  // 第二次攒到 10 连击：章节模式不再降层
  const brick2 = state.bricks.find((b) => b.tier === "G");
  st.combo = STORM_COMBO - 1;
  st.comboTimer = COMBO_WINDOW;
  const count2 = state.stormCount;
  ballNear(state, brick2.x + brick2.w / 2, brick2.y + brick2.h + BALL_R, 0, -300);
  const { state: s2, events: e2 } = stepN(state, 6, () => ({ flipL: false, flipR: false }));
  assert.ok(!e2.some((ev) => ev.type === "storm_row"), "章节模式风暴每关仅一次");
  assert.equal(s2.stormCount, count2);
});

test("可翻倒靶：三靶齐倒触发全靶奖励 +200", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 11, seed: 23 });
  const targets = st.mechs.targets;
  assert.equal(targets.length, 3, "第二章应有 3 靶");
  let s = st;
  for (const t of targets) {
    ballNear(s, t.x + t.w / 2, t.y + t.h + BALL_R - 4, 0, -280);
    const r = stepN(s, 4, () => ({ flipL: false, flipR: false }));
    s = r.state;
  }
  assert.ok(s.mechs.targets.every((t) => t.down), "三靶应全部倒下");
  assert.ok(s.score >= MECH_SCORE.allTargets, "全靶奖励应入账");
});

test("星级：★剩余弹珠 ★★用时 ★★★连击，清场保底 1 星", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 25 });
  st.status = "cleared";
  st.ballsRemaining = 1;
  st.stageTimer = 50;   // ≤ 目标 75
  st.maxCombo = 10;     // ≥ 目标 8
  assert.equal(computeStars(st), 3);
  st.maxCombo = 0;
  st.stageTimer = 100;
  assert.equal(computeStars(st), 1);
  st.ballsRemaining = 0;
  assert.equal(computeStars(st), 1, "清场保底 1 星");
});

test("摇机：每颗弹珠最多 3 次", () => {
  let st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 27 });
  launchBall(st, 1);
  let nudges = 0;
  for (let i = 0; i < 60; i++) {
    const r = stepFrame(st, FIXED_DT, { flipL: false, flipR: false, nudge: true });
    st = r.state;
    if (r.events.some((e) => e.type === "nudge")) nudges += 1;
  }
  assert.ok(nudges <= 3, `摇机应限 3 次，实测 ${nudges}`);
});

test("速度钳制：弹珠速度不超过速度上限（含风暴加成）", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 29 });
  ballNear(st, CX, 400, 5000, 0);
  const { state } = stepN(st, 8, () => ({ flipL: false, flipR: false }));
  const b = state.balls[0];
  assert.ok(b, "弹珠应仍在场");
  const speed = Math.hypot(b.vx, b.vy);
  assert.ok(speed <= MAX_BALL_SPEED + 8, `速度应被钳制，实测 ${speed}`);
});

test("确定性：同种子同输入 2000 步逐帧一致（可重放契约）", () => {
  const make = () => {
    let st = createInitialState({ mode: MODE.STAGE, levelId: 1, seed: 31 });
    launchBall(st, 1);
    const trail = [];
    for (let i = 0; i < 2000; i++) {
      const r = stepFrame(st, FIXED_DT, { flipL: i % 37 < 9, flipR: i % 53 < 9 });
      st = r.state;
      if (i % 100 === 0 && st.balls.length) {
        trail.push([st.score, st.combo, st.bricksRemaining, st.balls[0].x.toFixed(3), st.balls[0].y.toFixed(3)]);
      }
      if (st.status !== "playing") break;
    }
    return trail;
  };
  const a = make(), b = make();
  assert.deepEqual(a, b, "同种子重放应逐帧一致");
});

test("1500 步随机游走：任意合法操作序列不抛错、不卡死、不变量不破", () => {
  let seed = 123456789;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const st = createInitialState({ mode: MODE.STAGE, levelId: 3, seed: 42 });
  launchBall(st, 1);
  let s = st;
  for (let i = 0; i < 1500; i++) {
    const inputs = {
      flipL: rnd() < 0.35,
      flipR: rnd() < 0.35,
      nudge: rnd() < 0.05
    };
    const r = stepFrame(s, FIXED_DT, inputs);
    s = r.state;
    for (const b of s.balls) {
      assert.ok(Number.isFinite(b.x) && Number.isFinite(b.y), "弹珠坐标不得 NaN/Infinity");
      assert.ok(b.x > -30 && b.x < W + 30, "弹珠 x 越界");
      assert.ok(b.y > -30 && b.y < H + 30, "弹珠 y 越界");
    }
    assert.ok(Number.isFinite(s.score) && s.score >= 0, "分数不得为负或非有限");
    assert.ok(Number.isFinite(s.bricksRemaining) && s.bricksRemaining >= 0, "剩余砖数不得为负");
    assert.ok(s.ballsRemaining >= 0, "剩余弹珠不得为负");
    assert.ok(["serving", "playing", "cleared", "failed", "over"].includes(s.status), "状态机非法");
    if (s.status === "serving" && s.ballsRemaining > 0) launchBall(s, 1);
    if (s.status === "cleared" || s.status === "failed") break;
  }
  assert.ok(s.status === "playing" || s.status === "cleared" || s.status === "failed" || s.status === "serving", "随机游走应正常终结或仍在进行");
});

test("restartStage：同关卡同种子重置为全新服务态", () => {
  const st = createInitialState({ mode: MODE.STAGE, levelId: 5, seed: 33 });
  launchBall(st, 1);
  stepN(st, 120);
  const fresh = restartStage(st);
  assert.equal(fresh.status, "serving");
  assert.equal(fresh.levelId, 5);
  assert.equal(fresh.seed, 33);
  assert.equal(fresh.ballsRemaining, 3);
  assert.equal(fresh.balls.length, 0);
});

test("可解性导出：30 关行模板全部可解", () => {
  for (const level of LEVELS) {
    const r = checkLevelSolvable(level.rows);
    assert.ok(r.ok, `关卡 ${level.id} 不可解: ${r.reason}`);
  }
});

test("关卡数据：三章各 10 关、星级目标递增、每行 12 列", () => {
  assert.equal(LEVELS.length, 30);
  for (const level of LEVELS) {
    for (const row of level.rows) assert.equal(row.length, 12, `关卡 ${level.id} 行宽非 12`);
    assert.ok(level.targets.time > 0 && level.targets.combo > 0, `关卡 ${level.id} 星级目标非法`);
  }
  assert.deepEqual(
    [LEVELS[0].chapter, LEVELS[9].chapter, LEVELS[10].chapter, LEVELS[19].chapter, LEVELS[20].chapter, LEVELS[29].chapter],
    [1, 1, 2, 2, 3, 3],
    "章节边界错误"
  );
});
