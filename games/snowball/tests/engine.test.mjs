import test from "node:test";
import assert from "node:assert/strict";
import {
  createSession,
  step,
  pause,
  resume,
  debugSetPlayer,
  debugClearEnemies,
  debugKillEnemy,
  debugHurt,
  FIXED_DT,
} from "../js/engine.mjs";

function boot() {
  return createSession({ levelIndex: 0 });
}

test("引擎：开局即可操作，玩家落在出生平台", () => {
  const session = createSession({ levelIndex: 0 });
  assert.equal(session.status, "playing");
  assert.equal(session.lives, 3);
  assert.ok(session.world.player.onGround);
  assert.equal(session.world.player.y, session.level.playerSpawn.y);
  assert.ok(session.world.enemies.length >= 3);
});

test("引擎：左右移动改变位置，松手后停下", () => {
  const session = createSession({ levelIndex: 0 });
  const start = session.world.player.x;
  for (let i = 0; i < 30; i += 1) step(session, { axis: 1 }, FIXED_DT);
  assert.ok(session.world.player.x > start + 40);
  for (let i = 0; i < 90; i += 1) step(session, { axis: 0 }, FIXED_DT);
  assert.ok(Math.abs(session.world.player.vx) < 1);
});

test("引擎：跳跃离地并最终落回平台", () => {
  const session = createSession({ levelIndex: 0 });
  step(session, { jumpPressed: true }, FIXED_DT);
  assert.ok(session.world.player.y < 500);
  assert.ok(session.events.some((event) => event.type === "jump"));
  for (let i = 0; i < 90; i += 1) step(session, {}, FIXED_DT);
  assert.ok(session.world.player.onGround);
  assert.ok(Math.abs(session.world.player.y - 500) < 0.6 || session.world.player.y === 390);
});

test("引擎：喷雪冻结小怪并生成雪球", () => {
  const session = createSession({ levelIndex: 0 });
  const enemy = session.world.enemies[0];
  debugSetPlayer(session, enemy.x - 70, 390);
  const before = session.world.enemies.length;
  for (let i = 0; i < 100; i += 1) step(session, { spray: true }, FIXED_DT);
  assert.equal(session.world.enemies.length, before - 1);
  assert.equal(session.world.snowballs.length, 1);
  assert.ok(session.events.some((event) => event.type === "freeze"));
});

test("引擎：低飞怪冻结成雪球后稳稳落地，不会穿地", () => {
  const session = createSession({ levelIndex: 5 });
  for (let i = 0; i < 36; i += 1) step(session, {}, FIXED_DT);
  debugSetPlayer(session, 70, 390);
  for (let i = 0; i < 100 && session.world.snowballs.length === 0; i += 1) {
    step(session, { spray: true }, FIXED_DT);
  }
  const ball = session.world.snowballs[0];
  assert.ok(ball, "应当冻出雪球");
  assert.ok(ball.y + ball.r <= 501, "雪球生成时不应陷入地面");
  assert.ok(ball.y > 400, "雪球应停在近地高度");
  for (let i = 0; i < 90; i += 1) step(session, {}, FIXED_DT);
  assert.ok(ball.y + ball.r <= 501, "静置后仍应停在地面上");
});

test("引擎：贴近雪球朝它走即可推成滚球", () => {
  const session = createSession({ levelIndex: 0 });
  const enemy = session.world.enemies[0];
  debugSetPlayer(session, enemy.x - 70, 390);
  for (let i = 0; i < 100; i += 1) step(session, { spray: true }, FIXED_DT);
  const ball = session.world.snowballs[0];
  debugSetPlayer(session, ball.x - 26, 390);
  for (let i = 0; i < 30; i += 1) step(session, { axis: 1 }, FIXED_DT);
  const rolling = session.world.snowballs[0];
  assert.ok(rolling.rolling);
  assert.ok(rolling.vx > 0);
  assert.ok(session.events.some((event) => event.type === "push"));
});

test("引擎：滚球碾过小怪、加分、变大且不会陷进地面", () => {
  const session = createSession({ levelIndex: 0 });
  const enemy = session.world.enemies[0];
  debugSetPlayer(session, enemy.x - 70, 390);
  for (let i = 0; i < 100; i += 1) step(session, { spray: true }, FIXED_DT);
  const ball = session.world.snowballs[0];
  debugSetPlayer(session, ball.x - 26, 390);
  for (let i = 0; i < 300; i += 1) step(session, { axis: 1 }, FIXED_DT);
  assert.ok(session.kills >= 1);
  assert.ok(session.score >= 100);
  const rolling = session.world.snowballs[0];
  assert.ok(rolling);
  assert.ok(rolling.r > 16);
  assert.ok(rolling.y + rolling.r <= 501);
});

test("引擎：连锁雪崩在第三只时触发并追加奖励", () => {
  const session = createSession({ levelIndex: 4 });
  const base = session.score;
  assert.ok(debugKillEnemy(session, 0));
  assert.ok(debugKillEnemy(session, 0));
  const two = session.score - base;
  assert.ok(debugKillEnemy(session, 0));
  assert.equal(session.maxChain, 3);
  assert.ok(session.score - base > two);
  assert.ok(session.events.some((event) => event.type === "avalanche"));
});

test("引擎：未推走的雪球七秒后还原为小怪", () => {
  const session = createSession({ levelIndex: 0 });
  const enemy = session.world.enemies[0];
  const total = session.world.enemies.length;
  debugSetPlayer(session, enemy.x - 70, 390);
  for (let i = 0; i < 100; i += 1) step(session, { spray: true }, FIXED_DT);
  assert.equal(session.world.snowballs.length, 1);
  debugSetPlayer(session, 480, 500);
  for (let i = 0; i < 460; i += 1) step(session, {}, FIXED_DT);
  assert.equal(session.world.snowballs.length, 0);
  assert.ok(session.world.enemies.length >= total);
});

test("引擎：受伤扣命并进入无敌，第三次倒地结束", () => {
  const session = createSession({ levelIndex: 0 });
  debugHurt(session);
  assert.equal(session.lives, 2);
  assert.ok(session.world.player.invuln > 0);
  assert.ok(session.events.some((event) => event.type === "hurt"));
  debugHurt(session);
  debugHurt(session);
  assert.equal(session.lives, 0);
  assert.equal(session.status, "gameover");
  assert.ok(session.events.some((event) => event.type === "gameover"));
});

test("引擎：暂停冻结时间，恢复后继续推进", () => {
  const session = createSession({ levelIndex: 0 });
  for (let i = 0; i < 10; i += 1) step(session, {}, FIXED_DT);
  const frozenAt = session.elapsed;
  pause(session);
  for (let i = 0; i < 60; i += 1) step(session, {}, FIXED_DT);
  assert.equal(session.elapsed, frozenAt);
  resume(session);
  step(session, {}, FIXED_DT);
  assert.ok(session.elapsed > frozenAt);
});

test("引擎：清空敌人过关，星级按时间与受伤判定", () => {
  const clean = createSession({ levelIndex: 0 });
  debugClearEnemies(clean);
  step(clean, {}, FIXED_DT);
  assert.equal(clean.status, "cleared");
  assert.equal(clean.stars, 3);
  assert.ok(clean.events.some((event) => event.type === "clear"));

  const hurt = createSession({ levelIndex: 0 });
  debugHurt(hurt);
  debugClearEnemies(hurt);
  step(hurt, {}, FIXED_DT);
  assert.equal(hurt.status, "cleared");
  assert.equal(hurt.stars, 2);
});

test("引擎：弹簧把玩家弹起", () => {
  const session = createSession({ levelIndex: 2 });
  debugSetPlayer(session, 330, 492);
  step(session, {}, FIXED_DT);
  assert.ok(session.world.player.vy < -400);
  assert.ok(session.events.some((event) => event.type === "spring"));
});

test("引擎：冰面摩擦低，松手后仍会滑行", () => {
  const session = createSession({ levelIndex: 3 });
  for (let i = 0; i < 24; i += 1) step(session, { axis: 1 }, FIXED_DT);
  const speed = session.world.player.vx;
  for (let i = 0; i < 8; i += 1) step(session, { axis: 0 }, FIXED_DT);
  assert.ok(speed > 150);
  assert.ok(session.world.player.vx > speed * 0.5);
});

test("引擎：章末首领只吃滚球伤害且三次后倒下", () => {
  const session = createSession({ levelIndex: 9 });
  const boss = session.world.enemies.find((enemy) => enemy.type === "boss");
  assert.ok(boss);
  assert.equal(boss.hp, 3);
  for (let hit = 0; hit < 3; hit += 1) {
    session.world.snowballs.push({
      id: 9000 + hit,
      x: boss.x,
      y: boss.y + 20,
      r: 28,
      vx: 300,
      vy: 0,
      dir: 1,
      rolling: true,
      escape: 0,
      age: 0,
      spin: 0,
    });
    step(session, {}, FIXED_DT);
    if (boss.alive) boss.invuln = 0;
  }
  assert.ok(!boss.alive);
  assert.ok(session.events.some((event) => event.type === "bossHit"));
});

test("引擎：冲刺九十秒后结算", () => {
  const session = createSession({ mode: "rush" });
  assert.equal(session.rushTime, 90);
  session.rushTime = 0.02;
  step(session, {}, 0.05);
  assert.equal(session.status, "cleared");
  assert.equal(session.stars, 1);
  assert.ok(session.events.some((event) => event.type === "clear" && event.mode === "rush"));
});

test("引擎：1200 步随机游走不抛错、状态有限且守恒", () => {
  const session = createSession({ levelIndex: 6 });
  let seed = 1234567;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 1200; i += 1) {
    const axis = [0, -1, 1, 0][i % 4];
    step(session, { axis, spray: rnd() < 0.22, jumpPressed: rnd() < 0.02 }, FIXED_DT);
    const player = session.world.player;
    assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y));
    assert.ok(player.x > -40 && player.x < 1000);
    assert.ok(player.y < 700);
    assert.ok(session.lives >= 0 && session.lives <= 5);
    assert.ok(["playing", "cleared", "gameover"].includes(session.status));
  }
  assert.ok(session.elapsed > 19);
});
