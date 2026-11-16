/**
 * @file games/tidy/js/game.mjs
 * DOM-Free 状态机控制器，调度 engine、levels、score 与 storage。
 */

import {
  createInitialState,
  pickUpItem,
  moveItem,
  rotateItem,
  releaseItem,
  useHint,
  stepFrame,
  resetLevel,
} from './engine.mjs';
import { getLevelById, LEVELS } from './levels.mjs';
import { calculateStars } from './score.mjs';
import { loadStorage, recordLevelClear } from './storage.mjs';

export class GameController {
  constructor(options = {}) {
    this.storage = loadStorage();
    const startLevelId = options.levelId || this.storage.currentLevel || 1;
    this.currentLevelId = startLevelId;
    this.paused = false;
    this.state = null;

    this.initLevel(startLevelId);
  }

  initLevel(levelId) {
    const levelConfig = getLevelById(levelId);
    this.currentLevelId = levelConfig.id;
    this.paused = false;
    this.state = createInitialState({
      level: levelConfig,
      seed: Date.now(),
    });
  }

  getState() {
    return this.state;
  }

  isPaused() {
    return this.paused;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  pickUp(itemId, clientX, clientY) {
    if (this.paused || this.state.status === 'won') return;
    this.state = pickUpItem(this.state, itemId, clientX, clientY);
  }

  move(clientX, clientY) {
    if (this.paused || this.state.status === 'won') return;
    this.state = moveItem(this.state, clientX, clientY);
  }

  rotate(itemId, dir = 1) {
    if (this.paused || this.state.status === 'won') return;
    const targetId = itemId || this.state.heldItemId;
    if (targetId) {
      this.state = rotateItem(this.state, targetId, dir);
    }
  }

  release() {
    if (this.paused || this.state.status === 'won') return;
    this.state = releaseItem(this.state);

    // 若通关，结算星级并持久化存档
    if (this.state.status === 'won') {
      const stars = calculateStars({
        cleared: true,
        failedAttempts: this.state.failedAttempts,
        elapsedTime: this.state.elapsedTime,
        targetSeconds: this.state.level.targetSeconds || 45,
      });

      this.storage = recordLevelClear(this.currentLevelId, {
        stars,
        time: this.state.elapsedTime,
        moves: this.state.moves,
      });
    }
  }

  hint() {
    if (this.paused || this.state.status === 'won') return;
    this.state = useHint(this.state);
  }

  restart() {
    this.paused = false;
    this.state = resetLevel(this.state);
  }

  loadLevel(levelId) {
    this.initLevel(levelId);
  }

  loadNextLevel() {
    const nextId = Math.min(LEVELS.length, this.currentLevelId + 1);
    this.initLevel(nextId);
  }

  step(dt) {
    if (this.paused) return;
    this.state = stepFrame(this.state, dt);
  }
}
