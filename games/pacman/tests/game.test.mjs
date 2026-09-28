// game.test.mjs —— 模式编排验收（AGENTS 不变量：合法操作必执行、终局 no-op、UI 不得自算分）。
//
// 坑（照抄前务必看）：
//   1) game.mjs 必须严格 DOM-free —— 直接断言源码里没有 document/localStorage/window。
//   2) 断言"业务在推进"（分数涨、豆在少、关数在加），不能只断言"没抛异常"。
//   3) advance() 的返回值是模式编排的真相：next / restart / allClear / null，四条路径都要覆盖。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createGame, MODES, CAMPAIGN_COUNT, SETPIECE_COUNT } from "../js/game.mjs";
import { MAZES, SETPIECES } from "../js/mazes.mjs";
import { DIR, speedTierMult } from "../js/engine.mjs";

const DT = 1 / 60;

/** 一路跑到底：要么结算，要么跑满 maxFrames */
function run(game, maxFrames = 60 * 40, hook = null) {
  const seen = [];
  for (let i = 0; i < maxFrames; i += 1) {
    if (hook) hook(game, i);
    const evs = game.tick(DT);
    for (const e of evs) seen.push(e.type);
    if (game.finished()) break;
  }
  return seen;
}

test("模式口径：三种模式、战役七张、残局十张", () => {
  assert.deepEqual(MODES, ["campaign", "arcade", "setpiece"]);
  assert.equal(CAMPAIGN_COUNT, MAZES.length);
  assert.equal(SETPIECE_COUNT, SETPIECES.length);
});

test("开局：state 就位、状态 playing、统计归零", () => {
  const game = createGame({ mode: "campaign", level: 1 });
  const st = game.start();
  assert.ok(st, "开局必须产出一个 state");
  assert.equal(game.status, "playing");
  assert.equal(game.mode, "campaign");
  assert.equal(game.level, 1);
  assert.equal(game.paused, false);
  assert.deepEqual(game.stats(), { ghostsEaten: 0, bestChain: 0, dotsEaten: 0, fruitsEaten: 0, lostReason: null });
});

test("推进：豆在被吃、分数在涨（不是假跑）", () => {
  const game = createGame({ mode: "campaign", level: 1 });
  game.start();
  const before = game.state.dotsRemaining;
  // 一直往一个方向撞墙也没关系：关键是玩家会沿路吃到豆
  game.input(DIR.LEFT);
  run(game, 60 * 10);
  assert.ok(game.state.dotsEaten > 0, "十秒内一颗豆都没吃到，玩家卡住了");
  assert.ok(game.state.dotsRemaining < before, "剩余豆数必须下降");
  assert.ok(game.stats().dotsEaten > 0, "统计层也要跟着涨");
});

test("暂停真的停住：时间、豆数、分数都不许动", () => {
  const game = createGame({ mode: "campaign", level: 1 });
  game.start();
  game.input(DIR.LEFT);
  run(game, 120);
  const snap = {
    elapsed: game.state.elapsed,
    dots: game.state.dotsRemaining,
    score: game.state.score,
  };
  assert.equal(game.setPaused(true), true);
  for (let i = 0; i < 300; i += 1) assert.deepEqual(game.tick(DT), [], "暂停时 tick 必须返回空事件");
  assert.equal(game.state.elapsed, snap.elapsed, "暂停时计时不许走");
  assert.equal(game.state.dotsRemaining, snap.dots);
  assert.equal(game.state.score, snap.score);
  assert.equal(game.input(DIR.UP), false, "暂停时不接受操作");
  assert.equal(game.setPaused(false), false);
});

test("终局后一切操作 no-op：tick / input 都不许再动状态", () => {
  const game = createGame({ mode: "campaign", level: 1 });
  game.start();
  game.state.status = "levelclear";
  const snap = game.state.score;
  for (let i = 0; i < 60; i += 1) assert.deepEqual(game.tick(DT), []);
  assert.equal(game.input(DIR.LEFT), false);
  assert.equal(game.state.score, snap);
  assert.equal(game.togglePause(), false, "已结束时不能进入暂停态");
});

test("战役：清盘后 advance 进下一关，最后一张返回 allClear", () => {
  const game = createGame({ mode: "campaign", level: 1 });
  game.start();
  game.state.status = "levelclear";
  assert.equal(game.advance(), "next");
  assert.equal(game.level, 2);
  assert.equal(game.status, "playing");

  game.start({ level: CAMPAIGN_COUNT });
  game.state.status = "levelclear";
  assert.equal(game.advance(), "allClear", "通关最后一张应报 allClear，而不是越界进第 8 关");
  assert.equal(game.level, CAMPAIGN_COUNT);
});

test("经典街机惩罚：命数掉光 → 本迷宫从头重开，不提供原地续关", () => {
  const game = createGame({ mode: "campaign", level: 3 });
  game.start();
  const st = game.state;
  st.score = 4321;
  st.dotsEaten = 88;
  st.dotsRemaining = st.dotsTotal - 88;
  st.deaths = 2;
  st.status = "lost";
  assert.equal(game.advance(), "restart");
  assert.equal(game.state.status, "playing");
  assert.equal(game.state.score, 0, "整张迷宫从头来，分数清零");
  assert.equal(game.state.dotsEaten, 0, "豆全部补回去");
  assert.equal(game.state.deaths, 0);
  assert.equal(game.level, 3, "重开还在这张迷宫，不退回上一张");
});

test("街机无尽：清盘后 level 递增且始终跑同一张迷宫", () => {
  const game = createGame({ mode: "arcade" });
  game.start();
  const first = game.mazeId;
  assert.equal(game.level, 1);
  game.state.status = "levelclear";
  assert.equal(game.advance(), "next");
  assert.equal(game.level, 2);
  assert.equal(game.mazeId, first, "街机无尽只在一张舞台上续关");
  assert.ok(game.state.frightMax <= 6, "惊惶时长随关数递减");
});

test("残局：单关制，达成或失败都不进下一张", () => {
  const game = createGame({ mode: "setpiece", setpieceId: "sp_chain_2" });
  game.start();
  assert.equal(game.setpieceId, "sp_chain_2");
  assert.equal(game.state.setpiece.id, "sp_chain_2");
  assert.equal(game.state.lives, 1, "残局只有一条命");

  game.state.status = "setpieceClear";
  assert.equal(game.advance(), null, "残局没有下一张，达成即结束");
  const r = game.result();
  assert.equal(r.cleared, true);
  assert.equal(r.setpieceId, "sp_chain_2");
  assert.equal(r.failed, false);
});

test("残局失败原因必须落地：超时 ≠ 被灯撞灭", () => {
  // 超时：一帧都不输入，把时间耗光。掉命必须是 0，否则标题会写错。
  const game = createGame({ mode: "setpiece", setpieceId: "sp_escape_1" });
  const st0 = game.start();
  const limit = st0.setpiece.limitTime;
  assert.ok(limit > 0, "残局必须有时间上限，否则这条断言本身没意义");
  // ★ 站着不动一定会被灯撞死（lives=1 → 死因变成 death，断言就测不到超时了）。
  //   把命数顶到 999，让"时间耗尽"成为唯一的结算路径。
  //   注意：deaths 会大于 0，那是"不输入"这个测试动作造成的，不是超时本身造成的 ——
  //   真实残局里人早就死了；我们要钉的是 lostReason 的口径。
  st0.lives = 999;
  run(game, Math.ceil((limit + 2) / DT));
  assert.equal(game.finished(), true, `限时 ${limit}s 内必须结算，不能无限跑`);
  const r = game.result();
  assert.equal(r.failed, true);
  assert.equal(r.lostReason, "time", "超时要报 time，不能默认成撞灯");
  assert.notEqual(r.cleared, true);

  // 撞灯：直接把命数打光，原因必须是 death 而不是 time
  const g2 = createGame({ mode: "setpiece", setpieceId: "sp_escape_1" });
  const st = g2.start();
  st.lives = 1;
  st.deaths = 0;
  st.status = "lost";
  assert.equal(g2.result().lostReason, "death");

  // 重开必须把原因清干净，别把上一局的死因带进下一局
  g2.restart();
  assert.equal(g2.result().lostReason, null, "重开后不该还留着一局的失败原因");
});

test("未知残局 id 回落第一张，越界关卡号被钳住", () => {
  const game = createGame({ mode: "setpiece", setpieceId: "sp_not_exist" });
  game.start();
  assert.equal(game.setpieceId, SETPIECES[0].id);

  const c = createGame({ mode: "campaign", level: 99 });
  c.start();
  assert.equal(c.level, CAMPAIGN_COUNT, "越界关卡号钳到最后一张而不是崩掉");
  const d = createGame({ mode: "campaign", level: 0 });
  d.start();
  assert.equal(d.level, 1);
});

test("结算口径：清盘才给星，分数与用时来自引擎而不是 UI 自算", () => {
  const game = createGame({ mode: "campaign", level: 1 });
  game.start();
  const st = game.state;
  st.score = 12345;
  st.elapsed = 40;
  st.deaths = 0;
  st.status = "levelclear";
  const r = game.result();
  assert.equal(r.score, 12345);
  assert.equal(r.timeMs, 40000);
  assert.equal(r.stars, 3, "清盘 + 零死亡 + 未超时 = 三星");
  assert.deepEqual(r.detail, { clear: true, noDeath: true, fast: true });

  st.deaths = 2;
  st.elapsed = 9999;
  const r2 = game.result();
  assert.equal(r2.stars, 1, "清了盘但掉过命且超时，只给一颗星");
  assert.equal(r2.detail.noDeath, false);
  assert.equal(r2.detail.fast, false);
});

test("统计：吞灯与豆链累计，重开后归零", () => {
  const game = createGame({ mode: "campaign", level: 1 });
  game.start();
  game.input(DIR.LEFT);
  run(game, 60 * 20);
  const s1 = game.stats();
  assert.equal(s1.dotsEaten, game.state.dotsEaten, "统计层与引擎必须一致");
  game.restart();
  assert.deepEqual(game.stats(), { ghostsEaten: 0, bestChain: 0, dotsEaten: 0, fruitsEaten: 0, lostReason: null });
});

test("重开：分数、豆、统计全部回到开局态", () => {
  const game = createGame({ mode: "campaign", level: 2 });
  game.start();
  game.input(DIR.LEFT);
  run(game, 300);
  game.restart();
  assert.equal(game.state.score, 0);
  assert.equal(game.state.dotsEaten, 0);
  assert.equal(game.state.dotsRemaining, game.state.dotsTotal);
  assert.equal(game.status, "playing");
  assert.equal(game.level, 2);
});

test("game.mjs 严格 DOM-free：不碰 document / window / 存储 API", () => {
  const raw = readFileSync(new URL("../js/game.mjs", import.meta.url), "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1");
  for (const word of ["document", "window", "localStorage", "navigator", "alert("]) {
    assert.equal(src.includes(word), false, `game.mjs 不得出现 ${word}`);
  }
});

test("速度档：对局中热切换不重置，重开一局后还在", () => {
  const game = createGame({ mode: "campaign", level: 1, speedTier: "calm" });
  game.start();
  assert.equal(game.speedTier(), "calm");
  assert.equal(game.state.speedScale, speedTierMult("calm"));

  // 跑一会儿攒出可观测的状态，换档后必须一字不差
  run(game, 60 * 3);
  const before = {
    score: game.state.score,
    dots: game.state.dotsRemaining,
    elapsed: game.state.elapsed,
    lives: game.state.lives,
  };
  const tier = game.setSpeedTier("surge");
  assert.equal(tier, "surge");
  assert.deepEqual(
    { score: game.state.score, dots: game.state.dotsRemaining, elapsed: game.state.elapsed, lives: game.state.lives },
    before,
    "换档绝不重置局面",
  );
  assert.ok(game.state.speedScale > speedTierMult("calm"), "倍率要真的变大");

  // ★ 重开一局最容易掉档：createGame 每次重建，档位必须跟着过去
  game.start({ level: 1 });
  assert.equal(game.speedTier(), "surge", "重开后档位必须还在");
  assert.equal(game.state.speedScale, speedTierMult("surge"));

  // 非法档回落标准，绝不静默变成 0 倍
  assert.equal(game.setSpeedTier("turbo"), "standard");
  assert.equal(game.state.speedScale, 1);
});
