/**
 * @file games/sleepwalker/js/game.mjs
 * DOM-free 状态机控制器，接收 UI 意图调度 engine，管理关卡流转与数据记录。
 */

import { LEVELS, getLevelById, getTotalLevels } from './levels.mjs';
import {
  createInitialState,
  clickGadget,
  stepFrame,
  rewind,
  setFastForward,
} from './engine.mjs';
import { recordLevelClear, loadGameData, saveGameData } from './storage.mjs';
import { calculateStars } from './score.mjs';

export class GameController {
  constructor(initialLevelId = 1) {
    this.storage = loadGameData();
    const targetLevelId = initialLevelId || this.storage.currentLevel || 1;
    this.currentLevel = getLevelById(targetLevelId);
    this.state = createInitialState(this.currentLevel);
    this.paused = false;
    this.state.isPaused = false;
    this.eventListeners = [];
    this.lastStepTime = 0;
    this.totalLevels = getTotalLevels();
  }

  /**
   * 注册游戏事件回调 (win, lost, bubble, scare, bounce, rewind 等)
   */
  onEvent(cb) {
    if (typeof cb === 'function') {
      this.eventListeners.push(cb);
    }
  }

  emitEvents(events) {
    if (!events || !events.length) return;
    for (const ev of events) {
      for (const cb of this.eventListeners) {
        try {
          cb(ev);
        } catch (e) {
          // 静默
        }
      }
    }
  }

  /**
   * 载入指定关卡
   */
  loadLevel(levelId) {
    const id = Math.max(1, Math.min(this.totalLevels, levelId));
    this.currentLevel = getLevelById(id);
    this.state = createInitialState(this.currentLevel);
    this.paused = false;
    this.state.isPaused = false;
    this.storage.currentLevel = id;
    saveGameData(this.storage);
    this.emitEvents([{ type: 'level_loaded', levelId: id }]);
    return this.state;
  }

  /**
   * 重新开始当前关卡
   */
  restartLevel() {
    this.state = createInitialState(this.currentLevel);
    this.paused = false;
    this.state.isPaused = false;
    this.emitEvents([{ type: 'restart', levelId: this.currentLevel.id }]);
    return this.state;
  }

  /**
   * 下一关
   */
  nextLevel() {
    if (this.currentLevel.id < this.totalLevels) {
      return this.loadLevel(this.currentLevel.id + 1);
    }
    return this.state;
  }

  /**
   * 点击场景中某个机关
   */
  clickGadget(gadgetId) {
    const ok = clickGadget(this.state, gadgetId);
    if (ok) {
      this.emitEvents(this.state.events);
    }
    return ok;
  }

  /**
   * 根据坐标点击（UI层命中检测）
   */
  clickAt(x, y) {
    if (this.state.status !== 'playing') return false;

    // 优先检测可互动机关
    for (const id in this.state.gadgets) {
      const g = this.state.gadgets[id];
      // 容差判定区域稍大，提升触控手感
      if (
        x >= g.x - 12 &&
        x <= g.x + g.w + 12 &&
        y >= g.y - 12 &&
        y <= g.y + g.h + 12
      ) {
        return this.clickGadget(g.id);
      }
    }
    return false;
  }

  /**
   * 时光倒流 5 秒
   */
  rewind(seconds = 5) {
    this.paused = false;
    this.state.isPaused = false;
    const ok = rewind(this.state, seconds);
    if (ok) {
      this.emitEvents(this.state.events);
    }
    return ok;
  }

  /**
   * 暂停/继续切换
   */
  togglePause() {
    this.paused = !this.paused;
    this.state.isPaused = this.paused;
    this.emitEvents([{ type: 'pause_toggled', paused: this.paused }]);
    return this.paused;
  }

  setPaused(val) {
    this.paused = Boolean(val);
    this.state.isPaused = this.paused;
    this.emitEvents([{ type: 'pause_toggled', paused: this.paused }]);
    return this.paused;
  }

  isPaused() {
    return this.paused;
  }

  /**
   * 切换 1.5x 倍速
   */
  toggleFastForward() {
    const nextVal = !this.state.fastForward;
    setFastForward(this.state, nextVal);
    this.storage.fastSpeed = nextVal;
    saveGameData(this.storage);
    return nextVal;
  }

  setFastForward(val) {
    setFastForward(this.state, val);
  }

  /**
   * 推进物理时钟
   */
  step(dt) {
    if (this.paused) {
      return this.state;
    }

    if (this.state.status === 'playing') {
      const prevStatus = this.state.status;
      stepFrame(this.state, dt);

      // 处理音频与视觉瞬态事件
      if (this.state.events && this.state.events.length) {
        this.emitEvents(this.state.events);
      }

      // 如果本帧判定通关
      if (prevStatus === 'playing' && this.state.status === 'won') {
        const starResult = calculateStars(this.state);
        const updatedStorage = recordLevelClear(
          this.currentLevel.id,
          starResult.stars,
          starResult.bubblesCount
        );
        this.storage = updatedStorage;
        this.emitEvents([{
          type: 'level_won',
          levelId: this.currentLevel.id,
          stars: starResult.stars,
          bubbles: starResult.bubblesCount,
          time: this.state.time,
        }]);
      }

      // 如果本帧判定失败
      if (prevStatus === 'playing' && this.state.status === 'lost') {
        this.emitEvents([{
          type: 'level_lost',
          levelId: this.currentLevel.id,
          reason: this.state.events.find((e) => e.type === 'scare')?.reason || 'fail',
        }]);
      }
    } else {
      // 结束状态下仍可更新入梦/打呼动效
      stepFrame(this.state, dt);
    }

    return this.state;
  }

  getState() {
    return this.state;
  }

  getLevel() {
    return this.currentLevel;
  }
}
