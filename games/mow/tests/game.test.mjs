// game.test.mjs — DOM-free 控制器生命周期与结算归档。
import { test } from "node:test";
import assert from "node:assert/strict";
import { MowGame } from "../js/game.mjs";
import * as storage from "../js/storage.mjs";
import { mulberry32, PHASES, BOSS_TIME } from "../js/engine.mjs";

function simulateUntil(predicate, game, maxMs = 600000) {
  let elapsed = 0;
  while (!predicate() && elapsed < maxMs) {
    game.step(16.7);
    elapsed += 16.7;
  }
  return elapsed;
}

test("控制器：newRun → start → step → 快照 → 结束只归档一次", () => {
  storage.resetBackendForTests();
  const game = new MowGame();
  game.newRun("standard", "mower");
  assert.equal(game.getMode(), "standard");
  assert.equal(game.getCharacter(), "mower");
  game.start();
  const events = [];
  let endCount = 0;
  game.on((ev) => {
    if (ev.type === "runEnd") endCount += 1;
    events.push(ev.type);
  });
  game.step(16.7);
  assert.ok(game.snapshot());
  // 快速致死：直接压血 + 贴脸怪
  const s = game.state;
  s.player.hp = 1;
  s.enemies.push({ alive: true, type: "caterpillar", x: s.player.x, y: s.player.y, r: 12, hp: 5, maxHp: 5, spawnT: 0, elite: false, xp: 1, dmg: 1, speed: 58, angle: 0, steer: 1, bounce: false, dirX: 0, dirY: 1, hitFlash: 0 });
  simulateUntil(() => !game.state || game.state.phase === PHASES.lost, game);
  assert.ok(endCount >= 1, "runEnd 事件已发出");
  assert.equal(endCount, 1, "只归档一次");
  assert.ok(game.lastResult, "lastResult 记录");
  assert.ok(game.lastResult.result.lost || !game.lastResult.result.won);
  assert.ok(game.getSave().stats.runs >= 1, "统计累计");
});

test("控制器：三选一升级流程", () => {
  storage.resetBackendForTests();
  const game = new MowGame();
  game.newRun("standard", "mower");
  game.start();
  const s = game.state;
  s.xp = s.xpNext;
  game.step(16.7);
  assert.equal(s.phase, PHASES.upgrading);
  assert.ok(s.choices.length >= 3);
  game.choose(0);
  assert.equal(s.phase, PHASES.playing);
});

test("控制器：标准通关 → 存档解禁无尽与兔子", () => {
  storage.resetBackendForTests();
  const game = new MowGame();
  game.newRun("standard", "mower");
  game.start();
  const s = game.state;
  s.time = BOSS_TIME - 1;
  simulateUntil(() => s.bossSpawned, game, 10000);
  assert.ok(s.boss, "Boss 登场");
  s.player.x = s.boss.x;
  s.player.y = s.boss.y + 60;
  s.boss.hp = 1;
  simulateUntil(() => s.phase === PHASES.won, game, 60000);
  const save = game.getSave();
  assert.ok(save.best.standard && save.best.standard.won, "标准最佳已通关");
  assert.ok(save.unlocked.includes("rabbit"), "兔子解锁");
  // 无尽深渊可开
  game.newRun("endless", "ladybug");
  game.start();
  assert.equal(game.getMode(), "endless");
  assert.equal(game.getCharacter(), "ladybug");
});

test("控制器：待命阶段不可推进、不可爆发", () => {
  storage.resetBackendForTests();
  const game = new MowGame();
  game.newRun("standard", "mower");
  const s = game.state;
  const t0 = s.time;
  game.step(16.7);
  assert.equal(s.time, t0, "ready 阶段不推进");
  game.pressBurst();
  assert.equal(s.burstCount, 0);
});
