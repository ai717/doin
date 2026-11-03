import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, getLevelById } from '../js/levels.mjs';
import {
  createInitialState,
  pickUpItem,
  rotateItem,
  moveItem,
  releaseItem,
  isAngleMatch,
} from '../js/engine.mjs';

test('levels: metadata integrity for all 24 levels', () => {
  assert.equal(LEVELS.length, 24);

  const seenIds = new Set();
  LEVELS.forEach((level, idx) => {
    assert.equal(level.id, idx + 1);
    assert.ok(level.act >= 1 && level.act <= 5);
    assert.ok(level.slots.length >= 3 && level.slots.length <= 10);
    assert.ok(level.items.length === level.slots.length);
    assert.ok(level.targetSeconds >= 30 && level.targetSeconds <= 90);
    assert.ok(typeof level.key === 'string' && level.key.length > 0);
    assert.ok(!seenIds.has(level.id));
    seenIds.add(level.id);

    // 检查槽位与物品的 1:1 双向映射
    const itemIds = new Set(level.items.map((it) => it.id));
    const slotItemIds = new Set(level.slots.map((sl) => sl.itemId));
    assert.equal(itemIds.size, level.items.length);
    assert.equal(slotItemIds.size, level.slots.length);
    for (const id of itemIds) {
      assert.ok(slotItemIds.has(id), `Level ${level.id} slot missing for item ${id}`);
    }
  });
});

test('levels: getLevelById fallback', () => {
  const l1 = getLevelById(1);
  assert.equal(l1.id, 1);
  const fallback = getLevelById(999);
  assert.equal(fallback.id, 1);
});

test('levels: mathematical solvability of all 24 levels', () => {
  for (const level of LEVELS) {
    let state = createInitialState({ level, seed: 1000 + level.id });

    // 模拟熟练玩家按层级拓扑顺序 (底层 -> 顶层) 依次收纳每一个物品
    const sortedSlots = [...level.slots].sort((a, b) => (a.layer || 0) - (b.layer || 0));

    for (const slot of sortedSlots) {
      const item = state.items.find((it) => it.id === slot.itemId);
      assert.ok(item, `Item ${slot.itemId} must exist in level ${level.id}`);

      // 拾起
      state = pickUpItem(state, item.id, item.x, item.y);

      // 旋转对齐
      let safetyRot = 0;
      while (!isAngleMatch(state.items.find((it) => it.id === item.id).rotation, slot.rotation, item.symmetry || 1)) {
        state = rotateItem(state, item.id, 1);
        safetyRot++;
        if (safetyRot > 8) break;
      }

      // 移至槽位并释放
      state = moveItem(state, slot.x, slot.y);
      state = releaseItem(state);

      const placedItem = state.items.find((it) => it.id === item.id);
      assert.ok(placedItem.isSnapped, `Level ${level.id}: Item ${item.id} failed to snap into slot ${slot.id}`);
    }

    assert.equal(state.status, 'won', `Level ${level.id} (${level.key}) should be won after placing all items`);
  }
});
