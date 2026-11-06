/**
 * @file games/mtower/js/game.mjs
 * DOM-Free 状态机控制器，调度纯逻辑引擎、撤销栈与楼层穿梭。
 */

import { createInitialState, step } from './engine.mjs';
import { loadStorage, saveStorage, recordVictory } from './storage.mjs';

export class GameController {
  constructor(options = {}) {
    this.mode = options.mode || 'classic50';
    this.state = createInitialState({ mode: this.mode });
    this.storage = loadStorage();
    this.paused = false;
  }

  getState() {
    return this.state;
  }

  isPaused() {
    return this.paused;
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.restart();
  }

  restart() {
    this.state = createInitialState({ mode: this.mode });
    this.paused = false;
  }

  move(dx, dy) {
    if (this.paused) return;
    this.state = step(this.state, { type: 'move', dx, dy });
    this.checkVictoryPersistence();
  }

  undo() {
    this.state = step(this.state, { type: 'undo' });
  }

  rewindFloor(floor) {
    this.state = step(this.state, { type: 'rewind_floor', floor });
  }

  fly(targetFloor) {
    this.state = step(this.state, { type: 'fly', floor: targetFloor });
  }

  useHolyWater() {
    this.state = step(this.state, { type: 'use_water' });
  }

  useEarthquake() {
    this.state = step(this.state, { type: 'use_quake' });
  }

  updateTimer(dt) {
    if (!this.paused && this.state.status === 'playing') {
      this.state.elapsedTime += dt;
    }
  }

  checkVictoryPersistence() {
    if (this.state.status === 'won') {
      this.storage = recordVictory({
        score: this.state.hero.hp + this.state.hero.atk * 20 + this.state.hero.def * 20,
        floor: this.state.currentFloor,
      }, this.mode);
    }
  }
}
