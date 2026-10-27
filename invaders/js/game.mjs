// Controller: owns the simulation clock, input intents, audio cues and progress.
// It never touches the DOM directly - all presentation goes through callbacks.
import { createState, setInput, stepFrame, drainEvents, STATUS, MODES, applyMod } from "./engine.mjs";
import { reportFor, starsFor } from "./score.mjs";
import * as audio from "./audio.mjs";
import * as storage from "./storage.mjs";
import { VIEW_W } from "./data.mjs";

const FIXED = 1 / 120;
const MAX_STEPS = 10;

const CUE_BY_EVENT = {
  march: "march",
  shot: "shot",
  rail: "rail",
  hit: "hit",
  dive: "dive",
  dash: "dash",
  chip: "chip",
  crash: "crash",
  hull: "hull",
  blocked: "blocked",
  overheat: "overheat",
  cooled: "cooled",
  mod: "mod",
  wave: "wave",
  sweep: "crash",
  sweepWarn: "dash",
  mshipIn: "mship",
  mshipHit: "hit",
  mshipDown: "crash",
  win: "win",
  lose: "lose",
};

function seedFor(mode, levelId) {
  const base = mode === MODES.SURVIVAL ? Date.now() % 1000003 : levelId * 7919;
  return (base ^ 0x5f3759df) >>> 0;
}

export class SiegeGame {
  constructor(options = {}) {
    this.onFrame = options.onFrame ?? (() => {});
    this.onFinish = options.onFinish ?? (() => {});
    this.onChange = options.onChange ?? (() => {});
    this.progress = storage.load();
    this.state = null;
    this.running = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.input = { dir: 0, pointerX: null, firing: false };
    this.finished = false;
    this.rafId = 0;
  }

  start({ mode = MODES.CAMPAIGN, levelId = 1 } = {}) {
    this.stopLoop();
    this.mode = mode;
    this.levelId = levelId;
    this.finished = false;
    this.accumulator = 0;
    this.lastTime = 0;
    this.state = createState({ mode, levelId, seed: seedFor(mode, levelId) });
    this.running = true;
    this.onChange(this.state);
    this.loop(0);
    return this.state;
  }

  stopLoop() {
    this.running = false;
    if (this.rafId && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  // Keyboard counts as an explicit intent: pressing a direction always takes
  // ownership back from the pointer, otherwise one stray mouse move over the
  // stage would pin the turret for the rest of the run.
  setMove(dir) {
    if (dir !== 0) this.input.pointerX = null;
    this.input.dir = dir;
  }

  setPointer(x) {
    this.input.pointerX = x;
  }

  clearPointer() {
    this.input.pointerX = null;
  }

  // Dropped whenever the run is interrupted (overlay opens, level starts, the
  // board ends): a stale held key or a stale pointer target would otherwise
  // keep steering a turret the player is no longer looking at.
  clearInput() {
    this.input.dir = 0;
    this.input.firing = false;
    this.input.pointerX = null;
  }

  setFiring(value) {
    this.input.firing = Boolean(value);
  }

  togglePause() {
    if (!this.state) return false;
    if (this.state.status === STATUS.WON || this.state.status === STATUS.LOST) return false;
    this.state.paused = !this.state.paused;
    this.onChange(this.state);
    return this.state.paused;
  }

  isPaused() {
    return Boolean(this.state?.paused);
  }

  restart() {
    if (!this.mode) return null;
    return this.start({ mode: this.mode, levelId: this.levelId });
  }

  grantMod(key) {
    if (!this.state) return;
    applyMod(this.state, key);
  }

  pushInput() {
    if (!this.state) return;
    const turret = this.state.turret;
    let dir = this.input.dir;
    if (this.input.pointerX !== null && this.input.pointerX !== undefined) {
      const delta = this.input.pointerX - turret.x;
      if (Math.abs(delta) < 6) {
        // Arrived at the tapped lane: release the pointer so it stops shadowing
        // the keyboard, and let the turret rest instead of jittering on target.
        this.input.pointerX = null;
        dir = 0;
      } else {
        dir = Math.max(-1, Math.min(1, delta / 46));
      }
    }
    setInput(this.state, { move: dir, firing: this.input.firing });
  }

  handleEvent(event) {
    if (event.type === "kill") {
      audio.play(event.headon ? "headon" : "hit");
    } else if (event.type === "march") {
      audio.play("march", { interval: event.interval, force: true });
    } else {
      const cue = CUE_BY_EVENT[event.type];
      if (cue) audio.play(cue);
    }
  }

  advance(dt) {
    const state = this.state;
    if (!state) return;
    this.pushInput();
    stepFrame(state, dt);
    const events = drainEvents(state);
    for (const event of events) this.handleEvent(event);
    if (!this.finished && (state.status === STATUS.WON || state.status === STATUS.LOST)) {
      this.finished = true;
      this.commitProgress(state);
      this.onFinish(this.report(state), state);
    }
    return events;
  }

  report(state = this.state) {
    return reportFor(state);
  }

  commitProgress(state) {
    const report = reportFor(state);
    if (state.mode === MODES.CAMPAIGN && state.status === STATUS.WON) {
      this.progress = storage.recordLevel(this.progress, state.levelId, starsFor(state), state.score);
    } else if (state.mode === MODES.SURVIVAL) {
      this.progress = storage.recordSurvival(this.progress, state.waveIndex + 1, state.score, state.bestCombo);
    } else if (state.mode === MODES.TRAINING && state.status === STATUS.WON) {
      this.progress = storage.recordTraining(this.progress, state.levelId);
    }
    storage.save(this.progress);
    return report;
  }

  setMuted(value) {
    audio.setMuted(value);
    this.progress.muted = Boolean(value);
    storage.save(this.progress);
    return this.progress.muted;
  }

  loop = (now) => {
    if (!this.running) return;
    const time = typeof now === "number" ? now : 0;
    if (!this.lastTime) this.lastTime = time;
    let delta = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    delta = Math.min(delta, 0.25);
    this.accumulator += delta;
    let steps = 0;
    const events = [];
    while (this.accumulator >= FIXED && steps < MAX_STEPS) {
      const batch = this.advance(FIXED);
      if (batch && batch.length) events.push(...batch);
      this.accumulator -= FIXED;
      steps += 1;
    }
    if (steps === MAX_STEPS) this.accumulator = 0;
    this.onFrame(this.state, delta, events);
    if (this.running && typeof requestAnimationFrame === "function") {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };
}

export { MODES, STATUS, VIEW_W };
