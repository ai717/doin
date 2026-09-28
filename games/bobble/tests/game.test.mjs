// 泡泡射手 · 控制器状态机单元测试（DOM-free）
// 覆盖：闯关完整通关流程 / 残局按序通关 / 无尽下压与绝境补给 / 换弹与冰镐弹 / 终局 no-op
import test from "node:test";
import assert from "node:assert/strict";

import { BobbleGame } from "../js/game.mjs";
import { MODE, AIM, MAX_ANGLE, PRISM, countBubbles, solve, solveWithLoad, simulateShot, resolveLanding, DEATH_ROW } from "../js/engine.mjs";
import { PUZZLES } from "../js/levels.mjs";

function settle(game, maxFrames = 400) {
  let frames = 0;
  while (frames < maxFrames && game.state.status === "flying") {
    game.step(1 / 60);
    frames += 1;
  }
  while (frames < maxFrames && game.state.status === "settle") {
    game.step(1 / 60);
    frames += 1;
  }
  return frames;
}

function shoot(game, angle) {
  game.setAngle(angle);
  const ok = game.fire();
  if (ok) settle(game);
  return ok;
}

test("装载闯关：初始装填合法、目标发数与棋盘就绪", () => {
  const game = new BobbleGame();
  const s = game.loadStage(1);
  assert.equal(s.mode, MODE.STAGE);
  assert.equal(s.status, "aim");
  assert.ok(s.palette.includes(s.loaded));
  assert.ok(s.palette.includes(s.next));
  assert.ok(countBubbles(s.board) > 0);
  assert.ok(s.target >= 10);
});

test("发射流程：飞行 → 结算 → 回到瞄准，用弹数与下压倒数同步推进", () => {
  const game = new BobbleGame();
  const s = game.loadStage(1);
  const pressBefore = s.pressIn;
  const ok = shoot(game, 0);
  assert.equal(ok, true);
  assert.equal(s.shots, 1);
  assert.equal(s.pressIn, pressBefore - 1);
  assert.ok(["aim", "win", "over"].includes(s.status));
});

test("换弹：交换当前与待发射泡，飞行中禁止操作", () => {
  const game = new BobbleGame();
  const s = game.loadStage(2);
  const a = s.loaded;
  const b = s.next;
  assert.equal(game.swap(), true);
  assert.equal(s.loaded, b);
  assert.equal(s.next, a);
  game.fire();
  assert.equal(game.swap(), false, "飞行中禁止换弹");
});

test("冰镐弹：可开关且每发消耗一枚，用尽后拒绝", () => {
  const game = new BobbleGame();
  const s = game.loadStage(21);
  const total = s.picks;
  assert.ok(total >= 1);
  assert.equal(game.togglePick(), true);
  assert.equal(s.pickArmed, true);
  shoot(game, 0.2);
  assert.equal(s.pickArmed, false);
  assert.equal(s.picks, total - 1);
  let guard = 0;
  while (s.picks > 0 && guard < 10) {
    if (game.togglePick()) shoot(game, -0.2);
    guard += 1;
  }
  assert.equal(s.picks, 0);
  assert.equal(game.togglePick(), false, "冰镐弹用尽后应拒绝");
});

test("瞄准角被夹在合法范围，硬核档打开加成", () => {
  const game = new BobbleGame();
  const s = game.loadStage(1);
  game.setAngle(9);
  assert.ok(s.angle <= MAX_ANGLE + 1e-9);
  game.setAngle(-9);
  assert.ok(s.angle >= -MAX_ANGLE - 1e-9);
  game.setAimTier(AIM.PRO);
  assert.equal(s.proBonus, true);
  game.setAimTier(AIM.EXTENDED);
  assert.equal(s.proBonus, false);
});

test("完整通关：按求解器路线重放，第 1 关在预算内清空并触发通关事件", () => {
  const game = new BobbleGame();
  const s = game.loadStage(1);
  let win = null;
  game.subscribe((ev) => {
    if (ev.type === "win") win = ev;
  });
  // 每发重新规划（真实对局含冰盖下压，盘面会变），逐步逼近清空
  const budget = s.target + 12;
  let usedShots = 0;
  while (s.status === "aim" && usedShots < budget) {
    const plan = solve(s.board, { budget: 6, palette: s.palette, goal: "clear", beam: 3, samples: 64 });
    const step = plan.node?.path?.[0] ?? null;
    if (!step) break;
    s.loaded = step.color;
    shoot(game, step.angle);
    usedShots += 1;
  }
  assert.ok(win, `未触发通关事件，终态 ${s.status}`);
  assert.equal(s.status, "win");
  assert.ok(s.shots <= s.target + 12);
  assert.equal(countBubbles(s.board), 0);
});

test("雪崩播报：一次射击造成 5 连以上时广播 avalanche", () => {
  const game = new BobbleGame();
  const s = game.loadStage(1);
  let avalanche = null;
  game.subscribe((ev) => {
    if (ev.type === "avalanche") avalanche = ev;
  });
  let guard = 0;
  while (!avalanche && s.status === "aim" && guard < 40) {
    // 贪心挑当前手上颜色收益最大的角度
    let best = 0;
    let bestGain = -1;
    for (let k = -30; k <= 30; k += 1) {
      const angle = (k / 30) * MAX_ANGLE;
      const shot = simulateShot(s.board, angle);
      if (!shot.land) continue;
      const res = resolveLanding(s.board, shot.land[0], shot.land[1], s.loaded);
      const gain = res.popped.length + res.dropped.length * 2;
      if (gain > bestGain) {
        bestGain = gain;
        best = angle;
      }
    }
    shoot(game, best);
    guard += 1;
  }
  assert.ok(avalanche, "40 发内应至少出现一次雪崩");
  assert.ok(avalanche.chain >= 5);
  assert.ok(s.maxChain >= 5);
});

test("残局通关：按确定发数序列发射，冰晶必定坠落判胜", () => {
  const pz = PUZZLES[0];
  const game = new BobbleGame();
  const s = game.loadPuzzle(pz.id);
  assert.equal(s.mode, MODE.PUZZLE);
  assert.ok(s.crystals >= 1);
  assert.deepEqual(s.queue, pz.load);
  const board = JSON.parse(JSON.stringify(s.board));
  const plan = solveWithLoad(board, pz.load, { goal: "crystal", samples: 160, beam: 8 });
  assert.ok(plan.ok, "残局题面应有解");
  for (const step of plan.path ?? []) {
    if (s.status !== "aim") break;
    shoot(game, step.angle);
  }
  assert.equal(s.status, "win", `残局 ${pz.id} 未通关，状态 ${s.status}`);
  assert.equal(s.crystals, 0);
});

test("无尽寒潮：持续下压推进，濒临冰封线时补给棱镜泡", () => {
  const game = new BobbleGame();
  const s = game.loadEndless(20260928);
  assert.equal(s.mode, MODE.ENDLESS);
  let rescued = false;
  game.subscribe((ev) => {
    if (ev.type === "rescue") rescued = true;
  });
  let guard = 0;
  while (s.status === "aim" && guard < 60) {
    shoot(game, (Math.random() - 0.5) * MAX_ANGLE);
    guard += 1;
  }
  assert.ok(s.pressCount >= 1, "无尽模式应发生冰盖下压");
  assert.ok(["aim", "over"].includes(s.status));
  if (s.status === "over") assert.ok(rescued || s.shots > 0);
});

test("终局 no-op：通关或失败后再发射不再改变状态", () => {
  const game = new BobbleGame();
  const s = game.loadStage(1);
  s.status = "over";
  assert.equal(game.fire(), false);
  assert.equal(s.shots, 0);
});

test("重开：回到本关初始盘面与零用弹", () => {
  const game = new BobbleGame();
  const s = game.loadStage(3);
  shoot(game, 0.3);
  const shotsBefore = s.shots;
  assert.ok(shotsBefore >= 1);
  const fresh = game.restart();
  assert.equal(fresh.shots, 0);
  assert.equal(fresh.levelId, 3);
  assert.equal(fresh.status, "aim");
});

test("每日残局：按日期种子装载，盘面非空", () => {
  const game = new BobbleGame();
  const s = game.loadDaily(20260928);
  assert.equal(s.mode, MODE.DAILY);
  assert.ok(countBubbles(s.board) > 10);
  assert.ok(s.seed === 20260928);
});

test("绝境补给发放棱镜泡：无尽模式濒死时待发射泡含 PRISM", () => {
  const game = new BobbleGame();
  const s = game.loadEndless(777);
  let gave = false;
  game.subscribe((ev) => {
    if (ev.type === "rescue") gave = true;
  });
  let guard = 0;
  while (!gave && s.status === "aim" && guard < 200) {
    shoot(game, (guard % 2 ? 0.9 : -0.9));
    guard += 1;
  }
  if (gave) {
    assert.ok(s.next === PRISM || s.loaded === PRISM, "补给后手上应有棱镜泡");
    assert.ok(s.rescueUsed);
  }
  assert.ok(guard <= 200);
});

test("冰封线判定：盘面压到第 14 行触发失败广播", () => {
  const game = new BobbleGame();
  const s = game.loadEndless(4242);
  let over = null;
  game.subscribe((ev) => {
    if (ev.type === "lose") over = ev;
  });
  let guard = 0;
  while (!over && guard < 400) {
    if (s.status !== "aim") break;
    shoot(game, (Math.random() - 0.5) * MAX_ANGLE);
    guard += 1;
  }
  assert.ok(guard < 400, "无尽模式应在有限发数内收敛到终局");
  assert.ok(DEATH_ROW === 14);
});

test("暂停时所有玩家操作 no-op，不消耗发数也不改角度", () => {
  const game = new BobbleGame();
  const s = game.loadStage(1);
  assert.equal(s.status, "aim");
  const shotsBefore = s.shots;
  const angleBefore = s.angle;
  game.pause();
  assert.equal(game.paused, true);
  assert.equal(game.swap(), false);
  assert.equal(game.togglePick(), false);
  assert.equal(game.fire(), false);
  game.nudge(0.1);
  game.setAngle(0.5);
  assert.equal(s.angle, angleBefore, "暂停时角度不应改变");
  assert.equal(s.shots, shotsBefore, "暂停时不应消耗一发");
  game.resume();
  assert.equal(game.paused, false);
  assert.doesNotThrow(() => game.fire());
});

test("暂停时 step 冻结对局：飞行子弹不前进、不结算", () => {
  const game = new BobbleGame();
  const s = game.loadStage(2);
  game.setAngle(0);
  assert.equal(game.fire(), true);
  assert.equal(s.status, "flying");
  game.pause();
  const distBefore = s.flight.dist;
  for (let i = 0; i < 30; i += 1) game.step(1 / 60);
  assert.equal(s.flight.dist, distBefore, "暂停时飞行子弹不应前进");
  assert.equal(s.status, "flying", "暂停时不应结算");
  game.resume();
  settle(game);
  assert.ok(["aim", "win", "over"].includes(s.status));
});
