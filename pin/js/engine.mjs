/**
 * @file games/pin/js/engine.mjs
 * 纯数学旋转动力学与角间距碰撞状态机，严格 DOM-Free。
 * 驱动角速度曲线积分、极速连射弹道、角间距碰撞判定、连击状态机与随机游走不变式。
 */

export const WHEEL_CX = 240;
export const WHEEL_CY = 220;
export const WHEEL_RADIUS = 75;
export const PIN_STEM_LENGTH = 65;
export const PIN_HEAD_RADIUS = 8;
export const PIN_LAUNCH_Y = 490;
export const PIN_FLIGHT_SPEED = 2600; // px/s (极速弹射飞入，约 0.075s)
export const LAUNCH_BUFFER_TIME = 0.07; // 70ms 输入缓冲窗口

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
 * 角度归一化到 [0, 2*PI)
 */
export function normalizeAngle(rad) {
  let a = rad % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  return a;
}

/**
 * 计算两个角度之间的最小圆周绝对夹角 [0, PI]
 */
export function angleDiff(a, b) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > Math.PI ? Math.PI * 2 - diff : diff;
}

/**
 * 角度转弧度
 */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * 弧度转角度
 */
export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * 计算当前时钟周期的瞬时旋转角速度 omega(t) (rad/s)
 */
export function calculateAngularVelocity(level, elapsedTime) {
  const type = level.rotationType || 'constant';
  const base = level.baseSpeed || 1.5;
  const t = elapsedTime;

  if (type === 'pendulum') {
    // 逆向平滑摆钟曲线: base * cos(freq * t)
    const freq = level.speedFreq || 1.0;
    return base * Math.cos(freq * t);
  }

  if (type === 'pulse') {
    // 脉冲式周期呼吸变速
    const amp = level.speedAmp || 1.4;
    const freq = level.speedFreq || 1.2;
    return base + amp * Math.sin(freq * t);
  }

  if (type === 'stutter') {
    // 假动作急停顿挫
    const interval = level.stutterInterval || 2.5;
    const cycle = t % interval;
    if (cycle < 0.35) {
      return base * 0.15; // 骤停
    }
    return base * 1.25; // 暴冲
  }

  if (type === 'celestial') {
    // 非对称复合天文曲线
    const amp = level.speedAmp || 1.8;
    const freq = level.speedFreq || 1.3;
    return base * Math.sin(freq * t) + amp * Math.cos(freq * 1.6 * t);
  }

  // 默认匀速自转
  return base;
}

/**
 * 创建整关初始状态
 */
export function createInitialState(options = {}) {
  const {
    mode = 'level', // 'level' | 'endless'
    level = {
      id: 1,
      key: 'level_1',
      initialPins: [0, Math.PI],
      pendingCount: 6,
      rotationType: 'constant',
      baseSpeed: 1.3,
      safeAngleDeg: 10.0,
      targetSeconds: 25,
    },
    seed = Date.now(),
  } = options;

  // 圆盘初始自带针
  const wheelPins = (level.initialPins || []).map((ang, idx) => ({
    id: `init_${idx}`,
    angle: normalizeAngle(ang),
    color: '#4a90e2',
  }));

  const pendingCount = mode === 'endless' ? 12 : (level.pendingCount || 8);

  return {
    mode,
    level,
    status: 'playing', // 'playing' | 'won' | 'failed'
    wheelAngle: 0, // 当前齿轮绝对旋转角 (rad)
    currentSpeed: level.baseSpeed || 1.5,
    wheelPins,
    pendingCount,
    totalLaunched: 0,
    flyingPins: [], // 正在向上飞行的针
    combo: 0,
    maxCombo: 0,
    elapsedTime: 0,
    endlessScore: 0,
    lastLaunchTime: -999,
    bufferLaunchTimer: 0,
    collisionInfo: null, // { angle, pinA, pinB }
    events: [],
    seed,
  };
}

/**
 * 发射一枚针头
 */
export function launchPin(state) {
  if (state.status !== 'playing') return state;
  if (state.pendingCount <= 0) return state;

  const s = {
    ...state,
    flyingPins: [...state.flyingPins],
    events: [],
  };

  const nextIndex = s.totalLaunched + 1;
  s.pendingCount -= 1;
  s.totalLaunched += 1;
  s.lastLaunchTime = s.elapsedTime;

  // 产生飞向圆盘下沿 (Y = WHEEL_CY + WHEEL_RADIUS) 的弹道针
  s.flyingPins.push({
    id: `pin_${nextIndex}`,
    label: nextIndex.toString(),
    x: WHEEL_CX,
    y: PIN_LAUNCH_Y,
    targetY: WHEEL_CY + WHEEL_RADIUS,
  });

  s.events.push({ type: 'pin_launch', index: nextIndex });
  return s;
}

/**
 * 单帧物理步进推演（纯函数）
 * @param {Object} state
 * @param {number} dt 微分步长 (s)
 */
export function stepFrame(state, dt) {
  const s = {
    ...state,
    wheelPins: [...state.wheelPins],
    flyingPins: state.flyingPins.map((p) => ({ ...p })),
    events: [],
  };

  if (s.status !== 'playing') {
    return s;
  }

  s.elapsedTime += dt;

  // 1. 计算角速度并推进齿轮自转
  s.currentSpeed = calculateAngularVelocity(s.level, s.elapsedTime);
  s.wheelAngle = normalizeAngle(s.wheelAngle + s.currentSpeed * dt);

  // 2. 推进所有在途飞行的针头
  const safeAngleRad = degToRad(s.level.safeAngleDeg || 9.5);
  const remainingFlying = [];

  for (const pin of s.flyingPins) {
    pin.y -= PIN_FLIGHT_SPEED * dt;

    if (pin.y <= pin.targetY) {
      // 针头扎入圆盘！
      // 在世界坐标系中，击发点在齿轮正下方（角度为 PI / 2）
      // 转换至齿轮自身的旋转参考系：alpha = PI/2 - wheelAngle
      const insertedAngle = normalizeAngle(Math.PI / 2 - s.wheelAngle);

      // 碰撞检测：遍历圆盘上所有已扎入的针
      let hasCollision = false;
      let minGap = 999;
      let collidedPin = null;

      for (const existing of s.wheelPins) {
        const gap = angleDiff(insertedAngle, existing.angle);
        if (gap < minGap) minGap = gap;

        if (gap < safeAngleRad) {
          hasCollision = true;
          collidedPin = existing;
          break;
        }
      }

      if (hasCollision) {
        // 碰撞失败！
        s.status = 'failed';
        s.collisionInfo = {
          angle: insertedAngle,
          pinId: pin.id,
          collidedPinId: collidedPin ? collidedPin.id : null,
          gap: minGap,
        };
        s.events.push({
          type: 'pin_collision',
          angle: insertedAngle,
          collidedWith: collidedPin ? collidedPin.id : null,
        });
        return s;
      }

      // 成功安全扎入！
      s.combo += 1;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      if (s.mode === 'endless') {
        s.endlessScore += 10 + s.combo * 2;
      }

      s.wheelPins.push({
        id: pin.id,
        angle: insertedAngle,
        label: pin.label,
        color: '#ffd54f',
      });

      s.events.push({
        type: 'pin_hit',
        pinId: pin.id,
        combo: s.combo,
        angle: insertedAngle,
      });

      // 无尽模式消解机制：当圆盘超过 18 根针时，自动消解最早的 6 根针并触发连环爆发
      if (s.mode === 'endless' && s.wheelPins.length > 18) {
        s.wheelPins.splice(0, 6);
        s.endlessScore += 50;
        s.events.push({ type: 'endless_dissolve' });
      }

      // 检查本关胜利：待射弹夹清空且所有飞行针已全部安全就位
      if (s.mode === 'level' && s.pendingCount === 0 && remainingFlying.length === 0) {
        s.status = 'won';
        s.events.push({
          type: 'level_won',
          elapsedTime: s.elapsedTime,
          maxCombo: s.maxCombo,
          totalPins: s.wheelPins.length,
        });
      }
    } else {
      remainingFlying.push(pin);
    }
  }

  s.flyingPins = remainingFlying;
  return s;
}

/**
 * 快速重开当前关卡（0 延迟瞬时复位）
 */
export function resetLevel(state) {
  return createInitialState({
    mode: state.mode,
    level: state.level,
    seed: Date.now(),
  });
}
