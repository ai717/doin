// DOM-free match controller for Flick Duel: wraps the physics engine for the UI and tests.

import {
  advance,
  createMatch,
  debugCrossAll,
  drainEvents,
  flick,
  setPaused,
  settleShot,
  snapshot,
} from "./engine.mjs";
import { planShot } from "./ai.mjs";
import { normalizeSettings } from "./levels.mjs";

export function createGame(options = {}) {
  let settings = normalizeSettings(options);
  let seed = Number.isFinite(options.seed) ? Math.floor(options.seed) : 1;
  let state = createMatch({ ...settings, seed });

  function boot(nextSettings) {
    settings = normalizeSettings(nextSettings);
    seed += 1;
    state = createMatch({ ...settings, seed });
    return state;
  }

  return {
    getState() {
      return state;
    },
    get settings() {
      return { ...settings };
    },
    flick(puckId, dirX, dirY, power) {
      return flick(state, puckId, dirX, dirY, power);
    },
    tick(dt) {
      return advance(state, dt);
    },
    settle() {
      return settleShot(state);
    },
    pause() {
      return setPaused(state, true);
    },
    resume() {
      return setPaused(state, false);
    },
    togglePause() {
      return setPaused(state, !state.paused);
    },
    configure(nextSettings) {
      return boot(nextSettings);
    },
    restart() {
      return boot(settings);
    },
    planAiShot(random) {
      return planShot(state, settings.difficulty, random);
    },
    debugCrossAll(side) {
      return debugCrossAll(state, side);
    },
    drainEvents() {
      return drainEvents(state);
    },
    snapshot() {
      return snapshot(state);
    },
  };
}
