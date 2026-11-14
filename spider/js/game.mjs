// Spider Solitaire Game Controller
// Coordinates engine, rules, audio, storage, and timer.

import { SpiderEngine } from './engine.mjs';
import { sound } from './audio.mjs';
import { calculateScore, calculateStars } from './score.mjs';
import { loadGameData, saveGameData, recordLevelResult, clearSavedGame } from './storage.mjs';
import { LEVELS, getLevelById, getDailySeed } from './levels.mjs';

export class SpiderGameController {
  constructor({ onStateChange, onVictory, onRunCleared } = {}) {
    this.onStateChange = onStateChange || (() => {});
    this.onVictory = onVictory || (() => {});
    this.onRunCleared = onRunCleared || (() => {});

    this.mode = 'story'; // 'story' | 'endless' | 'daily'
    this.currentLevel = LEVELS[0];
    this.suitCount = 2;
    this.seed = 10421;

    this.engine = new SpiderEngine({ seed: this.seed, suitCount: this.suitCount });
    this.timeSeconds = 0;
    this.timerId = null;
    this.isPaused = false;
    this.isWon = false;

    // Load saved sound preference
    const saved = loadGameData();
    if (saved && typeof saved.soundMuted === 'boolean') {
      sound.setMuted(saved.soundMuted);
    }
  }

  startTimer() {
    this.stopTimer();
    this.timerId = setInterval(() => {
      if (!this.isPaused && !this.isWon) {
        this.timeSeconds++;
        this.emitChange();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  emitChange(extra = {}) {
    this.onStateChange({
      mode: this.mode,
      level: this.currentLevel,
      suitCount: this.suitCount,
      columns: this.engine.columns,
      stockCount: this.engine.stock.length,
      dealsLeft: this.engine.remainingStockDeals,
      completedRuns: this.engine.completedRuns,
      moves: this.engine.movesCount,
      par: this.currentLevel ? this.currentLevel.par : 120,
      timeSeconds: this.timeSeconds,
      isWon: this.isWon,
      canUndo: this.engine.history.length > 0,
      score: this.getCurrentScore(),
      ...extra
    });
  }

  getCurrentScore() {
    return calculateScore({
      runsCleared: this.engine.completedRuns.length,
      moves: this.engine.movesCount,
      timeSeconds: this.timeSeconds,
      suitCount: this.suitCount,
      par: this.currentLevel ? this.currentLevel.par : 120,
      isWon: this.isWon
    });
  }

  startStoryLevel(levelId) {
    const level = getLevelById(levelId);
    this.mode = 'story';
    this.currentLevel = level;
    this.suitCount = level.suitCount;
    this.seed = level.seed;
    this.timeSeconds = 0;
    this.isWon = false;
    this.isPaused = false;

    this.engine.init(this.seed, this.suitCount);
    this.startTimer();
    this.emitChange();
  }

  startEndless(suitCount = 2, seed = null) {
    this.mode = 'endless';
    this.currentLevel = null;
    this.suitCount = suitCount;
    this.seed = seed !== null ? seed : Math.floor(Math.random() * 900000 + 100000);
    this.timeSeconds = 0;
    this.isWon = false;
    this.isPaused = false;

    this.engine.init(this.seed, this.suitCount);
    this.startTimer();
    this.emitChange();
  }

  startDaily(dateStr = null) {
    this.mode = 'daily';
    this.currentLevel = null;
    this.suitCount = 2; // Daily default standard 2-suit
    this.seed = getDailySeed(dateStr);
    this.timeSeconds = 0;
    this.isWon = false;
    this.isPaused = false;

    this.engine.init(this.seed, this.suitCount);
    this.startTimer();
    this.emitChange();
  }

  restart() {
    this.timeSeconds = 0;
    this.isWon = false;
    this.isPaused = false;
    this.engine.init(this.seed, this.suitCount);
    this.startTimer();
    sound.playUndo();
    this.emitChange();
  }

  dealStock() {
    if (this.isWon || this.engine.stock.length < 10) return false;
    const res = this.engine.dealStock();
    if (res.success) {
      sound.playDeal();

      if (res.clearedRuns && res.clearedRuns.length > 0) {
        sound.playRunClear();
        for (const run of res.clearedRuns) {
          this.onRunCleared(run);
        }
      }

      this.checkVictory();
      this.emitChange({ cardsDealt: res.cardsDealt });
      return true;
    }
    return false;
  }

  moveCards(fromCol, cardIndex, toCol) {
    if (this.isWon) return false;
    const res = this.engine.move(fromCol, cardIndex, toCol);
    if (res.success) {
      sound.playCardDrop();

      if (res.clearedRuns && res.clearedRuns.length > 0) {
        sound.playRunClear();
        for (const run of res.clearedRuns) {
          this.onRunCleared(run);
        }
      }

      this.checkVictory();
      this.emitChange({ moved: true, flippedCard: res.flippedCard });
      return true;
    }
    return false;
  }

  smartMove(fromCol, cardIndex) {
    if (this.isWon) return false;
    const smart = this.engine.findSmartMove(fromCol, cardIndex);
    if (smart) {
      return this.moveCards(fromCol, cardIndex, smart.toCol);
    }
    return false;
  }

  undo() {
    if (this.isWon || this.engine.history.length === 0) return false;
    const ok = this.engine.undo();
    if (ok) {
      sound.playUndo();
      this.emitChange();
      return true;
    }
    return false;
  }

  getHint() {
    if (this.isWon) return null;
    const hint = this.engine.getHint();
    if (hint) {
      sound.playHint();
    }
    return hint;
  }

  checkVictory() {
    if (this.engine.isWon && !this.isWon) {
      this.isWon = true;
      this.stopTimer();
      sound.playVictory();

      const finalScore = this.getCurrentScore();
      const stars = calculateStars({
        isWon: true,
        moves: this.engine.movesCount,
        par: this.currentLevel ? this.currentLevel.par : 120
      });

      if (this.mode === 'story' && this.currentLevel) {
        recordLevelResult(this.currentLevel.id, stars, finalScore, this.engine.movesCount);
      }

      this.onVictory({
        score: finalScore,
        moves: this.engine.movesCount,
        timeSeconds: this.timeSeconds,
        stars,
        mode: this.mode,
        level: this.currentLevel
      });
    }
  }
}
