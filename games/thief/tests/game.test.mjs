// game.test.mjs - the DOM-free controller: gesture bookkeeping, the
// aim -> retract -> won chain, shock recovery and level gating.

import test from "node:test";
import assert from "node:assert/strict";
import { PHASE, createGame } from "../js/game.mjs";
import { getLevel } from "../js/levels.mjs";
import { starsFor } from "../js/score.mjs";

function harness(overrides = {}) {
  const best = {};
  const cleared = {};
  const events = [];
  const wins = [];
  const game = createGame({
    loadProgress: () => {
      const ids = Object.keys(best).map(Number);
      return {
        cleared: { ...cleared },
        best: { ...best },
        clearedCount: ids.length,
        totalStars: ids.reduce((sum, id) => sum + (cleared[id] ?? 0), 0),
        maxStars: 60,
      };
    },
    recordLevel: (id, travelled) => {
      const round = Math.round(travelled);
      const level = getLevel(id);
      const previous = best[id] ?? null;
      const improved = previous === null || round < previous;
      if (improved) best[id] = round;
      const stars = starsFor(level, best[id]);
      cleared[id] = stars;
      return { improved, stars, best: best[id] };
    },
    onEvent: (payload) => events.push(payload),
    onWin: (result) => wins.push(result),
    ...overrides,
  });
  return { game, best, cleared, events, wins };
}

// 按住当前手掌再拖到目标点：控制器按位移增量驱动，等距拖拽正好命中该点。
function dragTo(game, point) {
  const hand = game.snapshot().hand;
  game.pointerDown(hand);
  game.pointerMove(point);
  game.pointerUp();
}

function followSolution(game) {
  for (const waypoint of game.level.solution) {
    dragTo(game, waypoint);
    if (game.snapshot().phase !== PHASE.AIM) return;
  }
}

function runTicks(game, seconds, step = 1 / 60) {
  const frames = Math.ceil(seconds / step);
  for (let i = 0; i < frames; i += 1) game.tick(step);
}

test("开局: 第 1 关从肩部起手，状态为瞄准", () => {
  const { game } = harness();
  game.start(1);
  const snap = game.snapshot();
  assert.equal(snap.levelId, 1);
  assert.equal(snap.phase, PHASE.AIM);
  assert.equal(snap.travelled, 0);
  assert.deepEqual(snap.hand, game.level.handStart);
  assert.equal(snap.stars, 3);
  assert.equal(snap.paused, false);
  assert.equal(snap.progress.clearedCount, 0);
});

test("拖拽: 手跟随指针位移而不是跳到指针位置", () => {
  const { game } = harness();
  game.start(1);
  const start = game.snapshot().hand;
  game.pointerDown({ x: 400, y: 400 });
  game.pointerMove({ x: 412, y: 388 });
  const moved = game.snapshot().hand;
  assert.ok(Math.abs(moved.x - (start.x + 12)) < 1e-6);
  assert.ok(Math.abs(moved.y - (start.y - 12)) < 1e-6);
  assert.equal(game.snapshot().dragging, true);
  game.pointerUp();
  assert.equal(game.snapshot().dragging, false);
});

test("通关: 走完作者路线进入回弹，回弹结束判胜并结算", () => {
  const { game, wins, events } = harness();
  game.start(1);
  followSolution(game);
  assert.equal(game.snapshot().phase, PHASE.RETRACT);
  assert.equal(game.snapshot().result, null);

  runTicks(game, 3);
  const snap = game.snapshot();
  assert.equal(snap.phase, PHASE.WON);
  assert.equal(wins.length, 1, "onWin 只应触发一次");
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, "WON");
  assert.equal(events[0].slug, "thief");
  assert.equal(events[0].level, 1);
  assert.ok(events[0].stars >= 1 && events[0].stars <= 3);
  assert.ok(events[0].timestamp > 0);

  assert.ok(snap.result.won);
  assert.equal(snap.result.levelId, 1);
  assert.equal(snap.result.improved, true);
  assert.equal(snap.result.hasNext, true);
  assert.ok(snap.result.travel > 0);
  assert.equal(snap.result.best, snap.result.travel);
  assert.equal(snap.progress.cleared[1], snap.result.stars);

  runTicks(game, 3);
  assert.equal(wins.length, 1, "结算不能被重复触发");
});

test("计分: 回弹结束后星数按实测臂展评定", () => {
  const { game } = harness();
  game.start(1);
  followSolution(game);
  const travelled = game.snapshot().travelled;
  runTicks(game, 3);
  const result = game.snapshot().result;
  assert.ok(result);
  assert.equal(result.travel, Math.round(travelled));
  assert.equal(result.stars, starsFor(game.level, travelled));
});

test("暂停: 暂停期间不可拖拽，时间也不推进", () => {
  const { game } = harness();
  game.start(1);
  game.pause();
  assert.equal(game.snapshot().paused, true);
  assert.equal(game.pointerDown(game.snapshot().hand), false, "暂停时不应接受拖拽");
  runTicks(game, 1);
  assert.equal(game.snapshot().travelled, 0);
  game.togglePause();
  assert.equal(game.snapshot().paused, false);
  assert.equal(game.pointerDown(game.snapshot().hand), true);
  game.pointerUp();
});

test("失败: 触电后上报 LOST，超时自动重开", () => {
  const { game, events } = harness();
  game.start(5);
  dragTo(game, game.level.target);
  const hit = game.snapshot();
  assert.equal(hit.phase, PHASE.SHOCK);
  assert.equal(hit.failure.kind, "laser");
  assert.equal(events.length, 1);
  assert.equal(events[0].outcome, "LOST");
  assert.equal(events[0].stars, 0);

  runTicks(game, 0.4);
  assert.equal(game.snapshot().phase, PHASE.SHOCK, "还没到自动重开的时间");
  runTicks(game, 1.0);
  const fresh = game.snapshot();
  assert.equal(fresh.phase, PHASE.AIM);
  assert.equal(fresh.travelled, 0);
  assert.equal(fresh.failure, null);
});

test("重来: restart 清空进度但保留关卡", () => {
  const { game } = harness();
  game.start(4);
  dragTo(game, { x: 400, y: 300 });
  assert.ok(game.snapshot().travelled > 0);
  game.restart();
  const snap = game.snapshot();
  assert.equal(snap.levelId, 4);
  assert.equal(snap.phase, PHASE.AIM);
  assert.equal(snap.travelled, 0);
  assert.deepEqual(snap.hand, game.level.handStart);
});

test("关卡门禁: 没通关到上一关时下一件打不开", () => {
  const { game } = harness();
  game.start(1);
  game.nextLevel();
  assert.equal(game.snapshot().levelId, 1, "通关前不能跳关");

  followSolution(game);
  runTicks(game, 3);
  assert.equal(game.snapshot().phase, PHASE.WON);
  game.nextLevel();
  assert.equal(game.snapshot().levelId, 2, "通关后可以进下一关");
  assert.equal(game.snapshot().travelled, 0);
});

test("关卡门禁: 最后一关没有下一件", () => {
  const { game } = harness();
  game.start(20);
  followSolution(game);
  runTicks(game, 4);
  assert.equal(game.snapshot().result.hasNext, false);
});

test("快照: 警报灯跟随手臂与危险的距离", () => {
  const { game } = harness();
  game.start(5);
  assert.equal(game.snapshot().alarm, 0);
  const laser = game.level.lasers[0];
  dragTo(game, { x: laser.x1 - 24, y: (laser.y1 + laser.y2) / 2 });
  const alarm = game.snapshot().alarm;
  assert.ok([0, 1, 2].includes(alarm));
  assert.equal(game.snapshot().phase, PHASE.AIM);
});

test("未知关卡回落到第 1 关，refreshProgress 拉取最新存档", () => {
  const { game, best } = harness();
  game.start(999);
  assert.equal(game.snapshot().levelId, 1);
  best[3] = 700;
  game.refreshProgress();
  assert.equal(game.snapshot().progress.best[3], 700);
});
