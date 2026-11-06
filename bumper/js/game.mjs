/**
 * @file games/bumper/js/game.mjs
 * DOM-free 状态机控制器，调度 engine 纯函数，管理单人相扑天梯与双人同屏对撞。
 */

import {
  createInitialState,
  setCarThrust,
  stepFrame,
  resetMatch,
} from './engine.mjs';
import { getLevelById, LEVELS } from './levels.mjs';
import { loadStorage, recordLevelClear } from './storage.mjs';
import { calculateStars } from './score.mjs';

export class GameController {
  constructor() {
    this.storage = loadStorage();
    this.currentLevelId = this.storage.lastLevel || 1;
    this.currentLevel = getLevelById(this.currentLevelId);
    this.totalLevels = LEVELS.length;
    this.mode = '1p'; // '1p' | '2p'

    this.state = createInitialState({
      mode: this.mode,
      levelConfig: this.currentLevel,
    });

    this.paused = false;
    this.eventListeners = [];
  }

  getState() {
    return this.state;
  }

  getLevel() {
    return this.currentLevel;
  }

  isPaused() {
    return this.paused;
  }

  setPaused(paused) {
    this.paused = !!paused;
  }

  togglePause() {
    this.paused = !this.paused;
    return this.paused;
  }

  onEvent(callback) {
    if (typeof callback === 'function') {
      this.eventListeners.push(callback);
    }
  }

  emitEvent(ev) {
    for (const cb of this.eventListeners) {
      try {
        cb(ev);
      } catch (err) {
        // 静默防炸
      }
    }
  }

  setMode(mode) {
    if (mode !== '1p' && mode !== '2p') return;
    this.mode = mode;
    this.restartMatch();
  }

  loadLevel(levelId) {
    const id = Math.max(1, Math.min(this.totalLevels, levelId));
    this.currentLevelId = id;
    this.currentLevel = getLevelById(id);
    this.paused = false;
    this.restartMatch();
  }

  nextLevel() {
    if (this.currentLevelId < this.totalLevels) {
      this.loadLevel(this.currentLevelId + 1);
    } else {
      this.restartMatch();
    }
  }

  restartMatch() {
    this.state = createInitialState({
      mode: this.mode,
      targetScore: this.state.targetScore || 5,
      levelConfig: this.currentLevel,
    });
    this.paused = false;
  }

  /**
   * 红车冲刺控制 (P1: W/A 键或触屏左下)
   */
  setThrustRed(isThrusting) {
    if (this.paused) return;
    this.state = setCarThrust(this.state, 'red', isThrusting);
  }

  /**
   * 蓝车冲刺控制 (P2: Up/L 键或触屏右下，仅 2P 模式有效)
   */
  setThrustBlue(isThrusting) {
    if (this.paused) return;
    if (this.mode !== '2p') return; // 1P 模式下蓝车由 AI 状态机控制
    this.state = setCarThrust(this.state, 'blue', isThrusting);
  }

  /**
   * 单帧物理推进
   */
  step(dt) {
    if (this.paused) return;

    this.state = stepFrame(this.state, dt);

    // 派发单帧瞬态物理事件
    if (this.state.events && this.state.events.length > 0) {
      for (const ev of this.state.events) {
        this.emitEvent(ev);

        // 如果在 1P 模式决出胜负且红方获胜，结算星级
        if (ev.type === 'match_win' && this.mode === '1p' && ev.winner === 'red') {
          const starResult = calculateStars(this.state);
          this.storage = recordLevelClear(
            this.currentLevelId,
            starResult.totalStars,
            this.state.scores.red
          );
        }
      }
    }
  }
}
