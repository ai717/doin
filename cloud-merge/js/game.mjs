// game.mjs: 云朵合成状态控制器，DOM-free，调度 engine 并派发事件。

import {
  createInitialState,
  applyIntent,
  stepFrame,
  FIXED_DT,
  MAX_SUBSTEPS,
  STATUS,
} from "./engine.mjs?v=79c518024932";

export class CloudGame {
  constructor(options = {}) {
    this.options = options;
    this.state = createInitialState(options);
    this.paused = false;
    this.listeners = new Set();
    this.accumulator = 0;
  }

  on(fn) {
    if (typeof fn === "function") {
      this.listeners.add(fn);
    }
    return () => this.listeners.delete(fn);
  }

  emit(type, payload = {}) {
    for (const fn of this.listeners) {
      try {
        fn(type, payload);
      } catch {}
    }
  }

  getState() {
    return this.state;
  }

  isPaused() {
    return this.paused;
  }

  isGameOver() {
    return this.state.status === STATUS.over;
  }

  isPlaying() {
    return this.state.status === STATUS.playing;
  }

  setAim(x) {
    if (this.paused || this.isGameOver()) return;
    const res = applyIntent(this.state, { type: "set_aim", x });
    this.state = res.state;
    if (res.action) {
      this.emit("state_change", { state: this.state });
    }
  }

  drop(x) {
    if (this.paused || this.isGameOver()) return false;
    const res = applyIntent(this.state, { type: "drop", x });
    this.state = res.state;
    if (res.action === "drop") {
      for (const evt of res.events) {
        this.emit(evt.type, evt);
      }
      this.emit("state_change", { state: this.state });
      return true;
    }
    return false;
  }

  collectRainbow(id) {
    if (this.paused || this.isGameOver()) return false;
    const res = applyIntent(this.state, { type: "collect_rainbow", id });
    this.state = res.state;
    if (res.action === "collect_rainbow") {
      for (const evt of res.events) {
        this.emit(evt.type, evt);
      }
      this.emit("state_change", { state: this.state });
      return true;
    }
    return false;
  }

  togglePause() {
    if (this.isGameOver()) return false;
    this.paused = !this.paused;
    this.emit("pause_change", { paused: this.paused });
    return this.paused;
  }

  setPause(paused) {
    if (this.isGameOver()) return;
    this.paused = !!paused;
    this.emit("pause_change", { paused: this.paused });
  }

  restart(mode, options = {}) {
    this.paused = false;
    const res = applyIntent(this.state, {
      type: "restart",
      mode: mode || this.state.mode,
      seed: options.seed,
      dateStr: options.dateStr,
    });
    this.state = res.state;
    this.accumulator = 0;
    this.emit("restart", { state: this.state });
    this.emit("state_change", { state: this.state });
  }

  update(rawDt) {
    if (this.paused || this.isGameOver()) return;

    const dt = Math.min(0.1, Math.max(0.001, rawDt));
    this.accumulator += dt;

    let subSteps = 0;
    while (this.accumulator >= FIXED_DT && subSteps < MAX_SUBSTEPS) {
      const res = stepFrame(this.state, FIXED_DT);
      this.state = res.state;
      this.accumulator -= FIXED_DT;
      subSteps += 1;

      for (const evt of res.events) {
        this.emit(evt.type, evt);
      }
    }

    if (this.accumulator > FIXED_DT * MAX_SUBSTEPS) {
      this.accumulator = 0;
    }
  }
}
