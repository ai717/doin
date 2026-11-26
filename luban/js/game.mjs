/**
 * Game state coordinator for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * Pure logic, DOM-free coordinator connecting Engine, Levels, Score, and Storage.
 */

import { LEVELS } from './levels.mjs';
import {
  createGameState,
  tryExtractBlock,
  undo,
  findHint,
  rotateViewAngle,
  GAME_STATUS
} from './engine.mjs';
import { buildSettlementSummary } from './score.mjs';
import { recordLevelCompletion } from './storage.mjs';

export class LubanGame {
  constructor(options = {}) {
    this.currentLevelId = options.initialLevel || 1;
    this.levelConfig = null;
    this.state = null;

    // Callbacks
    this.onStateChange = options.onStateChange || (() => {});
    this.onSoundEffect = options.onSoundEffect || (() => {});
    this.onBlockBlocked = options.onBlockBlocked || (() => {});
    this.onBlockSlide = options.onBlockSlide || (() => {});
    this.onWin = options.onWin || (() => {});
  }

  loadLevel(levelId) {
    const config = LEVELS.find(l => l.id === levelId) || LEVELS[0];
    this.currentLevelId = config.id;
    this.levelConfig = config;
    this.state = createGameState(config);
    this.onStateChange(this.state, this.levelConfig);
  }

  restart() {
    this.loadLevel(this.currentLevelId);
  }

  nextLevel() {
    const nextId = Math.min(36, this.currentLevelId + 1);
    this.loadLevel(nextId);
  }

  handleBlockClick(blockId) {
    if (!this.state || this.state.status === GAME_STATUS.WON) {
      return { success: false };
    }

    const res = tryExtractBlock(this.state, blockId);

    if (!res.success) {
      if (res.reason === 'blocked') {
        this.onSoundEffect('wood_thud');
        this.onBlockBlocked(blockId, res.blockers);
      }
      return res;
    }

    // Free block slides out
    this.onSoundEffect('wood_slide');

    this.onBlockSlide(blockId, res.block, () => {
      this.onSoundEffect('tenon_clack');
      if (res.isWon) {
        const summary = buildSettlementSummary(this.state, this.levelConfig);
        recordLevelCompletion(this.currentLevelId, summary.rating.id, summary.steps);
        this.onSoundEffect('level_win');
        this.onWin(summary);
      }
      this.onStateChange(this.state, this.levelConfig);
    });

    return res;
  }

  handleUndo() {
    if (!this.state) return { success: false };
    const res = undo(this.state);
    if (res.success) {
      this.onSoundEffect('wood_slide');
      this.onStateChange(this.state, this.levelConfig);
    }
    return res;
  }

  handleHint() {
    if (!this.state) return { success: false };
    const res = findHint(this.state);
    if (res.success) {
      this.onSoundEffect('hint_chime');
      this.onStateChange(this.state, this.levelConfig);
    }
    return res;
  }

  handleRotate(direction = 1) {
    if (!this.state) return;
    const angle = rotateViewAngle(this.state, direction);
    this.onSoundEffect('view_rotate');
    this.onStateChange(this.state, this.levelConfig);
    return angle;
  }

  getState() {
    return this.state;
  }

  getLevelConfig() {
    return this.levelConfig;
  }
}
