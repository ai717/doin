/**
 * State machine and game flow coordinator for Tenpai King · Wait Finder (雀神听牌王 · 听牌速判)
 * Pure logic, DOM-free coordinator connecting Engine, Levels, Score, and Storage.
 */

import { LEVELS } from './levels.mjs';
import { evaluateAnswer } from './score.mjs';
import { recordQuestionResult, loadSaveData } from './storage.mjs';

export const GAME_STATUS = {
  ANSWERING: 'answering',
  SUBMITTED: 'submitted',
  PAUSED: 'paused'
};

export class TenpaiGame {
  constructor(options = {}) {
    this.currentLevelId = options.initialLevel || 1;
    this.levelConfig = null;
    this.status = GAME_STATUS.ANSWERING;
    this.userPicks = new Set();
    this.userTarget = null;
    this.remainingSec = 30;
    this.currentStreak = 0;
    this.lastEvalResult = null;
    this.tickAccumulator = 0;

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onSoundEffect = options.onSoundEffect || (() => {});
    this.onComplete = options.onComplete || (() => {});
  }

  loadLevel(levelId) {
    const config = LEVELS.find(l => l.id === levelId) || LEVELS[0];
    this.currentLevelId = config.id;
    this.levelConfig = config;
    this.status = GAME_STATUS.ANSWERING;
    this.userPicks.clear();
    this.userTarget = null;
    this.remainingSec = config.timeLimit;
    this.lastEvalResult = null;
    this.tickAccumulator = 0;

    this.onSoundEffect('tile_clack');
    this.onStateChange();
  }

  restart() {
    this.loadLevel(this.currentLevelId);
  }

  nextLevel() {
    const nextId = Math.min(60, this.currentLevelId + 1);
    this.loadLevel(nextId);
  }

  togglePick(tileId) {
    if (this.status !== GAME_STATUS.ANSWERING) return;

    if (!this.userPicks.has(tileId)) {
      this.userPicks.add(tileId);
      this.onSoundEffect('tile_select');
    } else if (this.userTarget !== tileId) {
      this.userTarget = tileId;
      this.onSoundEffect('target_set');
    } else {
      this.userPicks.delete(tileId);
      this.userTarget = null;
      this.onSoundEffect('tile_select');
    }

    this.onStateChange();
  }

  clearPicks() {
    if (this.status !== GAME_STATUS.ANSWERING) return;
    this.userPicks.clear();
    this.userTarget = null;
    this.onSoundEffect('tile_select');
    this.onStateChange();
  }

  submit() {
    if (this.status !== GAME_STATUS.ANSWERING) return;

    const picksArray = Array.from(this.userPicks);
    const evalResult = evaluateAnswer(
      picksArray,
      this.userTarget,
      this.levelConfig,
      this.remainingSec,
      this.currentStreak
    );

    this.status = GAME_STATUS.SUBMITTED;
    this.lastEvalResult = evalResult;

    if (evalResult.isPassed) {
      this.currentStreak += 1;
      if (evalResult.isPerfect) {
        this.onSoundEffect('hu_fanfare');
      } else {
        this.onSoundEffect('reveal_correct');
      }
    } else {
      this.currentStreak = 0;
      this.onSoundEffect('reveal_wrong');
    }

    recordQuestionResult(this.currentLevelId, evalResult.totalScore, evalResult.isPassed);

    this.onComplete(evalResult);
    this.onStateChange();
  }

  togglePause() {
    if (this.status === GAME_STATUS.ANSWERING) {
      this.status = GAME_STATUS.PAUSED;
      this.onStateChange();
      return true;
    } else if (this.status === GAME_STATUS.PAUSED) {
      this.status = GAME_STATUS.ANSWERING;
      this.onStateChange();
      return false;
    }
    return null;
  }

  pause() {
    if (this.status === GAME_STATUS.ANSWERING) {
      this.status = GAME_STATUS.PAUSED;
      this.onStateChange();
    }
  }

  resume() {
    if (this.status === GAME_STATUS.PAUSED) {
      this.status = GAME_STATUS.ANSWERING;
      this.onStateChange();
    }
  }

  update(dtSeconds) {
    if (this.status !== GAME_STATUS.ANSWERING) return;

    this.remainingSec = Math.max(0, this.remainingSec - dtSeconds);
    this.tickAccumulator += dtSeconds;

    // Wood temple block tick sound every second (or twice a second if < 5s)
    const tickInterval = this.remainingSec <= 5 ? 0.5 : 1.0;
    if (this.tickAccumulator >= tickInterval) {
      this.tickAccumulator = 0;
      this.onSoundEffect('timer_tick', this.remainingSec <= 5);
    }

    if (this.remainingSec <= 0) {
      // Time is up -> automatic submission!
      this.submit();
    }

    this.onStateChange();
  }

  getState() {
    const data = loadSaveData();
    return {
      status: this.status,
      levelConfig: this.levelConfig,
      currentLevelId: this.currentLevelId,
      userPicks: Array.from(this.userPicks),
      userTarget: this.userTarget,
      remainingSec: this.remainingSec,
      currentStreak: this.currentStreak,
      lastEvalResult: this.lastEvalResult,
      totalScore: data.totalScore,
      unlockedLevel: data.unlockedLevel
    };
  }
}
