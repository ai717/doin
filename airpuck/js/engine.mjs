/**
 * @file games/airpuck/js/engine.mjs
 * 纯 2D 刚体冲量物理、半场约束与气垫动力学状态机，严格 DOM-Free。
 * 驱动动量叠加碰撞、音速扣杀、中场电磁加速、障碍折射与随机游走不变式。
 */

export const TABLE_WIDTH = 840;
export const TABLE_HEIGHT = 480;

export const LEFT_WALL = 40;
export const RIGHT_WALL = 800;
export const TOP_WALL = 30;
export const BOTTOM_WALL = 450;
export const CENTER_X = 420;

export const GOAL_Y_MIN = 170;
export const GOAL_Y_MAX = 310;
export const GOAL_DEPTH = 36;

export const PUCK_RADIUS = 18;
export const STRIKER_RADIUS = 32;

export const MAX_PUCK_SPEED = 1400;
export const MIN_PUCK_SPEED = 15;
export const MAX_STRIKER_SPEED = 480;
export const DASH_SPEED = 960;
export const DASH_DURATION = 0.15;
export const DASH_COOLDOWN = 2.0;

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
 * 创建整局初始物理状态
 */
export function createInitialState(options = {}) {
  const {
    level = null,
    mode = 'ai', // 'ai' (P1 vs AI) 或 '2p' (P1 vs P2)
    targetScore = 5,
    seed = Date.now(),
  } = options;

  const currentLevel = level || {
    id: 1,
    act: 1,
    key: 'level_1',
    nameKey: 'rival_apprentice',
    targetScore: options.targetScore || 5,
    targetSeconds: 75,
    ai: {
      speed: 260,
      reactionDelay: 0.18,
      defenseBias: 0.85,
      aggression: 0.35,
      dashEnabled: false,
    },
    table: {
      friction: 0.998,
      wallRestitution: 0.96,
      boosters: [],
      bumpers: [],
    },
  };

  const finalTargetScore = options.targetScore !== undefined ? options.targetScore : (currentLevel.targetScore || 5);

  return {
    mode,
    level: currentLevel,
    targetScore: finalTargetScore,
    scoreP1: 0,
    scoreP2: 0,
    status: 'playing', // 'playing' | 'round_reset' | 'won'
    winner: null, // 'p1' | 'p2' | null
    elapsedTime: 0,
    totalHitsP1: 0,
    totalHitsP2: 0,
    maxPuckSpeed: 0,
    roundResetTimer: 0,

    // 气垫球
    puck: {
      x: CENTER_X,
      y: (TOP_WALL + BOTTOM_WALL) / 2,
      vx: 0,
      vy: 0,
      lastHitBy: null, // 'p1' | 'p2'
      history: [], // 用于绘制极速激光拖尾
    },

    // P1 (左半场 - 赛博红)
    p1: {
      x: 180,
      y: (TOP_WALL + BOTTOM_WALL) / 2,
      vx: 0,
      vy: 0,
      inputX: 0,
      inputY: 0,
      isDashing: false,
      dashTimer: 0,
      dashCooldown: 0,
      streak: 0,
    },

    // P2 (右半场 - 极速蓝 / AI)
    p2: {
      x: 660,
      y: (TOP_WALL + BOTTOM_WALL) / 2,
      vx: 0,
      vy: 0,
      inputX: 0,
      inputY: 0,
      isDashing: false,
      dashTimer: 0,
      dashCooldown: 0,
      aiReactionTimer: 0,
      aiTargetY: (TOP_WALL + BOTTOM_WALL) / 2,
    },

    // 机关状态
    boosters: (currentLevel.table.boosters || []).map((b, idx) => ({
      ...b,
      id: `booster_${idx}`,
      cooldown: 0,
    })),
    bumpers: (currentLevel.table.bumpers || []).map((b, idx) => ({
      ...b,
      id: `bumper_${idx}`,
      hitTimer: 0,
    })),

    events: [],
    seed,
  };
}

/**
 * 限制玩家在己方半场内游走
 */
function clampStrikerPosition(x, y, isP1) {
  const minX = isP1 ? LEFT_WALL + STRIKER_RADIUS : CENTER_X + STRIKER_RADIUS;
  const maxX = isP1 ? CENTER_X - STRIKER_RADIUS : RIGHT_WALL - STRIKER_RADIUS;
  const minY = TOP_WALL + STRIKER_RADIUS;
  const maxY = BOTTOM_WALL - STRIKER_RADIUS;

  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/**
 * 触发突进扣杀 (Dash Smash)
 */
export function triggerDash(state, side = 'p1') {
  if (state.status !== 'playing') return state;

  const striker = side === 'p1' ? state.p1 : state.p2;
  if (striker.dashCooldown > 0 || striker.isDashing) return state;

  const nextStriker = {
    ...striker,
    isDashing: true,
    dashTimer: DASH_DURATION,
    dashCooldown: DASH_COOLDOWN,
  };

  const nextState = {
    ...state,
    [side]: nextStriker,
    events: [...state.events, { type: 'dash', side }],
  };

  return nextState;
}

/**
 * 设置玩家移动意图输入
 */
export function setInput(state, side, ix, iy) {
  const striker = side === 'p1' ? state.p1 : state.p2;
  return {
    ...state,
    [side]: {
      ...striker,
      inputX: Math.max(-1, Math.min(1, ix)),
      inputY: Math.max(-1, Math.min(1, iy)),
    },
  };
}

/**
 * 瞬时重置下一回合发球
 */
export function resetRound(state, concedingSide = 'p1') {
  const isP1Conceding = concedingSide === 'p1';
  // 新球在落后方发球点平稳生成，带有微弱向前速度
  const startX = isP1Conceding ? 260 : 580;
  const startY = (TOP_WALL + BOTTOM_WALL) / 2;
  const startVx = isP1Conceding ? 120 : -120;

  return {
    ...state,
    status: 'playing',
    roundResetTimer: 0,
    puck: {
      x: startX,
      y: startY,
      vx: startVx,
      vy: 0,
      lastHitBy: null,
      history: [],
    },
    p1: {
      ...state.p1,
      x: 180,
      y: (TOP_WALL + BOTTOM_WALL) / 2,
      vx: 0,
      vy: 0,
      isDashing: false,
      dashTimer: 0,
    },
    p2: {
      ...state.p2,
      x: 660,
      y: (TOP_WALL + BOTTOM_WALL) / 2,
      vx: 0,
      vy: 0,
      isDashing: false,
      dashTimer: 0,
    },
    events: [...state.events, { type: 'round_start' }],
  };
}

/**
 * 纯函数物理帧步进
 */
export function stepFrame(state, dt) {
  if (state.status === 'won') {
    return { ...state, events: [] };
  }

  // 若处于进球后 0.8s 停顿倒计时
  if (state.status === 'round_reset') {
    const nextTimer = state.roundResetTimer - dt;
    if (nextTimer <= 0) {
      return resetRound(state, state.lastConcedingSide || 'p1');
    }
    return { ...state, roundResetTimer: nextTimer, events: [] };
  }

  const events = [];
  const nextState = {
    ...state,
    elapsedTime: state.elapsedTime + dt,
    puck: { ...state.puck, history: [...state.puck.history] },
    p1: { ...state.p1 },
    p2: { ...state.p2 },
    boosters: state.boosters.map((b) => ({ ...b })),
    bumpers: state.bumpers.map((b) => ({ ...b })),
    events,
  };

  const { puck, p1, p2, level } = nextState;
  const table = level.table;

  // 1. AI 决策树更新 (P2 in AI mode)
  if (state.mode === 'ai') {
    updateAIDecision(nextState, dt);
  }

  // 2. 更新手柄物理移动与突进 CD
  updateStrikerPhysics(p1, dt, true);
  updateStrikerPhysics(p2, dt, false);

  // 3. 机关状态冷却更新
  for (const b of nextState.boosters) {
    if (b.cooldown > 0) b.cooldown -= dt;
  }
  for (const b of nextState.bumpers) {
    if (b.hitTimer > 0) b.hitTimer -= dt;
  }

  // 4. 高速气垫球细分子步步进 (Continuous Collision Sub-stepping)
  const SUBSTEPS = 4;
  const subDt = dt / SUBSTEPS;

  for (let step = 0; step < SUBSTEPS; step++) {
    // 气垫球位置积分与低摩擦阻尼
    puck.x += puck.vx * subDt;
    puck.y += puck.vy * subDt;
    puck.vx *= Math.pow(table.friction || 0.998, subDt * 60);
    puck.vy *= Math.pow(table.friction || 0.998, subDt * 60);

    // 速度钳制
    const curSpeed = Math.hypot(puck.vx, puck.vy);
    if (curSpeed > MAX_PUCK_SPEED) {
      const scale = MAX_PUCK_SPEED / curSpeed;
      puck.vx *= scale;
      puck.vy *= scale;
    }
    if (curSpeed > nextState.maxPuckSpeed) {
      nextState.maxPuckSpeed = Math.round(curSpeed);
    }

    // 碰撞 A: 手柄 P1 与小球刚体碰撞
    handleStrikerPuckCollision(p1, puck, 'p1', events, nextState);

    // 碰撞 B: 手柄 P2 与小球刚体碰撞
    handleStrikerPuckCollision(p2, puck, 'p2', events, nextState);

    // 碰撞 C: 机关 Bumper 弹性柱碰撞
    for (const bumper of nextState.bumpers) {
      handleBumperCollision(bumper, puck, events);
    }

    // 碰撞 D: 机关 Booster 加速环判定
    for (const booster of nextState.boosters) {
      handleBoosterZone(booster, puck, events);
    }

    // 碰撞 E: 边界与球门检测 (含破门大爆炸与得分)
    const goalResult = handleWallAndGoalCollision(puck, table, events);
    if (goalResult) {
      if (goalResult === 'p1') {
        nextState.scoreP1 += 1;
        events.push({ type: 'goal_score', scorer: 'p1', scoreP1: nextState.scoreP1, scoreP2: nextState.scoreP2 });
      } else {
        nextState.scoreP2 += 1;
        events.push({ type: 'goal_score', scorer: 'p2', scoreP1: nextState.scoreP1, scoreP2: nextState.scoreP2 });
      }

      // 检查胜负判定 (抢 5 分决胜)
      if (nextState.scoreP1 >= nextState.targetScore) {
        nextState.status = 'won';
        nextState.winner = 'p1';
        events.push({ type: 'match_win', winner: 'p1', scoreP1: nextState.scoreP1, scoreP2: nextState.scoreP2 });
        return nextState;
      }
      if (nextState.scoreP2 >= nextState.targetScore) {
        nextState.status = 'won';
        nextState.winner = 'p2';
        events.push({ type: 'match_win', winner: 'p2', scoreP1: nextState.scoreP1, scoreP2: nextState.scoreP2 });
        return nextState;
      }

      // 进入进球后 0.8s 顿挫重置缓冲
      nextState.status = 'round_reset';
      nextState.roundResetTimer = 0.8;
      nextState.lastConcedingSide = goalResult === 'p1' ? 'p2' : 'p1';
      return nextState;
    }
  }

  // 记录小球近 12 帧历史轨迹（用于激光拖尾平滑渲染）
  puck.history.unshift({ x: puck.x, y: puck.y, speed: Math.hypot(puck.vx, puck.vy) });
  if (puck.history.length > 12) {
    puck.history.pop();
  }

  return nextState;
}

/**
 * 手柄移动物理积分
 */
function updateStrikerPhysics(striker, dt, isP1) {
  // 突进扣杀计时
  if (striker.isDashing) {
    striker.dashTimer -= dt;
    if (striker.dashTimer <= 0) {
      striker.isDashing = false;
    }
  }
  if (striker.dashCooldown > 0) {
    striker.dashCooldown -= dt;
    if (striker.dashCooldown <= 0) {
      striker.dashCooldown = 0;
    }
  }

  const speed = striker.isDashing ? DASH_SPEED : MAX_STRIKER_SPEED;
  striker.vx = striker.inputX * speed;
  striker.vy = striker.inputY * speed;

  const targetX = striker.x + striker.vx * dt;
  const targetY = striker.y + striker.vy * dt;

  const clamped = clampStrikerPosition(targetX, targetY, isP1);
  striker.x = clamped.x;
  striker.y = clamped.y;
}

/**
 * 手柄与气垫球 2D 刚体冲量碰撞公式
 */
function handleStrikerPuckCollision(striker, puck, side, events, state) {
  const dx = puck.x - striker.x;
  const dy = puck.y - striker.y;
  const minDist = STRIKER_RADIUS + PUCK_RADIUS;
  const distSq = dx * dx + dy * dy;

  if (distSq >= minDist * minDist) return;

  const dist = Math.sqrt(distSq) || 0.001;
  const nx = dx / dist;
  const ny = dy / dist;

  // 1. 位置硬解重叠分离（避免穿模粘连）
  puck.x = striker.x + nx * (minDist + 0.5);
  puck.y = striker.y + ny * (minDist + 0.5);

  // 2. 相对速度矢量计算
  const rvx = puck.vx - striker.vx;
  const rvy = puck.vy - striker.vy;
  const velAlongNormal = rvx * nx + rvy * ny;

  // 仅在朝向彼此冲撞时进行动量反射
  if (velAlongNormal < 0) {
    const baseRestitution = 1.08;
    // 突进扣杀时赋予高达 1.8x 的极速动能冲击波
    const dashMultiplier = striker.isDashing ? 1.6 : 1.0;
    const impulse = -(1 + baseRestitution * dashMultiplier) * velAlongNormal;

    puck.vx += impulse * nx + striker.vx * 0.45;
    puck.vy += impulse * ny + striker.vy * 0.45;

    // 若手柄带有切角切向速度，赋予小球弧线侧旋切向冲量
    const tangentX = -ny;
    const tangentY = nx;
    const tangentSpeed = striker.vx * tangentX + striker.vy * tangentY;
    puck.vx += tangentX * tangentSpeed * 0.25;
    puck.vy += tangentY * tangentSpeed * 0.25;

    // 保证最小出球速度，杜绝卡壳滞留
    const postSpeed = Math.hypot(puck.vx, puck.vy);
    if (postSpeed < 220) {
      const boost = 220 / (postSpeed || 1);
      puck.vx *= boost;
      puck.vy *= boost;
    }

    puck.lastHitBy = side;
    if (side === 'p1') state.totalHitsP1 += 1;
    else state.totalHitsP2 += 1;

    events.push({
      type: 'puck_hit',
      side,
      x: puck.x,
      y: puck.y,
      speed: Math.round(Math.hypot(puck.vx, puck.vy)),
      isDashing: striker.isDashing,
    });
  }
}

/**
 * 边界与球门槽碰撞
 */
function handleWallAndGoalCollision(puck, table, events) {
  const eWall = table.wallRestitution || 0.96;

  // 1. 顶部墙面碰撞
  if (puck.y - PUCK_RADIUS < TOP_WALL) {
    puck.y = TOP_WALL + PUCK_RADIUS;
    puck.vy = -puck.vy * eWall;
    events.push({ type: 'wall_bounce', x: puck.x, y: puck.y });
  }

  // 2. 底部墙面碰撞
  if (puck.y + PUCK_RADIUS > BOTTOM_WALL) {
    puck.y = BOTTOM_WALL - PUCK_RADIUS;
    puck.vy = -puck.vy * eWall;
    events.push({ type: 'wall_bounce', x: puck.x, y: puck.y });
  }

  // 3. 左侧边界与红方球门
  const inGoalY = puck.y >= GOAL_Y_MIN && puck.y <= GOAL_Y_MAX;
  if (puck.x - PUCK_RADIUS < LEFT_WALL) {
    if (inGoalY) {
      // 判定穿过球门深度 -> 蓝方得分！
      if (puck.x < LEFT_WALL - 6) {
        return 'p2';
      }
    } else {
      puck.x = LEFT_WALL + PUCK_RADIUS;
      puck.vx = -puck.vx * eWall;
      events.push({ type: 'wall_bounce', x: puck.x, y: puck.y });
    }
  }

  // 4. 右侧边界与蓝方球门
  if (puck.x + PUCK_RADIUS > RIGHT_WALL) {
    if (inGoalY) {
      // 判定穿过球门深度 -> 红方得分！
      if (puck.x > RIGHT_WALL + 6) {
        return 'p1';
      }
    } else {
      puck.x = RIGHT_WALL - PUCK_RADIUS;
      puck.vx = -puck.vx * eWall;
      events.push({ type: 'wall_bounce', x: puck.x, y: puck.y });
    }
  }

  return null;
}

/**
 * 机关障碍柱 Bumper 碰撞
 */
function handleBumperCollision(bumper, puck, events) {
  const dx = puck.x - bumper.x;
  const dy = puck.y - bumper.y;
  const minDist = bumper.radius + PUCK_RADIUS;
  const distSq = dx * dx + dy * dy;

  if (distSq >= minDist * minDist) return;

  const dist = Math.sqrt(distSq) || 0.001;
  const nx = dx / dist;
  const ny = dy / dist;

  puck.x = bumper.x + nx * (minDist + 0.5);
  puck.y = bumper.y + ny * (minDist + 0.5);

  const velAlongNormal = puck.vx * nx + puck.vy * ny;
  if (velAlongNormal < 0) {
    const e = bumper.restitution || 1.15;
    puck.vx -= (1 + e) * velAlongNormal * nx;
    puck.vy -= (1 + e) * velAlongNormal * ny;

    bumper.hitTimer = 0.25;
    events.push({
      type: 'bumper_hit',
      x: bumper.x,
      y: bumper.y,
      speed: Math.round(Math.hypot(puck.vx, puck.vy)),
    });
  }
}

/**
 * 机关 Booster 加速环穿过判定
 */
function handleBoosterZone(booster, puck, events) {
  if (booster.cooldown > 0) return;

  const dx = puck.x - booster.x;
  const dy = puck.y - booster.y;
  const distSq = dx * dx + dy * dy;

  if (distSq < booster.radius * booster.radius) {
    const mult = booster.multiplier || 1.4;
    puck.vx *= mult;
    puck.vy *= mult;
    booster.cooldown = 0.6; // 0.6s 冷却，防止连续重复加速

    events.push({
      type: 'booster_trigger',
      x: booster.x,
      y: booster.y,
      speed: Math.round(Math.hypot(puck.vx, puck.vy)),
    });
  }
}

/**
 * 单人模式 AI 行为树决策更新
 */
function updateAIDecision(state, dt) {
  const { puck, p2, level } = state;
  const aiCfg = level.ai || { speed: 300, reactionDelay: 0.1, defenseBias: 0.7, aggression: 0.5 };

  p2.aiReactionTimer += dt;
  if (p2.aiReactionTimer >= aiCfg.reactionDelay) {
    p2.aiReactionTimer = 0;

    const baseDefenseX = 720;
    const baseDefenseY = (TOP_WALL + BOTTOM_WALL) / 2;

    // 当球在左半场：回防守位，并纵向微跟球
    if (puck.x < CENTER_X) {
      const targetX = baseDefenseX;
      const targetY = baseDefenseY * (1 - aiCfg.defenseBias) + puck.y * aiCfg.defenseBias;

      const dx = targetX - p2.x;
      const dy = targetY - p2.y;
      const dist = Math.hypot(dx, dy) || 1;

      p2.inputX = Math.abs(dx) > 10 ? Math.sign(dx) * Math.min(1, Math.abs(dx) / 50) : 0;
      p2.inputY = Math.abs(dy) > 10 ? Math.sign(dy) * Math.min(1, Math.abs(dy) / 50) : 0;
    } else {
      // 球在右半场：预测拦截点并迎球前冲挥击！
      let predictY = puck.y + (puck.vy * 0.12);
      predictY = Math.max(TOP_WALL + STRIKER_RADIUS, Math.min(BOTTOM_WALL - STRIKER_RADIUS, predictY));

      let targetX = puck.x + 20; // 稍微从球右后方前推
      let targetY = predictY;

      // 若球正快速飞往自己球门：全力优先横向封堵
      if (puck.vx > 100 && puck.x > 620) {
        targetX = Math.max(p2.x - 40, puck.x);
        targetY = puck.y;
      }

      const dx = targetX - p2.x;
      const dy = targetY - p2.y;

      p2.inputX = Math.abs(dx) > 6 ? Math.sign(dx) : 0;
      p2.inputY = Math.abs(dy) > 6 ? Math.sign(dy) : 0;

      // 绝佳轰门时机：当球在前方近身且移动朝向球门时，触发 AI 突进扣杀！
      if (
        aiCfg.dashEnabled &&
        p2.dashCooldown <= 0 &&
        dx < -15 &&
        dx > -100 &&
        Math.abs(dy) < 35 &&
        puck.vx < 150
      ) {
        p2.isDashing = true;
        p2.dashTimer = DASH_DURATION;
        p2.dashCooldown = DASH_COOLDOWN;
      }
    }
  }
}
