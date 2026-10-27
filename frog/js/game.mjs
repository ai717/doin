// DOM-free 状态控制器：持有引擎盘面、关卡与局内分数，接收 UI 意图调 engine，
// 派发事件给 UI（音效/粒子/结算）。不碰 DOM / localStorage。
import {
  createState, applyIntent, stepFrame,
  EV_HOME, EV_FLY, EV_HIT, EV_DROWN, EV_EDGE, EV_TIMEOUT,
} from "./engine.mjs";
import { buildLevel } from "./level.mjs";
import { SCORE, eventScore, starRating } from "./score.mjs";

const DEATH_EVENTS = new Set([EV_HIT, EV_DROWN, EV_EDGE, EV_TIMEOUT]);

export function createGame() {
  let engineState = null;
  let levelId = 1;
  let score = 0;
  let result = null;
  let onEvent = null;

  function notify(event) {
    if (onEvent && event) onEvent(event);
  }

  function start(id) {
    const cfg = buildLevel(id);
    engineState = createState(cfg);
    levelId = cfg.levelId;
    score = 0;
    result = null;
  }

  function finishIfNeeded() {
    if (!engineState || result) return;
    if (engineState.status === "won" || engineState.status === "lost") {
      const won = engineState.status === "won";
      result = {
        won,
        score,
        lostLives: engineState.totalLostLives,
        stars: won ? starRating(engineState.totalLostLives) : 0,
        timeMs: won ? Math.round(engineState.time * 1000) : null,
      };
    }
  }

  function intent(dir) {
    if (!engineState || result) return { action: null };
    const before = engineState;
    const { state: next, action } = applyIntent(before, dir);
    if (next === before) return { action: null };
    engineState = next;
    if (action === "move") {
      if (dir === "up") score += SCORE.HOP;
      notify("hop");
    } else if (action === EV_HOME || action === EV_FLY) {
      score += eventScore(action);
      notify(action);
    } else if (DEATH_EVENTS.has(action)) {
      notify(action);
    }
    finishIfNeeded();
    return { action, status: engineState.status };
  }

  function tick(dt) {
    if (!engineState || result) return;
    const before = engineState;
    const next = stepFrame(before, dt);
    if (next === before) return;
    engineState = next;
    if (DEATH_EVENTS.has(next.lastEvent) && next.lastEvent !== before.lastEvent) {
      notify(next.lastEvent);
    }
    finishIfNeeded();
  }

  return {
    start,
    intent,
    tick,
    state: () => engineState,
    score: () => score,
    result: () => result,
    levelId: () => levelId,
    bindEvents(cb) { onEvent = cb; },
  };
}