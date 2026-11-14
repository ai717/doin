/**
 * @file games/pin/js/game.mjs
 * DOM-Free 状态机控制器，调度 engine、levels、score 与 storage。
 */

import {
  createInitialState,
  launchPin,
  stepFrame,
  resetLevel,
} from './engine.mjs';
import { getLevelById, LEVELS } from './levels.mjs';
import { calculateStars } from './score.mjs';
import { loadStorage, recordLevelClear, recordEndlessScore } from './storage.mjs';

export class GameController {
  constructor(options = {}) {
    this.storage = loadStorage();
    this.mode = options.mode || 'level'; // 'level' | 'endless'
    const startLevelId = options.levelId || this.storage.currentLevel || 1;
    this.currentLevelId = startLevelId;
    this.paused = false;
    this.state = null;

    if (this.mode === 'endless') {
      this.initEndless();
    } else {
      this.initLevel(startLevelId);
    }
  }

  initLevel(levelId) {
    const levelConfig = getLevelById(levelId);
    this.currentLevelId = levelConfig.id;
    this.mode = 'level';
    this.paused = false;
    this.state = createInitialState({
      mode: 'level',
      level: levelConfig,
      seed: Date.now(),
    });
  }

  initEndless() {
    this.mode = 'endless';
    this.paused = false;
    // 无尽模式使用动态提速关卡模板
    const endlessTemplate = {
      id: 999,
      key: 'level_endless',
      initialPins: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
      pendingCount: 9999,
      rotationType: 'pulse',
      baseSpeed: 1.8,
      speedAmp: 1.2,
      speedFreq: 1.0,
      safeAngleDeg: 8.8,
    };
    this.state = createInitialState({
      mode: 'endless',
      level: endlessTemplate,
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

  setMode(targetMode) {
    if (targetMode === 'endless') {
      this.initEndless();
    } else {
      this.initLevel(this.currentLevelId);
    }
  }

  launch() {
    if (this.paused) return;
    this.state = launchPin(this.state);
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

    // 关卡胜利结算
    if (this.state.status === 'won' && this.mode === 'level') {
      const stars = calculateStars({
        cleared: true,
        maxCombo: this.state.maxCombo,
        elapsedTime: this.state.elapsedTime,
        targetSeconds: this.state.level.targetSeconds || 30,
      });

      this.storage = recordLevelClear(this.currentLevelId, {
        stars,
        time: this.state.elapsedTime,
        maxCombo: this.state.maxCombo,
      });
    }

    // 无尽模式最高分更新
    if (this.mode === 'endless' && this.state.endlessScore > 0) {
      recordEndlessScore(this.state.endlessScore);
    }
  }
}
