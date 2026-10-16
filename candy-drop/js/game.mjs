// game.mjs: DOM-free 状态控制器 —— 接收 UI 意图，调度 engine，派发事件。
// 绝不自造 action、绝不直接改动 engine 内部状态；终局后一切操作 no-op。

import {
  createState,
  stepFrame,
  applyIntent,
  isPlaying,
  activeRopes,
  FIXED_DT,
} from "./engine.mjs";
import { LEVEL_COUNT, levelById, levelsOfBox } from "./levels.mjs";
import * as store from "./storage.mjs";
import { scoreOf, boxStars, totalScore } from "./score.mjs";

const MAX_FRAME = 0.25; // 单帧最多补 0.25s，防切后台回来爆炸

export function createGame({ audio = null, storage: injected = null } = {}) {
  const db = injected ?? store;
  const sfx = audio ?? { cut() {}, star() {}, capture() {}, pop() {}, puff() {}, bump() {}, win() {}, lose() {}, creak() {} };

  let save = db.load();
  let screen = "ready"; // ready | levels | playing | result
  let levelId = save.last && levelById(save.last) ? save.last : 1;
  let state = null;
  let acc = 0;
  let lastResult = null;
  const listeners = new Set();

  function emit(type, payload = {}) {
    const evt = { type, ...payload };
    for (const fn of [...listeners]) {
      try {
        fn(evt);
      } catch {
        // 单个订阅者出错不影响其他订阅者
      }
    }
  }

  function level() {
    return levelById(levelId);
  }

  function boxOf(id) {
    const lvl = levelById(id);
    return lvl ? lvl.box : 1;
  }

  function snapshot() {
    return {
      screen,
      levelId,
      level: level(),
      state,
      save,
      result: lastResult,
      totalScore: totalScore(save.levels),
      boxStars: boxStars(save.levels, boxOf(levelId)),
      boxUnlocked: db.isBoxUnlocked(save, boxOf(levelId)),
    };
  }

  function changed(reason = "") {
    emit("change", { reason, snapshot: snapshot() });
  }

  /** 引擎事件 → 音效与 UI 特效 */
  function consumeEngineEvents() {
    const events = state.events;
    if (!events.length) return;
    state.events = [];
    for (const e of events) {
      if (e.type === "cut") sfx.cut();
      else if (e.type === "launch") sfx.cut();
      else if (e.type === "star") sfx.star(e.index);
      else if (e.type === "capture") sfx.capture();
      else if (e.type === "pop") sfx.pop();
      else if (e.type === "puff") sfx.puff();
      else if (e.type === "bounce") sfx.bump();
      else if (e.type === "rope-auto") sfx.creak();
      emit("fx", { event: e });
    }
  }

  function finish() {
    const won = state.status === "won";
    const stars = state.starsTaken;
    const score = scoreOf(stars, won);
    const prevStars = save.levels[levelId]?.stars ?? 0;
    const rec = db.recordResult(save, levelId, { stars, won });
    save = rec.data;
    const improved = rec.improved;
    lastResult = {
      levelId,
      won,
      stars,
      prevStars,
      score,
      improved,
      reason: state.reason ?? null,
      time: state.t,
      cuts: state.cuts,
      isLast: levelId >= LEVEL_COUNT,
      boxStars: boxStars(save.levels, boxOf(levelId)),
      boxDone: levelsOfBox(boxOf(levelId)).every((l) => save.levels[l.id]?.cleared),
    };
    screen = "result";
    if (won) sfx.win();
    else sfx.lose();
    emit("result", { result: lastResult, snapshot: snapshot() });
    changed("finish");
  }

  function tick(dtSeconds) {
    if (screen !== "playing" || !state) return;
    const dt = Math.max(0, Math.min(MAX_FRAME, Number(dtSeconds) || 0));
    acc += dt;
    let guard = 0;
    while (acc >= FIXED_DT && guard < 600) {
      stepFrame(state, FIXED_DT);
      acc -= FIXED_DT;
      guard += 1;
      if (!isPlaying(state)) break;
    }
    consumeEngineEvents();
    if (!isPlaying(state)) {
      finish();
      return;
    }
    emit("frame", { snapshot: snapshot() });
  }

  /** 玩家意图统一入口：非法意图静默忽略，绝不抛错 */
  function intent(next) {
    if (screen !== "playing" || !state) return { ok: false, detail: "not-playing" };
    const res = applyIntent(state, next);
    if (res.ok) consumeEngineEvents();
    if (!isPlaying(state)) finish();
    else if (res.ok) emit("frame", { snapshot: snapshot() });
    return res;
  }

  const api = {
    on(fn) {
      if (typeof fn === "function") listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get: snapshot,
    getSave: () => save,
    /** 当前关卡是否进行中 */
    isPlaying: () => screen === "playing" && !!state && isPlaying(state),
    /** 是否还有绳可切（HUD 用） */
    ropesLeft: () => (state ? activeRopes(state).length : 0),
    hasBubble: () => !!state && state.attached >= 0,

    start(id = levelId) {
      const lvl = levelById(id);
      if (!lvl) return false;
      if (!db.isLevelUnlocked(save, id)) return false;
      levelId = lvl.id;
      state = createState(lvl);
      acc = 0;
      lastResult = null;
      screen = "playing";
      save = db.setLast(save, levelId);
      emit("start", { levelId, level: lvl });
      // 开局即存在的事件（如初始气泡）也要发给 UI
      consumeEngineEvents();
      changed("start");
      return true;
    },
    retry() {
      return api.start(levelId);
    },
    next() {
      const id = levelId + 1;
      if (id > LEVEL_COUNT) return false;
      if (!db.isLevelUnlocked(save, id)) return false;
      return api.start(id);
    },
    openLevels() {
      screen = "levels";
      changed("levels");
    },
    openReady() {
      screen = "ready";
      changed("ready");
    },
    tick,
    intent,

    slice(x1, y1, x2, y2, tolerance) {
      return intent({ type: "cut", x1, y1, x2, y2, tolerance });
    },
    popBubble() {
      return intent({ type: "popBubble" });
    },
    puff(index = 0) {
      return intent({ type: "puff", index });
    },
    slide(index, t) {
      return intent({ type: "slide", index, t });
    },

    setMuted(muted) {
      save = db.setMuted(save, muted);
      changed("muted");
    },
    resetSave() {
      save = db.clear();
      levelId = 1;
      screen = "ready";
      state = null;
      changed("reset");
    },
  };

  return api;
}
