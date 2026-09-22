// 莓园打地鼠 — 规则引擎（DOM-free：不碰 document / window / localStorage）
// 纯状态机 + 确定性 PRNG，可被 node:test 直接驱动。

import { hitPoints, applyBombPenalty, comboMultiplier } from "./score.mjs";

export const SPECIES = Object.freeze({
  NORMAL: "normal",   // 普通地鼠
  GOLD: "gold",       // 金鼠：分高、露头短
  HELMET: "helmet",   // 铁盔鼠：需两击（第一击掀盔）
  BOMB: "bomb",       // 炸弹鼠：禁打，误击扣分并清连击
});

export const SPECIES_LIST = Object.freeze([SPECIES.NORMAL, SPECIES.GOLD, SPECIES.HELMET, SPECIES.BOMB]);

export const PHASE = Object.freeze({ RISE: "rise", UP: "up", DUCK: "duck" });

/**
 * 冒头时长：地鼠从地平线爬升到位的时长（毫秒）。
 * 必须能被人眼看清"钻出来"的过程，不能是瞬移。
 * 与 style.css 的 `--rise-ms` 保持一致（layout.test.mjs 会校验两者不脱钩）。
 */
export const RISE_MS = 220;
export const DUCK_MS = 150;
/** 露头时长下限（公平性红线：人类视觉反应中位数约 250ms，这里留足余量） */
export const MIN_UP_MS = 450;
export const FRENZY_MS = 4000;
export const FRENZY_COMBO_STEP = 20;
/** 狂热期地鼠计时流速（<1 = 变慢，给玩家从容收割） */
export const FRENZY_SLOW = 0.62;
export const HELMET_HP = 2;

export const DIFFICULTY_IDS = Object.freeze(["easy", "normal", "crazy"]);

export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: "easy",
    durationMs: 60000,
    upMs: [1000, 1250],
    gapMs: [720, 1100],
    maxUp: 2,
    weights: Object.freeze({ normal: 0.88, gold: 0.12, helmet: 0, bomb: 0 }),
  }),
  normal: Object.freeze({
    id: "normal",
    durationMs: 60000,
    upMs: [780, 980],
    gapMs: [520, 860],
    maxUp: 3,
    weights: Object.freeze({ normal: 0.66, gold: 0.14, helmet: 0.1, bomb: 0.1 }),
  }),
  crazy: Object.freeze({
    id: "crazy",
    durationMs: 60000,
    upMs: [660, 800],
    gapMs: [340, 580],
    maxUp: 4,
    weights: Object.freeze({ normal: 0.5, gold: 0.16, helmet: 0.14, bomb: 0.2 }),
  }),
});

export const DEFAULT_ROWS = 3;
export const DEFAULT_COLS = 4;

/** mulberry32：确定性 PRNG，注入种子即可复现整局 */
export function mulberry32(seed) {
  let a = (Number.isFinite(seed) ? Math.floor(seed) : 1) >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 每日题面种子：同一天全球同题 */
export function dailySeed(dateStr) {
  const text = String(dateStr ?? "");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) || 1;
}

export function todayKey(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 取难度配置，非法 id 回退 normal */
export function difficultyConfig(id) {
  return DIFFICULTIES[id] ?? DIFFICULTIES.normal;
}

function randBetween(rng, [min, max]) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + rng() * (hi - lo);
}

/** 按权重抽鼠种；ban 用于公平性约束（如"场上已无非炸弹目标"时禁出炸弹） */
export function pickSpecies(rng, weights, banBomb = false) {
  const pool = SPECIES_LIST.filter((s) => (banBomb ? s !== SPECIES.BOMB : true));
  const total = pool.reduce((sum, s) => sum + Math.max(0, weights[s] ?? 0), 0);
  if (total <= 0) return SPECIES.NORMAL;
  let roll = rng() * total;
  for (const s of pool) {
    roll -= Math.max(0, weights[s] ?? 0);
    if (roll <= 0) return s;
  }
  return pool[pool.length - 1];
}

function upDurationFor(rng, cfg, species) {
  const base = randBetween(rng, cfg.upMs);
  const scale = species === SPECIES.GOLD ? 0.7 : species === SPECIES.HELMET ? 1.35 : 1;
  return Math.max(MIN_UP_MS, Math.round(base * scale));
}

export function createRun(options = {}) {
  const cfg = difficultyConfig(options.difficulty);
  const rows = Math.max(1, Math.floor(options.rows ?? DEFAULT_ROWS));
  const cols = Math.max(1, Math.floor(options.cols ?? DEFAULT_COLS));
  const holeCount = rows * cols;
  const maxUp = Math.max(1, Math.min(cfg.maxUp, Math.max(1, holeCount - 2)));

  return {
    difficulty: cfg.id,
    daily: Boolean(options.daily),
    seed: Math.floor(options.seed ?? 1) >>> 0,
    rows,
    cols,
    holeCount,
    maxUp,
    status: "running", // running | over
    timeLeftMs: Math.floor(options.durationMs ?? cfg.durationMs),
    elapsedMs: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,
    misses: 0,
    bombs: 0,
    frenzyLeftMs: 0,
    frenzyCount: 0,
    spawnTimerMs: 320, // 开局给一点准备时间
    holes: new Array(holeCount).fill(null),
    nextId: 1,
    events: [],
    rng: mulberry32(options.seed ?? 1),
  };
}

export function activeMoles(state) {
  const list = [];
  for (let i = 0; i < state.holes.length; i += 1) {
    const mole = state.holes[i];
    if (mole && mole.phase !== PHASE.DUCK) list.push({ index: i, mole });
  }
  return list;
}

/** 场上是否还有"可打"目标（炸弹鼠不算） */
export function hasHittableTarget(state) {
  return activeMoles(state).some(({ mole }) => mole.species !== SPECIES.BOMB);
}

export function freeHoleIndexes(state) {
  const list = [];
  for (let i = 0; i < state.holes.length; i += 1) {
    if (!state.holes[i]) list.push(i);
  }
  return list;
}

function spawnOne(state) {
  const cfg = difficultyConfig(state.difficulty);
  const free = freeHoleIndexes(state);
  if (free.length === 0) return null;
  // 公平性：场上若已无非炸弹目标，本次强制不出炸弹，绝不让玩家陷入"只能挨罚"的帧
  const banBomb = !hasHittableTarget(state);
  const species = pickSpecies(state.rng, cfg.weights, banBomb);
  const index = free[Math.floor(state.rng() * free.length) % free.length];
  const mole = {
    id: state.nextId++,
    species,
    phase: PHASE.RISE,
    t: 0,
    upMs: upDurationFor(state.rng, cfg, species),
    hp: species === SPECIES.HELMET ? HELMET_HP : 1,
  };
  state.holes[index] = mole;
  state.events.push({ type: "spawn", index, species });
  return { index, mole };
}

/**
 * 推进一帧。dt 建议 ≤ 100ms（大跳会被钳制，防止切后台回来一次性结算）。
 * 非 running 状态调用为 no-op（不抛错）。
 */
export function stepRun(state, dtMs) {
  state.events = [];
  if (!state || state.status !== "running") return state;

  const dt = Math.max(0, Math.min(100, Number(dtMs) || 0));
  state.elapsedMs += dt;
  state.timeLeftMs -= dt;

  if (state.frenzyLeftMs > 0) {
    state.frenzyLeftMs = Math.max(0, state.frenzyLeftMs - dt);
    if (state.frenzyLeftMs === 0) state.events.push({ type: "frenzyEnd" });
  }

  const moleDt = state.frenzyLeftMs > 0 ? dt * FRENZY_SLOW : dt;

  for (let i = 0; i < state.holes.length; i += 1) {
    const mole = state.holes[i];
    if (!mole) continue;
    mole.t += moleDt;
    if (mole.phase === PHASE.RISE && mole.t >= RISE_MS) {
      mole.phase = PHASE.UP;
      mole.t = 0;
      state.events.push({ type: "up", index: i, species: mole.species });
    } else if (mole.phase === PHASE.UP && mole.t >= mole.upMs) {
      mole.phase = PHASE.DUCK;
      mole.t = 0;
      // 漏掉：炸弹鼠缩回是"守住了"，不算失误
      if (mole.species !== SPECIES.BOMB) {
        state.misses += 1;
        state.combo = 0;
        state.events.push({ type: "miss", index: i, species: mole.species });
      } else {
        state.events.push({ type: "dodge", index: i });
      }
    } else if (mole.phase === PHASE.DUCK && mole.t >= DUCK_MS) {
      state.holes[i] = null;
      state.events.push({ type: "clear", index: i });
    }
  }

  state.spawnTimerMs -= dt;
  if (state.spawnTimerMs <= 0) {
    const active = activeMoles(state).length;
    if (active < state.maxUp) spawnOne(state);
    const cfg = difficultyConfig(state.difficulty);
    state.spawnTimerMs = randBetween(state.rng, cfg.gapMs);
  }

  if (state.timeLeftMs <= 0) {
    state.timeLeftMs = 0;
    state.status = "over";
    state.events.push({ type: "over" });
  }
  return state;
}

/**
 * 敲击一个洞位。返回 { ok, kind, points, combo, index, species }。
 * kind: 'hit' | 'gold' | 'helmetBlock' | 'helmet' | 'bomb' | 'empty' | 'idle'
 * 非法意图（空洞、已结束）返回 ok:false，UI 静默忽略，绝不抛错。
 */
export function hitHole(state, index) {
  if (!state || state.status !== "running") return { ok: false, kind: "idle", index, points: 0 };
  const i = Math.floor(index);
  if (!Number.isFinite(i) || i < 0 || i >= state.holes.length) {
    return { ok: false, kind: "empty", index: i, points: 0 };
  }

  const mole = state.holes[i];
  if (!mole || mole.phase === PHASE.DUCK) {
    return { ok: false, kind: "empty", index: i, points: 0 };
  }

  const frenzy = state.frenzyLeftMs > 0;

  if (mole.species === SPECIES.BOMB) {
    state.bombs += 1;
    state.combo = 0;
    state.score = applyBombPenalty(state.score);
    mole.phase = PHASE.DUCK;
    mole.t = 0;
    state.events.push({ type: "bomb", index: i });
    return { ok: true, kind: "bomb", index: i, species: mole.species, points: -3, combo: 0, frenzy };
  }

  if (mole.species === SPECIES.HELMET && mole.hp > 1) {
    mole.hp -= 1;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.hits += 1;
    const points = hitPoints(mole.species, state.combo, { frenzy, isBlock: true });
    state.score += points;
    maybeStartFrenzy(state);
    state.events.push({ type: "block", index: i });
    return { ok: true, kind: "helmetBlock", index: i, species: mole.species, points, combo: state.combo, frenzy };
  }

  state.combo += 1;
  state.maxCombo = Math.max(state.maxCombo, state.combo);
  state.hits += 1;
  const points = hitPoints(mole.species, state.combo, { frenzy });
  state.score += points;
  const kind = mole.species === SPECIES.GOLD ? "gold" : mole.species === SPECIES.HELMET ? "helmet" : "hit";
  mole.phase = PHASE.DUCK;
  mole.t = 0;
  maybeStartFrenzy(state);
  state.events.push({ type: "hit", index: i, species: mole.species, points });
  return { ok: true, kind, index: i, species: mole.species, points, combo: state.combo, frenzy };
}

function maybeStartFrenzy(state) {
  if (state.frenzyLeftMs > 0) return;
  if (state.combo > 0 && state.combo % FRENZY_COMBO_STEP === 0) {
    state.frenzyLeftMs = FRENZY_MS;
    state.frenzyCount += 1;
    state.events.push({ type: "frenzyStart", combo: state.combo });
  }
}

export function isOver(state) {
  return Boolean(state) && state.status === "over";
}

/** 剩余秒数（向上取整，HUD 用） */
export function secondsLeft(state) {
  return Math.max(0, Math.ceil((state?.timeLeftMs ?? 0) / 1000));
}

/** 当前连击倍率（转发 score 口径，UI 不自己算） */
export function currentMultiplier(state) {
  return comboMultiplier(state?.combo ?? 0);
}
