import test from "node:test";
import assert from "node:assert/strict";

import {
  ARENA_MAX,
  ARENA_MIN,
  CONTINUES,
  MAX_HP,
  STATUS,
  Z_MAX,
  Z_MIN,
  aliveEnemies,
  applyIntent,
  createMatch,
  drainEvents,
  isTerminal,
  mulberry32,
  resumeAfterContinue,
  stepFrame,
  summarize,
} from "../js/engine.mjs";

function settle(state, seconds = 1) {
  for (let i = 0; i < Math.round(seconds * 60); i += 1) stepFrame(state, 1 / 60);
}

function placeEnemyInFront(state, enemy) {
  const player = state.players[0];
  enemy.spawnT = 0;
  enemy.stun = 0;
  enemy.cool = 60;
  enemy.attack = null;
  enemy.x = Math.min(ARENA_MAX - 20, player.x + 44);
  enemy.z = player.z;
  player.facing = 1;
}

function hitOnce(state, action = "heavy") {
  const enemy = aliveEnemies(state)[0];
  assert.ok(enemy, "需要一个可攻击目标");
  placeEnemyInFront(state, enemy);
  const before = enemy.hp;
  applyIntent(state, { action });
  settle(state, 0.4);
  return before - enemy.hp;
}

test("创建关卡：起手第一波立刻可打，边界与状态合法", () => {
  const state = createMatch({ levelId: "level_01", seed: 1 });
  assert.equal(state.status, STATUS.playing);
  assert.equal(state.mode, "story");
  assert.equal(state.phase, "wave");
  assert.equal(state.waveIndex, 0);
  assert.equal(state.enemies.length, 3);
  assert.equal(state.continues, CONTINUES);
  assert.equal(state.players[0].hp, MAX_HP);
  assert.ok(state.players[0].x >= ARENA_MIN && state.players[0].x <= ARENA_MAX);
  assert.ok(state.players[0].z >= Z_MIN && state.players[0].z <= Z_MAX);
  for (const enemy of state.enemies) {
    assert.ok(Number.isFinite(enemy.hp) && enemy.hp > 0);
    assert.ok(enemy.z >= Z_MIN && enemy.z <= Z_MAX);
  }
});

test("重拳 15、轻拳 6、背摔 20、必杀 40 且消耗 10 体力", () => {
  const state = createMatch({ levelId: "level_01", seed: 2 });
  settle(state, 1);
  assert.equal(hitOnce(state, "heavy"), 15);

  const state2 = createMatch({ levelId: "level_01", seed: 2 });
  settle(state2, 1);
  assert.equal(hitOnce(state2, "light"), 6);

  const state3 = createMatch({ levelId: "level_01", seed: 3 });
  settle(state3, 1);
  const grabbable = aliveEnemies(state3)[0];
  grabbable.stun = 0.5;
  grabbable.x = state3.players[0].x + 40;
  grabbable.z = state3.players[0].z;
  state3.players[0].facing = 1;
  applyIntent(state3, { action: "heavy" });
  assert.equal(state3.players[0].attack.type, "suplex");
  const before = grabbable.hp;
  settle(state3, 0.4);
  assert.equal(before - grabbable.hp, 20);

  const state4 = createMatch({ levelId: "level_01", seed: 4 });
  settle(state4, 1);
  const target = aliveEnemies(state4)[0];
  target.x = state4.players[0].x + 50;
  target.z = state4.players[0].z;
  const hp = state4.players[0].hp;
  assert.equal(applyIntent(state4, { action: "special" }).action, "special");
  settle(state4, 0.45);
  assert.equal(state4.players[0].hp, hp - 10);
  assert.ok(state4.ko >= 1, "必杀应清掉身边小怪");
});

test("必杀蓄力时再按 U 可取消且不扣体力", () => {
  const state = createMatch({ levelId: "level_01", seed: 5 });
  settle(state, 1);
  const player = state.players[0];
  const hp = player.hp;
  assert.equal(applyIntent(state, { action: "special" }).action, "special");
  assert.equal(player.special.phase, "charge");
  assert.equal(applyIntent(state, { action: "special" }).action, "special");
  assert.equal(player.special.phase, "idle");
  settle(state, 0.5);
  assert.equal(player.hp, hp);
});

test("第三下轻拳带击飞属性，重拳可把对手打浮空", () => {
  const state = createMatch({ levelId: "level_01", seed: 6 });
  settle(state, 1);
  const player = state.players[0];
  player.combo = 1;
  player.comboT = 0.5;
  applyIntent(state, { action: "light" });
  assert.equal(player.attack.chain, 2);
  assert.equal(player.attack.spec.launch, "small");

  const state2 = createMatch({ levelId: "level_01", seed: 6 });
  settle(state2, 1);
  const enemy = aliveEnemies(state2)[0];
  placeEnemyInFront(state2, enemy);
  applyIntent(state2, { action: "heavy" });
  settle(state2, 0.3);
  assert.ok(["launched", "hurt"].includes(enemy.state));
  assert.ok(enemy.vh > 0 || enemy.vx !== 0);
});

test("道具：捡起投掷物后按 L 扔出，牛奶当场回血", () => {
  const state = createMatch({ levelId: "level_01", seed: 7 });
  settle(state, 1);
  const player = state.players[0];
  const ball = state.items.find((item) => item.kind === "item_basketball");
  assert.ok(ball);
  player.x = ball.x;
  player.z = ball.z;
  assert.equal(applyIntent(state, { action: "use" }).action, "use");
  assert.equal(player.carryId, ball.id);
  assert.equal(ball.held, true);
  const enemy = aliveEnemies(state)[0];
  enemy.x = player.x + 120;
  enemy.z = player.z;
  assert.equal(applyIntent(state, { action: "use" }).action, "use");
  assert.equal(player.carryId, null);
  assert.equal(state.projectiles.length, 1);
  assert.equal(state.projectiles[0].team, "player");

  const state2 = createMatch({ levelId: "level_01", seed: 8 });
  settle(state2, 1);
  const player2 = state2.players[0];
  player2.hp = 50;
  const milk = state2.items.find((item) => item.kind === "item_milk");
  player2.x = milk.x;
  player2.z = milk.z;
  applyIntent(state2, { action: "use" });
  assert.equal(player2.hp, 75);
  assert.equal(state2.items.some((item) => item.id === milk.id), false);
});

test("清空三波后压轴对手登场，击败即结算并给出评级", () => {
  const state = createMatch({ levelId: "level_01", seed: 9 });
  const player = state.players[0];

  function wipeWave() {
    settle(state, 0.2);
    let guard = 0;
    while (aliveEnemies(state).length > 0 && guard < 30) {
      guard += 1;
      const enemy = aliveEnemies(state)[0];
      enemy.hp = 1;
      placeEnemyInFront(state, enemy);
      applyIntent(state, { action: "heavy" });
      settle(state, 0.35);
    }
    assert.equal(aliveEnemies(state).length, 0);
  }

  wipeWave();
  assert.equal(state.waveIndex, 0);
  settle(state, 1.3);
  assert.equal(state.waveIndex, 1);
  assert.equal(state.enemies.length, 4);
  wipeWave();
  settle(state, 1.3);
  assert.equal(state.waveIndex, 2);
  assert.equal(state.enemies.length, 5);
  wipeWave();
  settle(state, 1.4);
  assert.equal(state.phase, "boss");
  assert.equal(aliveEnemies(state).length, 1);
  assert.equal(aliveEnemies(state)[0].elite, true);

  const elite = aliveEnemies(state)[0];
  elite.hp = 1;
  placeEnemyInFront(state, elite);
  applyIntent(state, { action: "heavy" });
  settle(state, 2);
  assert.equal(state.status, STATUS.cleared);
  assert.ok(isTerminal(state));
  assert.ok(state.ko >= 13);

  const summary = summarize(state);
  assert.equal(summary.outcome, "clear");
  assert.ok(summary.stars >= 1 && summary.stars <= 3);
  assert.ok(summary.score > 0);
  assert.equal(summary.levelId, "level_01");
  assert.equal(player.ko, state.ko);
});

test("章节 Boss 关：击倒 Boss 后清场并结算", () => {
  const state = createMatch({ levelId: "level_03", seed: 10 });
  state.waveIndex = 2;
  state.enemies = [];
  state.phase = "wave";
  state.waveDelay = 2;
  settle(state, 0.2);
  assert.equal(state.phase, "boss");
  const boss = aliveEnemies(state)[0];
  assert.equal(boss.boss, true);
  boss.hp = 1;
  placeEnemyInFront(state, boss);
  applyIntent(state, { action: "heavy" });
  settle(state, 2.2);
  assert.equal(state.status, STATUS.cleared);
  assert.equal(summarize(state).bossKills, 1);
});

test("体力见底进入续关，续关后满血重打当前波次", () => {
  const state = createMatch({ levelId: "level_01", seed: 11 });
  settle(state, 1);
  const player = state.players[0];
  player.hp = 1;
  player.invuln = 0;
  const enemies = aliveEnemies(state);
  enemies.forEach((enemy, index) => {
    enemy.spawnT = 0;
    enemy.cool = 0;
    enemy.stun = 0;
    enemy.x = player.x + 34;
    enemy.z = player.z + index * 0.005;
  });
  let guard = 0;
  while (state.status === STATUS.playing && guard < 360) {
    stepFrame(state, 1 / 60);
    guard += 1;
  }
  assert.equal(state.status, STATUS.continue);
  assert.equal(state.continues, CONTINUES);

  const resumed = applyIntent(state, { type: "continue" });
  assert.equal(resumed.action, "continue");
  assert.equal(state.status, STATUS.playing);
  assert.equal(state.continues, CONTINUES - 1);
  assert.equal(state.continuesUsed, 1);
  assert.equal(player.hp, MAX_HP);
  assert.equal(state.waveIndex, 0);
  assert.equal(aliveEnemies(state).length, 3);
});

test("双人模式一人倒地后会在 5 秒后复活", () => {
  const state = createMatch({ levelId: "level_01", players: 2, seed: 12 });
  settle(state, 0.5);
  const [p1, p2] = state.players;
  p2.x = 1500;
  p1.hp = 0;
  p1.downTimer = 5;
  p1.attack = null;
  settle(state, 7);
  assert.ok(p1.hp > 0);
  assert.equal(p1.downTimer, 0);
});

test("街机模式 180 秒倒计时结束即结算", () => {
  const state = createMatch({ mode: "arcade", seed: 13 });
  assert.equal(state.mode, "arcade");
  assert.equal(state.timeLeft, 180);
  assert.equal(state.continues, 0);
  settle(state, 1);
  assert.ok(state.timeLeft < 180);
  state.ko = 7;
  state.timeLeft = 0.05;
  stepFrame(state, 0.2);
  assert.equal(state.status, STATUS.cleared);
  const summary = summarize(state);
  assert.equal(summary.mode, "arcade");
  assert.equal(summary.stars, 0);
  assert.ok(summary.score > 0);
});

test("终局后所有操作与推进均为 no-op", () => {
  const state = createMatch({ levelId: "level_01", seed: 14 });
  state.status = STATUS.cleared;
  state.events.length = 0;
  const snapshot = JSON.stringify({
    players: state.players.map((p) => [p.x, p.z, p.hp]),
    enemies: state.enemies.length,
    time: state.time,
  });
  assert.equal(applyIntent(state, { action: "heavy" }).action, null);
  assert.equal(applyIntent(state, { action: "jump" }).action, null);
  assert.equal(applyIntent(state, { type: "continue" }).action, null);
  settle(state, 1);
  assert.equal(JSON.stringify({
    players: state.players.map((p) => [p.x, p.z, p.hp]),
    enemies: state.enemies.length,
    time: state.time,
  }), snapshot);
});

test("相同种子与相同操作产生完全一致的 900 帧结果", () => {
  const run = (seed) => {
    const state = createMatch({ levelId: "level_02", seed });
    const rng = mulberry32(77);
    for (let frame = 0; frame < 900; frame += 1) {
      if (frame % 25 === 0) {
        applyIntent(state, { type: "input", mx: rng() * 2 - 1, mz: rng() * 2 - 1 });
      }
      if (frame % 19 === 0) {
        applyIntent(state, { action: ["light", "heavy", "jump", "use"][Math.floor(rng() * 4)] });
      }
      if (frame % 53 === 0) applyIntent(state, { action: "special" });
      stepFrame(state, 1 / 60);
      if (state.status === STATUS.continue) applyIntent(state, { type: "continue" });
    }
    return JSON.stringify({
      time: state.time.toFixed(5),
      ko: state.ko,
      status: state.status,
      players: state.players.map((p) => [p.x.toFixed(4), p.z.toFixed(4), p.hp, p.ko]),
      enemies: state.enemies.map((e) => [e.kind, e.x.toFixed(4), e.z.toFixed(4), e.hp, e.state]),
      projectiles: state.projectiles.map((p) => [p.kind, p.x.toFixed(3), p.z.toFixed(3), p.h.toFixed(3)]),
    });
  };
  assert.equal(run(4242), run(4242));
});

test("2400 步随机游走：坐标、体力、事件与状态始终合法", () => {
  const state = createMatch({ levelId: "level_03", players: 2, seed: 5150 });
  const rng = mulberry32(31);
  const eventTypes = new Set([
    "wave", "boss", "swing", "impact", "hit", "ko", "land", "dust", "star", "jump",
    "charge", "special", "specialCancel", "pickup", "throw", "heal", "hurt", "down",
    "continue", "lost", "clear", "telegraph", "bounce", "grab", "bossDown", "summon",
    "resume", "revive", "leap",
  ]);
  for (let frame = 0; frame < 2400; frame += 1) {
    if (frame % 17 === 0) {
      applyIntent(state, { type: "input", playerId: 0, mx: rng() * 2 - 1, mz: rng() * 2 - 1 });
      applyIntent(state, { type: "input", playerId: 1, mx: rng() * 2 - 1, mz: rng() * 2 - 1 });
    }
    if (frame % 9 === 0) {
      const actions = ["light", "heavy", "jump", "use", "special"];
      applyIntent(state, { action: actions[Math.floor(rng() * actions.length)], playerId: Math.floor(rng() * 2) });
    }
    stepFrame(state, 1 / 60);
    if (state.status === STATUS.continue) applyIntent(state, { type: "continue" });

    for (const player of state.players) {
      assert.ok(Number.isFinite(player.x) && Number.isFinite(player.z) && Number.isFinite(player.h));
      assert.ok(player.x >= ARENA_MIN - 0.001 && player.x <= ARENA_MAX + 0.001);
      assert.ok(player.z >= Z_MIN - 0.001 && player.z <= Z_MAX + 0.001);
      assert.ok(player.hp >= 0 && player.hp <= player.maxHp);
      assert.ok(player.ko >= 0);
    }
    for (const enemy of state.enemies) {
      assert.ok(Number.isFinite(enemy.x) && Number.isFinite(enemy.hp));
      assert.ok(enemy.hp <= enemy.maxHp);
      assert.ok(enemy.z >= Z_MIN - 0.001 && enemy.z <= Z_MAX + 0.001);
    }
    for (const projectile of state.projectiles) {
      assert.ok(Number.isFinite(projectile.x) && Number.isFinite(projectile.h));
    }
    for (const event of drainEvents(state)) {
      assert.ok(eventTypes.has(event.type), `未知事件 ${event.type}`);
    }
    assert.ok(state.ko >= 0);
    if (state.status === STATUS.lost || state.status === STATUS.cleared) break;
  }
  assert.ok(["playing", "continue", "cleared", "lost"].includes(state.status));
});

test("resumeAfterContinue 在非续关状态下是安全 no-op", () => {
  const state = createMatch({ levelId: "level_01", seed: 15 });
  const continues = state.continues;
  const result = resumeAfterContinue(state);
  assert.equal(result.action, null);
  assert.equal(state.continues, continues);
});
