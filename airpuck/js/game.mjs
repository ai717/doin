/**
 * @file games/airpuck/js/game.mjs
 * DOM-Free 状态机控制器，调度物理引擎、模式切换、单人关卡与本地双人对战。
 */

import {
  createInitialState,
  stepFrame,
  setInput,
  triggerDash,
  resetRound,
} from './engine.mjs';
import { getLevelById, LEVELS } from './levels.mjs';
import {
  loadStorage,
  recordLevelClear,
  recordVsMatch,
} from './storage.mjs';
import { calculateStars } from './score.mjs';

export class GameController {
  constructor(options = {}) {
    this.storage = loadStorage();
    this.mode = options.mode || 'ai'; // 'ai' | '2p'
    this.currentLevelId = Math.min(22, Math.max(1, options.levelId || this.storage.unlockedLevel || 1));
    this.paused = false;

    this.initGame();
  }

  initGame() {
    const level = getLevelById(this.currentLevelId);
    this.state = createInitialState({
      mode: this.mode,
      level,
      targetScore: 5,
    });
    this.paused = false;
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

  setMode(mode) {
    if (mode !== 'ai' && mode !== '2p') return;
    this.mode = mode;
    this.initGame();
  }

  loadLevel(levelId) {
    const numericId = typeof levelId === 'number' ? levelId : parseInt(levelId, 10);
    this.currentLevelId = Math.max(1, Math.min(22, numericId));
    this.mode = 'ai';
    this.initGame();
  }

  loadNextLevel() {
    if (this.currentLevelId < 22) {
      this.loadLevel(this.currentLevelId + 1);
    } else {
      this.restart();
    }
  }

  restart() {
    this.initGame();
  }

  setP1Input(ix, iy) {
    if (this.paused) return;
    this.state = setInput(this.state, 'p1', ix, iy);
  }

  setP2Input(ix, iy) {
    if (this.paused) return;
    this.state = setInput(this.state, 'p2', ix, iy);
  }

  p1Dash() {
    if (this.paused) return;
    this.state = triggerDash(this.state, 'p1');
  }

  p2Dash() {
    if (this.paused) return;
    this.state = triggerDash(this.state, 'p2');
  }

  step(dt) {
    if (this.paused) return;

    this.state = stepFrame(this.state, dt);

    // 监听比赛终局结算事件
    if (this.state.status === 'won') {
      if (this.mode === 'ai') {
        const starsResult = calculateStars(this.state, this.state.level);
        if (starsResult.won) {
          this.storage = recordLevelClear(this.currentLevelId, starsResult, this.state.elapsedTime);
        }
      } else {
        this.storage = recordVsMatch(this.state.winner);
      }
    }
  }
}
