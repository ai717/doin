// game.mjs —— 模式编排控制器：严格 DOM-free，只调度 engine，绝不碰 DOM / localStorage。
//
// 三个模式的推进口径（拍板 ❷ ❸）：
//   campaign：七张主题迷宫逐张解锁；掉命全盘复位但保留已吃豆；命数掉光 → 本迷宫从头重开（经典街机，不原地续关）
//   arcade  ：同一张迷宫无限续关，关数越高灯越快、惊惶越短；命数掉光即结算
//   setpiece：十张残局各一条命，达成目标或超时即结算，不进下一关

import { MAZES, SETPIECES } from "./mazes.mjs";
import { createState, parseMaze, stepFrame, setDesired, restartMaze, starCount, evaluateStars, applySpeedTier, speedTierMult, DEFAULT_SPEED_TIER, SPEED_TIERS } from "./engine.mjs";
import { rateRun, clampInt } from "./score.mjs";

export const MODES = ["campaign", "arcade", "setpiece"];
export const CAMPAIGN_COUNT = MAZES.length;
export const SETPIECE_COUNT = SETPIECES.length;
/** 街机无尽固定跑第一张迷宫（它不是主题迷宫，是纯粹的续关舞台） */
export const ARCADE_MAZE = 0;

function levelIdFor(mode, level) {
  if (mode === "setpiece") return 0;
  if (mode === "arcade") return ARCADE_MAZE;
  return clampInt(level, 1, CAMPAIGN_COUNT, 1) - 1;
}

export function createGame(options = {}) {
  let mode = MODES.includes(options.mode) ? options.mode : "campaign";
  let level = mode === "campaign" ? clampInt(options.level, 1, CAMPAIGN_COUNT, 1) : 1;
  let setpieceIndex = 0;
  let setpieceId = null;
  let state = null;
  let paused = false;
  let speedTier = SPEED_TIERS.some((t) => t.id === options.speedTier) ? options.speedTier : DEFAULT_SPEED_TIER;
  const stats = { ghostsEaten: 0, bestChain: 0, dotsEaten: 0, fruitsEaten: 0, lostReason: null };

  function setpieceIndexFor(id) {
    const i = SETPIECES.findIndex((sp) => sp.id === id);
    return i >= 0 ? i : 0;
  }

  if (mode === "setpiece") {
    setpieceIndex = options.setpieceId ? setpieceIndexFor(options.setpieceId) : clampInt(options.setpieceIndex, 0, SETPIECE_COUNT - 1, 0);
    setpieceId = SETPIECES[setpieceIndex]?.id ?? null;
  }

  function resetStats() {
    stats.ghostsEaten = 0;
    stats.bestChain = 0;
    stats.dotsEaten = 0;
    stats.fruitsEaten = 0;
    stats.lostReason = null;
  }

  function buildState() {
    const mazeIndex = levelIdFor(mode, level);
    const sp = mode === "setpiece" ? SETPIECES[setpieceIndex] : null;
    const opts = {
      modeId: mode,
      // ★ 每局都必须重新 parse 一份：engine 会就地修改 grid.pellets，
      //   共享同一份解析结果会让第二局开场就没豆可吃。
      maze: parseMaze(MAZES[mazeIndex]),
      level: mode === "setpiece" ? 1 : level,
      setpiece: sp,
      // ★ 速度档要跟着每一局重建走，否则重开一次就掉回标准档
      speedTier,
      speedScale: speedTierMult(speedTier),
    };
    if (options.seed !== undefined) opts.seed = options.seed;
    return createState(opts);
  }

  /** 开局 / 重开当前关。命数掉光后走的也是这里（经典街机：整张迷宫从头来） */
  function start(nextOptions = {}) {
    if (MODES.includes(nextOptions.mode)) mode = nextOptions.mode;
    if (mode === "campaign" && nextOptions.level !== undefined) {
      level = clampInt(nextOptions.level, 1, CAMPAIGN_COUNT, level);
    }
    if (mode === "setpiece") {
      if (nextOptions.setpieceId) setpieceIndex = setpieceIndexFor(nextOptions.setpieceId);
      else if (nextOptions.setpieceIndex !== undefined) {
        setpieceIndex = clampInt(nextOptions.setpieceIndex, 0, SETPIECE_COUNT - 1, setpieceIndex);
      }
      setpieceId = SETPIECES[setpieceIndex]?.id ?? null;
    }
    state = buildState();
    resetStats();
    paused = false;
    return state;
  }

  function absorb(events) {
    for (const ev of events) {
      if (ev.type === "eatGhost") stats.ghostsEaten += 1;
      else if (ev.type === "pellet") stats.dotsEaten += 1;
      else if (ev.type === "fruitEat") stats.fruitsEaten += 1;
      // ★ 残局失败原因必须落地：超时 / 步数用尽与"被灯撞灭"是两回事，
      //   标题写错会让玩家以为自己被撞了（明明掉命 0）。
      else if (ev.type === "setpieceFail") stats.lostReason = ev.reason;
    }
    if (state && state.chainBest > stats.bestChain) stats.bestChain = state.chainBest;
  }

  /** 推进一帧。暂停或已结束时返回空事件数组，绝不让时间偷偷流走。 */
  function tick(dt) {
    if (!state || paused || state.status !== "playing") return [];
    const events = stepFrame(state, dt);
    absorb(events);
    return events;
  }

  function finished() {
    if (!state) return false;
    return ["levelclear", "lost", "setpieceClear"].includes(state.status);
  }

  /**
   * 结算后推进：返回 next（进下一关）/ restart（本关从头）/ allClear（战役通关）/ null（无可推进）。
   * 残局没有"下一张"——达成即结束，由调用方回到残局列表。
   */
  function advance() {
    if (!state) return start();
    if (state.status === "levelclear") {
      if (mode === "campaign") {
        if (level >= CAMPAIGN_COUNT) return "allClear";
        level += 1;
        start();
        return "next";
      }
      if (mode === "arcade") {
        level += 1;
        start();
        return "next";
      }
    }
    // 命数掉光 / 残局失败：本迷宫从头重开
    if (state.status === "lost" || state.status === "setpieceFail") {
      if (mode === "campaign" || mode === "arcade") {
        restartMaze(state);
        resetStats();
        paused = false;
        return "restart";
      }
    }
    return null;
  }

  /** 重开当前关（不等结算，暂停菜单里的"再点一次"也走这里） */
  function restart() {
    if (!state) return start();
    restartMaze(state);
    resetStats();
    paused = false;
    return "restart";
  }

  function result() {
    if (!state) return null;
    const s = state;
    const cleared = s.status === "levelclear" || s.status === "setpieceClear";
    const timeMs = Math.round(s.elapsed * 1000);
    const parMs = Math.round((s.grid.parTime ?? 0) * 1000);
    const rating = rateRun({ cleared, deaths: s.deaths, timeMs, parMs });
    return {
      mode,
      level,
      mazeId: s.grid.id,
      setpieceId: mode === "setpiece" ? setpieceId : null,
      cleared,
      failed: s.status === "lost",
      // "time" / "steps" 来自残局判定；其余落败一律是命数掉光（撞灯）
      lostReason: s.status === "lost" ? (stats.lostReason ?? "death") : null,
      stars: rating.stars,
      detail: rating.detail,
      score: s.score,
      timeMs,
      parMs,
      dots: s.dotsEaten,
      dotsTotal: s.dotsTotal,
      deaths: s.deaths,
      ghosts: stats.ghostsEaten,
      bestChain: stats.bestChain,
      fruits: stats.fruitsEaten,
    };
  }

  const api = {
    get mode() {
      return mode;
    },
    get level() {
      return level;
    },
    get state() {
      return state;
    },
    get status() {
      return state ? state.status : "idle";
    },
    get paused() {
      return paused;
    },
    get setpieceId() {
      return setpieceId;
    },
    get mazeId() {
      return state ? state.grid.id : MAZES[levelIdFor(mode, level)].id;
    },
    get mazeMeta() {
      return MAZES[levelIdFor(mode, level)].meta;
    },

    start,
    tick,
    restart,
    advance,
    result,
    finished,
    stats() {
      return { ...stats };
    },

    input(dir) {
      if (!state || paused || state.status !== "playing") return false;
      return setDesired(state, dir);
    },
    setPaused(v) {
      paused = v === true;
      return paused;
    },
    togglePause() {
      if (!state || state.status !== "playing") return false;
      paused = !paused;
      return paused;
    },

    speedTier: () => speedTier,
    /** 换速度档：只改倍率，绝不重建局面（与语言热切换同一条铁律） */
    setSpeedTier(tier) {
      speedTier = SPEED_TIERS.some((t) => t.id === tier) ? tier : DEFAULT_SPEED_TIER;
      if (state) applySpeedTier(state, speedTier);
      return speedTier;
    },

    /** 星星口径：结算时与 score.rateRun 同源，UI 只准读不准算 */
    stars() {
      return state ? starCount(state) : 0;
    },
    evaluate() {
      return state ? evaluateStars(state) : { clear: false, time: false, noDeath: false };
    },
  };

  return api;
}
