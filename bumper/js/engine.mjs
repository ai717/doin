/**
 * @file games/bumper/js/engine.mjs
 * 纯数学刚体物理状态机，严格 DOM-Free。
 * 驱动单键自旋与直线冲刺、刚体弹性碰撞冲量、绝境缩圈与 23 关确定性 AI。
 */

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 480;
export const ARENA_CX = 400;
export const ARENA_CY = 240;
export const BASE_ARENA_RADIUS = 210;
export const MIN_ARENA_RADIUS = 95;

export const CAR_RADIUS = 18; // 碰撞圆形包围盒半径 (px)
export const CAR_MASS = 1.0;
export const SPIN_SPEED = 3.8; // 原地自旋角速度 (rad/s)
export const THRUST_ACCEL = 620; // 冲刺直线加速度 (px/s²)
export const MAX_SPEED = 330; // 极限最高冲刺速度 (px/s)
export const DEFAULT_FRICTION = 2.4; // 地面滑动阻尼 (1/s)
export const RESTITUTION = 0.95; // 刚体碰撞弹性恢复系数
export const DOUBLE_TAP_WINDOW = 0.22; // 双击急刹判定窗口 (s)

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
 * 角度归一化到 [-PI, PI]
 */
export function normalizeAngle(ang) {
  let a = ang % (Math.PI * 2);
  if (a > Math.PI) a -= Math.PI * 2;
  if (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * 创建单辆小车的初始状态
 */
export function createInitialCar(id, x, y, angle) {
  return {
    id, // 'red' | 'blue'
    x,
    y,
    vx: 0,
    vy: 0,
    angle, // 朝向弧度
    spinDir: id === 'red' ? 1 : -1, // 自旋方向 (+1 顺时针，-1 逆时针)
    thrusting: false, // 是否按住按键处于冲刺状态
    fallen: false, // 是否跌入悬崖
    fallTimer: 0, // 跌落坠崖特写计时
    lastPressTime: -999, // 上次按下开始时间
    lastPressDuration: 0.1, // 上次按下持续时长 (s)
    lastReleaseTime: -999, // 上次松开时间 (用于双击急刹检测)
    skidMarks: [], // 漂移轮胎印队列
  };
}

/**
 * 创建初始对决状态
 */
export function createInitialState(options = {}) {
  const {
    mode = '1p', // '1p' (人机天梯) | '2p' (双人同屏)
    targetScore = 5, // 抢 5 分决胜制 (BO5)
    levelConfig = {
      id: 1,
      act: 1,
      key: 'level_1',
      aiAimTolerance: 0.38,
      aiReactionTime: 0.16,
      aiStrategy: 'steady',
      friction: DEFAULT_FRICTION,
      shrinkDelay: 15.0,
      pegs: [],
      platformSpin: 0,
    },
    seed = Date.now(),
  } = options;

  return {
    mode,
    status: 'countdown', // 'countdown' | 'playing' | 'round_end' | 'match_won' | 'match_lost'
    levelConfig,
    targetScore,
    seed,
    rng: createRng(seed),

    // 局数与比分
    round: 1,
    scores: { red: 0, blue: 0 },
    roundWinner: null,
    matchWinner: null,

    // 擂台环境
    arenaRadius: BASE_ARENA_RADIUS,
    shrinkDelay: levelConfig.shrinkDelay ?? 15.0,
    pegs: levelConfig.pegs ? JSON.parse(JSON.stringify(levelConfig.pegs)) : [],
    platformSpin: levelConfig.platformSpin ?? 0,
    friction: levelConfig.friction ?? DEFAULT_FRICTION,

    // 计时器
    countdownTimer: 2.0, // 3-2-1 GO
    roundTime: 0,
    roundEndTimer: 0,

    // 红蓝赛车
    cars: {
      red: createInitialCar('red', ARENA_CX - 110, ARENA_CY, 0),
      blue: createInitialCar('blue', ARENA_CX + 110, ARENA_CY, Math.PI),
    },

    // AI 控制器状态
    ai: {
      timer: 0,
      isThrusting: false,
      strategy: levelConfig.aiStrategy || 'steady',
      aimTolerance: levelConfig.aiAimTolerance || 0.38,
      reactionTime: levelConfig.aiReactionTime || 0.16,
    },

    // 瞬态统计与事件
    stats: {
      collisions: 0,
      redBrakes: 0,
      blueBrakes: 0,
      redFalls: 0,
      blueFalls: 0,
    },
    events: [{ type: 'countdown_start' }],
  };
}

/**
 * 玩家按键状态改变 (纯函数)
 * @param {Object} state
 * @param {'red'|'blue'} carId
 * @param {boolean} isThrusting
 */
export function setCarThrust(state, carId, isThrusting) {
  const s = {
    ...state,
    cars: {
      ...state.cars,
      [carId]: { ...state.cars[carId] },
    },
    events: [...state.events],
    stats: { ...state.stats },
  };

  const car = s.cars[carId];
  if (car.fallen || s.status !== 'playing') {
    return s;
  }

  // 1. 从松开 -> 按下冲刺 (Press Down)
  if (!car.thrusting && isThrusting) {
    const timeSinceRelease = s.roundTime - car.lastReleaseTime;
    const curSpeed = Math.hypot(car.vx, car.vy);
    const pressDuration = car.lastPressDuration ?? 0.1;

    // 检测快速双击急刹 (Double-Tap Brake)
    // 触发条件：短促前次按压 (< 0.22s) + 极速双击窗口 (< DOUBLE_TAP_WINDOW) + 高速运动中 (> 80 px/s)
    if (timeSinceRelease < DOUBLE_TAP_WINDOW && curSpeed > 80 && pressDuration < 0.22) {
      car.vx *= 0.15;
      car.vy *= 0.15;
      if (carId === 'red') s.stats.redBrakes += 1;
      else s.stats.blueBrakes += 1;
      s.events.push({ type: 'brake', carId, x: car.x, y: car.y });
    }

    car.thrusting = true;
    car.lastPressTime = s.roundTime;
    s.events.push({ type: 'thrust_start', carId });
  }
  // 2. 从按下 -> 松开按键 (Release Key)
  else if (car.thrusting && !isThrusting) {
    car.thrusting = false;
    // 经典微操：每次松手旋转方向自动取反 (+1 <-> -1)
    car.spinDir = -car.spinDir;
    car.lastPressDuration = Math.max(0.01, s.roundTime - (car.lastPressTime ?? s.roundTime));
    car.lastReleaseTime = s.roundTime;
    s.events.push({ type: 'thrust_end', carId });
  }

  return s;
}

/**
 * 单帧物理步进推演 stepFrame (严格纯函数)
 * @param {Object} state
 * @param {number} dt 物理微分步长 (s)
 * @returns {Object} 新状态快照
 */
export function stepFrame(state, dt) {
  const s = {
    ...state,
    cars: {
      red: { ...state.cars.red },
      blue: { ...state.cars.blue },
    },
    scores: { ...state.scores },
    events: [],
    stats: { ...state.stats },
  };

  // 1. 倒计时状态
  if (s.status === 'countdown') {
    const prevSec = Math.ceil(s.countdownTimer);
    s.countdownTimer -= dt;
    const curSec = Math.ceil(s.countdownTimer);

    if (curSec < prevSec && curSec > 0) {
      s.events.push({ type: 'countdown_tick', count: curSec });
    }

    if (s.countdownTimer <= 0) {
      s.status = 'playing';
      s.roundTime = 0;
      s.events.push({ type: 'engine_go' });
    }
    return s;
  }

  // 2. 回合结束定格状态
  if (s.status === 'round_end') {
    s.roundEndTimer -= dt;

    // 坠落小车继续下坠动效
    for (const id of ['red', 'blue']) {
      const car = s.cars[id];
      if (car.fallen) {
        car.fallTimer += dt;
        car.x += car.vx * dt * 0.5;
        car.y += car.vy * dt * 0.5;
      }
    }

    if (s.roundEndTimer <= 0) {
      // 判定是否达成 BO5 率先抢得 targetScore 分
      if (s.scores.red >= s.targetScore) {
        s.status = 'match_won';
        s.matchWinner = 'red';
        s.events.push({ type: 'match_win', winner: 'red' });
      } else if (s.scores.blue >= s.targetScore) {
        s.status = 'match_lost';
        s.matchWinner = 'blue';
        s.events.push({ type: 'match_lost', winner: 'blue' });
      } else {
        // 重置进入下一小局
        s.round += 1;
        s.status = 'countdown';
        s.countdownTimer = 1.8;
        s.roundTime = 0;
        s.arenaRadius = BASE_ARENA_RADIUS;
        s.roundWinner = null;
        s.cars.red = createInitialCar('red', ARENA_CX - 110, ARENA_CY, 0);
        s.cars.blue = createInitialCar('blue', ARENA_CX + 110, ARENA_CY, Math.PI);
        s.events.push({ type: 'round_next', round: s.round });
      }
    }
    return s;
  }

  if (s.status === 'match_won' || s.status === 'match_lost') {
    return s;
  }

  // 3. 正常战斗中 (status === 'playing')
  s.roundTime += dt;

  // 3.1 绝境缩圈机制 (Sudden Death)
  if (s.roundTime > s.shrinkDelay && s.arenaRadius > MIN_ARENA_RADIUS) {
    s.arenaRadius = Math.max(MIN_ARENA_RADIUS, s.arenaRadius - 14 * dt);
    if (Math.floor(s.roundTime) !== Math.floor(s.roundTime - dt)) {
      s.events.push({ type: 'arena_shrink', radius: s.arenaRadius });
    }
  }

  // 3.2 1P 模式下驱动 AI (Blue)
  if (s.mode === '1p') {
    stepAiBehavior(s, dt);
  }

  // 3.3 物理推进红蓝双车动力学
  for (const id of ['red', 'blue']) {
    const car = s.cars[id];
    if (car.fallen) continue;

    // 旋转或直线冲刺
    if (!car.thrusting) {
      // 原地自旋寻向
      car.angle = normalizeAngle(car.angle + car.spinDir * SPIN_SPEED * dt);
      // 地面摩擦衰减当前惯性滑动
      car.vx -= car.vx * s.friction * dt;
      car.vy -= car.vy * s.friction * dt;
    } else {
      // 沿车头朝向喷射冲刺
      const ax = Math.cos(car.angle) * THRUST_ACCEL;
      const ay = Math.sin(car.angle) * THRUST_ACCEL;
      car.vx += ax * dt;
      car.vy += ay * dt;

      // 摩擦与极速限制
      car.vx -= car.vx * (s.friction * 0.4) * dt;
      car.vy -= car.vy * (s.friction * 0.4) * dt;
      const curSpeed = Math.hypot(car.vx, car.vy);
      if (curSpeed > MAX_SPEED) {
        car.vx = (car.vx / curSpeed) * MAX_SPEED;
        car.vy = (car.vy / curSpeed) * MAX_SPEED;
      }

      // 周期性产生漂移轮胎印
      if (Math.random() < 0.4) {
        car.skidMarks.push({
          x: car.x - Math.cos(car.angle) * 12,
          y: car.y - Math.sin(car.angle) * 12,
          angle: car.angle,
          alpha: 0.6,
        });
        if (car.skidMarks.length > 25) car.skidMarks.shift();
      }
    }

    // 齿轮自转平台切向漂移 (Act 4)
    if (s.platformSpin !== 0) {
      const dx = car.x - ARENA_CX;
      const dy = car.y - ARENA_CY;
      car.vx += -dy * s.platformSpin * dt;
      car.vy += dx * s.platformSpin * dt;
    }

    // 位移积分
    car.x += car.vx * dt;
    car.y += car.vy * dt;

    // 轮胎印淡出
    for (const sm of car.skidMarks) {
      sm.alpha -= dt * 0.5;
    }
    car.skidMarks = car.skidMarks.filter((sm) => sm.alpha > 0);
  }

  // 3.4 两车刚体弹性碰撞冲量检测
  checkCarsCollision(s);

  // 3.5 弹球保险杠碰撞检测 (Act 3 Pegs)
  checkPegsCollision(s);

  // 3.6 悬崖边缘跌落检测 (Fall Off)
  checkFallOff(s);

  return s;
}

/**
 * 两车刚体冲量弹性碰撞计算
 */
function checkCarsCollision(s) {
  const c1 = s.cars.red;
  const c2 = s.cars.blue;
  if (c1.fallen || c2.fallen) return;

  const dx = c2.x - c1.x;
  const dy = c2.y - c1.y;
  const dist = Math.hypot(dx, dy);
  const minDist = CAR_RADIUS * 2;

  if (dist < minDist && dist > 0.001) {
    const nx = dx / dist;
    const ny = dy / dist;

    // 相对速度在法线方向的投影
    const vrx = c2.vx - c1.vx;
    const vry = c2.vy - c1.vy;
    const vn = vrx * nx + vry * ny;

    // 仅在相互靠近时发生反弹
    if (vn < 0) {
      const impulseMag = -(1 + RESTITUTION) * vn / (1 / CAR_MASS + 1 / CAR_MASS);

      c1.vx -= (impulseMag / CAR_MASS) * nx;
      c1.vy -= (impulseMag / CAR_MASS) * ny;
      c2.vx += (impulseMag / CAR_MASS) * nx;
      c2.vy += (impulseMag / CAR_MASS) * ny;

      // 冲撞优势传递 (Offensive Ramming Momentum Transfer):
      // 主动冲刺撞向对方的车，享有额外推力并衰减反冲
      const c1Forward = Math.cos(c1.angle) * nx + Math.sin(c1.angle) * ny; // > 0 朝向对方
      const c2Forward = -Math.cos(c2.angle) * nx - Math.sin(c2.angle) * ny; // > 0 朝向对方

      if (c1.thrusting && c1Forward > 0.15) {
        c2.vx += nx * 130;
        c2.vy += ny * 130;
        c1.vx += nx * 50; // 减小反弹
      }
      if (c2.thrusting && c2Forward > 0.15) {
        c1.vx -= nx * 130;
        c1.vy -= ny * 130;
        c2.vx -= nx * 50; // 减小反弹
      }

      // 切向微量弹射，打破无限正面对顶僵局
      const tx = -ny;
      const ty = nx;
      const glance = (c1Forward - c2Forward) * 35;
      c1.vx += tx * glance;
      c1.vy += ty * glance;
      c2.vx -= tx * glance;
      c2.vy -= ty * glance;

      // 分开重叠几何体
      const overlap = (minDist - dist) * 0.55;
      c1.x -= nx * overlap;
      c1.y -= ny * overlap;
      c2.x += nx * overlap;
      c2.y += ny * overlap;

      s.stats.collisions += 1;
      s.events.push({
        type: 'car_collision',
        x: (c1.x + c2.x) * 0.5,
        y: (c1.y + c2.y) * 0.5,
        impact: Math.abs(impulseMag),
      });
    }
  }
}

/**
 * 弹球台弹性支柱碰撞 (Act 3 Pegs)
 */
function checkPegsCollision(s) {
  if (!s.pegs || s.pegs.length === 0) return;

  for (const peg of s.pegs) {
    for (const id of ['red', 'blue']) {
      const car = s.cars[id];
      if (car.fallen) continue;

      const dx = car.x - peg.x;
      const dy = car.y - peg.y;
      const dist = Math.hypot(dx, dy);
      const minDist = CAR_RADIUS + (peg.r || 20);

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        // 强力弹射冲量
        car.vx = nx * 280;
        car.vy = ny * 280;
        car.x = peg.x + nx * (minDist + 2);
        car.y = peg.y + ny * (minDist + 2);

        s.events.push({
          type: 'peg_hit',
          x: peg.x,
          y: peg.y,
          carId: id,
        });
      }
    }
  }
}

/**
 * 跌落深渊检测与胜负结算
 */
function checkFallOff(s) {
  for (const id of ['red', 'blue']) {
    const car = s.cars[id];
    if (car.fallen) continue;

    const distFromCenter = Math.hypot(car.x - ARENA_CX, car.y - ARENA_CY);
    // 重心超出边缘时判定失控坠落
    if (distFromCenter > s.arenaRadius + CAR_RADIUS * 0.6) {
      car.fallen = true;
      car.fallTimer = 0;
      s.status = 'round_end';
      s.roundEndTimer = 1.6;

      const otherId = (id === 'red') ? 'blue' : 'red';
      s.roundWinner = otherId;
      s.scores[otherId] += 1;

      if (id === 'red') s.stats.redFalls += 1;
      else s.stats.blueFalls += 1;

      s.events.push({
        type: 'fall_off',
        loser: id,
        winner: otherId,
        scores: { ...s.scores },
      });
      break;
    }
  }
}

/**
 * 确定性 AI 状态机驱动 (驱动 Blue 车)
 */
function stepAiBehavior(s, dt) {
  const ai = s.cars.blue;
  const target = s.cars.red;
  if (ai.fallen || target.fallen) return;

  s.ai.timer += dt;
  if (s.ai.timer < s.ai.reactionTime) return;
  s.ai.timer = 0;

  // 1. 计算车头朝向红车的相对角
  const dx = target.x - ai.x;
  const dy = target.y - ai.y;
  const desiredAngle = Math.atan2(dy, dx);
  const diffAngle = Math.abs(normalizeAngle(desiredAngle - ai.angle));

  // 2. 检查前方悬崖安全性 (梯度悬崖意识：新手 AI 悬崖防范弱易冲出，大师 AI 极度警觉)
  const cliffAwareness = s.levelConfig?.aiCliffAwareness ?? Math.min(0.96, 0.40 + (s.levelConfig?.id || 1) * 0.025);
  const noticesCliff = s.rng ? (s.rng() < cliffAwareness) : true;

  const futureX = ai.x + Math.cos(ai.angle) * 75;
  const futureY = ai.y + Math.sin(ai.angle) * 75;
  const futureDist = Math.hypot(futureX - ARENA_CX, futureY - ARENA_CY);
  const isNearCliff = noticesCliff && (futureDist > s.arenaRadius - 15);

  let shouldThrust = false;

  if (s.ai.strategy === 'aggressive') {
    // 狂暴冲撞型：对准即全速狂冲
    shouldThrust = diffAngle < (s.ai.aimTolerance * 1.3) && !isNearCliff;
  } else if (s.ai.strategy === 'tactical') {
    // 战术周旋型：极度谨慎防坠崖
    shouldThrust = diffAngle < s.ai.aimTolerance && !isNearCliff && Math.hypot(dx, dy) < 260;
  } else {
    // 稳健型 (steady)
    shouldThrust = diffAngle < s.ai.aimTolerance && !isNearCliff;
  }

  // 状态变更驱动
  if (ai.thrusting !== shouldThrust) {
    const nextState = setCarThrust(s, 'blue', shouldThrust);
    s.cars.blue = nextState.cars.blue;
    s.events.push(...nextState.events);
  }
}

/**
 * 重置整场比赛
 */
export function resetMatch(state) {
  return createInitialState({
    mode: state.mode,
    targetScore: state.targetScore,
    levelConfig: state.levelConfig,
    seed: Date.now(),
  });
}
