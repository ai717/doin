/**
 * @file games/tug/js/game.mjs
 * DOM-free 状态机控制器，调度 engine 纯函数，管理单人天梯与双人模式流转。
 */

import {
  createInitialState,
  handlePullAction,
  stepFrame,
  resetMatch,
} from './engine.mjs';
import { getLevelById, LEVELS } from './levels.mjs';
import { loadStorage, saveStorage, recordLevelClear } from './storage.mjs';
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
      levelConfig: this.currentLevel,
    });
    this.paused = false;
  }

  /**
   * 红方按键拉扯 (P1: A 键或屏幕红按钮)
   */
  pullRed() {
    if (this.paused) return null;
    const { state, actionResult } = handlePullAction(this.state, 'red');
    this.state = state;
    if (actionResult) {
      this.emitEvent({
        type: 'pull_action',
        ...actionResult,
      });
    }
    return actionResult;
  }

  /**
   * 蓝方按键拉扯 (P2: L 键或屏幕蓝按钮，仅在 2P 模式有效)
   */
  pullBlue() {
    if (this.paused) return null;
    if (this.mode !== '2p') return null; // 1P 模式下蓝方由 AI 驱动
    const { state, actionResult } = handlePullAction(this.state, 'blue');
    this.state = state;
    if (actionResult) {
      this.emitEvent({
        type: 'pull_action',
        ...actionResult,
      });
    }
    return actionResult;
  }

  /**
   * 物理时钟推进一帧
   */
  step(dt) {
    if (this.paused) return;

    this.state = stepFrame(this.state, dt);

    // 派发单帧瞬态事件
    if (this.state.events && this.state.events.length > 0) {
      for (const ev of this.state.events) {
        this.emitEvent(ev);

        // 如果在 1P 模式决出胜负且红方获胜，结算星级
        if (ev.type === 'match_win' && this.mode === '1p' && ev.winner === 'red') {
          const starResult = calculateStars(this.state);
          this.storage = recordLevelClear(
            this.currentLevelId,
            starResult.totalStars,
            this.state.stats.redMaxCps
          );
        }
      }
    }
  }
}
