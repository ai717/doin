import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../js/game.mjs';

test('game: controller initialization', () => {
  const ctrl = new GameController();
  assert.equal(ctrl.mode, '1p');
  assert.equal(ctrl.isPaused(), false);
  assert.ok(ctrl.getState());
  assert.ok(ctrl.getLevel());
});

test('game: mode toggle and thrust restrictions', () => {
  const ctrl = new GameController();
  ctrl.getState().status = 'playing';

  // 1P 模式：红车可冲刺，蓝车由 AI 驱动忽略外界调用
  ctrl.setThrustRed(true);
  assert.equal(ctrl.getState().cars.red.thrusting, true);

  ctrl.setThrustBlue(true);
  assert.equal(ctrl.getState().cars.blue.thrusting, false);

  // 切换为 2P 模式：蓝车响应外界调用
  ctrl.setMode('2p');
  ctrl.getState().status = 'playing';
  ctrl.setThrustBlue(true);
  assert.equal(ctrl.getState().cars.blue.thrusting, true);
});

test('game: pause and resume toggle', () => {
  const ctrl = new GameController();
  assert.equal(ctrl.isPaused(), false);

  const p1 = ctrl.togglePause();
  assert.equal(p1, true);
  assert.equal(ctrl.isPaused(), true);

  // 暂停状态下冲刺指令被冻结
  ctrl.getState().status = 'playing';
  ctrl.getState().cars.red.thrusting = false;
  ctrl.setThrustRed(true);
  assert.equal(ctrl.getState().cars.red.thrusting, false);

  ctrl.setPaused(false);
  assert.equal(ctrl.isPaused(), false);
});

test('game: restartMatch and loadLevel', () => {
  const ctrl = new GameController();
  ctrl.getState().scores.red = 3;
  ctrl.loadLevel(4);
  assert.equal(ctrl.getLevel().id, 4);
  assert.equal(ctrl.getState().scores.red, 0);
  assert.equal(ctrl.isPaused(), false);
});
