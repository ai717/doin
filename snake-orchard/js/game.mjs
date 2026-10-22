import { Engine } from './engine.mjs';
import { ScoreManager } from './score.mjs';
import { audio } from './audio.mjs';
import { loadGameData, saveGameData } from './storage.mjs';

export const STATES = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER'
};

export const DIFFICULTY_SPEEDS = {
  easy: { base: 0.22, min: 0.12, accel: 0.001 },
  normal: { base: 0.14, min: 0.07, accel: 0.0015 },
  hard: { base: 0.08, min: 0.045, accel: 0.002 }
};

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.engine = new Engine();
    this.storedData = loadGameData();
    this.scoreManager = new ScoreManager(this.storedData.bestScore);
    this.state = STATES.READY;

    this.difficulty = this.storedData.difficulty || 'normal';
    this.accumulatedTime = 0;
    this.lastFrameTime = performance.now();
  }

  setDifficulty(diff) {
    if (!DIFFICULTY_SPEEDS[diff]) return;
    this.difficulty = diff;
    this.storedData.difficulty = diff;
    saveGameData(this.storedData);
    this.ui.updateDifficultyUI(diff);
  }

  start() {
    this.engine.reset();
    this.scoreManager.reset();
    this.accumulatedTime = 0;
    this.lastFrameTime = performance.now();
    this.state = STATES.PLAYING;
    this.ui.hideAllModals();
    this.ui.updatePauseButtonState(false);
    this.syncHUD();
  }

  pause() {
    if (this.state === STATES.PLAYING) {
      this.state = STATES.PAUSED;
      this.ui.showModal(this.ui.modalPause);
      this.ui.updatePauseButtonState(true);
    }
  }

  resume() {
    if (this.state === STATES.PAUSED) {
      this.state = STATES.PLAYING;
      this.lastFrameTime = performance.now();
      this.ui.hideModal(this.ui.modalPause);
      this.ui.updatePauseButtonState(false);
    }
  }

  togglePause() {
    if (this.state === STATES.PLAYING) {
      this.pause();
    } else if (this.state === STATES.PAUSED) {
      this.resume();
    }
  }

  handleInput(dir) {
    if (this.state !== STATES.PLAYING) return;
    const ok = this.engine.setDirection(dir);
    if (ok) {
      audio.playTurn();
    }
  }

  syncHUD() {
    const s = this.scoreManager.getSnapshot();
    const st = this.engine.getState();
    this.ui.updateHUD(s.score, s.bestScore, st.snake.length, s.combo);
  }

  update(now, renderer) {
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    if (this.state === STATES.PLAYING) {
      this.accumulatedTime += dt;
      const cfg = DIFFICULTY_SPEEDS[this.difficulty] || DIFFICULTY_SPEEDS.normal;
      const curLength = this.engine.getState().snake.length;
      const speedTier = Math.max(cfg.min, cfg.base - Math.min(curLength * cfg.accel, cfg.base - cfg.min));

      while (this.accumulatedTime >= speedTier) {
        this.accumulatedTime -= speedTier;
        const state = this.engine.step(speedTier);

        if (state.lastEvent === 'eat_normal') {
          audio.playEatNormal();
          const head = state.snake[0];
          const cellW = 600 / state.gridWidth;
          const cellH = 600 / state.gridHeight;
          renderer.emitFruitParticles(head.x * cellW + cellW / 2, head.y * cellH + cellH / 2, '#f43f5e');
          this.scoreManager.addAppleScore('normal', performance.now() / 1000);
          this.syncHUD();
        } else if (state.lastEvent === 'eat_special') {
          audio.playEatSpecial();
          const head = state.snake[0];
          const cellW = 600 / state.gridWidth;
          const cellH = 600 / state.gridHeight;
          renderer.emitFruitParticles(head.x * cellW + cellW / 2, head.y * cellH + cellH / 2, '#fbbf24');
          this.scoreManager.addAppleScore('special', performance.now() / 1000);
          this.syncHUD();
        } else if (state.lastEvent === 'die') {
          audio.playHit();
          this.state = STATES.GAMEOVER;
          this.handleGameOver();
          break;
        }
      }
    }

    renderer.draw(this.engine.getState(), dt);
  }

  handleGameOver() {
    const s = this.scoreManager.getSnapshot();
    this.storedData.gamesPlayed += 1;
    this.storedData.applesTotal += s.applesCount;
    if (s.score > this.storedData.bestScore) {
      this.storedData.bestScore = s.score;
    }
    saveGameData(this.storedData);
    this.ui.showGameOver(s.score, this.storedData.bestScore, s.applesCount);
  }
}
