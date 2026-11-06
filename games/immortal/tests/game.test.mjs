import test from 'node:test';
import assert from 'node:assert/strict';
import { GameController } from '../js/game.mjs';

test('game: controller lifecycle, open cauldron, equip and smelt', () => {
  const ctrl = new GameController();
  ctrl.init();

  const s1 = ctrl.getState();
  assert.ok(s1.data.cauldronStones > 0);
  assert.equal(s1.currentDrop, null);

  // Open Cauldron
  const resOpen = ctrl.openCauldron();
  assert.equal(resOpen.success, true);
  assert.ok(ctrl.currentDrop);
  assert.ok(ctrl.currentDrop.uid);

  // Equip Drop
  const slot = ctrl.currentDrop.slot;
  const resEquip = ctrl.equipCurrentDrop();
  assert.equal(resEquip.success, true);
  assert.equal(ctrl.currentDrop, null);
  assert.ok(ctrl.data.equipment[slot]);

  // Open another and Smelt
  ctrl.openCauldron();
  assert.ok(ctrl.currentDrop);
  const oldStones = ctrl.data.spiritStones;
  const resSmelt = ctrl.smeltCurrentDrop();
  assert.equal(resSmelt.success, true);
  assert.ok(ctrl.data.spiritStones > oldStones);
  assert.equal(ctrl.currentDrop, null);
});

test('game: upgrade cauldron consumes spirit stones', () => {
  const ctrl = new GameController();
  ctrl.init();

  ctrl.data.spiritStones = 50000;
  const oldLvl = ctrl.data.cauldronLevel;

  const res = ctrl.upgradeCauldron();
  assert.equal(res.success, true);
  assert.equal(ctrl.data.cauldronLevel, oldLvl + 1);
});
