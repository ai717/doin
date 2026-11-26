/**
 * @file games/tidy/js/engine.mjs
 * 纯几何卡槽吸附与多层收纳状态机，严格 DOM-Free。
 * 驱动物件拖拽拾取、90° 旋转、容差磁吸、多层依赖（Z-Layer Occlusion）与随机游走不变式。
 */

export const SNAP_RADIUS = 50; // 几何中心吸附容差距离 (px)
export const ANGLE_TOLERANCE_DEG = 15; // 角度吸附容差 (度)
export const BOX_OFFSET_X = 49; // 收纳盒内腔相对于画布的 X 偏移量 (boxX: 35 + padding: 14)
export const BOX_OFFSET_Y = 44; // 收纳盒内腔相对于画布的 Y 偏移量 (boxY: 30 + padding: 14)

/**
 * 确定性 Mulberry32 伪随机数发生器
 */
export function createRng(seed = 123456789) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 角度归一化到 [0, 360) 度
 */
export function normalizeAngleDeg(deg) {
  let a = Math.round(deg) % 360;
  if (a < 0) a += 360;
  return a;
}

/**
 * 判定当前旋转角是否与槽位角度在对称性下等价契合
 * @param {number} currentAngle 物品当前朝向 (0, 90, 180, 270)
 * @param {number} targetAngle 槽位预设朝向
 * @param {number} symmetry 对称阶数 (1: 无对称 360°, 2: 180° 对称, 4: 90° 对称正方形/圆形)
 */
export function isAngleMatch(currentAngle, targetAngle, symmetry = 1) {
  const cur = normalizeAngleDeg(currentAngle);
  const tgt = normalizeAngleDeg(targetAngle);

  if (symmetry >= 4) {
    // 正方形或圆形：任意 90° 整数倍均契合
    const diff = Math.abs(cur - tgt) % 90;
    return diff <= ANGLE_TOLERANCE_DEG || diff >= (90 - ANGLE_TOLERANCE_DEG);
  }

  if (symmetry === 2) {
    // 180° 对称长方形或椭圆：0° 与 180° 等价，90° 与 270° 等价
    const diff = Math.abs(cur - tgt) % 180;
    return diff <= ANGLE_TOLERANCE_DEG || diff >= (180 - ANGLE_TOLERANCE_DEG);
  }

  // 1: 严格单向
  const diff = Math.abs(cur - tgt);
  return diff <= ANGLE_TOLERANCE_DEG || diff >= (360 - ANGLE_TOLERANCE_DEG);
}

/**
 * 创建整关初始收纳状态
 */
export function createInitialState(options = {}) {
  const {
    level = { id: 1, key: 'level_1', slots: [], items: [], targetSeconds: 45 },
    seed = Date.now(),
  } = options;

  const rng = createRng(seed);

  // 初始化槽位映射（注入世界坐标，无缝桥接人类拖拽与单测相对坐标）
  const slots = (level.slots || []).map((slot) => ({
    ...slot,
    worldX: slot.x + BOX_OFFSET_X,
    worldY: slot.y + BOX_OFFSET_Y,
    isOccupied: false,
    occupiedItemId: null,
  }));

  // 计算散落托盘初始几何散落坐标 (右侧托盘区域: x: 380~560, y: 80~420)
  const itemsCount = level.items.length;
  const items = (level.items || []).map((item, idx) => {
    // 错落网格 + 微扰动
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const trayBaseX = 400 + col * 90;
    const trayBaseY = 80 + row * 85 + (col === 1 ? 25 : 0);
    const jitterX = (rng() - 0.5) * 16;
    const jitterY = (rng() - 0.5) * 16;
    const trayX = trayBaseX + jitterX;
    const trayY = trayBaseY + jitterY;

    return {
      ...item,
      x: trayX,
      y: trayY,
      trayX,
      trayY,
      rotation: normalizeAngleDeg(item.initialRotation ?? 0),
      isSnapped: false,
      snappedSlotId: null,
      isDragging: false,
    };
  });

  return {
    level,
    slots,
    items,
    heldItemId: null,
    dragOffset: { x: 0, y: 0 },
    status: 'playing', // 'playing' | 'won'
    moves: 0,
    failedAttempts: 0,
    elapsedTime: 0,
    hintSlotId: null,
    hintTimer: 0,
    events: [],
    seed,
  };
}

/**
 * 判定物品是否可被拖拽吸附入特定槽位
 */
export function canSnapToSlot(item, slot, state) {
  // 1. 槽位是否已被其他物品占据
  if (slot.isOccupied && slot.occupiedItemId !== item.id) {
    return { canSnap: false, reason: 'occupied' };
  }

  // 2. 物品型号是否对号入座
  if (slot.itemId !== item.id) {
    return { canSnap: false, reason: 'mismatch' };
  }

  // 3. 几何中心与凹槽包围盒吸附距离检测 (同时兼容画布世界坐标与单测局部相对坐标)
  const slotWorldX = slot.worldX ?? (slot.x + BOX_OFFSET_X);
  const slotWorldY = slot.worldY ?? (slot.y + BOX_OFFSET_Y);

  const distWorld = Math.hypot(item.x - slotWorldX, item.y - slotWorldY);
  const distLocal = Math.hypot(item.x - slot.x, item.y - slot.y);
  const dist = Math.min(distWorld, distLocal);

  // 针对长条形物体的包围盒吸附冗余（只要拖入凹槽范围内即平滑磁吸）
  const isHoriz = (slot.rotation % 180 !== 0);
  const slotW = isHoriz ? slot.height : slot.width;
  const slotH = isHoriz ? slot.width : slot.height;
  const halfW = slotW / 2 + 24;
  const halfH = slotH / 2 + 24;

  const dxWorld = Math.abs(item.x - slotWorldX);
  const dyWorld = Math.abs(item.y - slotWorldY);
  const inBoxWorld = (dxWorld <= halfW && dyWorld <= halfH);

  const dxLocal = Math.abs(item.x - slot.x);
  const dyLocal = Math.abs(item.y - slot.y);
  const inBoxLocal = (dxLocal <= halfW && dyLocal <= halfH);

  if (dist > SNAP_RADIUS && !inBoxWorld && !inBoxLocal) {
    return { canSnap: false, reason: 'distance' };
  }

  // 4. 旋转角度契合度检测
  const matchAngle = isAngleMatch(item.rotation, slot.rotation, item.symmetry || 1);
  if (!matchAngle) {
    return { canSnap: false, reason: 'rotation' };
  }

  // 5. 多层图层先后约束检测 (Z-Layer Occlusion)
  if (slot.requires && slot.requires.length > 0) {
    for (const reqSlotId of slot.requires) {
      const depSlot = state.slots.find((s) => s.id === reqSlotId);
      if (!depSlot || !depSlot.isOccupied) {
        return { canSnap: false, reason: 'layer_blocked', blockedBy: reqSlotId };
      }
    }
  }

  return { canSnap: true, reason: null };
}

/**
 * 拾起物品（可从散落托盘拿起，也可从已收纳的槽位中取出）
 */
export function pickUpItem(state, itemId, clientX, clientY) {
  const s = {
    ...state,
    items: state.items.map((it) => ({ ...it })),
    slots: state.slots.map((sl) => ({ ...sl })),
    events: [],
  };

  const item = s.items.find((it) => it.id === itemId);
  if (!item || s.status === 'won') return s;

  // 如果原本已卡入槽位，取出重排
  if (item.isSnapped && item.snappedSlotId) {
    const slot = s.slots.find((sl) => sl.id === item.snappedSlotId);
    if (slot) {
      // 检查是否有上层物品依赖当前槽位，若有则必须先移开上层物品
      const blockingSlot = s.slots.find(
        (otherSlot) => otherSlot.isOccupied && otherSlot.requires && otherSlot.requires.includes(slot.id)
      );
      if (blockingSlot) {
        s.events.push({ type: 'slot_blocked', itemId, blockingSlotId: blockingSlot.id });
        return s;
      }
      slot.isOccupied = false;
      slot.occupiedItemId = null;
    }
    item.isSnapped = false;
    item.snappedSlotId = null;
    s.events.push({ type: 'pick_out', itemId });
  } else {
    s.events.push({ type: 'pick_up', itemId });
  }

  item.isDragging = true;
  s.heldItemId = itemId;
  s.dragOffset = {
    x: item.x - clientX,
    y: item.y - clientY,
  };

  return s;
}

/**
 * 拖拽移动当前拾起的物品
 */
export function moveItem(state, clientX, clientY) {
  if (!state.heldItemId || state.status === 'won') return state;

  const s = {
    ...state,
    items: state.items.map((it) => ({ ...it })),
    events: [],
  };

  const item = s.items.find((it) => it.id === s.heldItemId);
  if (!item) return s;

  item.x = clientX + s.dragOffset.x;
  item.y = clientY + s.dragOffset.y;

  return s;
}

/**
 * 旋转物品（顺时针/逆时针 90°）
 */
export function rotateItem(state, itemId, dir = 1) {
  const s = {
    ...state,
    items: state.items.map((it) => ({ ...it })),
    events: [],
  };

  const item = s.items.find((it) => it.id === itemId);
  if (!item || s.status === 'won') return s;

  // 若已卡入槽位，先不允许原地旋转（必须拖出）
  if (item.isSnapped) return s;

  item.rotation = normalizeAngleDeg(item.rotation + dir * 90);
  s.events.push({ type: 'rotate', itemId, rotation: item.rotation });
  return s;
}

/**
 * 松开当前物品并进行吸附判定
 */
export function releaseItem(state) {
  if (!state.heldItemId || state.status === 'won') return state;

  const s = {
    ...state,
    items: state.items.map((it) => ({ ...it })),
    slots: state.slots.map((sl) => ({ ...sl })),
    events: [],
  };

  const item = s.items.find((it) => it.id === s.heldItemId);
  if (!item) {
    s.heldItemId = null;
    return s;
  }

  item.isDragging = false;
  s.heldItemId = null;
  s.moves += 1;

  // 寻找目标对应槽位
  const targetSlot = s.slots.find((sl) => sl.itemId === item.id);
  let snapped = false;

  if (targetSlot) {
    const snapResult = canSnapToSlot(item, targetSlot, s);
    if (snapResult.canSnap) {
      // 成功吸附锁定！
      item.isSnapped = true;
      item.snappedSlotId = targetSlot.id;
      item.x = targetSlot.worldX ?? (targetSlot.x + BOX_OFFSET_X);
      item.y = targetSlot.worldY ?? (targetSlot.y + BOX_OFFSET_Y);
      item.rotation = targetSlot.rotation; // 完美对齐
      targetSlot.isOccupied = true;
      targetSlot.occupiedItemId = item.id;
      snapped = true;

      s.events.push({
        type: 'snap_in',
        itemId: item.id,
        slotId: targetSlot.id,
        material: item.material,
      });

      // 检查是否全部物品归位
      const allDone = s.slots.every((sl) => sl.isOccupied);
      if (allDone) {
        s.status = 'won';
        s.events.push({
          type: 'level_clear',
          elapsedTime: s.elapsedTime,
          moves: s.moves,
          failedAttempts: s.failedAttempts,
        });
      }
    } else if (snapResult.reason === 'layer_blocked') {
      s.events.push({ type: 'layer_blocked', itemId: item.id, blockedBy: snapResult.blockedBy });
    }
  }

  // 若吸附失败，平滑弹回托盘
  if (!snapped) {
    item.x = item.trayX;
    item.y = item.trayY;
    item.isSnapped = false;
    item.snappedSlotId = null;
    s.failedAttempts += 1;
    s.events.push({ type: 'snap_reject', itemId: item.id });
  }

  return s;
}

/**
 * 激活透视微光提示 (Hint)
 */
export function useHint(state) {
  if (state.status === 'won') return state;

  const s = {
    ...state,
    events: [],
  };

  // 优先寻找当前拖拽的物品，或者第一个未收纳的物品
  const unsnappedItem = state.heldItemId
    ? state.items.find((it) => it.id === state.heldItemId)
    : state.items.find((it) => !it.isSnapped);

  if (unsnappedItem) {
    const targetSlot = state.slots.find((sl) => sl.itemId === unsnappedItem.id);
    if (targetSlot) {
      s.hintSlotId = targetSlot.id;
      s.hintTimer = 3.5;
      s.events.push({ type: 'hint_activated', slotId: targetSlot.id });
    }
  }

  return s;
}

/**
 * 单帧物理步进推演（纯函数）
 */
export function stepFrame(state, dt) {
  const s = {
    ...state,
    events: [],
  };

  if (s.status === 'playing') {
    s.elapsedTime += dt;
  }

  // 提示倒计时
  if (s.hintTimer > 0) {
    s.hintTimer -= dt;
    if (s.hintTimer <= 0) {
      s.hintTimer = 0;
      s.hintSlotId = null;
    }
  }

  return s;
}

/**
 * 重置当前关卡
 */
export function resetLevel(state) {
  return createInitialState({
    level: state.level,
    seed: Date.now(),
  });
}
