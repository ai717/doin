// engine.mjs: 云朵合成物理与规则纯函数引擎。
// 严禁碰 DOM、window、localStorage 等宿主对象。
// stepFrame 与 applyIntent 均返回 { state, events, action }。

import {
  mergeScore,
  calculateMergePoints,
  rainClearScore,
  rainbowCollectScore,
} from "./score.mjs?v=dev";

// —— 世界与容器（逻辑单位）——
export const WORLD = Object.freeze({ width: 440, height: 680 });
export const WALL = 16;
export const SAFETY_Y = 140;
export const DROP_Y = 80;

// —— 固定时间步 ——
export const FIXED_DT = 1 / 120;
export const MAX_SUBSTEPS = 6;

// —— 10 级云朵等级链 ——
export const MAX_LEVEL = 10;
export const LEVEL_COUNT = 10;
export const RADII = Object.freeze([18, 25, 33, 42, 52, 63, 75, 87, 99, 112]);

// 每级云朵的主题风格参数（纯数据供渲染使用）
export const CLOUD_DEFS = Object.freeze([
  Object.freeze({ level: 1, name: "小云朵", enName: "Tiny Cloud", color: "#FFFFFF", glow: "#E0F4FF", type: "white" }),
  Object.freeze({ level: 2, name: "棉花云", enName: "Cotton Cloud", color: "#F7FAFC", glow: "#D7ECFB", type: "white" }),
  Object.freeze({ level: 3, name: "积云", enName: "Cumulus Cloud", color: "#EDF2F7", glow: "#CBE3F8", type: "fluffy" }),
  Object.freeze({ level: 4, name: "浓积云", enName: "Cumulus Congestus", color: "#E2E8F0", glow: "#BEDBFA", type: "fluffy" }),
  Object.freeze({ level: 5, name: "雨云", enName: "Rain Cloud", color: "#CBD5E1", glow: "#93C5FD", type: "rain" }),
  Object.freeze({ level: 6, name: "大雨云", enName: "Heavy Rain Cloud", color: "#94A3B8", glow: "#60A5FA", type: "heavy_rain" }),
  Object.freeze({ level: 7, name: "积雨云", enName: "Cumulonimbus", color: "#64748B", glow: "#3B82F6", type: "storm_prep" }),
  Object.freeze({ level: 8, name: "雷暴云", enName: "Thunderstorm Cloud", color: "#475569", glow: "#FACC15", type: "thunder" }),
  Object.freeze({ level: 9, name: "雪云", enName: "Snow Cloud", color: "#F1F5F9", glow: "#A5B4FC", type: "snow" }),
  Object.freeze({ level: 10, name: "彩虹云", enName: "Rainbow Cloud", color: "#FFFBEB", glow: "#F472B6", type: "rainbow" }),
]);

// —— 掉落池权重 ——
export const DROP_WEIGHTS = Object.freeze([10, 8, 5, 3, 2]); // 对应 L1..L5
export const START_POOL = 3; // 初始只掉 L1..L3
export const CAP_POOL = 5;

// —— 轻飘软弹物理手感 ——
export const GRAVITY = 860;
export const RESTITUTION = 0.28;
export const WALL_RESTITUTION = 0.35;
export const AIR_DRAG = 0.9992;
export const FLOOR_TANGENT = 0.98;
export const SLEEP_SPEED = 2.5;
export const SOLVER_ITER = 6;
export const MAX_CORRECTION = 0.75;
export const MERGE_ITER = 20;

// —— 规则时序 ——
export const DROP_COOLDOWN = 0.45;
export const DANGER_LIMIT = 2.0; // 超出安全线 2.0 秒结算
export const DANGER_AGE = 0.8;
export const CHAIN_WINDOW = 0.75;
export const MAX_CLOUDS = 200;

export const STATUS = Object.freeze({
  ready: "ready",
  playing: "playing",
  over: "over",
});

// —— 确定性 PRNG (mulberry32) ——
export function mulberry32(seed) {
  let a = (seed >>> 0) || 1;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function dailySeed(dateStr) {
  return hashSeed(`cloud-merge:daily:${dateStr}`);
}

export function levelRadius(level) {
  const lv = Math.trunc(Number(level));
  if (!Number.isFinite(lv)) return RADII[0];
  return RADII[Math.max(1, Math.min(MAX_LEVEL, lv)) - 1];
}

export function clampAimX(x, level) {
  const r = levelRadius(level);
  const minX = WALL + r + 4;
  const maxX = WORLD.width - WALL - r - 4;
  if (minX >= maxX) return WORLD.width / 2;
  return Math.max(minX, Math.min(maxX, x));
}

export function unlockedPoolSize(maxLevelReached) {
  if (maxLevelReached >= 8) return 5;
  if (maxLevelReached >= 6) return 4;
  return START_POOL;
}

export function pickDropLevel(rng, maxLevelReached) {
  const pool = unlockedPoolSize(maxLevelReached);
  const weights = DROP_WEIGHTS.slice(0, pool);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * total;
  for (let i = 0; i < pool; i += 1) {
    if (roll < weights[i]) return i + 1;
    roll -= weights[i];
  }
  return 1;
}

/**
 * 创建全新的游戏状态
 */
export function createInitialState(options = {}) {
  const mode = options.mode === "daily" ? "daily" : "endless";
  const seed = Number.isFinite(options.seed)
    ? options.seed >>> 0
    : mode === "daily"
      ? dailySeed(options.dateStr || "2026-09-14")
      : (Math.random() * 0xffffffff) >>> 0;

  const rng = mulberry32(seed);
  const nextId = 1;
  const currentDrop = pickDropLevel(rng, 1);
  const nextDrop = pickDropLevel(rng, 1);

  return {
    mode,
    seed,
    status: STATUS.ready,
    score: 0,
    maxLevelReached: 1,
    clouds: [],
    nextId,
    aimX: WORLD.width / 2,
    currentDrop,
    nextDrop,
    cooldown: 0,
    chainCombo: 0,
    chainTimer: 0,
    maxChainCombo: 0,
    rainbowsCollected: 0,
    dangerTimer: 0,
    isDanger: false,
    rainActiveUntil: 0,
    rainSourceX: 0,
    rainSourceY: 0,
    timeElapsed: 0,
    _rng: rng,
  };
}

/**
 * 意图处理：纯函数状态转换
 */
export function applyIntent(state, intent) {
  if (!state || !intent) return { state, events: [], action: null };
  const events = [];

  if (intent.type === "restart") {
    const nextState = createInitialState({
      mode: intent.mode || state.mode,
      seed: intent.seed,
      dateStr: intent.dateStr,
    });
    events.push({ type: "restarted", mode: nextState.mode });
    return { state: nextState, events, action: "restart" };
  }

  if (state.status === STATUS.over) {
    return { state, events: [], action: null };
  }

  if (intent.type === "set_aim") {
    if (!Number.isFinite(intent.x)) return { state, events: [], action: null };
    const clamped = clampAimX(intent.x, state.currentDrop);
    state.aimX = clamped;
    return { state, events: [], action: "set_aim" };
  }

  if (intent.type === "drop") {
    if (state.cooldown > 0 || state.clouds.length >= MAX_CLOUDS) {
      return { state, events: [], action: null };
    }

    const level = state.currentDrop;
    const r = levelRadius(level);
    const dropX = clampAimX(Number.isFinite(intent.x) ? intent.x : state.aimX, level);

    const newCloud = {
      id: state.nextId++,
      level,
      x: dropX,
      y: DROP_Y,
      vx: 0,
      vy: 40,
      radius: r,
      age: 0,
      mass: r * r * 0.05,
    };

    state.clouds.push(newCloud);
    state.cooldown = DROP_COOLDOWN;
    state.status = STATUS.playing;

    // 更新待丢与下一朵
    state.currentDrop = state.nextDrop;
    state.nextDrop = pickDropLevel(state._rng, state.maxLevelReached);
    state.aimX = clampAimX(state.aimX, state.currentDrop);

    events.push({
      type: "drop",
      cloud: { ...newCloud },
    });

    return { state, events, action: "drop" };
  }

  if (intent.type === "collect_rainbow") {
    // 寻找场上的 L10 彩虹云
    let targetIndex = -1;
    if (intent.id) {
      targetIndex = state.clouds.findIndex(
        (c) => c.id === intent.id && c.level === MAX_LEVEL
      );
    } else {
      targetIndex = state.clouds.findIndex((c) => c.level === MAX_LEVEL);
    }

    if (targetIndex === -1) {
      return { state, events: [], action: null };
    }

    const collectedCloud = state.clouds[targetIndex];
    state.clouds.splice(targetIndex, 1);

    const bonus = rainbowCollectScore();
    state.score += bonus;
    state.rainbowsCollected += 1;

    events.push({
      type: "rainbow_collected",
      cloud: { ...collectedCloud },
      points: bonus,
      totalRainbows: state.rainbowsCollected,
    });

    return { state, events, action: "collect_rainbow" };
  }

  return { state, events: [], action: null };
}

/**
 * 推进物理与逻辑帧：纯函数步进
 */
export function stepFrame(state, dt = FIXED_DT) {
  if (!state || state.status === STATUS.over) {
    return { state, events: [], action: null };
  }

  const events = [];
  state.timeElapsed += dt;

  // 冷却与连锁计时
  if (state.cooldown > 0) {
    state.cooldown = Math.max(0, state.cooldown - dt);
  }

  if (state.chainTimer > 0) {
    state.chainTimer = Math.max(0, state.chainTimer - dt);
    if (state.chainTimer === 0) {
      state.chainCombo = 0;
    }
  }

  // 积分推进运动
  const count = state.clouds.length;
  for (let i = 0; i < count; i += 1) {
    const c = state.clouds[i];
    c.age += dt;

    // 轻飘重力与微弱阻尼
    c.vy += GRAVITY * dt;
    c.vx *= AIR_DRAG;
    c.vy *= AIR_DRAG;

    c.x += c.vx * dt;
    c.y += c.vy * dt;

    // 墙体约束
    const minX = WALL + c.radius;
    const maxX = WORLD.width - WALL - c.radius;
    if (c.x < minX) {
      c.x = minX;
      c.vx = -c.vx * WALL_RESTITUTION;
    } else if (c.x > maxX) {
      c.x = maxX;
      c.vx = -c.vx * WALL_RESTITUTION;
    }

    // 地面约束
    const maxY = WORLD.height - WALL - c.radius;
    if (c.y > maxY) {
      c.y = maxY;
      c.vy = -c.vy * RESTITUTION;
      c.vx *= FLOOR_TANGENT;
      if (Math.abs(c.vy) < SLEEP_SPEED) c.vy = 0;
    }
  }

  // 物理碰撞与合体检测
  resolveCollisionsAndMerges(state, events, dt);

  // 检查安全线与危险判定
  checkSafetyThreshold(state, events, dt);

  return { state, events, action: "step" };
}

/**
 * 碰撞求解与合体状态机流转
 */
function resolveCollisionsAndMerges(state, events, dt) {
  const mergedIds = new Set();
  const clouds = state.clouds;

  for (let iter = 0; iter < SOLVER_ITER; iter += 1) {
    const len = clouds.length;
    for (let i = 0; i < len; i += 1) {
      const a = clouds[i];
      if (mergedIds.has(a.id)) continue;

      for (let j = i + 1; j < len; j += 1) {
        const b = clouds[j];
        if (mergedIds.has(b.id)) continue;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distSq = dx * dx + dy * dy;
        const minDist = a.radius + b.radius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // 同级云朵触发合体！
          if (a.level === b.level && a.level < MAX_LEVEL && iter === 0) {
            mergedIds.add(a.id);
            mergedIds.add(b.id);

            const nextLevel = a.level + 1;
            const nextRadius = levelRadius(nextLevel);
            const midX = (a.x + b.x) * 0.5;
            const midY = (a.y + b.y) * 0.5;

            // 动量守恒
            const nextVx = (a.vx + b.vx) * 0.5;
            const nextVy = (a.vy + b.vy) * 0.5 - 25; // 微微上浮软弹

            // 连锁增加
            state.chainCombo += 1;
            state.chainTimer = CHAIN_WINDOW;
            if (state.chainCombo > state.maxChainCombo) {
              state.maxChainCombo = state.chainCombo;
            }

            const points = calculateMergePoints(nextLevel, state.chainCombo);
            state.score += points;
            if (nextLevel > state.maxLevelReached) {
              state.maxLevelReached = nextLevel;
            }

            const mergedCloud = {
              id: state.nextId++,
              level: nextLevel,
              x: midX,
              y: midY,
              vx: nextVx,
              vy: nextVy,
              radius: nextRadius,
              age: 0,
              mass: nextRadius * nextRadius * 0.05,
            };

            events.push({
              type: "merge",
              a: { ...a },
              b: { ...b },
              cloud: { ...mergedCloud },
              level: nextLevel,
              chain: state.chainCombo,
              points,
            });

            // 如果合成了 L8 雷暴云，触发自动下雨清场机制！
            if (nextLevel === 8) {
              triggerThunderstormRain(state, mergedCloud, events, mergedIds);
            }

            break; // 该 a 已合体
          }

          // 否则纯物理分离
          const totalMass = a.mass + b.mass;
          const ratioA = b.mass / totalMass;
          const ratioB = a.mass / totalMass;

          const separation = overlap * MAX_CORRECTION;
          a.x -= nx * separation * ratioA;
          a.y -= ny * separation * ratioA;
          b.x += nx * separation * ratioB;
          b.y += ny * separation * ratioB;

          // 速度冲量
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal < 0) {
            const impulse = -(1 + RESTITUTION) * velAlongNormal / (1 / a.mass + 1 / b.mass);
            a.vx -= (impulse / a.mass) * nx;
            a.vy -= (impulse / a.mass) * ny;
            b.vx += (impulse / b.mass) * nx;
            b.vy += (impulse / b.mass) * ny;
          }
        }
      }
    }
  }

  // 清除已合体云朵并加入合成出的新云朵
  if (mergedIds.size > 0) {
    const keep = [];
    for (let i = 0; i < state.clouds.length; i += 1) {
      const c = state.clouds[i];
      if (!mergedIds.has(c.id)) {
        keep.push(c);
      }
    }

    for (const evt of events) {
      if (evt.type === "merge") {
        keep.push(evt.cloud);
      }
    }
    state.clouds = keep;
  }
}

/**
 * L8 雷暴云下雨清场核心微创新：
 * 雷暴云生成时，向下喷射雨幕，清开正下方圆柱范围内的挤压云朵。
 */
function triggerThunderstormRain(state, stormCloud, events, mergedIds) {
  const columnHalfWidth = stormCloud.radius * 0.8;
  const minX = stormCloud.x - columnHalfWidth;
  const maxX = stormCloud.x + columnHalfWidth;
  const minY = stormCloud.y + 10;

  const clearedClouds = [];

  for (let i = 0; i < state.clouds.length; i += 1) {
    const c = state.clouds[i];
    if (mergedIds && mergedIds.has(c.id)) continue;
    if (c.id === stormCloud.id) continue;

    // 清除正下方、等级小于 8 的云朵（避免吞掉雷暴或彩虹）
    if (c.y > minY && c.x >= minX - c.radius * 0.5 && c.x <= maxX + c.radius * 0.5 && c.level < 8) {
      clearedClouds.push(c);
      if (clearedClouds.length >= 4) break; // 一次最多清 4 朵，保持平衡
    }
  }

  if (clearedClouds.length > 0) {
    for (const c of clearedClouds) {
      if (mergedIds) mergedIds.add(c.id);
    }

    const rainPoints = rainClearScore(clearedClouds.length);
    state.score += rainPoints;

    events.push({
      type: "rain_clear",
      source: { ...stormCloud },
      cleared: clearedClouds.map((c) => ({ ...c })),
      points: rainPoints,
    });
  }

  state.rainActiveUntil = state.timeElapsed + 1.2;
  state.rainSourceX = stormCloud.x;
  state.rainSourceY = stormCloud.y;
}

/**
 * 安全红线判定：云朵静止超过安全线，且持续超过 DANGER_LIMIT，触发游戏结算
 */
function checkSafetyThreshold(state, events, dt) {
  let anyAbove = false;
  const count = state.clouds.length;

  for (let i = 0; i < count; i += 1) {
    const c = state.clouds[i];
    // 刚生成的云朵有免死保护期
    if (c.age < DANGER_AGE) continue;

    // 顶点超过警戒线且速度稳定
    if (c.y - c.radius < SAFETY_Y && Math.abs(c.vy) < 25) {
      anyAbove = true;
      break;
    }
  }

  if (anyAbove) {
    state.isDanger = true;
    state.dangerTimer += dt;
    if (state.dangerTimer >= DANGER_LIMIT) {
      state.status = STATUS.over;
      events.push({
        type: "game_over",
        score: state.score,
        maxLevel: state.maxLevelReached,
        maxChain: state.maxChainCombo,
        rainbows: state.rainbowsCollected,
      });
    }
  } else {
    state.isDanger = false;
    state.dangerTimer = Math.max(0, state.dangerTimer - dt * 1.5);
  }
}
