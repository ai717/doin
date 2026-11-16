/**
 * @file games/sleepwalker/js/engine.mjs
 * 纯数学与物理时序状态机，严格 DOM-free、Storage-free。
 */

export const STAGE_WIDTH = 840;
export const STAGE_HEIGHT = 540;
export const DEFAULT_SPEED = 60; // 正常漫步 60 px/s
export const FAST_SPEED = 90; // 1.5x 加速 90 px/s
export const GRAVITY = 800; // 重力加速度 px/s^2
export const MAX_SAFE_FALL = 140; // 安全下落落差阈值 (px)
export const FATAL_FALL = 190; // 致死/惊醒下落高度 (px)
export const TICK_RATE = 60; // 固定物理时序 60 Hz
export const DT = 1 / TICK_RATE;
export const SNAPSHOT_INTERVAL = 3; // 每 3 tick 保存一次快照 (20 snapshots/sec)
export const MAX_HISTORY_SNAPSHOTS = 100; // 5 秒 = 100 个快照

/**
 * 深拷贝辅助
 */
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 创建关卡初始状态
 * @param {object} levelData
 */
export function createInitialState(levelData) {
  const spawn = levelData.spawn || { x: 50, y: 300, facing: 1 };
  const bed = levelData.bed || { x: 780, y: 300, w: 60, h: 40 };

  const gadgets = {};
  if (Array.isArray(levelData.gadgets)) {
    for (const g of levelData.gadgets) {
      gadgets[g.id] = {
        id: g.id,
        type: g.type, // 'toggle' | 'timed' | 'single' | 'spring' | 'fan' | 'distract'
        active: Boolean(g.initialActive),
        initialActive: Boolean(g.initialActive),
        timer: 0,
        duration: g.duration || 4.0,
        x: g.x,
        y: g.y,
        w: g.w,
        h: g.h,
        props: g.props ? clone(g.props) : {},
        triggered: false,
      };
    }
  }

  const bubbles = (levelData.bubbles || []).map((b, idx) => ({
    id: b.id !== undefined ? b.id : idx + 1,
    x: b.x,
    y: b.y,
    r: b.r || 14,
    collected: false,
  }));

  const platforms = (levelData.platforms || []).map((p, idx) => ({
    id: p.id || `plat_${idx}`,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h || 14,
    type: p.type || 'solid', // 'solid', 'wall', 'ramp', 'cushion'
    isHazard: Boolean(p.isHazard),
    hazardType: p.hazardType || null,
  }));

  const state = {
    levelId: levelData.id,
    levelKey: levelData.key,
    tick: 0,
    time: 0,
    fastForward: false,
    accumulator: 0,
    walker: {
      x: spawn.x,
      y: spawn.y,
      vx: (spawn.facing || 1) * DEFAULT_SPEED,
      vy: 0,
      state: 'walk', // 'walk' | 'fall' | 'turn' | 'bounce' | 'float' | 'panic' | 'sleep'
      facing: spawn.facing || 1,
      turnTimer: 0,
      fallStartY: spawn.y,
      onGround: true,
      currentPlatId: null,
      bobPhase: 0,
      floatTimer: 0,
    },
    bed: clone(bed),
    platforms,
    gadgets,
    bubbles,
    hazards: clone(levelData.hazards || []),
    status: 'playing', // 'playing' | 'won' | 'lost'
    history: [],
    scareCount: 0,
    heartRate: 60,
    clicksCount: 0,
    events: [],
  };

  // 记录初始快照
  state.history.push(createSnapshot(state));
  return state;
}

/**
 * 提取精简状态用于历史倒带
 */
function createSnapshot(state) {
  const gadgetStates = {};
  for (const id in state.gadgets) {
    const g = state.gadgets[id];
    gadgetStates[id] = {
      active: g.active,
      timer: g.timer,
      triggered: g.triggered,
      props: clone(g.props),
    };
  }

  return {
    tick: state.tick,
    time: state.time,
    walker: clone(state.walker),
    gadgets: gadgetStates,
    bubbles: state.bubbles.map((b) => b.collected),
    status: state.status,
    scareCount: state.scareCount,
    clicksCount: state.clicksCount,
  };
}

/**
 * 点击场景机关
 * @param {object} state
 * @param {string} gadgetId
 */
export function clickGadget(state, gadgetId) {
  if (state.status !== 'playing') {
    return false;
  }

  const g = state.gadgets[gadgetId];
  if (!g) return false;

  let triggered = false;

  switch (g.type) {
    case 'single':
      if (!g.triggered) {
        g.triggered = true;
        g.active = true;
        triggered = true;
      }
      break;
    case 'timed':
      g.active = true;
      g.timer = g.duration;
      g.triggered = true;
      triggered = true;
      break;
    case 'toggle':
      g.active = !g.active;
      g.triggered = true;
      triggered = true;
      break;
    case 'spring':
      g.active = true;
      g.timer = g.duration || 3.0;
      g.triggered = true;
      triggered = true;
      break;
    case 'fan':
      g.active = !g.active;
      g.triggered = true;
      triggered = true;
      break;
    case 'distract':
      g.active = true;
      g.timer = g.duration || 6.0;
      g.triggered = true;
      triggered = true;
      break;
    default:
      g.active = !g.active;
      triggered = true;
  }

  if (triggered) {
    state.clicksCount++;
    state.events.push({
      type: 'gadget_click',
      gadgetId,
      gadgetType: g.type,
      active: g.active,
      x: g.x,
      y: g.y,
    });
    return true;
  }
  return false;
}

/**
 * 5 秒倒带功能
 * @param {object} state
 * @param {number} seconds
 */
export function rewind(state, seconds = 5) {
  if (!state.history || state.history.length <= 1) {
    return false;
  }

  const stepsToRewind = Math.floor(seconds * (TICK_RATE / SNAPSHOT_INTERVAL));
  const targetIndex = Math.max(0, state.history.length - 1 - stepsToRewind);
  const snapshot = state.history[targetIndex];

  if (!snapshot) return false;

  // 截断快照历史
  state.history.length = targetIndex + 1;

  // 恢复状态
  state.tick = snapshot.tick;
  state.time = snapshot.time;
  state.walker = clone(snapshot.walker);
  state.status = 'playing'; // 倒带必定恢复可游玩
  state.scareCount = snapshot.scareCount;
  state.clicksCount = snapshot.clicksCount;

  for (const id in snapshot.gadgets) {
    if (state.gadgets[id]) {
      const snapG = snapshot.gadgets[id];
      state.gadgets[id].active = snapG.active;
      state.gadgets[id].timer = snapG.timer;
      state.gadgets[id].triggered = snapG.triggered;
      state.gadgets[id].props = clone(snapG.props);
    }
  }

  for (let i = 0; i < state.bubbles.length; i++) {
    if (snapshot.bubbles[i] !== undefined) {
      state.bubbles[i].collected = snapshot.bubbles[i];
    }
  }

  state.events.push({ type: 'rewind', time: state.time });
  return true;
}

/**
 * 设置快进状态
 * @param {object} state
 * @param {boolean} fast
 */
export function setFastForward(state, fast) {
  state.fastForward = Boolean(fast);
}

/**
 * 获取场景当前全部有效碰撞表面（静态平台 + 处于开启/搭设状态的机关平台）
 * @param {object} state
 */
export function getActivePlatforms(state) {
  const result = [];

  for (const p of state.platforms) {
    result.push(p);
  }

  // 遍历机关，看是否生成或撤除动态平台
  for (const id in state.gadgets) {
    const g = state.gadgets[id];
    if (g.props && g.props.platform) {
      const platDef = g.props.platform;
      // 检查何时生成平台：通常为 g.active 时
      const shouldExist = platDef.inverted ? !g.active : g.active;
      if (shouldExist) {
        result.push({
          id: `gadget_plat_${g.id}`,
          x: platDef.x !== undefined ? platDef.x : g.x,
          y: platDef.y !== undefined ? platDef.y : g.y,
          w: platDef.w !== undefined ? platDef.w : g.w,
          h: platDef.h !== undefined ? platDef.h : 14,
          type: platDef.type || 'solid',
          isCushion: Boolean(platDef.isCushion),
        });
      }
    }
  }

  return result;
}

/**
 * 查询梦游先生脚下是否有支撑平台
 */
function findPlatformUnderfoot(x, y, platforms, tolerance = 6) {
  for (const p of platforms) {
    if (p.type === 'wall') continue;
    // 梦游先生脚底 x 坐标在平台横向范围内 [p.x - 4, p.x + p.w + 4]
    if (x >= p.x - 4 && x <= p.x + p.w + 4) {
      // y 恰好在平台顶面附近
      if (Math.abs(y - p.y) <= tolerance) {
        return p;
      }
    }
  }
  return null;
}

/**
 * 推进固定单步 (1/60 秒)
 * @param {object} state
 * @param {number} dt
 */
function singleTick(state, dt) {
  state.tick++;
  state.time += dt;

  // 1. 更新机关计时器
  for (const id in state.gadgets) {
    const g = state.gadgets[id];
    if (g.timer > 0) {
      g.timer -= dt;
      if (g.timer <= 0) {
        g.timer = 0;
        if (g.type === 'timed' || g.type === 'spring' || g.type === 'distract') {
          g.active = false;
          state.events.push({
            type: 'gadget_reset',
            gadgetId: g.id,
            gadgetType: g.type,
          });
        }
      }
    }
  }

  const walker = state.walker;

  // 如果已结束，仅更新打呼噜或惊吓动效
  if (state.status === 'won') {
    walker.state = 'sleep';
    walker.vx = 0;
    walker.vy = 0;
    state.heartRate = 55;
    return;
  }
  if (state.status === 'lost') {
    walker.vx = 0;
    state.heartRate = 180;
    return;
  }

  const platforms = getActivePlatforms(state);
  const currentSpeed = (state.fastForward ? FAST_SPEED : DEFAULT_SPEED);

  // 2. 状态机推进
  if (walker.state === 'turn') {
    walker.turnTimer -= dt;
    walker.vx = 0;
    if (walker.turnTimer <= 0) {
      walker.facing = -walker.facing;
      walker.state = 'walk';
      walker.vx = walker.facing * currentSpeed;
      state.events.push({ type: 'turn_finish', facing: walker.facing });
    }
  } else if (walker.state === 'walk') {
    walker.vx = walker.facing * currentSpeed;
    walker.bobPhase = (walker.bobPhase + dt * 6) % (Math.PI * 2);

    // 检查前方是否有坚硬垂直阻碍墙（遇到墙停顿 0.35s 掉头）
    const frontX = walker.x + walker.facing * 12;
    let hitWall = false;

    for (const p of platforms) {
      if (p.type === 'wall' || p.isBlocker) {
        if (
          frontX >= p.x &&
          frontX <= p.x + p.w &&
          walker.y >= p.y &&
          walker.y - 32 <= p.y + p.h
        ) {
          hitWall = true;
          break;
        }
      }
    }

    // 检查是否有闭合的门或闸门（由机关控制的 blocker）
    for (const id in state.gadgets) {
      const g = state.gadgets[id];
      if (g.props && g.props.gate) {
        const isOpen = g.props.gate.inverted ? g.active : !g.active;
        if (!isOpen) {
          const gx = g.props.gate.x !== undefined ? g.props.gate.x : g.x;
          const gy = g.props.gate.y !== undefined ? g.props.gate.y : g.y;
          const gw = g.props.gate.w !== undefined ? g.props.gate.w : 16;
          const gh = g.props.gate.h !== undefined ? g.props.gate.h : 60;
          if (
            frontX >= gx &&
            frontX <= gx + gw &&
            walker.y >= gy &&
            walker.y - 32 <= gy + gh
          ) {
            hitWall = true;
            break;
          }
        }
      }
    }

    if (hitWall) {
      walker.state = 'turn';
      walker.turnTimer = 0.35;
      walker.vx = 0;
      state.events.push({ type: 'turn_start', x: walker.x, y: walker.y });
    } else {
      // 正常水平漫步
      walker.x += walker.vx * dt;

      // 检查当前脚下是否悬空（踩空即下坠）
      const ground = findPlatformUnderfoot(walker.x, walker.y, platforms, 6);
      if (!ground) {
        walker.state = 'fall';
        walker.onGround = false;
        walker.fallStartY = walker.y;
        walker.vy = 0;
        state.events.push({ type: 'fall_start', x: walker.x, y: walker.y });
      } else {
        walker.y = ground.y; // 保持紧贴表面
        walker.currentPlatId = ground.id;
      }
    }
  } else if (walker.state === 'fall' || walker.state === 'bounce' || walker.state === 'float') {
    // 检查排气扇/反重力光束（向上气流）
    let inWind = false;
    for (const id in state.gadgets) {
      const g = state.gadgets[id];
      if ((g.type === 'fan' || g.props?.isWind) && g.active) {
        const windX = g.props?.windX !== undefined ? g.props.windX : g.x - 10;
        const windY = g.props?.windY !== undefined ? g.props.windY : g.y - 140;
        const windW = g.props?.windW !== undefined ? g.props.windW : g.w + 20;
        const windH = g.props?.windH !== undefined ? g.props.windH : 150;

        if (
          walker.x >= windX &&
          walker.x <= windX + windW &&
          walker.y >= windY &&
          walker.y <= windY + windH
        ) {
          inWind = true;
          walker.state = 'float';
          walker.vy = Math.max(walker.vy - 1600 * dt, -200);
          state.events.push({ type: 'wind_lift', id: g.id });
          break;
        }
      }
    }

    if (inWind) {
      // 气流托举浮空漫步
      walker.x += walker.facing * currentSpeed * dt;
      walker.y += walker.vy * dt;
      walker.fallStartY = walker.y;
    } else {
      // 正常重力加速度
      walker.vy += GRAVITY * dt;
      // 下落时带微小水平惯性
      walker.x += walker.vx * 0.7 * dt;
      walker.y += walker.vy * dt;
    }

    // 检查弹簧鞋/遮阳蓬反弹跳板 (bounce)
    for (const id in state.gadgets) {
      const g = state.gadgets[id];
      if ((g.type === 'spring' || g.props?.isBouncy) && g.active) {
        const bx = g.x;
        const by = g.y;
        const bw = g.w;
        const bh = g.h;

        if (
          walker.x >= bx - 8 &&
          walker.x <= bx + bw + 8 &&
          walker.y >= by - 6 &&
          walker.y <= by + bh + 10 &&
          walker.vy > 0
        ) {
          walker.state = 'bounce';
          walker.vy = g.props?.bounceVy || -480;
          walker.vx = (g.props?.bounceVx !== undefined ? g.props.bounceVx : walker.facing * 75);
          walker.fallStartY = walker.y;
          state.events.push({ type: 'bounce', gadgetId: g.id });
          break;
        }
      }
    }

    // 检查下落着陆 (向下落时撞击平台顶面)
    if (walker.vy > 0) {
      for (const p of platforms) {
        if (p.type === 'wall') continue;
        if (walker.x >= p.x - 4 && walker.x <= p.x + p.w + 4) {
          // 垂直穿越顶面判定
          if (walker.y >= p.y && walker.y - walker.vy * dt <= p.y + 12) {
            const fallDist = walker.y - walker.fallStartY;

            // 如果高度超过致死阈值且非缓冲垫
            if (fallDist > FATAL_FALL && !p.isCushion) {
              walker.y = p.y;
              walker.state = 'panic';
              state.status = 'lost';
              state.scareCount++;
              state.events.push({ type: 'scare', reason: 'fatal_fall', dist: fallDist });
              return;
            }

            // 安全着陆软着陆
            walker.y = p.y;
            walker.vy = 0;
            walker.onGround = true;
            walker.state = 'walk';
            walker.fallStartY = walker.y;
            walker.vx = walker.facing * currentSpeed;
            state.events.push({ type: 'land', safe: true, dist: fallDist });
            break;
          }
        }
      }
    }
  }

  // 3. 检查危险物体 (如恶犬、滚筒、排气蒸汽)
  for (const h of state.hazards) {
    let hazardActive = true;
    // 恶犬被骨头引开，或蒸汽被阀门关闭
    if (h.linkedGadgetId) {
      const linkedG = state.gadgets[h.linkedGadgetId];
      if (linkedG && linkedG.active) {
        hazardActive = false; // 机关激活导致危险消除！
      }
    }

    if (hazardActive) {
      const hx = h.x;
      const hy = h.y;
      const hw = h.w || 30;
      const hh = h.h || 30;

      if (
        walker.x >= hx - 10 &&
        walker.x <= hx + hw + 10 &&
        walker.y >= hy &&
        walker.y - 32 <= hy + hh
      ) {
        walker.state = 'panic';
        state.status = 'lost';
        state.scareCount++;
        state.events.push({ type: 'scare', reason: h.type || 'hazard' });
        return;
      }
    }
  }

  // 4. 检查坠入深渊
  if (walker.y > STAGE_HEIGHT + 30 || walker.x < -40 || walker.x > STAGE_WIDTH + 40) {
    walker.state = 'panic';
    state.status = 'lost';
    state.scareCount++;
    state.events.push({ type: 'scare', reason: 'abyss' });
    return;
  }

  // 5. 检查金泡泡收集
  for (const b of state.bubbles) {
    if (!b.collected) {
      const dx = walker.x - b.x;
      const dy = (walker.y - 18) - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= b.r + 14) {
        b.collected = true;
        state.events.push({ type: 'bubble', id: b.id });
      }
    }
  }

  // 6. 检查抵达终点软床
  const bed = state.bed;
  if (
    walker.x >= bed.x - 12 &&
    walker.x <= bed.x + bed.w + 12 &&
    walker.y >= bed.y - 6 &&
    walker.y <= bed.y + bed.h + 10 &&
    state.status === 'playing'
  ) {
    walker.state = 'sleep';
    walker.x = bed.x + bed.w / 2;
    walker.y = bed.y + bed.h;
    walker.vx = 0;
    walker.vy = 0;
    state.status = 'won';
    state.events.push({ type: 'win', time: state.time });
    return;
  }

  // 7. 更新心率模拟
  if (walker.state === 'fall') {
    state.heartRate = Math.min(140, state.heartRate + 15 * dt);
  } else if (walker.state === 'bounce') {
    state.heartRate = 110;
  } else {
    state.heartRate = Math.max(60, state.heartRate - 10 * dt);
  }

  // 8. 周期性记录快照 (每 SNAPSHOT_INTERVAL tick)
  if (state.tick % SNAPSHOT_INTERVAL === 0) {
    state.history.push(createSnapshot(state));
    if (state.history.length > MAX_HISTORY_SNAPSHOTS) {
      state.history.shift();
    }
  }
}

/**
 * 推进外层帧（纯函数，处理时间片切分，保证确定性）
 * @param {object} state
 * @param {number} rawDt
 */
export function stepFrame(state, rawDt) {
  state.events = []; // 清空上一帧瞬态事件

  // 限幅 dt 防止系统休眠后爆大步
  const dt = Math.min(rawDt, 0.1);
  state.accumulator = (state.accumulator || 0) + dt;

  while (state.accumulator >= DT) {
    singleTick(state, DT);
    state.accumulator -= DT;
  }
}
