// engine：数字合成大西瓜规则唯一权威，纯函数，与页面 / 渲染 / 存储解耦（不碰任何宿主对象）。
// stepFrame 每次推进恰好一个 FIXED_DT；离散操作走 applyIntent；两者都返回 { state, events, action }。
// action === null 表示“这一步没生效”，合法操作永不抛错；rng 可注入，掉落序列与物理因此可复现。
// 状态就地修改：引擎是唯一写入方，渲染 / UI 只读。

import { harvestScore, mergeScore } from "./score.mjs?v=dev";

// —— 世界与容器（逻辑单位，渲染层等比缩放）——
export const WORLD = Object.freeze({ width: 440, height: 660 });
export const WALL = 14;
export const SAFETY_Y = 132;
export const DROP_Y = 72;

// —— 固定时间步 ——
export const FIXED_DT = 1 / 120;
export const MAX_SUBSTEPS = 6;

// —— 数字水果链（11 级）——
export const MAX_LEVEL = 11;
export const LEVEL_COUNT = 11;
export const RADII = Object.freeze([17, 22, 28, 35, 43, 52, 61, 70, 79, 87, 96]);
// 每级数字值：2 樱桃 → 4 草莓 → 8 葡萄 → 16 柠檬 → 32 橙 → 64 苹果 → 128 蜜桃 → 256 菠萝 → 512 甜瓜 → 1024 半个大西瓜 → 2048 大西瓜
export const LEVEL_VALUES = Object.freeze([2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048]);

// 每级水果外观（主色 / 高光色，纯数据，供 render / ui / 图鉴 / 预览复用；engine 不绘制）。
export const FRUIT_STYLE = Object.freeze([
  Object.freeze({ color: "#e8434f", glow: "#ff9aa2", juice: "#ffd3d6" }),   // 2 樱桃
  Object.freeze({ color: "#ff5e7a", glow: "#ffb3c2", juice: "#ffe3ea" }),   // 4 草莓
  Object.freeze({ color: "#8e5bd6", glow: "#c9a6ff", juice: "#eadfff" }),   // 8 葡萄
  Object.freeze({ color: "#ffcf2e", glow: "#ffef9e", juice: "#fff7d6" }),   // 16 柠檬
  Object.freeze({ color: "#ff9f3c", glow: "#ffd9a8", juice: "#ffedda" }),   // 32 橙
  Object.freeze({ color: "#ef4444", glow: "#ffa3a3", juice: "#ffdada" }),   // 64 苹果
  Object.freeze({ color: "#ffb37a", glow: "#ffdcc0", juice: "#ffefe3" }),   // 128 蜜桃
  Object.freeze({ color: "#f7b733", glow: "#ffe9a8", juice: "#fff3d3" }),   // 256 菠萝
  Object.freeze({ color: "#8fdc8f", glow: "#d3f5d3", juice: "#eaffea" }),   // 512 甜瓜
  Object.freeze({ color: "#3dae5a", glow: "#a8e6a8", juice: "#d2f4d2" }),   // 1024 半个大西瓜
  Object.freeze({ color: "#2e8b4f", glow: "#9fe8b0", juice: "#d6f7de" }),   // 2048 大西瓜
]);

// —— 掉落池：前期只出 2 / 4，合出 16（L4）后解锁 8 ——
export const DROP_WEIGHTS = Object.freeze([11, 7, 3]); // L1..L3
export const START_POOL = 2;
export const CAP_POOL = 3;
export const POOL_UNLOCK_LEVEL = 4; // 合出过 L4(16) → 开放 L3(8) 掉落

// —— 物理手感（果园滚动：弹性适中、略带摩擦，落定干脆）——
export const GRAVITY = 1400;
export const RESTITUTION = 0.36;
export const WALL_RESTITUTION = 0.46;
export const AIR_DRAG = 0.9995;
export const FLOOR_TANGENT = 0.985;
export const SLEEP_SPEED = 3;
export const FLOOR_SETTLE = 28;
export const WALL_SETTLE = 20;
export const SOLVER_ITER = 6;
export const MAX_CORRECTION = 0.8;
export const MERGE_ITER = 24;

// —— 规则时序 ——
export const DROP_COOLDOWN = 0.5;
export const DANGER_LIMIT = 2.2;
export const DANGER_AGE = 0.9;
export const CHAIN_WINDOW = 0.7;
export const AIM_STEP = 6;
export const MAX_FRUITS = 220;

export const STATUS = Object.freeze({ ready: "ready", playing: "playing", over: "over" });

// —— 确定性 PRNG ——
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

// FNV-1a 32 位字符串散列。
export function hashSeed(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// 每日挑战：同日同题（同掉落序列）。
export function dailySeed(dateStr) {
  return hashSeed(`watermelon-2048:daily:${dateStr}`);
}

export function levelRadius(level) {
  const lv = Math.trunc(Number(level));
  if (!Number.isFinite(lv)) return RADII[0];
  return RADII[Math.max(1, Math.min(MAX_LEVEL, lv)) - 1];
}

export function levelValue(level) {
  const lv = Math.trunc(Number(level));
  if (!Number.isFinite(lv)) return LEVEL_VALUES[0];
  return LEVEL_VALUES[Math.max(1, Math.min(MAX_LEVEL, lv)) - 1];
}

export function clampAimX(x, level) {
  const r = levelRadius(level);
  const min = WALL + r;
  const max = WORLD.width - WALL - r;
  const nx = Number(x);
  if (!Number.isFinite(nx)) return (min + max) / 2;
  return Math.max(min, Math.min(max, nx));
}

export function poolMaxFor(maxLevel) {
  return Number(maxLevel) >= POOL_UNLOCK_LEVEL ? CAP_POOL : START_POOL;
}

// 加权随机取一个可掉落等级（1..poolMax）。
export function nextDropLevel(rng, state) {
  const poolMax = poolMaxFor(state ? state.maxLevel : 0);
  const useRng = typeof rng === "function" ? rng : Math.random;
  let total = 0;
  for (let lv = 1; lv <= poolMax; lv += 1) total += DROP_WEIGHTS[lv - 1];
  let pick = useRng() * total;
  for (let lv = 1; lv <= poolMax; lv += 1) {
    pick -= DROP_WEIGHTS[lv - 1];
    if (pick <= 0) return lv;
  }
  return poolMax;
}

export function createState(run = {}, { rng = Math.random, mode = "endless", seed = null } = {}) {
  const useRng = typeof rng === "function" ? rng : Math.random;
  const m = mode === "daily" ? "daily" : "endless";
  const bootstrap = { maxLevel: 0 };
  return {
    mode: m,
    seed: Number.isFinite(seed) ? seed >>> 0 : null,
    status: STATUS.ready,
    paused: false,
    fruits: [],
    current: nextDropLevel(useRng, bootstrap),
    next: nextDropLevel(useRng, bootstrap),
    aimX: WORLD.width / 2,
    dropCooldown: 0,
    score: 0,
    maxLevel: 0,
    maxChain: 0,
    chain: 0,
    sinceMerge: CHAIN_WINDOW,
    dangerTime: 0,
    nextId: 1,
    harvested: 0,
    first2048At: null, // 首次合出 2048 时的 elapsed（最快达成纪录）
    elapsed: 0,
  };
}

export function isRunning(state) {
  return !!state && state.status === STATUS.playing && !state.paused;
}

function massOf(f) {
  return f.r * f.r;
}

function makeFruit(state, level, x, y, vx, vy, age, squash) {
  return {
    id: state.nextId++,
    level,
    x,
    y,
    vx,
    vy,
    r: levelRadius(level),
    age,
    squash,
  };
}

function integrate(f, dt) {
  f.vy += GRAVITY * dt;
  f.vx *= AIR_DRAG;
  f.vy *= AIR_DRAG;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  f.age += dt;
  if (f.squash > 0) f.squash = Math.max(0, f.squash - dt * 3.4);
}

// 墙 / 地约束：位置钳制保证不穿模；小速度归零抑制堆叠抖动；顶部开放（仅软上限）。
function constrainWalls(f) {
  const minX = WALL + f.r;
  const maxX = WORLD.width - WALL - f.r;
  const floorY = WORLD.height - WALL - f.r;

  if (f.x < minX) {
    f.x = minX;
    if (f.vx < 0) {
      f.vx = -f.vx * WALL_RESTITUTION;
      if (f.vx < WALL_SETTLE) f.vx = 0;
    }
  } else if (f.x > maxX) {
    f.x = maxX;
    if (f.vx > 0) {
      f.vx = -f.vx * WALL_RESTITUTION;
      if (f.vx > -WALL_SETTLE) f.vx = 0;
    }
  }

  if (f.y > floorY) {
    f.y = floorY;
    if (f.vy > 0) {
      f.vy = -f.vy * WALL_RESTITUTION;
      if (f.vy > -FLOOR_SETTLE) f.vy = 0;
    }
    f.vx *= FLOOR_TANGENT;
  }

  const ceiling = -f.r * 2.5;
  if (f.y < ceiling) {
    f.y = ceiling;
    if (f.vy < 0) f.vy = 0;
  }

  if (Math.hypot(f.vx, f.vy) < SLEEP_SPEED) {
    f.vx = 0;
    f.vy = 0;
  }
}

// 圆-圆碰撞求解（多次迭代稳定堆叠）。只修正位置 / 速度，不在此处合并。
function solveCollisions(fruits) {
  for (let iter = 0; iter < SOLVER_ITER; iter += 1) {
    let moved = false;
    for (let i = 0; i < fruits.length; i += 1) {
      const a = fruits[i];
      for (let j = i + 1; j < fruits.length; j += 1) {
        const b = fruits[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const minDist = a.r + b.r;
        if (dist >= minDist) continue;
        // 可合成的同级对交给 passMerge 处理，不在这里弹开，否则会被先分离导致永不合并。
        if (a.level === b.level && a.level < MAX_LEVEL) continue;
        if (dist < 1e-6) {
          dx = minDist * 0.5;
          dy = 0;
          dist = minDist * 0.5;
        }
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        const invA = 1 / massOf(a);
        const invB = 1 / massOf(b);
        const invSum = invA + invB;

        const corr = overlap * MAX_CORRECTION;
        a.x -= nx * corr * (invA / invSum);
        a.y -= ny * corr * (invA / invSum);
        b.x += nx * corr * (invB / invSum);
        b.y += ny * corr * (invB / invSum);

        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const velNormal = rvx * nx + rvy * ny;
        if (velNormal < 0) {
          const jImp = (-(1 + RESTITUTION) * velNormal) / invSum;
          const ix = jImp * nx;
          const iy = jImp * ny;
          a.vx -= ix * invA;
          a.vy -= iy * invA;
          b.vx += ix * invB;
          b.vy += iy * invB;
          const impact = Math.min(1, Math.abs(velNormal) / 240);
          if (impact > a.squash) a.squash = impact;
          if (impact > b.squash) b.squash = impact;
        }
        moved = true;
      }
    }
    for (let k = 0; k < fruits.length; k += 1) constrainWalls(fruits[k]);
    if (!moved) break;
  }
}

// 扫描一对可合并的同级水果，合并为高一级（中点 + 动量平均），返回是否发生了合并。
function passMerge(state, events) {
  const fruits = state.fruits;
  for (let i = 0; i < fruits.length; i += 1) {
    const a = fruits[i];
    if (a.level >= MAX_LEVEL) continue;
    for (let j = i + 1; j < fruits.length; j += 1) {
      const b = fruits[j];
      if (b.level !== a.level) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.hypot(dx, dy) >= a.r + b.r) continue;

      const ma = massOf(a);
      const mb = massOf(b);
      const total = ma + mb;
      const newLevel = a.level + 1;
      const mx = (a.x * ma + b.x * mb) / total;
      const my = (a.y * ma + b.y * mb) / total;
      const mvx = (a.vx * ma + b.vx * mb) / total;
      const mvy = (a.vy * ma + b.vy * mb) / total;

      fruits.splice(j, 1);
      fruits.splice(i, 1);
      const merged = makeFruit(state, newLevel, mx, my, mvx, mvy, 0, 1);
      fruits.push(merged);

      const chainIndex = state.chain;
      state.chain += 1;
      state.sinceMerge = 0;
      const gained = mergeScore(newLevel, chainIndex);
      state.score += gained;
      if (newLevel > state.maxLevel) state.maxLevel = newLevel;
      if (state.chain > state.maxChain) state.maxChain = state.chain;
      if (newLevel === MAX_LEVEL && state.first2048At === null) {
        state.first2048At = state.elapsed;
      }
      events.push({
        type: "merge",
        level: newLevel,
        value: levelValue(newLevel),
        x: mx,
        y: my,
        chainIndex,
        gained,
        id: merged.id,
      });
      return true;
    }
  }
  return false;
}

function updateDanger(state, dt, events) {
  let inDanger = false;
  for (let i = 0; i < state.fruits.length; i += 1) {
    const f = state.fruits[i];
    if (f.age > DANGER_AGE && f.y - f.r < SAFETY_Y) {
      inDanger = true;
      break;
    }
  }
  if (inDanger) {
    const was = state.dangerTime;
    state.dangerTime += dt;
    if (was <= 0) events.push({ type: "dangerStart" });
    if (state.dangerTime > DANGER_LIMIT && state.status === STATUS.playing) {
      state.status = STATUS.over;
      events.push({
        type: "roundEnd",
        score: state.score,
        maxLevel: state.maxLevel,
        maxChain: state.maxChain,
        harvested: state.harvested,
        time: state.first2048At === null ? 0 : state.first2048At,
        mode: state.mode,
      });
    }
  } else if (state.dangerTime > 0) {
    state.dangerTime = Math.max(0, state.dangerTime - dt * 1.5);
    if (state.dangerTime === 0) events.push({ type: "dangerEnd" });
  }
}

function isSpawnBlocked(state, x, y, r) {
  for (let i = 0; i < state.fruits.length; i += 1) {
    const f = state.fruits[i];
    if (Math.hypot(f.x - x, f.y - y) < f.r + r - 0.5) return true;
  }
  return false;
}

function findHarvestTarget(state, x, y) {
  const px = Number(x);
  const py = Number(y);
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  for (let i = state.fruits.length - 1; i >= 0; i -= 1) {
    const f = state.fruits[i];
    if (f.level !== MAX_LEVEL) continue;
    if (Math.hypot(f.x - px, f.y - py) <= f.r) return f;
  }
  return null;
}

// 指针落点是否命中一枚可摘的 2048 大西瓜。供 UI 在「摘瓜 / 丢弃」间分流，复用同一权威判定。
export function harvestTargetAt(state, x, y) {
  return !!findHarvestTarget(state, x, y);
}

// 每帧推进一个固定步：时序 → 积分 → 碰撞 → 合并连锁 → 超线判定。
export function stepFrame(state, { rng = Math.random } = {}) {
  const events = [];
  if (!isRunning(state)) return { state, events, action: null };
  const dt = FIXED_DT;

  state.elapsed += dt;
  if (state.dropCooldown > 0) state.dropCooldown = Math.max(0, state.dropCooldown - dt);

  state.sinceMerge += dt;
  if (state.sinceMerge >= CHAIN_WINDOW && state.chain > 0) state.chain = 0;

  for (let i = 0; i < state.fruits.length; i += 1) integrate(state.fruits[i], dt);
  solveCollisions(state.fruits);

  let merges = 0;
  while (merges < MERGE_ITER && passMerge(state, events)) merges += 1;
  if (merges > 0) {
    for (let i = 0; i < state.fruits.length; i += 1) constrainWalls(state.fruits[i]);
  }

  updateDanger(state, dt, events);
  return { state, events, action: "step" };
}

export function applyIntent(state, intent, { rng = Math.random } = {}) {
  const events = [];
  const type = intent && intent.type;
  const useRng = typeof rng === "function" ? rng : Math.random;

  if (type === "start") {
    if (state.status !== STATUS.ready) return { state, events, action: null };
    state.status = STATUS.playing;
    events.push({ type: "start", mode: state.mode });
    return { state, events, action: "start" };
  }

  if (type === "restart") {
    const fresh = createState({}, { rng: useRng, mode: state.mode, seed: state.seed });
    fresh.status = STATUS.playing;
    events.push({ type: "start", mode: fresh.mode, restart: true });
    return { state: fresh, events, action: "restart" };
  }

  if (type === "pause" || type === "resume" || type === "togglePause") {
    if (state.status !== STATUS.playing) return { state, events, action: null };
    const wantPause = type === "togglePause" ? !state.paused : type === "pause";
    if (wantPause === state.paused) return { state, events, action: null };
    state.paused = wantPause;
    events.push({ type: wantPause ? "paused" : "resumed" });
    return { state, events, action: type };
  }

  if (!isRunning(state)) return { state, events, action: null };

  if (type === "aim") {
    state.aimX = clampAimX(intent.x, state.current);
    return { state, events, action: "aim" };
  }

  if (type === "drop") {
    if (state.dropCooldown > 0) {
      events.push({ type: "deny", reason: "cooldown" });
      return { state, events, action: null };
    }
    const r = levelRadius(state.current);
    const rawX = intent && Number.isFinite(intent.x) ? intent.x : state.aimX;
    const x = clampAimX(rawX, state.current);
    if (isSpawnBlocked(state, x, DROP_Y, r)) {
      events.push({ type: "deny", reason: "blocked" });
      return { state, events, action: null };
    }
    if (state.fruits.length >= MAX_FRUITS) {
      events.push({ type: "deny", reason: "full" });
      return { state, events, action: null };
    }
    const fruit = makeFruit(state, state.current, x, DROP_Y, 0, 0, 0, 0);
    state.fruits.push(fruit);
    state.current = state.next;
    state.next = nextDropLevel(useRng, state);
    state.aimX = clampAimX(state.aimX, state.current);
    state.dropCooldown = DROP_COOLDOWN;
    events.push({ type: "drop", level: fruit.level, x, y: DROP_Y, id: fruit.id });
    return { state, events, action: "drop" };
  }

  if (type === "harvest") {
    const target = findHarvestTarget(state, intent.x, intent.y);
    if (!target) {
      events.push({ type: "deny", reason: "noHarvest" });
      return { state, events, action: null };
    }
    const idx = state.fruits.indexOf(target);
    if (idx >= 0) state.fruits.splice(idx, 1);
    const gained = harvestScore();
    state.score += gained;
    state.harvested += 1;
    events.push({ type: "harvest", x: target.x, y: target.y, level: target.level, gained, id: target.id });
    return { state, events, action: "harvest" };
  }

  return { state, events, action: null };
}
