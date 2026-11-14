/**
 * Glyph Craft (字灵拆拆乐) - Game Controller
 * Pure DOM-free State Machine Controller.
 */

import { getLevelById, getTotalLevels } from './levels.mjs';
import {
  createInitialState,
  synthesizeGlyphs,
  disassembleGlyph,
  sliceSceneObstacle,
  applyGlyphToObstacle,
  undo as engineUndo
} from './engine.mjs';
import { loadGameData, recordLevelSuccess } from './storage.mjs';
import { calculateLevelStars } from './score.mjs';

export class GameController {
  constructor() {
    this.currentLevelId = 1;
    this.currentLevel = getLevelById(1);
    this.engineState = null;
    this.storageData = loadGameData();
    this.paused = false;
    this.onStateChange = null;
    this.onVictory = null;
  }

  init(levelId = null) {
    const saved = loadGameData();
    this.storageData = saved;
    const targetLevelId = levelId || saved.highestLevel || 1;
    this.startLevel(targetLevelId);
  }

  startLevel(levelId) {
    const safeId = Math.max(1, Math.min(getTotalLevels(), levelId));
    this.currentLevelId = safeId;
    this.currentLevel = getLevelById(safeId);
    this.engineState = createInitialState(this.currentLevel);
    this.paused = false;
    this._notify();
  }

  applyGlyph(glyphUid, obstacleId) {
    if (this.paused || !this.engineState) return { success: false };
    const res = applyGlyphToObstacle(this.engineState, glyphUid, obstacleId);
    if (res.success) {
      this._checkVictory();
      this._notify();
    }
    return res;
  }

  synthesize(uidA, uidB) {
    if (this.paused || !this.engineState) return { success: false };
    const res = synthesizeGlyphs(this.engineState, uidA, uidB);
    if (res.success) {
      this._notify();
    }
    return res;
  }

  disassemble(glyphUid) {
    if (this.paused || !this.engineState) return { success: false };
    const res = disassembleGlyph(this.engineState, glyphUid);
    if (res.success) {
      this._notify();
    }
    return res;
  }

  sliceObstacle(obstacleId) {
    if (this.paused || !this.engineState) return { success: false };
    const res = sliceSceneObstacle(this.engineState, obstacleId);
    if (res.success) {
      this._checkVictory();
      this._notify();
    }
    return res;
  }

  undo() {
    if (this.paused || !this.engineState) return { success: false };
    const res = engineUndo(this.engineState);
    if (res.success) {
      this._notify();
    }
    return res;
  }

  resetLevel() {
    if (!this.currentLevel) return;
    this.engineState = createInitialState(this.currentLevel);
    this.paused = false;
    this._notify();
  }

  togglePause(explicitState = null) {
    if (explicitState !== null) {
      this.paused = !!explicitState;
    } else {
      this.paused = !this.paused;
    }
    this._notify();
    return this.paused;
  }

  _checkVictory() {
    if (this.engineState && this.engineState.won) {
      const starAssessment = calculateLevelStars(this.currentLevel, this.engineState);
      const newDiscovered = Array.from(this.engineState.discoveredGlyphs);
      this.storageData = recordLevelSuccess(
        this.currentLevelId,
        starAssessment.stars,
        newDiscovered
      );
      if (typeof this.onVictory === 'function') {
        this.onVictory({
          level: this.currentLevel,
          state: this.engineState,
          assessment: starAssessment
        });
      }
    }
  }

  _notify() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }

  getState() {
    return {
      levelId: this.currentLevelId,
      level: this.currentLevel,
      engine: this.engineState,
      paused: this.paused,
      storage: this.storageData
    };
  }
}
