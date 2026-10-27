// filepath: games/ice-slide/js/game.mjs
// 会话状态控制器（DOM-free）：接收 UI 意图，调度 engine 滑行结算，派发事件。
// 不碰 DOM、不碰 localStorage；计分与存档分别在 score.mjs / storage.mjs。
// 三轨模式（拍板项 1 = A）：campaign 章节推进 / daily 每日一局（日期种子同题）/ practice 练习场。
import { parseLevel, slide, isWon, boxesOnGoal, countBoxes, fingerprint } from "./engine.mjs";
import { LEVELS } from "./levels.mjs";
import { hint } from "./solver.mjs";

export const PHASE = Object.freeze({
  IDLE: "idle",
  PLAYING: "playing",
  PAUSED: "paused",
  WON: "won",
});

export const MODE = Object.freeze({
  CAMPAIGN: "campaign",
  DAILY: "daily",
  PRACTICE: "practice",
});

/** mulberry32：确定性 PRNG（与全站约定一致） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 日期字符串（YYYY-MM-DD）-> 确定性 32 位种子 */
function dateSeed(dateKey) {
  let h = 2166136261 >>> 0;
  const s = String(dateKey || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 每日一局选关：日期种子确定性选取，同日期任何人同题 */
export function dailyLevelIndex(dateKey) {
  const rand = mulberry32(dateSeed(dateKey));
  return Math.floor(rand() * LEVELS.length) % LEVELS.length;
}

export function createGame() {
  let mode = MODE.CAMPAIGN;
  let levelIndex = 0;
  let level = null;
  let state = null;
  let history = []; // 旧 map 引用栈（slide 不可变，引用安全）
  let phase = PHASE.IDLE;
  let startStamp = 0;
  let elapsedMs = 0;
  let timerStarted = false;
  const listeners = new Set();

  function emit(reason) {
    for (const cb of listeners) cb(getView(), reason);
  }

  function levelByIdx(i) {
    const idx = Math.max(0, Math.min(LEVELS.length - 1, i));
    return { index: idx, meta: LEVELS[idx] };
  }

  function loadLevel(i, nextMode = mode) {
    const { index, meta } = levelByIdx(i);
    levelIndex = index;
    mode = nextMode;
    level = parseLevel(meta.map);
    state = level;
    history = [];
    phase = PHASE.IDLE;
    startStamp = 0;
    elapsedMs = 0;
    timerStarted = false;
    emit("level");
  }

  /** 每日一局：日期种子选关 + daily 模式 */
  function startDaily(dateKey) {
    loadLevel(dailyLevelIndex(dateKey), MODE.DAILY);
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

  /** 方向 id：engine.DIRS 下标。返回 true 表示发生了滑行 */
  function move(dirId) {
    if (phase !== PHASE.PLAYING) return false;
    const next = slide(state, dirId);
    if (!next) return false;
    history.push(state); // 旧状态入栈（slide 不可变）
    state = next;
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

  /** 求解器提示：返回 { dir } / { dead: true } / { won: true } / null（保险丝静默） */
  function hintDir() {
    if (!state || phase === PHASE.IDLE) return null;
    const res = hint(state, { maxStates: 200000 });
    if (res.won) return { won: true };
    if (res.solvable === false) return { dead: true };
    if (res.dir === null || res.dir === undefined) return null; // 保险丝触发，静默
    return { dir: res.dir };
  }

  function subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }

  function getView() {
    return {
      mode,
      index: levelIndex,
      meta: LEVELS[levelIndex],
      phase,
      moves: state ? state.moves : 0,
      pushes: state ? state.pushes : 0,
      boxesOnGoal: state ? boxesOnGoal(state) : 0,
      totalBoxes: state ? countBoxes(state) : 0,
      par: LEVELS[levelIndex] ? LEVELS[levelIndex].par : 0,
      won: state ? isWon(state) : false,
      fingerprint: state ? fingerprint(state) : "",
      timeMs: timeMs(),
      historyLen: history.length,
      last: state ? state.last : null,
    };
  }

  loadLevel(0); // 首屏零门槛：创建即载入第 1 关（main 会按存档改载其它关）

  return {
    loadLevel,
    startDaily,
    start,
    pause,
    resume,
    restart,
    move,
    undo,
    canUndo,
    nextLevel,
    hintDir,
    subscribe,
    getView,
    /** 只读状态快照（slide 不可变，引用安全） */
    get state() {
      return state;
    },
    get levelIndex() {
      return levelIndex;
    },
    get mode() {
      return mode;
    },
    get phase() {
      return phase;
    },
  };
}
