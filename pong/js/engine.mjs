// Pong Neo 核心物理与对局规则引擎（DOM-free 纯逻辑）
// 绝对禁止访问 window, document, localStorage

export const COURT_WIDTH = 600;
export const COURT_HEIGHT = 800;
export const PADDLE_WIDTH = 120;
export const PADDLE_HEIGHT = 16;
export const BALL_RADIUS = 9;

export const BASE_SPEED = 380; // px/sec
export const SPEED_INCREMENT = 1.045; // 每次回球提速 4.5%
export const MAX_SPEED = 860;
export const SERVE_SPEED = 320;

export const PADDLE_SPEED = 540; // 键盘/AI 最大横移速度 px/sec

export const MODES = {
  PVE: "pve",
  PVP: "pvp",
  WALL: "wall"
};

export const DIFFICULTIES = {
  EASY: "easy",
  NORMAL: "normal",
  HARD: "hard"
};

export const TARGET_SCORES = [3, 5, 7];

export function createInitialState(options = {}) {
  const mode = Object.values(MODES).includes(options.mode) ? options.mode : MODES.PVE;
  const difficulty = Object.values(DIFFICULTIES).includes(options.difficulty) ? options.difficulty : DIFFICULTIES.NORMAL;
  const targetScore = TARGET_SCORES.includes(options.targetScore) ? options.targetScore : 5;

  const state = {
    mode,
    difficulty,
    targetScore,
    scoreTop: 0,
    scoreBottom: 0,
    rallies: 0,
    maxRally: 0,
    status: "serving", // 'serving' | 'playing' | 'scored' | 'won'
    winner: null,      // 'top' | 'bottom' | null
    serveTimer: 0.8,   // 倒计时秒数
    serveDirection: 1, // 1 向下发球(给玩家)，-1 向上发球
    ball: {
      x: COURT_WIDTH / 2,
      y: COURT_HEIGHT / 2,
      vx: 0,
      vy: 0,
      speed: SERVE_SPEED,
      radius: BALL_RADIUS,
      trail: [],
      spin: 0
    },
    topPaddle: {
      x: COURT_WIDTH / 2,
      y: 35,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      vx: 0,
      targetX: COURT_WIDTH / 2
    },
    bottomPaddle: {
      x: COURT_WIDTH / 2,
      y: COURT_HEIGHT - 35,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
      vx: 0,
      targetX: COURT_WIDTH / 2
    },
    wallHealth: 999, // Wall 模式用于记录单人墙击次数
    lastHit: null    // 'top' | 'bottom'
  };

  initServe(state, options.initialDirection ?? 1);
  return state;
}

export function initServe(state, direction = 1) {
  state.status = "serving";
  state.serveTimer = 0.8;
  state.serveDirection = direction;
  state.rallies = 0;
  state.lastHit = null;

  // 角度略微随机偏转 (-25度 ~ +25度)
  const angle = ((Math.random() - 0.5) * 0.7);
  const vy = Math.cos(angle) * SERVE_SPEED * direction;
  const vx = Math.sin(angle) * SERVE_SPEED;

  state.ball.x = COURT_WIDTH / 2;
  state.ball.y = COURT_HEIGHT / 2;
  state.ball.vx = vx;
  state.ball.vy = vy;
  state.ball.speed = SERVE_SPEED;
  state.ball.trail = [];
  state.ball.spin = 0;

  state.topPaddle.x = COURT_WIDTH / 2;
  state.topPaddle.vx = 0;
  state.bottomPaddle.x = COURT_WIDTH / 2;
  state.bottomPaddle.vx = 0;
}

// 纯函数帧步进推进：支持固定时步或实际 dt
export function stepFrame(state, dt, inputs = {}) {
  if (state.status === "won") {
    return { state, events: [] };
  }

  const events = [];
  const next = deepClone(state);

  // 1. 处理发球倒计时
  if (next.status === "serving") {
    next.serveTimer -= dt;
    if (next.serveTimer <= 0) {
      next.status = "playing";
      events.push({ type: "serve", direction: next.serveDirection });
    }
  }

  // 2. 更新挡板移动 (Bottom Paddle - 玩家)
  updateBottomPaddle(next, dt, inputs.bottom);

  // 3. 更新上方挡板 (Top Paddle - AI 或 2P)
  if (next.mode === MODES.PVP) {
    updateTopPaddlePvp(next, dt, inputs.top);
  } else if (next.mode === MODES.WALL) {
    // 墙模式上方全封闭
    next.topPaddle.width = COURT_WIDTH;
    next.topPaddle.x = COURT_WIDTH / 2;
  } else {
    // PVE AI 决策
    updateTopPaddleAi(next, dt);
  }

  // 4. 小球物理步进与碰撞检测
  if (next.status === "playing") {
    stepBallPhysics(next, dt, events);
  }

  return { state: next, events };
}

function updateBottomPaddle(state, dt, input) {
  const p = state.bottomPaddle;
  const halfW = p.width / 2;

  if (input && typeof input.targetX === "number") {
    // 鼠标或触控绝对定位（平滑插值，防止瞬移失真）
    const target = Math.max(halfW, Math.min(COURT_WIDTH - halfW, input.targetX));
    const dx = target - p.x;
    p.vx = dx / Math.max(0.016, dt);
    p.x = target;
  } else if (input && typeof input.moveDirection === "number") {
    // 键盘移动 -1(左) / 0 / 1(右)
    p.vx = input.moveDirection * PADDLE_SPEED;
    p.x += p.vx * dt;
    p.x = Math.max(halfW, Math.min(COURT_WIDTH - halfW, p.x));
  } else {
    p.vx = 0;
  }
}

function updateTopPaddlePvp(state, dt, input) {
  const p = state.topPaddle;
  const halfW = p.width / 2;

  if (input && typeof input.targetX === "number") {
    const target = Math.max(halfW, Math.min(COURT_WIDTH - halfW, input.targetX));
    const dx = target - p.x;
    p.vx = dx / Math.max(0.016, dt);
    p.x = target;
  } else if (input && typeof input.moveDirection === "number") {
    p.vx = input.moveDirection * PADDLE_SPEED;
    p.x += p.vx * dt;
    p.x = Math.max(halfW, Math.min(COURT_WIDTH - halfW, p.x));
  } else {
    p.vx = 0;
  }
}

// 模拟人类反应延迟与落点预判的 AI 状态机
function updateTopPaddleAi(state, dt) {
  const p = state.topPaddle;
  const halfW = p.width / 2;
  const ball = state.ball;

  let targetX = COURT_WIDTH / 2;

  if (state.difficulty === DIFFICULTIES.EASY) {
    // 菜鸟：只追球当前 X，速度慢，反应迟钝
    const maxSpeed = PADDLE_SPEED * 0.55;
    targetX = ball.x;
    const dx = targetX - p.x;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), maxSpeed * dt);
    p.vx = step / dt;
    p.x += step;
  } else if (state.difficulty === DIFFICULTIES.NORMAL) {
    // 进阶：若球向上运动，预判落点；落点带轻微浮动误差
    if (ball.vy < 0) {
      // 简单预判到达 y=35 的时间与 x
      const timeToHit = Math.abs((p.y - ball.y) / (ball.vy || -1));
      targetX = ball.x + ball.vx * timeToHit;
      // 撞墙折射折算
      while (targetX < 0 || targetX > COURT_WIDTH) {
        if (targetX < 0) targetX = -targetX;
        if (targetX > COURT_WIDTH) targetX = 2 * COURT_WIDTH - targetX;
      }
      targetX += Math.sin(state.rallies) * 15; // 故意的小误差
    } else {
      targetX = COURT_WIDTH / 2; // 回中防守
    }
    const maxSpeed = PADDLE_SPEED * 0.85;
    const dx = targetX - p.x;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), maxSpeed * dt);
    p.vx = step / dt;
    p.x += step;
  } else {
    // 魔王 (Hard)：精确预判落点，且故意用挡板边缘切角反抽
    if (ball.vy < 0) {
      const timeToHit = Math.abs((p.y - ball.y) / (ball.vy || -1));
      targetX = ball.x + ball.vx * timeToHit;
      while (targetX < 0 || targetX > COURT_WIDTH) {
        if (targetX < 0) targetX = -targetX;
        if (targetX > COURT_WIDTH) targetX = 2 * COURT_WIDTH - targetX;
      }
      // 故意用挡板侧边 25px 处迎球制造刁钻大角度
      const offset = (targetX > COURT_WIDTH / 2 ? -28 : 28);
      targetX += offset;
    } else {
      targetX = COURT_WIDTH / 2;
    }
    const maxSpeed = PADDLE_SPEED * 1.15;
    const dx = targetX - p.x;
    const step = Math.sign(dx) * Math.min(Math.abs(dx), maxSpeed * dt);
    p.vx = step / dt;
    p.x += step;
  }

  p.x = Math.max(halfW, Math.min(COURT_WIDTH - halfW, p.x));
}

// 物理碰撞与连续射线步进（CCD）
function stepBallPhysics(state, dt, events) {
  const ball = state.ball;

  // 轨迹记录
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 8) ball.trail.shift();

  // 旋球横向阻尼衰减
  if (ball.spin !== 0) {
    ball.vx += ball.spin * dt;
    ball.spin *= 0.96;
  }

  // 子步进防止高速穿模 (Sub-stepping)
  const steps = Math.ceil((ball.speed * dt) / 10);
  const subDt = dt / steps;

  for (let s = 0; s < steps; s++) {
    ball.x += ball.vx * subDt;
    ball.y += ball.vy * subDt;

    // 1. 左右边框反弹
    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx);
      events.push({ type: "wall_hit", x: ball.x, y: ball.y });
    } else if (ball.x + ball.radius >= COURT_WIDTH) {
      ball.x = COURT_WIDTH - ball.radius;
      ball.vx = -Math.abs(ball.vx);
      events.push({ type: "wall_hit", x: ball.x, y: ball.y });
    }

    // 2. 下方挡板 (Bottom Paddle) 碰撞检测
    const bp = state.bottomPaddle;
    const bTop = bp.y - bp.height / 2;
    const bBottom = bp.y + bp.height / 2;
    const bLeft = bp.x - bp.width / 2;
    const bRight = bp.x + bp.width / 2;

    if (
      ball.vy > 0 &&
      ball.y + ball.radius >= bTop &&
      ball.y - ball.radius <= bBottom &&
      ball.x >= bLeft - ball.radius &&
      ball.x <= bRight + ball.radius
    ) {
      // 命中下方挡板
      ball.y = bTop - ball.radius;
      resolvePaddleHit(ball, bp, -1, state, events, "bottom");
      break;
    }

    // 3. 上方挡板 (Top Paddle 或 Wall) 碰撞检测
    const tp = state.topPaddle;
    const tTop = tp.y - tp.height / 2;
    const tBottom = tp.y + tp.height / 2;
    const tLeft = tp.x - tp.width / 2;
    const tRight = tp.x + tp.width / 2;

    if (
      ball.vy < 0 &&
      ball.y - ball.radius <= tBottom &&
      ball.y + ball.radius >= tTop &&
      ball.x >= tLeft - ball.radius &&
      ball.x <= tRight + ball.radius
    ) {
      // 命中上方挡板
      ball.y = tBottom + ball.radius;
      resolvePaddleHit(ball, tp, 1, state, events, "top");
      break;
    }

    // 4. 越过底线判定得分
    if (ball.y - ball.radius > COURT_HEIGHT) {
      // 下方失误，上方得分
      handleScore(state, "top", events);
      return;
    } else if (ball.y + ball.radius < 0) {
      if (state.mode === MODES.WALL) {
        // 墙壁极限反弹，不失分
        ball.y = ball.radius;
        ball.vy = Math.abs(ball.vy);
        events.push({ type: "wall_hit", x: ball.x, y: ball.y });
      } else {
        // 上方失误，下方得分
        handleScore(state, "bottom", events);
        return;
      }
    }
  }
}

// 挡板碰撞多段切角与挥板切削物理
function resolvePaddleHit(ball, paddle, verticalDir, state, events, hitter) {
  state.rallies += 1;
  state.maxRally = Math.max(state.maxRally, state.rallies);
  state.lastHit = hitter;

  // 1. 归一化撞击点：[-1, 1]，0 为正中，-1 极左，1 极右
  const hitFactor = Math.max(-1, Math.min(1, (ball.x - paddle.x) / (paddle.width / 2)));

  // 2. 角度折射：正中 10°，边缘最高 68°
  const maxBounceAngle = (68 * Math.PI) / 180;
  const bounceAngle = hitFactor * maxBounceAngle;

  // 3. 球速按拍数逐拍递增
  const newSpeed = Math.min(MAX_SPEED, ball.speed * SPEED_INCREMENT);
  ball.speed = newSpeed;

  // 4. 挥拍切削旋转（Paddle Velocity Transfer）
  const paddleSpeedRatio = Math.max(-1, Math.min(1, paddle.vx / PADDLE_SPEED));
  ball.spin = paddleSpeedRatio * 180; // 弧度旋球加速度

  ball.vx = Math.sin(bounceAngle) * newSpeed + paddle.vx * 0.15;
  ball.vy = Math.cos(bounceAngle) * newSpeed * verticalDir;

  events.push({
    type: "paddle_hit",
    hitter,
    x: ball.x,
    y: ball.y,
    hitFactor,
    speed: newSpeed,
    rallies: state.rallies,
    isSmash: Math.abs(hitFactor) > 0.75 || Math.abs(paddleSpeedRatio) > 0.5
  });
}

function handleScore(state, scorer, events) {
  if (scorer === "top") {
    state.scoreTop += 1;
  } else {
    state.scoreBottom += 1;
  }

  events.push({
    type: "score",
    scorer,
    scoreTop: state.scoreTop,
    scoreBottom: state.scoreBottom
  });

  // 检查是否终局
  if (state.scoreTop >= state.targetScore) {
    state.status = "won";
    state.winner = "top";
    events.push({ type: "game_over", winner: "top" });
  } else if (state.scoreBottom >= state.targetScore) {
    state.status = "won";
    state.winner = "bottom";
    events.push({ type: "game_over", winner: "bottom" });
  } else {
    // 进入下一个发球回合，向下或向上（得分方发球）
    const nextDir = scorer === "top" ? 1 : -1;
    initServe(state, nextDir);
  }
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}