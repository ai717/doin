// game.mjs —— DOM-free 状态控制器：接收 UI 意图，调度 engine，派发事件。绝不碰 document / localStorage。

import { createRun, submitGuess, useTool, recall, beliefOf, remainingOf, isLegalGuess, STATUS, TOOL, TOOL_COST } from "./engine.mjs";
import { levelById } from "./levels.mjs";
import { mulberry32, randomSeed } from "./rng.mjs";
import { starsFor, starThresholds, efficiencyOf, rankKeyOf } from "./score.mjs";

export const REASON = {
  OUT: "out",
  REPEAT: "repeat",
  EMPTY: "empty",
  OVER: "over",
  NO_TOOL: "noTool",
  NO_ROOM: "noRoom",
  NO_RECALL: "noRecall",
};

export function createGame() {
  let level = null;
  let run = null;
  let seed = 0;
  const listeners = new Set();

  function emit(type, payload = {}) {
    for (const fn of listeners) {
      try {
        fn(type, payload);
      } catch {
        // 单个监听者出错不影响其它
      }
    }
  }

  function view() {
    if (!run) return null;
    const belief = beliefOf(run);
    return {
      level,
      seed,
      min: run.min,
      max: run.max,
      range: run.range,
      budget: run.budget,
      used: run.used,
      remaining: remainingOf(run),
      status: run.status,
      belief,
      tools: { ...run.tools },
      fog: run.fog.map((s) => ({ ...s })),
      log: run.log.map((e) => ({ ...e })),
      guessed: [...run.guessed].sort((a, b) => a - b),
      drift: run.drift,
      driftTurns: run.driftTurns,
      liars: run.liars,
      blind: run.blind,
    };
  }

  /** 只读诊断出口：验收脚本读真值用（含隐藏目标与谎灯回合），UI 不得展示 */
  function diagnose() {
    if (!run) return null;
    return { target: run.target, lieTurn: run.lieTurn, used: run.used, status: run.status, levelId: level?.id ?? 0 };
  }

  function start(levelId, seedInput) {
    const lvl = levelById(levelId);
    if (!lvl) return null;
    level = lvl;
    seed = Number.isFinite(seedInput) ? seedInput >>> 0 : randomSeed();
    run = createRun(lvl, mulberry32(seed));
    emit("start", { level, view: view() });
    return view();
  }

  function restart() {
    if (!level) return null;
    return start(level.id, randomSeed());
  }

  function fire(value) {
    if (!run) return { ok: false, reason: REASON.OVER };
    if (run.status !== STATUS.PLAYING) return { ok: false, reason: REASON.OVER };
    const n = Number(value);
    if (!Number.isInteger(n)) return { ok: false, reason: REASON.EMPTY };
    if (n < run.min || n > run.max) return { ok: false, reason: REASON.OUT, value: n };
    if (run.guessed.has(n)) return { ok: false, reason: REASON.REPEAT, value: n };
    if (remainingOf(run) < 1) return { ok: false, reason: REASON.NO_ROOM };
    const entry = submitGuess(run, n);
    if (!entry) return { ok: false, reason: REASON.OVER };
    emit("echo", { entry, view: view() });
    if (entry.hit) emit("win", { entry, result: result() });
    else if (run.status === STATUS.LOST) emit("lose", { result: result() });
    return { ok: true, entry, view: view() };
  }

  function gear(kind) {
    if (!run) return { ok: false, reason: REASON.OVER };
    if (run.status !== STATUS.PLAYING) return { ok: false, reason: REASON.OVER };
    if (kind === TOOL.RECALL) return undo();
    if (kind !== TOOL.PROBE && kind !== TOOL.SCAN) return { ok: false, reason: REASON.NO_TOOL };
    if ((run.tools[kind] ?? 0) <= 0) return { ok: false, reason: REASON.NO_TOOL, kind };
    if (remainingOf(run) < TOOL_COST[kind]) return { ok: false, reason: REASON.NO_ROOM, kind };
    const entry = useTool(run, kind);
    if (!entry) return { ok: false, reason: REASON.NO_ROOM, kind };
    emit("tool", { entry, view: view() });
    if (run.status === STATUS.LOST) emit("lose", { result: result() });
    return { ok: true, entry, view: view() };
  }

  function undo() {
    if (!run) return { ok: false, reason: REASON.OVER };
    if (run.status !== STATUS.PLAYING) return { ok: false, reason: REASON.OVER };
    if ((run.tools.recall ?? 0) <= 0) return { ok: false, reason: REASON.NO_RECALL };
    if (!recall(run)) return { ok: false, reason: REASON.NO_RECALL };
    emit("undo", { view: view() });
    return { ok: true, view: view() };
  }

  function result() {
    if (!run || !level) return null;
    const used = run.used;
    const won = run.status === STATUS.WON;
    return {
      levelId: level.id,
      won,
      used,
      target: run.target,
      stars: won ? starsFor(level, used) : 0,
      thresholds: starThresholds(level),
      efficiency: won ? efficiencyOf(level, used) : 0,
      rankKey: won ? rankKeyOf(level, used) : "rankNone",
      lieTurn: run.liars > 0 ? run.lieTurn : -1,
      lieShown: run.liars > 0 && run.log.some((e) => e.liar),
    };
  }

  return {
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    start,
    restart,
    fire,
    gear,
    undo,
    result,
    view,
    diagnose,
    isLegal: (v) => (run ? isLegalGuess(run, v) : false),
  };
}
