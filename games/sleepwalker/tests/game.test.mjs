/**
 * @file games/sleepwalker/tests/game.test.mjs
 * GameController 状态流转、暂停逻辑与事件派发测试。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../js/game.mjs';

test('game: controller initialization', () => {
  const ctrl = new GameController(1);
  assert.equal(ctrl.currentLevel.id, 1);
  assert.equal(ctrl.isPaused(), false);
  assert.equal(ctrl.getState().status, 'playing');
});

test('game: pause and resume toggle', () => {
  const ctrl = new GameController(1);
  assert.equal(ctrl.isPaused(), false);

  // 步进几步，小人移动
  ctrl.step(0.1);
  const x1 = ctrl.getState().walker.x;
  assert.ok(x1 > 40);

  // 暂停
  ctrl.togglePause();
  assert.equal(ctrl.isPaused(), true);
  assert.equal(ctrl.getState().isPaused, true);

  // 步进时物理时钟冻结
  ctrl.step(0.5);
  const xPaused = ctrl.getState().walker.x;
  assert.equal(xPaused, x1, 'Walker position must NOT change while paused');

  // 恢复继续
  ctrl.togglePause();
  assert.equal(ctrl.isPaused(), false);
  ctrl.step(0.1);
  assert.ok(ctrl.getState().walker.x > x1, 'Walker resumes forward movement');
});

test('game: restart and loadLevel reset pause state', () => {
  const ctrl = new GameController(1);
  ctrl.setPaused(true);
  assert.equal(ctrl.isPaused(), true);

  ctrl.restartLevel();
  assert.equal(ctrl.isPaused(), false);
});
