import test from "node:test";
import assert from "node:assert/strict";
import {
  FIXED_DT,
  GRAZE_R,
  MAX_BOMBS,
  PLAYER_HIT_R,
  createSession,
  debugAddEnemy,
  debugCharge,
  debugClearStage,
  debugHurt,
  debugSpawnBoss,
  debugTeleport,
  nudgePlayer,
  pause,
  resume,
  step,
} from "../js/engine.mjs";
import { STAGE_H, STAGE_W } from "../js/levels.mjs";

function advance(session, frames, input = {}) {
  for (let i = 0; i < frames; i += 1) step(session, input, FIXED_DT);
  return session;
}

test("引擎：开局即可操作，玩家与自动火力就绪", () => {
  const session = createSession({ stageIndex: 0 });
  assert.equal(session.status, "playing");
  assert.equal(session.lives, 3);
  assert.equal(session.bombs, 2);
  const x = session.world.player.x;
  advance(session, 24);
  assert.ok(session.world.bullets.length > 0, "应自动开火");
  assert.equal(session.world.player.x, x, "无输入不应漂移");
});

test("引擎：左右移动与斜向速度受限，边界内夹取", () => {
  const session = createSession({ stageIndex: 0 });
  const startX = session.world.player.x;
  advance(session, 30, { axisX: 1 });
  assert.ok(session.world.player.x > startX);
  advance(session, 600, { axisX: 1, axisY: 1 });
  const player = session.world.player;
  assert.ok(player.x <= STAGE_W - 18 + 0.001);
  assert.ok(player.y <= STAGE_H - 18 + 0.001);
});

test("引擎：拖动偏移直接改变玩家位置并夹取", () => {
  const session = createSession({ stageIndex: 0 });
  const start = { x: session.world.player.x, y: session.world.player.y };
  nudgePlayer(session, -40, 25);
  assert.equal(session.world.player.x, start.x - 40);
  assert.equal(session.world.player.y, start.y + 25);
  nudgePlayer(session, -9999, 9999);
  assert.equal(session.world.player.x, 18);
  assert.equal(session.world.player.y, STAGE_H - 18);
});

test("引擎：按面推进刷出敌机且不越界", () => {
  const session = createSession({ stageIndex: 0 });
  advance(session, 6 * 60);
  assert.ok(session.world.enemies.length > 0, "六秒内应有敌机");
  for (const enemy of session.world.enemies) {
    assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.y));
    assert.ok(enemy.x > 0 && enemy.x < STAGE_W);
  }
  assert.ok(session.waveIndex > 0);
});

test("引擎：蓄力减速，松开释放穿透激光并击杀一列小机", () => {
  const session = createSession({ stageIndex: 0 });
  debugTeleport(session, 270, 700);
  const a = debugAddEnemy(session, "drone", 270, 320);
  const b = debugAddEnemy(session, "drone", 270, 380);
  const side = debugAddEnemy(session, "drone", 120, 320);
  advance(session, 40, { charge: true });
  const moving = session.world.player.charge;
  assert.ok(moving > 0.4, "蓄力值应增长");
  const before = session.world.player.y;
  advance(session, 12, { charge: true, axisY: 1 });
  const slowDelta = session.world.player.y - before;
  advance(session, 12, { axisY: 1 });
  const fastDelta = session.world.player.y - before;
  assert.ok(fastDelta > slowDelta, "蓄力时应减速");

  debugCharge(session, 1);
  step(session, { charge: false }, FIXED_DT);
  assert.ok(!a || a.hp <= 0 || !session.world.enemies.includes(a));
  assert.ok(!b || b.hp <= 0 || !session.world.enemies.includes(b));
  assert.ok(session.world.enemies.includes(side), "列外敌机不应被激光击中");
  assert.ok(session.kills >= 2);
  assert.ok(session.world.beam && session.world.beam.w > 40);
});

test("引擎：保险清空敌弹并重创全场", () => {
  const session = createSession({ stageIndex: 0 });
  const enemy = debugAddEnemy(session, "heavy", 270, 300);
  for (let i = 0; i < 30; i += 1) session.world.enemyBullets.push({ x: 100 + i, y: 400, vx: 0, vy: 0, r: 5, grazed: false });
  const bombs = session.bombs;
  step(session, { bombPressed: true }, FIXED_DT);
  assert.equal(session.bombs, bombs - 1);
  assert.equal(session.bombsUsed, 1);
  assert.equal(session.world.enemyBullets.length, 0);
  assert.ok(enemy.hp < enemy.maxHp);
});

test("引擎：贴着判定点擦弹，加分并积攒保险能量", () => {
  const session = createSession({ stageIndex: 0 });
  session.world.player.invuln = 0;
  session.bombEnergy = 0;
  const p = session.world.player;
  session.world.enemyBullets.push({ x: p.x + GRAZE_R - 4, y: p.y, vx: 0, vy: 0, r: 5, grazed: false });
  step(session, {}, FIXED_DT);
  assert.equal(session.graze, 1);
  assert.ok(session.score >= 15);
  assert.ok(session.bombEnergy > 0);
  assert.equal(session.world.enemyBullets.length, 1);
  assert.equal(session.world.enemyBullets[0].grazed, true);
});

test("引擎：命中扣命并清空弹幕，第三次结束", () => {
  const session = createSession({ stageIndex: 0 });
  const p = session.world.player;
  for (let hit = 0; hit < 3; hit += 1) {
    p.invuln = 0;
    session.world.enemyBullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: 5, grazed: false });
    step(session, {}, FIXED_DT);
  }
  assert.equal(session.lives, 0);
  assert.equal(session.status, "gameover");
  assert.ok(session.damaged);
});

test("引擎：暂停彻底冻结世界", () => {
  const session = createSession({ stageIndex: 0 });
  advance(session, 120);
  pause(session);
  const snapshot = {
    time: session.time,
    x: session.world.player.x,
    bullets: session.world.bullets.length,
    enemies: session.world.enemies.length,
  };
  advance(session, 120);
  assert.deepEqual(
    { time: session.time, x: session.world.player.x, bullets: session.world.bullets.length, enemies: session.world.enemies.length },
    snapshot,
  );
  resume(session);
  advance(session, 10);
  assert.ok(session.time > snapshot.time);
});

test("引擎：首领入场后吃激光掉血，击破即过关", () => {
  const session = createSession({ stageIndex: 0 });
  debugSpawnBoss(session);
  assert.ok(session.boss, "首领应已生成");
  const max = session.boss.maxHp;
  debugTeleport(session, session.boss.x, 700);
  debugCharge(session, 1);
  step(session, { charge: false }, FIXED_DT);
  assert.ok(session.boss.hp < max, "激光应削减首领血量");
  debugClearStage(session);
  assert.equal(session.status, "cleared");
  assert.equal(session.stars, 3);
  assert.ok(session.score > max);
  assert.equal(session.completed, false);
});

test("引擎：第六面通关标记六面全通", () => {
  const session = createSession({ stageIndex: 5 });
  debugClearStage(session);
  assert.equal(session.status, "cleared");
  assert.equal(session.completed, true);
});

test("引擎：训练模式不损命，六十秒后按擦弹结算", () => {
  const session = createSession({ mode: "training" });
  assert.equal(session.mode, "training");
  assert.equal(session.lives, 3);
  advance(session, 61 * 60);
  assert.equal(session.status, "cleared");
  assert.ok(session.stars >= 1 && session.stars <= 3);
  assert.equal(session.lives, 3);
  assert.equal(session.completed, false);
});

test("引擎：训练中弹只短暂无敌并计数", () => {
  const session = createSession({ mode: "training" });
  const p = session.world.player;
  p.invuln = 0;
  session.world.enemyBullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: 5, grazed: false });
  step(session, {}, FIXED_DT);
  assert.equal(session.lives, 3);
  assert.equal(p.hits, 1);
  assert.ok(p.invuln > 0);
});

test("引擎：调试受伤强制生效并立即进入无敌", () => {
  const session = createSession({ stageIndex: 0 });
  debugHurt(session);
  assert.equal(session.lives, 2);
  assert.ok(session.world.player.invuln > 0);
  debugHurt(session);
  assert.equal(session.lives, 1);
});

test("引擎：一千二百步随机游走不抛错、状态有限且守恒", () => {
  const session = createSession({ stageIndex: 2 });
  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1200; i += 1) {
    step(session, {
      axisX: Math.round(random() * 2 - 1),
      axisY: Math.round(random() * 2 - 1),
      slow: random() > 0.7,
      charge: random() > 0.75,
      bombPressed: random() > 0.985,
    }, FIXED_DT);
    assert.equal(Number.isFinite(session.time), true);
    assert.equal(Number.isFinite(session.world.player.x), true);
    assert.equal(Number.isFinite(session.world.player.y), true);
    assert.ok(session.world.player.x >= 18 && session.world.player.x <= STAGE_W - 18);
    assert.ok(session.world.player.y >= 70 && session.world.player.y <= STAGE_H - 18);
    assert.ok(session.world.enemyBullets.length <= 460);
    assert.ok(session.lives >= 0 && session.lives <= 3);
    assert.ok(session.bombs >= 0 && session.bombs <= MAX_BOMBS);
  }
  assert.ok(["playing", "cleared", "gameover"].includes(session.status));
  assert.equal(PLAYER_HIT_R, 4);
});
