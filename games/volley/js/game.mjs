// Volley Bombard — DOM-free match controller.
// Owns the engine state, the pause clock and the AI loop; the UI layer asks
// it for immutable view snapshots and pushes player intents in.

import * as E from "./engine.mjs";
import * as AI from "./ai.mjs";

const AI_THINK_DELAY = 650; // ms of "thinking" before the AI fires
const AI_SETTLE_DELAY = 900; // ms to admire the shell flight before endShot
const CLOCK_STEP = 1 / 60;

export function createGame({ seed = (Math.random() * 0xffffffff) >>> 0, mode = "2p", aiLevel = "veteran", terrain = "hill", onEvents } = {}) {
  let state = E.createMatch({ seed, terrain, mode, aiLevel });
  let paused = false;
  let over = false;
  let aiTimer = 0;
  let aiPhase = "idle"; // idle | think | charge | wait
  let pendingEvents = [];
  let charge = null; // {side, start}
  let matchMeta = { mode, aiLevel, terrain, seed };
  let roundWins = [0, 0];
  let lastWinner = null;

  function raw() {
    return state;
  }

  function view() {
    return {
      phase: state.phase,
      turn: state.turn,
      round: state.round,
      wind: state.wind,
      winner: state.winner,
      mode: matchMeta.mode,
      aiLevel: matchMeta.aiLevel,
      terrain: matchMeta.terrain,
      paused,
      players: state.players.map((p) => ({ ...p })),
      blocks: [E.intactCount(state, 0), E.intactCount(state, 1)],
      roundWins: [...roundWins],
      shells: state.shells.length,
    };
  }

  function pushEvents(events) {
    if (!events || !events.length) return;
    pendingEvents.push(...events);
    if (typeof onEvents === "function") onEvents(events);
  }

  function canAct(side) {
    return !paused && !over && state.phase === "aim" && state.turn === side && !(matchMeta.mode === "ai" && side === 0);
  }

  // ---- player intents ----

  function intent(type, payload = {}) {
    if (over || paused) return false;
    if (type !== "weapon" && type !== "angle" && type !== "power" && type !== "fire") return false;
    switch (type) {
      case "angle": {
        const side = payload.side ?? state.turn;
        if (!canAct(side)) return false;
        const base = payload.angle !== undefined ? payload.angle : state.players[side].angle + (payload.delta ?? 0);
        return E.setAim(state, side, { angle: base });
      }
      case "power": {
        const side = payload.side ?? state.turn;
        if (!canAct(side)) return false;
        const base = payload.power !== undefined ? payload.power : state.players[side].power + (payload.delta ?? 0);
        return E.setAim(state, side, { power: base });
      }
      case "weapon": {
        const side = payload.side ?? state.turn;
        if (!canAct(side)) return false;
        if (!state.weapons.includes(payload.weapon)) return false;
        return E.setAim(state, side, { weapon: payload.weapon });
      }
      case "fire": {
        const side = payload.side ?? state.turn;
        if (!canAct(side)) return false;
        return fire(side);
      }
      default:
        return false;
    }
  }

  function fire(side) {
    if (state.phase !== "aim" || state.turn !== side) return false;
    const ok = E.fire(state);
    if (ok) aiPhase = "wait";
    return ok;
  }

  // ---- AI loop (called from the frame tick) ----

  function tickAi(dtMs) {
    if (over || paused || matchMeta.mode !== "ai" || state.turn !== 0 || state.phase !== "aim") {
      aiPhase = "idle";
      aiTimer = 0;
      return;
    }
    aiTimer += dtMs;
    if (aiPhase === "idle" && aiTimer > 420) {
      aiPhase = "think";
      aiTimer = 0;
    } else if (aiPhase === "think" && aiTimer > AI_THINK_DELAY) {
      const plan = AI.aiPlan(state, 0);
      E.setAim(state, 0, plan);
      aiPhase = "charge";
      aiTimer = 0;
    } else if (aiPhase === "charge" && aiTimer > 500) {
      fire(0);
      aiPhase = "wait";
      aiTimer = 0;
    }
  }

  // ---- fixed-step clock ----

  function tick(dtMs) {
    if (paused || over) return;
    const dt = Math.min(dtMs, 250) / 1000;
    tickAi(dtMs);
    if (state.phase === "flight") {
      // engine 的 matchOver 缺 cause / blocksStanding，统一由 afterShot 广播完整版，
      // 否则 UI 会收到两次终局事件（结算统计被重复累计）。
      const events = E.stepSim(state, dt).filter((e) => e.type !== "matchOver");
      pushEvents(events);
      if (state.phase !== "flight") {
        // shot fully resolved this tick
        afterShot();
      }
    }
  }

  function afterShot() {
    if (state.winner !== null && state.winner !== undefined) {
      over = true;
      const winner = state.winner;
      if (winner === 0 || winner === 1) roundWins[winner] += 1;
      lastWinner = winner;
      pushEvents([{ type: "matchOver", winner, cause: flagDownCause(), blocksStanding: [E.intactCount(state, 0), E.intactCount(state, 1)] }]);
    }
  }

  function flagDownCause() {
    if (E.flagOf(state, 0)?.down || E.flagOf(state, 1)?.down) return "flag";
    return "blocks";
  }

  // ---- pause / lifecycle ----

  function setPaused(on) {
    paused = !!on;
    return paused;
  }

  function togglePause() {
    paused = !paused;
    return paused;
  }

  function isPaused() {
    return paused;
  }

  function isOver() {
    return over;
  }

  function restart(next = {}) {
    matchMeta = { ...matchMeta, ...next };
    state = E.createMatch({
      seed: (Math.random() * 0xffffffff) >>> 0,
      terrain: matchMeta.terrain,
      mode: matchMeta.mode,
      aiLevel: matchMeta.aiLevel,
    });
    paused = false;
    over = false;
    aiPhase = "idle";
    aiTimer = 0;
    pendingEvents = [];
    roundWins = [0, 0];
    lastWinner = null;
    pushEvents([{ type: "turnStart", side: state.turn, round: state.round }]);
    return view();
  }

  return {
    raw,
    view,
    intent,
    fire,
    tick,
    restart,
    setPaused,
    togglePause,
    isPaused,
    isOver,
    get meta() {
      return { ...matchMeta };
    },
  };
}
