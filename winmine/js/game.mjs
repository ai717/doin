// DOM-free 状态控制器：持有引擎盘面、难度与计时，接收 UI 意图，调度 engine。
// 不碰 DOM / localStorage；存储、音效与渲染都由外层（main/ui）负责。
import * as engine from "./engine.mjs";
import { boardConfig, customConfig } from "./level.mjs";

const MAX_TIME_MS = 999000; // 原版计时器最多 999 秒

export function createGame() {
  let board = engine.createState(boardConfig("beginner"));
  let difficulty = "beginner"; // "beginner" | "intermediate" | "expert" | "custom"
  let startTime = null;        // 首击时刻（毫秒时间戳）
  let finishTimeMs = null;     // 终局锁定用时
  let customBoard = null;      // 自定义配置缓存，供"新游戏"复用

  function reset(config) {
    board = engine.createState(config);
    startTime = null;
    finishTimeMs = null;
  }

  function newGame(id) {
    difficulty = id === "custom" ? "custom" : id;
    const cfg = id === "custom" && customBoard ? customBoard : boardConfig(id);
    reset(cfg ?? boardConfig("beginner"));
  }

  function newCustom({ rows, cols, mines }) {
    const cfg = customConfig({ rows, cols, mines });
    if (!cfg) return false;
    customBoard = cfg;
    difficulty = "custom";
    reset(cfg);
    return true;
  }

  function now() {
    return Date.now();
  }

  function elapsedMs() {
    if (startTime == null) return 0;
    const raw = finishTimeMs ?? now() - startTime;
    return Math.min(MAX_TIME_MS, Math.max(0, raw));
  }

  // 终局后锁定计时
  function lock() {
    if (finishTimeMs == null) finishTimeMs = now() - startTime;
  }

  function intent(action) {
    const { state, action: effect } = engine.applyIntent(board, action);
    const changed = state !== board;
    board = state;
    if (changed && board.status === engine.STATUS_PLAYING && startTime == null) {
      startTime = now();
    }
    if (changed && (board.status === engine.STATUS_WON || board.status === engine.STATUS_LOST)) {
      lock();
    }
    return { effect, changed, status: board.status };
  }

  function state() {
    return board;
  }

  function currentDifficulty() {
    return difficulty;
  }

  return {
    newGame,
    newCustom,
    intent,
    state,
    elapsedMs,
    currentDifficulty,
  };
}