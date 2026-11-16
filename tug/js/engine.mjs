/**
 * @file games/tug/js/engine.mjs
 * 纯数学物理状态机，严格 DOM-Free。
 * 驱动绳索张力、地面阻尼滑步、节奏脉冲光环与 22 关确定性 AI 行为。
 */

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 480;
export const WIN_DISTANCE = 150; // 红巾偏离中心达到 150px 判定本小局胜负
export const BASE_MASS = 1.0;
export const BASE_IMPULSE = 11.0; // 基础单次击键冲量 (px/s)
export const PERFECT_MULTIPLIER = 1.8; // 节拍暴击冲量倍数
export const DEFAULT_FRICTION = 3.6; // 地面摩擦衰减系数 (1/s)
export const BEAT_INTERVAL = 0.52; // 默认节拍基准周期 (约 115 BPM)
export const PERFECT_WINDOW = 0.085; // 节拍命中容差 (±85ms)

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
 * 创建初始对决状态
 * @param {Object} options
 * @param {string} options.mode - '1p' (人机天梯) 或 '2p' (双人同屏)
 * @param {Object} options.levelConfig - 关卡参数配置
 * @param {number} [options.seed] - PRNG 随机种子
 */
export function createInitialState(options = {}) {
  const {
    mode = '1p',
    levelConfig = {
      id: 1,
      act: 1,
      key: 'level_1',
      aiCps: 2.6,
      aiPerfectRate: 0.18,
      aiStrategy: 'steady',
      friction: DEFAULT_FRICTION,
      tiltAmp: 0,
      steamEnabled: false,
    },
    seed = Date.now(),
  } = options;

  return {
    mode, // '1p' | '2p'
    status: 'countdown', // 'countdown' | 'pulling' | 'round_end' | 'match_won' | 'match_lost'
    levelConfig,
    seed,
    rng: createRng(seed),

    // 局数与比分 (BO3 三局两胜)
    round: 1,
    scores: { red: 0, blue: 0 },
    roundWinner: null,
    matchWinner: null,

    // 物理量
    ropeX: 0, // 中心红巾水平偏移量，负值偏向红方(左)，正值偏向蓝方(右)
    ropeV: 0, // 瞬时速度 (px/s)
    tension: 0, // 绳索张力紧绷度 (0 ~ 1.0)

    // 计时器
    countdownTimer: 2.2, // 3-2-1 READY GO 倒计时 (s)
    roundTime: 0, // 本小局比赛已进行时长
    roundEndTimer: 0, // 胜负决出定格与掉入泥潭停留 (s)

    // 节拍系统
    beat: {
      interval: BEAT_INTERVAL,
      timer: 0, // 0 -> interval
      phase: 0, // 0.0 ~ 1.0 闭环
      isNearBeat: false,
    },

    // 环境修饰符 (来自 5 大季主题)
    env: {
      friction: levelConfig.friction ?? DEFAULT_FRICTION,
      tiltAmp: levelConfig.tiltAmp ?? 0,
      tiltAngle: 0, // 实时倾斜角 (rad)
      steamEnabled: levelConfig.steamEnabled ?? false,
      steamCharge: 0, // 蒸汽充能进度 0 ~ 1.0
      steamActive: false, // 蒸汽喷涌爆发期
      steamTimer: 0,
    },

    // AI 状态机 (仅 1p 模式驱动蓝方)
    ai: {
      nextTapDelay: 1 / (levelConfig.aiCps || 2.6),
      tapTimer: 0,
      cps: levelConfig.aiCps || 2.6,
      perfectRate: levelConfig.aiPerfectRate || 0.18,
      strategy: levelConfig.aiStrategy || 'steady',
    },

    // 实时手速与暴击统计
    stats: {
      redTaps: 0,
      blueTaps: 0,
      redPerfects: 0,
      bluePerfects: 0,
      redRecentTaps: [], // 滑动时间戳窗口，用于计算即时 CPS
      blueRecentTaps: [],
      redCps: 0,
      blueCps: 0,
      redMaxCps: 0,
      blueMaxCps: 0,
    },

    // 单帧待派发的瞬态事件
    events: [{ type: 'countdown_start' }],
  };
}

/**
 * 玩家按键/点击拉拽核心处理 (纯函数)
 * @param {Object} state
 * @param {'red'|'blue'} side
 * @param {number} [now]
 * @returns {Object} { state, actionResult }
 */
export function handlePullAction(state, side) {
  // 仅在拔河进行中响应拉力
  if (state.status !== 'pulling') {
    return { state, actionResult: null };
  }

  const s = { ...state, events: [...state.events] };
  const beatDist = Math.min(s.beat.timer, s.beat.interval - s.beat.timer);
  const isPerfect = beatDist <= PERFECT_WINDOW;

  let mult = isPerfect ? PERFECT_MULTIPLIER : 1.0;
  if (s.env.steamActive) {
    mult *= 1.4; // 蒸汽狂暴增益
  }

  const impulse = BASE_IMPULSE * mult;

  // 红方往左拉 (加速度负向)，蓝方往右拉 (加速度正向)
  if (side === 'red') {
    s.ropeV -= impulse;
    s.stats = {
      ...s.stats,
      redTaps: s.stats.redTaps + 1,
      redPerfects: s.stats.redPerfects + (isPerfect ? 1 : 0),
      redRecentTaps: [...s.stats.redRecentTaps, s.roundTime],
    };
  } else {
    s.ropeV += impulse;
    s.stats = {
      ...s.stats,
      blueTaps: s.stats.blueTaps + 1,
      bluePerfects: s.stats.bluePerfects + (isPerfect ? 1 : 0),
      blueRecentTaps: [...s.stats.blueRecentTaps, s.roundTime],
    };
  }

  const actionResult = {
    side,
    isPerfect,
    impulse,
    time: s.roundTime,
  };

  s.events.push({
    type: 'pull_tap',
    ...actionResult,
  });

  return { state: s, actionResult };
}

/**
 * 固定步长物理与状态流转单帧推演 stepFrame (严格纯函数)
 * @param {Object} state
 * @param {number} dt 物理微分时间 (s)
 * @returns {Object} 新状态快照
 */
export function stepFrame(state, dt) {
  const s = {
    ...state,
    events: [],
    stats: {
      ...state.stats,
      redRecentTaps: [...state.stats.redRecentTaps],
      blueRecentTaps: [...state.stats.blueRecentTaps],
    },
    scores: { ...state.scores },
    env: { ...state.env },
    ai: { ...state.ai },
    beat: { ...state.beat },
  };

  // 1. 节拍相位推进
  s.beat.timer += dt;
  if (s.beat.timer >= s.beat.interval) {
    s.beat.timer -= s.beat.interval;
    s.events.push({ type: 'beat_tick' });
  }
  s.beat.phase = s.beat.timer / s.beat.interval;
  const beatDist = Math.min(s.beat.timer, s.beat.interval - s.beat.timer);
  s.beat.isNearBeat = beatDist <= PERFECT_WINDOW;

  // 2. 状态分支逻辑
  if (s.status === 'countdown') {
    const prevSec = Math.ceil(s.countdownTimer);
    s.countdownTimer -= dt;
    const curSec = Math.ceil(s.countdownTimer);

    if (curSec < prevSec && curSec > 0) {
      s.events.push({ type: 'countdown_tick', count: curSec });
    }

    if (s.countdownTimer <= 0) {
      s.status = 'pulling';
      s.roundTime = 0;
      s.events.push({ type: 'whistle_go' });
    }
    return s;
  }

  if (s.status === 'round_end') {
    s.roundEndTimer -= dt;
    if (s.roundEndTimer <= 0) {
      // 检查 BO3 是否决出总胜负 (率先拿 2 分)
      if (s.scores.red >= 2) {
        s.status = 'match_won';
        s.matchWinner = 'red';
        s.events.push({ type: 'match_win', winner: 'red' });
      } else if (s.scores.blue >= 2) {
        s.status = 'match_lost';
        s.matchWinner = 'blue';
        s.events.push({ type: 'match_lost', winner: 'blue' });
      } else {
        // 进入下一小局
        s.round += 1;
        s.status = 'countdown';
        s.countdownTimer = 2.0;
        s.ropeX = 0;
        s.ropeV = 0;
        s.roundWinner = null;
        s.roundTime = 0;
        s.events.push({ type: 'round_next', round: s.round });
      }
    }
    return s;
  }

  if (s.status === 'match_won' || s.status === 'match_lost') {
    return s; // 比赛结束保持终局
  }

  // 3. 拔河进行中 (status === 'pulling')
  s.roundTime += dt;

  // 3.1 环境动力学计算
  let envForce = 0;

  // 海盗甲板摇摆倾斜 (Act 3)
  if (s.env.tiltAmp > 0) {
    s.env.tiltAngle = Math.sin(s.roundTime * 1.8) * s.env.tiltAmp;
    // 重力沿斜面下滑分力
    envForce += Math.sin(s.env.tiltAngle) * 28.0;
  }

  // 蒸汽充能喷发 (Act 4)
  if (s.env.steamEnabled) {
    s.env.steamTimer += dt;
    if (s.env.steamActive) {
      if (s.env.steamTimer > 3.0) {
        s.env.steamActive = false;
        s.env.steamTimer = 0;
        s.env.steamCharge = 0;
      }
    } else {
      s.env.steamCharge = Math.min(1.0, s.env.steamTimer / 6.0);
      if (s.env.steamCharge >= 1.0) {
        s.env.steamActive = true;
        s.env.steamTimer = 0;
        s.events.push({ type: 'steam_burst' });
      }
    }
  }

  // 3.2 1P 模式下 AI 智能体推演
  if (s.mode === '1p') {
    stepAiBehavior(s, dt);
  }

  // 3.3 物理张力与阻尼积分: a = (envForce) / M - friction * v
  const friction = s.env.friction;
  const accel = (envForce / BASE_MASS) - (friction * s.ropeV);
  s.ropeV += accel * dt;
  s.ropeX += s.ropeV * dt;

  // 张力视觉形变系数 (两端拉锯与速度产生紧绷)
  s.tension = Math.min(1.0, (Math.abs(s.ropeV) * 0.015) + (Math.abs(s.ropeX) / WIN_DISTANCE) * 0.6 + 0.35);

  // 3.4 即时 CPS 统计 (1秒滑动窗口)
  updateCpsWindow(s);

  // 3.5 胜负临界线判定 (|ropeX| >= WIN_DISTANCE)
  if (s.ropeX <= -WIN_DISTANCE) {
    // 红方(左)获胜
    s.ropeX = -WIN_DISTANCE;
    s.ropeV = 0;
    s.status = 'round_end';
    s.roundEndTimer = 1.8;
    s.roundWinner = 'red';
    s.scores.red += 1;
    s.events.push({
      type: 'round_win',
      winner: 'red',
      scores: { ...s.scores },
      loserFell: 'blue',
    });
  } else if (s.ropeX >= WIN_DISTANCE) {
    // 蓝方(右)获胜
    s.ropeX = WIN_DISTANCE;
    s.ropeV = 0;
    s.status = 'round_end';
    s.roundEndTimer = 1.8;
    s.roundWinner = 'blue';
    s.scores.blue += 1;
    s.events.push({
      type: 'round_win',
      winner: 'blue',
      scores: { ...s.scores },
      loserFell: 'red',
    });
  }

  return s;
}

/**
 * 驱动 1P 模式下蓝方 AI 行为 (确定性步长控制)
 */
function stepAiBehavior(s, dt) {
  s.ai.tapTimer += dt;

  // 依据关卡个性动态调整 AI 瞬时手速
  let currentTargetCps = s.ai.cps;

  if (s.ai.strategy === 'sprinter') {
    // 冲刺型：前 3.5 秒极速爆发 (+35%)，随后稍微放缓 (-15%)
    if (s.roundTime < 3.5) {
      currentTargetCps *= 1.35;
    } else {
      currentTargetCps *= 0.85;
    }
  } else if (s.ai.strategy === 'comeback') {
    // 逆境翻盘型：落后处于红方优势区 (ropeX < -40) 时暴怒拉升 (+40%)
    if (s.ropeX < -40) {
      currentTargetCps *= 1.4;
    }
  } else if (s.ai.strategy === 'rhythm_master') {
    // 节拍大师：偏向等待节拍点扣动
    if (s.beat.isNearBeat && s.ai.tapTimer > 0.14) {
      s.ai.tapTimer += 0.3; // 促成触发
    }
  }

  // 随机抖动基准间隔 (确定性 PRNG)
  const baseDelay = 1 / Math.max(1.0, currentTargetCps);
  const jitter = (s.rng() - 0.5) * 0.2 * baseDelay;
  const targetDelay = Math.max(0.08, baseDelay + jitter);

  if (s.ai.tapTimer >= targetDelay) {
    s.ai.tapTimer = 0;

    // 判定 AI 本次是否打出 PERFECT
    let isAiPerfect = false;
    if (s.ai.strategy === 'rhythm_master') {
      isAiPerfect = s.rng() < (s.ai.perfectRate * 1.25);
    } else {
      isAiPerfect = s.rng() < s.ai.perfectRate;
    }

    // 触发蓝方拉动
    let mult = isAiPerfect ? PERFECT_MULTIPLIER : 1.0;
    if (s.env.steamActive) mult *= 1.4;

    const impulse = BASE_IMPULSE * mult;
    s.ropeV += impulse;
    s.stats.blueTaps += 1;
    if (isAiPerfect) s.stats.bluePerfects += 1;
    s.stats.blueRecentTaps.push(s.roundTime);

    s.events.push({
      type: 'pull_tap',
      side: 'blue',
      isPerfect: isAiPerfect,
      impulse,
      time: s.roundTime,
    });
  }
}

/**
 * 维护 1.0 秒滑动窗口并计算实时 CPS
 */
function updateCpsWindow(s) {
  const windowStart = s.roundTime - 1.0;

  // 清理 1 秒前的记录
  while (s.stats.redRecentTaps.length > 0 && s.stats.redRecentTaps[0] < windowStart) {
    s.stats.redRecentTaps.shift();
  }
  while (s.stats.blueRecentTaps.length > 0 && s.stats.blueRecentTaps[0] < windowStart) {
    s.stats.blueRecentTaps.shift();
  }

  s.stats.redCps = s.stats.redRecentTaps.length;
  s.stats.blueCps = s.stats.blueRecentTaps.length;

  if (s.stats.redCps > s.stats.redMaxCps) s.stats.redMaxCps = s.stats.redCps;
  if (s.stats.blueCps > s.stats.blueMaxCps) s.stats.blueMaxCps = s.stats.blueCps;
}

/**
 * 重置整场比赛为初始状态
 */
export function resetMatch(state) {
  return createInitialState({
    mode: state.mode,
    levelConfig: state.levelConfig,
    seed: Date.now(),
  });
}
