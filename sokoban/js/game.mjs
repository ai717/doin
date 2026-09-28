// filepath: games/sokoban/js/game.mjs
// 会话状态控制器（DOM-free）：接收 UI 意图，调度 engine，派发事件。
// 不碰 DOM、不碰 localStorage；计分与存档分别在 score.mjs / storage.mjs。
import { parseLevel, applyMove, isWon, boxesOnGoal, countBoxes, fingerprint } from "./engine.mjs";
import { LEVELS } from "./levels.mjs";

export const PHASE = Object.freeze({
  IDLE: "idle",
  PLAYING: "playing",
  PAUSED: "paused",
  WON: "won",
});

export function createGame() {
  let levelIndex = 0;
  let level = null;
  let state = null;
  let history = [];       // 旧 map 引用栈（applyMove 不可变，引用安全）
  let phase = PHASE.IDLE;
  let startStamp = 0;
  let elapsedMs = 0;      // 已结算的累计时长（暂停期间不计）
  let tick = 0;
  let timerStarted = false;
  const listeners = new Set();

  function emit(reason) {
    for (const cb of listeners) cb(getView(), reason);
  }

  function levelByIdx(i) {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, i));
    return { index: idx, meta: LEVELS[idx] };
  }

  function loadLevel(i) {
    const { index, meta } = levelByIdx(i);
    levelIndex = index;
    level = parseLevel(meta.map);
    state = level;
    history = [];
    phase = PHASE.IDLE;
    startStamp = 0;
    elapsedMs = 0;
    timerStarted = false;
    emit("level");
  }

  function start() {
    if (phase === PHASE.WON) return;
    phase = PHASE.PLAYING;
    startStamp = performance.now();
    timerStarted = true;
    emit("phase");
  }

  function stopTimer() {
    if (!timerStarted) return;
    elapsedMs += performance.now() - startStamp;
    timerStarted = false;
  }

  function pause() {
    if (phase !== PHASE.PLAYING) return false;
    stopTimer();
    phase = PHASE.PAUSED;
    emit("phase");
    return true;
  }

  function resume() {
    if (phase !== PHASE.PAUSED) return false;
    phase = PHASE.PLAYING;
    startStamp = performance.now();
    timerStarted = true;
    emit("phase");
    return true;
  }

  function timeMs() {
    if (phase === PHASE.PLAYING && timerStarted) return elapsedMs + (performance.now() - startStamp);
    return elapsedMs;
  }

  function restart() {
    loadLevel(levelIndex);
  }

  /** 方向 id：engine.DIRS 下标。返回 true 表示发生移动 */
  function move(dirId) {
    if (phase !== PHASE.PLAYING) return false;
    const next = applyMove(state, dirId);
    if (!next) return false;
    history.push(state); // 旧状态入栈（applyMove 不可变）
    state = next;
    tick++;
    if (next.won) {
      stopTimer();
      phase = PHASE.WON;
      emit("win");
    } else {
      emit("move");
    }
    return true;
  }

  function undo() {
    if (phase === PHASE.PLAYING || phase === PHASE.WON) {
      const prev = history.pop();
      if (!prev) return false;
      state = prev;
      if (phase === PHASE.WON) {
        phase = PHASE.PLAYING;
        startStamp = performance.now();
        timerStarted = true;
      }
      emit("move");
      return true;
    }
    return false;
  }

  function canUndo() {
    return history.length > 0 && (phase === PHASE.PLAYING || phase === PHASE.WON);
  }

  function nextLevel() {
    if (levelIndex >= LEVELS.length - 1) {
      restart();
      return;
    }
    loadLevel(levelIndex + 1);
  }

  function subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function getView() {
    return {
      index: levelIndex,
      meta: LEVELS[levelIndex],
      phase,
      moves: state ? state.moves : 0,
      pushes: state ? state.pushes : 0,
      boxesOnGoal: state ? boxesOnGoal(state) : 0,
      totalBoxes: state ? countBoxes(state) : 0,
      par: state ? LEVELS[levelIndex].parPushes : 0,
      won: state ? isWon(state) : false,
      fingerprint: state ? fingerprint(state) : "",
      timeMs: timeMs(),
      historyLen: history.length,
    };
  }

  return {
    loadLevel,
    start,
    pause,
    resume,
    restart,
    move,
    undo,
    canUndo,
    nextLevel,
    subscribe,
    getView,
    /** 只读状态快照（applyMove 不可变，引用安全） */
    get state() { return state; },
    get levelIndex() { return levelIndex; },
    get phase() { return phase; },
  };
}
