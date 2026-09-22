// 莓园打地鼠 — 状态控制器（DOM-free）：收 UI 意图、调度 engine、派发事件

import * as E from "./engine.mjs";
import { summarizeRun } from "./score.mjs";

export const MODES = ["easy", "normal", "crazy", "daily"];

export function createController(options = {}) {
  return {
    run: null,
    mode: "normal",
    date: "",
    rows: Math.max(1, Math.floor(options.rows ?? E.DEFAULT_ROWS)),
    cols: Math.max(1, Math.floor(options.cols ?? E.DEFAULT_COLS)),
    paused: false,
  };
}

export function setGrid(game, rows, cols) {
  game.rows = Math.max(1, Math.floor(rows));
  game.cols = Math.max(1, Math.floor(cols));
  return game;
}

export function isRunning(game) {
  return Boolean(game.run) && game.run.status === "running" && !game.paused;
}

/** 当前模式对应的引擎难度配置（每日题面走 normal 参数） */
export function difficultyOf(mode) {
  return mode === "daily" ? "normal" : (MODES.includes(mode) ? mode : "normal");
}

export function start(game, options = {}) {
  const mode = MODES.includes(options.mode) ? options.mode : "normal";
  const seed = Number.isFinite(options.seed) ? Math.floor(options.seed) >>> 0 : (Date.now() >>> 0);
  game.mode = mode;
  game.date = typeof options.date === "string" ? options.date : "";
  game.paused = false;
  game.run = E.createRun({
    difficulty: difficultyOf(mode),
    seed,
    rows: game.rows,
    cols: game.cols,
    daily: mode === "daily",
  });
  return game;
}

export function pause(game) {
  if (!game.run || game.run.status !== "running") return false;
  if (game.paused) return false;
  game.paused = true;
  return true;
}

export function resume(game) {
  if (!game.run || game.run.status !== "running") return false;
  if (!game.paused) return false;
  game.paused = false;
  return true;
}

export function togglePause(game) {
  return game.paused ? resume(game) : pause(game);
}

/** 敲击洞位意图；未在运行时返回 ok:false（静默忽略，不抛错） */
export function hit(game, index) {
  if (!isRunning(game)) return { ok: false, kind: "idle", index, points: 0 };
  return E.hitHole(game.run, index);
}

/** 推进一帧，返回本帧事件数组（暂停或未开局返回空数组） */
export function tick(game, dt) {
  if (!game.run || game.paused) return [];
  E.stepRun(game.run, dt);
  return game.run.events;
}

export function isOver(game) {
  return Boolean(game.run) && game.run.status === "over";
}

/** 结算摘要（mode 用于存档分域） */
export function summary(game) {
  if (!game.run) {
    return { mode: game.mode, date: game.date, score: 0, maxCombo: 0, hits: 0, misses: 0, bombs: 0, frenzyCount: 0, accuracy: 0 };
  }
  const base = summarizeRun(game.run);
  return { ...base, mode: game.mode, date: game.date };
}

/** 存档分域 key：每日题面单独记 */
export function storageMode(game) {
  return game.mode;
}
