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

test('game: mode toggle and pull restrictions', () => {
  const ctrl = new GameController();
  ctrl.getState().status = 'pulling';

  // 1P 模式：红方可拉，蓝方拒绝 (由 AI 驱动)
  const redRes = ctrl.pullRed();
  assert.ok(redRes);
  const blueRes1p = ctrl.pullBlue();
  assert.equal(blueRes1p, null);

  // 切换为 2P 模式：蓝方可拉
  ctrl.setMode('2p');
  ctrl.getState().status = 'pulling';
  const blueRes2p = ctrl.pullBlue();
  assert.ok(blueRes2p);
});

test('game: pause and resume toggle', () => {
  const ctrl = new GameController();
  assert.equal(ctrl.isPaused(), false);

  const p1 = ctrl.togglePause();
  assert.equal(p1, true);
  assert.equal(ctrl.isPaused(), true);

  // 暂停状态下拉力被忽略
  ctrl.getState().status = 'pulling';
  const action = ctrl.pullRed();
  assert.equal(action, null);

  ctrl.setPaused(false);
  assert.equal(ctrl.isPaused(), false);
});

test('game: restartMatch and loadLevel', () => {
  const ctrl = new GameController();
  ctrl.getState().scores.red = 1;
  ctrl.loadLevel(3);
  assert.equal(ctrl.getLevel().id, 3);
  assert.equal(ctrl.getState().scores.red, 0);
  assert.equal(ctrl.isPaused(), false);
});
