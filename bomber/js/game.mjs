// Bomber - controller. DOM-free: receives intents, drives the engine, persists results.
import {
  MODE_PUZZLE,
  advance,
  bfs,
  cellOf,
  createState,
  detonateRemote,
  drainEvents,
  placeBomb,
  setInput,
  setPath,
  stepFrame,
} from "./engine.mjs";
import { CAMPAIGN_LEVELS, PUZZLE_LEVELS } from "./levels.mjs";
import * as store from "./storage.mjs";
import * as score from "./score.mjs";

export const MODE_CAMPAIGN = "campaign";

export class BomberGame {
  constructor() {
    this.data = store.load();
    this.state = null;
    this.mode = MODE_CAMPAIGN;
    this.index = 0;
    this.paused = false;
    this.result = null;
    this.listeners = new Set();
    this.audioHook = null;
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, payload = {}) {
    for (const fn of this.listeners) fn(type, payload);
  }

  get level() {
    return this.mode === MODE_PUZZLE ? PUZZLE_LEVELS[this.index] : CAMPAIGN_LEVELS[this.index];
  }

  levelCount() {
    return this.mode === MODE_PUZZLE ? PUZZLE_LEVELS.length : CAMPAIGN_LEVELS.length;
  }

  start(mode, index) {
    this.mode = mode === MODE_PUZZLE ? MODE_PUZZLE : MODE_CAMPAIGN;
    this.index = Math.max(0, Math.min(this.levelCount() - 1, index));
    const level = this.level;
    this.state = createState(level, { unlocks: this.data.unlocks });
    this.paused = false;
    this.result = null;
    this.emit("start", { mode: this.mode, index: this.index, level });
    return this.state;
  }

  restart() {
    return this.start(this.mode, this.index);
  }

  nextLevel() {
    if (this.index + 1 >= this.levelCount()) return false;
    this.start(this.mode, this.index + 1);
    return true;
  }

  setPaused(value) {
    this.paused = Boolean(value);
    this.emit("pause", { paused: this.paused });
  }

  togglePause() {
    this.setPaused(!this.paused);
  }

  // ---------------------------------------------------------------- intents

  move(dx, dy) {
    if (!this.state) return;
    setInput(this.state, dx, dy);
  }

  drop() {
    if (!this.state || this.paused) return false;
    return placeBomb(this.state);
  }

  detonate() {
    if (!this.state || this.paused) return false;
    return detonateRemote(this.state);
  }

  tapCell(cx, cy) {
    if (!this.state) return false;
    const [px, py] = cellOf(this.state.player.x, this.state.player.y);
    const path = bfs(this.state, [px, py], (x, y) => x === cx && y === cy, { limit: 400, player: true });
    if (!path || path.length < 2) return false;
    setPath(this.state, path.slice(1));
    return true;
  }

  // ---------------------------------------------------------------- loop

  update(dtMs) {
    const state = this.state;
    if (!state || this.paused || state.status !== "playing") return [];
    advance(state, dtMs);
    const events = drainEvents(state);
    if (this.audioHook) this.audioHook(events);
    if (events.length) this.emit("events", events);
    if (state.status !== "playing") this.finish();
    return events;
  }

  // test helper: deterministic single-frame stepping
  step(frames = 1) {
    if (!this.state) return [];
    for (let i = 0; i < frames; i++) stepFrame(this.state);
    return drainEvents(this.state);
  }

  finish() {
    const state = this.state;
    const info = score.summary(state);
    const won = state.status === "won";
    const id = state.levelId;
    const table = this.mode === MODE_PUZZLE ? this.data.puzzles : this.data.campaign;
    const prev = table[id] ?? { stars: 0 };
    const gainedParts = won ? info.parts : 0;

    if (won) {
      const merged = {
        stars: Math.max(prev.stars ?? 0, info.stars),
        time: Math.min(prev.time ?? Infinity, Math.round(info.elapsedSeconds)),
        demo: Math.max(prev.demo ?? 0, info.demo),
        bombs: Math.min(prev.bombs ?? Infinity, info.bombsUsed),
      };
      if (!Number.isFinite(merged.time)) delete merged.time;
      if (!Number.isFinite(merged.bombs)) delete merged.bombs;
      table[id] = merged;
      this.data.parts += gainedParts;
      this.data.records.cleared += 1;
      if (this.mode === MODE_PUZZLE) {
        this.data.puzzleUnlocked = Math.max(this.data.puzzleUnlocked, Math.min(PUZZLE_LEVELS.length, this.index + 2));
      } else {
        this.data.campaignUnlocked = Math.max(this.data.campaignUnlocked, Math.min(CAMPAIGN_LEVELS.length, this.index + 2));
      }
      this.data.records.stars = Object.values(this.data.campaign).reduce((sum, e) => sum + (e.stars ?? 0), 0)
        + Object.values(this.data.puzzles).reduce((sum, e) => sum + (e.stars ?? 0), 0);
    }
    this.data.records.maxChain = Math.max(this.data.records.maxChain, state.stats.maxChain);
    this.data.records.bestDemo = Math.max(this.data.records.bestDemo, info.demo);
    store.save(this.data);
    this.result = { ...info, won, id, gainedParts };
    this.emit("finish", this.result);
    return this.result;
  }

  totalStars() {
    return Object.values(this.data.campaign).reduce((sum, e) => sum + (e.stars ?? 0), 0)
      + Object.values(this.data.puzzles).reduce((sum, e) => sum + (e.stars ?? 0), 0);
  }

  unlock(key) {
    const cost = { bomb: 60, fire: 80, shield: 120 }[key] ?? 0;
    if (this.data.unlocks[key]) return false;
    if (this.data.parts < cost) return false;
    this.data.parts -= cost;
    this.data.unlocks[key] = true;
    store.save(this.data);
    this.emit("unlock", { key });
    return true;
  }

  unlockCost(key) {
    return { bomb: 60, fire: 80, shield: 120 }[key] ?? 0;
  }

  setAssist(value) {
    this.data.assist = Boolean(value);
    store.save(this.data);
  }

  setMuted(value) {
    this.data.muted = Boolean(value);
    store.save(this.data);
  }
}
