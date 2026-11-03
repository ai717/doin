import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  isAngleMatch,
  canSnapToSlot,
  pickUpItem,
  moveItem,
  rotateItem,
  releaseItem,
  useHint,
  stepFrame,
  createRng,
} from '../js/engine.mjs';
import { getLevelById } from '../js/levels.mjs';

test('engine: isAngleMatch with symmetries 1, 2, 4', () => {
  // 单向对称 (symmetry: 1)
  assert.ok(isAngleMatch(0, 0, 1));
  assert.ok(isAngleMatch(10, 0, 1));
  assert.ok(isAngleMatch(355, 0, 1));
  assert.ok(!isAngleMatch(90, 0, 1));
  assert.ok(!isAngleMatch(180, 0, 1));

  // 180° 对称 (symmetry: 2)
  assert.ok(isAngleMatch(0, 180, 2));
  assert.ok(isAngleMatch(180, 0, 2));
  assert.ok(isAngleMatch(90, 270, 2));
  assert.ok(isAngleMatch(270, 90, 2));
  assert.ok(!isAngleMatch(90, 0, 2));

  // 90° 对称正方形/圆形 (symmetry: 4)
  assert.ok(isAngleMatch(0, 90, 4));
  assert.ok(isAngleMatch(90, 180, 4));
  assert.ok(isAngleMatch(180, 270, 4));
  assert.ok(isAngleMatch(270, 0, 4));
});

test('engine: initial state creation', () => {
  const level1 = getLevelById(1);
  const state = createInitialState({ level: level1 });

  assert.equal(state.status, 'playing');
  assert.equal(state.items.length, 3);
  assert.equal(state.slots.length, 3);
  assert.equal(state.moves, 0);
  assert.equal(state.failedAttempts, 0);
});

test('engine: pick up, rotate, move and snap item to slot', () => {
  const level1 = getLevelById(1);
  let state = createInitialState({ level: level1 });

  const pencil = state.items.find((it) => it.id === 'pencil');
  assert.ok(pencil);

  // 1. 拾起铅笔
  state = pickUpItem(state, 'pencil', pencil.x, pencil.y);
  assert.equal(state.heldItemId, 'pencil');

  // 2. 旋转使其朝向与槽位 (0°) 一致
  while (!isAngleMatch(state.items.find((it) => it.id === 'pencil').rotation, 0, 1)) {
    state = rotateItem(state, 'pencil', 1);
  }

  // 3. 移动到槽位中心 (s1: x=80, y=160)
  const slot1 = state.slots.find((sl) => sl.id === 's1');
  state = moveItem(state, slot1.x, slot1.y);

  // 4. 释放吸附
  state = releaseItem(state);
  const updatedPencil = state.items.find((it) => it.id === 'pencil');
  assert.ok(updatedPencil.isSnapped);
  assert.equal(updatedPencil.snappedSlotId, 's1');
  assert.equal(state.moves, 1);
  assert.equal(state.failedAttempts, 0);
});

test('engine: snap rejection on wrong angle bounces back', () => {
  const level1 = getLevelById(1);
  let state = createInitialState({ level: level1 });

  const pencil = state.items.find((it) => it.id === 'pencil');
  state = pickUpItem(state, 'pencil', pencil.x, pencil.y);

  // 故意调整为错误角度 180°
  const curPencil = state.items.find((it) => it.id === 'pencil');
  curPencil.rotation = 180;

  // 移到槽位
  const slot1 = state.slots.find((sl) => sl.id === 's1');
  state = moveItem(state, slot1.x, slot1.y);

  // 释放
  state = releaseItem(state);
  const rejectedPencil = state.items.find((it) => it.id === 'pencil');
  assert.ok(!rejectedPencil.isSnapped);
  assert.equal(state.failedAttempts, 1);
});

test('engine: layer occlusion in Act 3 (must place bottom item first)', () => {
  const level11 = getLevelById(11); // 行李箱：大衣(底)，相机(顶)，护照(顶)
  let state = createInitialState({ level: level11 });

  // 试图在没有放置大衣 (s1) 的情况下，直接放入顶层相机 (s2)
  const camera = state.items.find((it) => it.id === 'vintage_camera');
  state = pickUpItem(state, 'vintage_camera', camera.x, camera.y);

  const slot2 = state.slots.find((sl) => sl.id === 's2');
  while (!isAngleMatch(state.items.find((it) => it.id === 'vintage_camera').rotation, slot2.rotation, 1)) {
    state = rotateItem(state, 'vintage_camera', 1);
  }

  state = moveItem(state, slot2.x, slot2.y);
  state = releaseItem(state);

  const cameraAfter = state.items.find((it) => it.id === 'vintage_camera');
  assert.ok(!cameraAfter.isSnapped, 'Camera should not snap while coat is missing');
  assert.ok(state.events.some((ev) => ev.type === 'layer_blocked'));
});

test('engine: >= 1000 steps random walk invariant test', () => {
  const level1 = getLevelById(1);
  let state = createInitialState({ level: level1, seed: 9999 });
  const rng = createRng(9999);

  for (let step = 0; step < 1000; step++) {
    const action = Math.floor(rng() * 6);

    if (action === 0) {
      // 随机拾起某物品
      const it = state.items[Math.floor(rng() * state.items.length)];
      state = pickUpItem(state, it.id, it.x, it.y);
    } else if (action === 1) {
      // 随机移动
      state = moveItem(state, rng() * 800, rng() * 500);
    } else if (action === 2) {
      // 随机旋转
      if (state.heldItemId) {
        state = rotateItem(state, state.heldItemId, rng() > 0.5 ? 1 : -1);
      }
    } else if (action === 3) {
      // 释放
      state = releaseItem(state);
    } else if (action === 4) {
      // 提示
      state = useHint(state);
    } else {
      // 物理步进
      state = stepFrame(state, 0.05);
    }

    // 断言不变量守恒
    assert.ok(state.items.length === 3, 'Items invariant preserved');
    assert.ok(state.slots.length === 3, 'Slots invariant preserved');
    assert.ok(typeof state.elapsedTime === 'number' && !isNaN(state.elapsedTime));
  }
});
