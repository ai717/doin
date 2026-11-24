import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../js/game.mjs";
import { FIXED_DT } from "../js/engine.mjs";

test("控制器：开局立即可玩且快照字段完整", () => {
  const game = createGame({ stageIndex: 0 });
  const snap = game.snapshot();
  assert.equal(snap.mode, "stage");
  assert.equal(snap.status, "playing");
  assert.equal(snap.stageNumber, 1);
  assert.equal(snap.stageId, "stage_1");
  assert.equal(snap.lives, 3);
  assert.equal(snap.bombs, 2);
  assert.equal(snap.stars, 0);
  assert.ok(snap.player.x > 0 && snap.player.y > 0);
  assert.equal(typeof snap.bossHp, "number");
});

test("控制器：固定步进推进时间，暂停后完全冻结", () => {
  const game = createGame({ stageIndex: 0 });
  game.tick(FIXED_DT);
  const time = game.snapshot().time;
  assert.ok(time >= FIXED_DT - 0.001);
  game.pause();
  game.tick(0.5);
  assert.equal(game.snapshot().time, time);
  game.resume();
  game.tick(FIXED_DT);
  assert.ok(game.snapshot().time > time);
});

test("控制器：输入驱动移动与蓄力", () => {
  const game = createGame({ stageIndex: 0 });
  const startX = game.snapshot().player.x;
  game.setAxis(1, 0);
  for (let i = 0; i < 20; i += 1) game.tick(FIXED_DT);
  assert.ok(game.snapshot().player.x > startX);
  game.setCharge(true);
  for (let i = 0; i < 30; i += 1) game.tick(FIXED_DT);
  const snap = game.snapshot();
  assert.equal(snap.charging, true);
  assert.ok(snap.charge > 0.3);
  game.setCharge(false);
  game.tick(FIXED_DT);
  assert.ok(game.session.world.beam, "松开蓄力应释放激光");
});

test("控制器：保险只有按下瞬间生效一次", () => {
  const game = createGame({ stageIndex: 0 });
  const bombs = game.snapshot().bombs;
  game.pressBomb();
  game.tick(FIXED_DT);
  assert.equal(game.snapshot().bombs, bombs - 1);
  game.tick(FIXED_DT);
  assert.equal(game.snapshot().bombs, bombs - 1);
});

test("控制器：拖动直接移动且不越界", () => {
  const game = createGame({ stageIndex: 0 });
  const start = game.snapshot().player;
  game.dragBy(-30, -40);
  const moved = game.snapshot().player;
  assert.ok(moved.x < start.x);
  assert.ok(moved.y < start.y);
  game.dragBy(-9999, 9999);
  const clamped = game.snapshot().player;
  assert.equal(clamped.x, 18);
  assert.equal(clamped.y, 882);
});

test("控制器：单次超长 tick 最多推进八步", () => {
  const game = createGame({ stageIndex: 0 });
  const before = game.snapshot().time;
  game.tick(2);
  const after = game.snapshot().time;
  assert.ok(after - before <= FIXED_DT * 8 + 0.0001);
  assert.ok(after - before > 0);
});

test("控制器：跳面立即生效并重置资源", () => {
  const game = createGame({ stageIndex: 0 });
  game.loadStage(3);
  const snap = game.snapshot();
  assert.equal(snap.stageNumber, 4);
  assert.equal(snap.stageId, "stage_4");
  assert.equal(snap.lives, 3);
  assert.equal(snap.score, 0);
  assert.equal(snap.bossHp, 0);
});

test("控制器：过关后下一面继承生命与得分", () => {
  const game = createGame({ stageIndex: 0 });
  game.session.score = 4321;
  game.debugWin();
  assert.equal(game.snapshot().status, "cleared");
  const carried = game.session.score;
  assert.ok(carried > 4321, "过关应追加奖励");
  assert.equal(game.nextStage(), true);
  const snap = game.snapshot();
  assert.equal(snap.stageNumber, 2);
  assert.equal(snap.score, carried);
  assert.equal(snap.lives, 3);
});

test("控制器：最后一面的 nextStage 不越界", () => {
  const game = createGame({ stageIndex: 5 });
  game.debugWin();
  assert.equal(game.nextStage(), false);
  assert.equal(game.snapshot().stageNumber, 6);
});

test("控制器：重开本面恢复默认资源并清理弹幕", () => {
  const game = createGame({ stageIndex: 2 });
  game.session.score = 999;
  game.session.lives = 1;
  game.debugTeleport(100, 200);
  game.restart();
  const snap = game.snapshot();
  assert.equal(snap.stageNumber, 3);
  assert.equal(snap.lives, 3);
  assert.equal(snap.score, 0);
  assert.equal(snap.enemyBullets, 0);
  assert.ok(snap.player.x >= 18);
});

test("控制器：训练模式快照带剩余时间且不损命", () => {
  const game = createGame({ stageIndex: 0 });
  game.loadTraining();
  const snap = game.snapshot();
  assert.equal(snap.mode, "training");
  assert.equal(snap.stageNumber, 0);
  assert.ok(Math.abs(snap.trainingLeft - 60) < 0.2);
  assert.equal(snap.lives, 3);
});

test("控制器：清场事件进入 drainEvents 队列", () => {
  const game = createGame({ stageIndex: 0 });
  game.debugWin();
  const events = game.drainEvents();
  assert.ok(events.some((event) => event.type === "clear"));
  assert.equal(game.drainEvents().length, 0);
});
