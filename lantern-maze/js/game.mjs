// game.mjs —— DOM-free 状态控制器：四种玩法的模式编排、更次推进、结算与事件分发。只调度 engine，不碰 DOM。

import {
  createState,
  stepFrame,
  intent,
  drainEvents,
  isTerminal,
  addTime,
  loseTime,
  ghostStateKey,
  WICK,
  DASH,
} from "./engine.mjs";
import { LEVEL_COUNT, LEVELS_PER_WATCH, ROSTERS, PHASES, TIME_POOL, ARENA_LAYOUT, levelById, rowsForLevel } from "./levels.mjs";
import { rateRun, formatScore, fruitValueForWatch, clampInt, SCORE_MAX } from "./score.mjs";

export const MODES = ["campaign", "timed", "survival", "workshop"];

/** 破晓冲刺的时间账：清巷续 40s，吞影续 2s，熄灯扣 15s */
export const TIMED = { startMs: 120000, maxMs: 180000, clearMs: 40000, ghostMs: 2000, deathMs: 15000 };
/** 百鬼夜巷的增援节奏：每 60 秒补一只，最多 8 只 */
export const SURVIVAL = { roundMs: 60000, maxGhosts: 8 };

const ENGINE_MODE = { campaign: "campaign", timed: "timed", survival: "survival", workshop: "custom" };

function clamp01(n) {
  return Math.max(0, Math.min(1, Number(n) || 0));
}

function roster(name) {
  return (ROSTERS[name] ?? ROSTERS.classic).map((r) => ({ ...r }));
}

/** 按模式拼 engine 的 cfg：主线直接用人物表，其余现场组装递进曲线 */
function cfgFor(g) {
  if (g.mode === "campaign") {
    const lvl = levelById(g.levelId) ?? levelById(1);
    return { ...lvl, roster: lvl.roster.map((r) => ({ ...r })), fog: g.assist.fog === false ? 0 : lvl.fog ?? 0 };
  }
  const watch = Math.min(5, 1 + Math.floor(g.lanesCleared / 4));
  if (g.mode === "timed") {
    return {
      roster: roster("classic"),
      phases: PHASES(9000, 15000, 2),
      frightMs: Math.max(2200, 5000 - g.lanesCleared * 300),
      ghostSpeedMul: Math.min(1.08, 0.94 + g.lanesCleared * 0.02),
      playerSpeedMul: 1,
      fog: 0,
      startLives: 3,
      timed: TIMED.startMs,
      timedMax: TIMED.maxMs,
      release: [0, 4000, 12000, 20000],
      fruitAt: [70, 170],
      fruitValue: fruitValueForWatch(watch),
      parMs: 60000,
      watch,
      level: g.lanesCleared + 1,
    };
  }
  if (g.mode === "survival") {
    return {
      roster: roster("classic"),
      phases: PHASES(10000, 14000, 3),
      frightMs: Math.max(1800, 4000 - g.round * 200),
      ghostSpeedMul: Math.min(1.1, 0.94 + g.round * 0.03),
      playerSpeedMul: 1,
      fog: 0,
      startLives: 3,
      release: [0, 3000, 9000, 15000],
      respawnDots: true,
      roundMs: SURVIVAL.roundMs,
      maxGhosts: SURVIVAL.maxGhosts,
      fruitAt: [70, 170],
      fruitValue: fruitValueForWatch(watch),
      parMs: 0,
      watch,
      level: g.round,
    };
  }
  return {
    roster: roster(g.rosterName ?? "classic"),
    phases: PHASES(9000, 15000, 2),
    frightMs: 5000,
    ghostSpeedMul: clampInt(g.speed, 60, 130, 100) / 100,
    playerSpeedMul: 1,
    fog: 0,
    startLives: 3,
    release: [0, 4000, 12000, 20000],
    fruitAt: [70, 170],
    fruitValue: 500,
    parMs: 78000,
    watch: 3,
    level: 1,
  };
}

function rowsFor(g) {
  if (g.customRows) return g.customRows;
  if (g.mode === "campaign") return rowsForLevel(g.levelId);
  if (g.mode === "survival") return g.layoutTable[ARENA_LAYOUT];
  if (g.mode === "timed") return g.layoutTable[TIME_POOL[g.laneIdx % TIME_POOL.length]];
  return null;
}

function carryStats(from, to) {
  if (!from) return to;
  to.score = Math.min(SCORE_MAX, to.score + from.score);
  to.eatenTotal += from.eatenTotal;
  to.deaths += from.deaths;
  to.extraLifeGiven = from.extraLifeGiven;
  for (const k of ["ghostsEaten", "pearlsEaten", "fruits"]) to.stats[k] += from.stats[k];
  to.stats.longestTrain = Math.max(to.stats.longestTrain, from.stats.longestTrain);
  to.stats.bestChain = Math.max(to.stats.bestChain, from.stats.bestChain);
  return to;
}

/**
 * @param {object} opts { mode, levelId, rows, layoutTable, code, seed, assist, rosterName, speed }
 */
export function createGame(opts = {}) {
  const g = {
    mode: MODES.includes(opts.mode) ? opts.mode : "campaign",
    levelId: clampInt(opts.levelId, 1, LEVEL_COUNT, 1),
    customRows: opts.rows ?? null,
    code: opts.code ?? null,
    layoutTable: opts.layoutTable ?? {},
    assist: { fog: true, ...(opts.assist ?? {}) },
    rosterName: opts.rosterName ?? null,
    speed: opts.speed ?? 100,
    seed: opts.seed ?? 20260915,
    laneIdx: 0,
    lanesCleared: 0,
    chain: 0,
    bestChainRun: 0,
    round: 1,
    state: null,
    total: 0,
    result: null,
    listeners: [],
  };

  function build(keep) {
    const rows = rowsFor(g);
    if (!rows) return null;
    const salt = g.mode === "campaign" ? g.levelId * 977 : g.lanesCleared * 613 + g.round * 31 + g.laneIdx * 7;
    const next = createState({ rows, cfg: cfgFor(g), seed: (g.seed + salt) >>> 0, mode: ENGINE_MODE[g.mode] });
    if (!next) return null;
    carryStats(keep, next);
    g.state = next;
    g.total = next.dotTotal + next.pearlLeft;
    g.result = null;
    drain(next);
    return next;
  }

  function drain(state) {
    const events = drainEvents(state);
    for (const e of events) g.listeners.forEach((fn) => fn(e, g));
    return events;
  }

  /** 模式内结算：清巷续时、熄灯扣时、终局快照 */
  function handle(events) {
    for (const e of events) {
      if (e.type === "eatGhost" && g.mode === "timed") addTime(g.state, TIMED.ghostMs);
      else if (e.type === "caught" && g.mode === "timed") loseTime(g.state, TIMED.deathMs);
      else if (e.type === "round") g.round = e.round;
      else if (e.type === "cleared") onCleared();
      else if (e.type === "lost") onOver("lost", e.reason);
    }
    if (g.mode === "timed" && g.state && g.state.status === "lost" && !g.result) onOver("lost", "time");
  }

  function snapshot(status, reason) {
    const s = g.state;
    if (!s) return null;
    const cleared = status === "cleared" || status === "won";
    const rating =
      g.mode === "campaign"
        ? rateRun({
            cleared,
            deaths: s.deaths,
            timeMs: Math.round(s.clock),
            parMs: s.cfg.parMs,
            bestChain: s.stats.bestChain,
            longestTrain: s.stats.longestTrain,
          })
        : { stars: 0, detail: { clear: cleared, noDeath: false, fast: false } };
    return {
      mode: g.mode,
      levelId: g.mode === "campaign" ? g.levelId : null,
      watch: s.cfg.watch ?? 1,
      status,
      reason: reason ?? null,
      cleared,
      won: g.mode === "campaign" && cleared && g.levelId >= LEVEL_COUNT,
      stars: rating.stars,
      detail: rating.detail,
      score: s.score,
      scoreText: formatScore(s.score),
      timeMs: Math.round(s.clock),
      deaths: s.deaths,
      lives: s.lives,
      eaten: g.total - (s.dotLeft + s.pearlLeft),
      total: g.total,
      ghostsEaten: s.stats.ghostsEaten,
      pearlsEaten: s.stats.pearlsEaten,
      fruits: s.stats.fruits,
      longestTrain: s.stats.longestTrain,
      bestChain: s.stats.bestChain,
      parMs: s.cfg.parMs,
      lanesCleared: g.lanesCleared,
      bestChainRun: g.bestChainRun,
      round: g.round,
      leftMs: Math.round(s.timeLeftMs),
      code: g.code,
    };
  }

  function onCleared() {
    if (g.mode === "campaign") {
      g.result = snapshot("cleared");
      if (g.result.won) g.result.status = "won";
      return;
    }
    if (g.mode === "workshop") {
      g.result = snapshot("cleared");
      return;
    }
    g.lanesCleared += 1;
    g.chain += 1;
    g.bestChainRun = Math.max(g.bestChainRun, g.chain);
    if (g.mode === "survival") return;
    g.laneIdx = (g.laneIdx + 1) % Math.max(1, TIME_POOL.length);
    const s = g.state;
    addTime(s, TIMED.clearMs);
    build({
      score: s.score,
      eatenTotal: s.eatenTotal,
      deaths: s.deaths,
      extraLifeGiven: s.extraLifeGiven,
      stats: { ...s.stats },
    });
  }

  function onOver(status, reason) {
    if (!g.result) g.result = snapshot(status, reason ?? (g.mode === "timed" ? "time" : "lives"));
  }

  const api = {
    raw: g,
    get mode() {
      return g.mode;
    },
    get state() {
      return g.state;
    },
    get levelId() {
      return g.levelId;
    },
    get total() {
      return g.total;
    },
    get lanesCleared() {
      return g.lanesCleared;
    },
    get bestChainRun() {
      return g.bestChainRun;
    },
    get round() {
      return g.round;
    },
    get result() {
      return g.result;
    },
    get over() {
      return !!g.result || (!!g.state && isTerminal(g.state));
    },
    on(fn) {
      g.listeners.push(fn);
      return () => {
        g.listeners = g.listeners.filter((f) => f !== fn);
      };
    },
    start(spec = {}) {
      if (spec.mode) g.mode = MODES.includes(spec.mode) ? spec.mode : g.mode;
      if (spec.levelId != null) g.levelId = clampInt(spec.levelId, 1, LEVEL_COUNT, g.levelId);
      if (spec.rows !== undefined) g.customRows = spec.rows;
      if (spec.code !== undefined) g.code = spec.code;
      if (spec.rosterName !== undefined) g.rosterName = spec.rosterName;
      if (spec.speed !== undefined) g.speed = spec.speed;
      if (spec.seed !== undefined) g.seed = spec.seed;
      if (spec.assist) Object.assign(g.assist, spec.assist);
      g.laneIdx = 0;
      g.lanesCleared = 0;
      g.chain = 0;
      g.bestChainRun = 0;
      g.round = 1;
      g.result = null;
      return build();
    },
    /** 推一帧：返回本帧事件（同时已派发给监听器） */
    step(dtMs) {
      if (!g.state || g.result) return [];
      stepFrame(g.state, dtMs);
      const events = drain(g.state);
      handle(events);
      return events;
    },
    turn(dir) {
      return g.state ? intent(g.state, { type: "turn", dir }) : { applied: false, action: null };
    },
    dash() {
      return g.state ? intent(g.state, { type: "dash" }) : { applied: false, action: null };
    },
    pause() {
      return g.state ? intent(g.state, { type: "pause" }) : { applied: false, action: null };
    },
    resume() {
      return g.state ? intent(g.state, { type: "resume" }) : { applied: false, action: null };
    },
    togglePause() {
      return g.state?.status === "paused" ? api.resume() : api.pause();
    },
    /** 重开本局：主线只重跑当前更，限时与生存整局归零 */
    restart() {
      g.chain = 0;
      if (g.mode === "timed" || g.mode === "survival") {
        g.lanesCleared = 0;
        g.laneIdx = 0;
        g.round = 1;
      }
      g.result = null;
      return build();
    },
    /** 主线推进到下一更；到底则返回 null */
    next() {
      if (g.mode !== "campaign" || g.levelId >= LEVEL_COUNT) return null;
      return api.start({ mode: "campaign", levelId: g.levelId + 1 });
    },
    settle() {
      if (!g.result) onOver(g.state?.status === "cleared" ? "cleared" : "lost");
      return g.result;
    },
  };
  api.start(opts);
  return api;
}

// ---------------------------------------------------------------- HUD 视图模型

export function hudOf(g) {
  const s = g.state;
  if (!s) return null;
  const left = s.dotLeft + s.pearlLeft;
  const total = Math.max(1, g.total);
  return {
    mode: g.mode,
    status: s.status,
    score: s.score,
    scoreText: formatScore(s.score),
    lives: s.lives,
    wick: Math.round(s.wick),
    wickPct: clamp01(s.wick / WICK.max),
    dashPct: s.dashCoolMs > 0 ? 1 - clamp01(s.dashCoolMs / DASH.coolMs) : 1,
    dashReady: s.dashCoolMs <= 0 && s.wick >= DASH.cost,
    dashCoolSec: Math.ceil(s.dashCoolMs / 1000),
    dotPct: clamp01((total - left) / total),
    dotLeft: left,
    dotTotal: total,
    clockMs: Math.round(s.clock),
    timeLeftMs: Math.round(s.timeLeftMs),
    timed: !!s.cfg.timed,
    phaseKind: s.phaseKind,
    frightPct: s.cfg.frightMs > 0 ? clamp01(s.frightMs / s.cfg.frightMs) : 0,
    trainBonus: s.trainBonus,
    round: s.round,
    lane: g.lanesCleared,
    bestChainRun: g.bestChainRun,
    parMs: s.cfg.parMs ?? 0,
    frightSec: Math.ceil(s.frightMs / 1000),
    liveDetail: {
      clear: s.status === "cleared",
      noDeath: s.deaths === 0,
      fast: (s.cfg.parMs ?? 0) > 0 && s.clock < s.cfg.parMs,
    },
    levelId: g.mode === "campaign" ? g.levelId : null,
    watch: s.cfg.watch ?? 1,
    fruitLive: !!s.fruit,
    levelCount: LEVEL_COUNT,
    perWatch: LEVELS_PER_WATCH,
    ghosts: s.ghosts.map((gh) => ({
      id: gh.id,
      name: gh.name,
      color: gh.color,
      key: ghostStateKey(s, gh),
      eaten: gh.eaten,
    })),
  };
}
