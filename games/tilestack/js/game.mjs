/**
 * State machine and game flow coordinator for TileStack (千层瓦片 · 叠叠消)
 * DOM-free coordinator connecting Engine, Levels, Score, and Storage.
 */

import { LEVELS } from './levels.mjs';
import {
  createGameState,
  pickTile,
  undo,
  findHint,
  stepFrame,
  GAME_STATUS
} from './engine.mjs';
import { calculateSettlement } from './score.mjs';
import { recordLevelCompletion } from './storage.mjs';

export class TileStackGame {
  constructor(options = {}) {
    this.currentLevelId = options.initialLevel || 1;
    this.levelConfig = null;
    this.state = null;

    // Event hooks
    this.onStateChange = options.onStateChange || (() => {});
    this.onMatch = options.onMatch || (() => {});
    this.onSoundEffect = options.onSoundEffect || (() => {});
    this.onWin = options.onWin || (() => {});
    this.onLose = options.onLose || (() => {});
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
    const nextId = Math.min(40, this.currentLevelId + 1);
    this.loadLevel(nextId);
  }

  handleTileClick(tileId, clientPos = null) {
    if (!this.state || this.state.status === GAME_STATUS.WON || this.state.status === GAME_STATUS.LOST) {
      return { action: null };
    }

    const prevKeys = this.state.unlockedKeys;
    const result = pickTile(this.state, tileId);

    if (!result.success) {
      return result;
    }

    // Play tile tap audio
    this.onSoundEffect('tile_tap');

    if (result.action === 'shattered_ice') {
      this.onSoundEffect('ice_shatter');
      this.onStateChange(this.state, this.levelConfig);
      return result;
    }

    if (this.state.unlockedKeys > prevKeys) {
      this.onSoundEffect('key_unlock');
    }

    // Tile landed in tray
    this.onSoundEffect('tray_land');

    if (result.matchResult && result.matchResult.matched) {
      const combo = result.matchResult.comboCount;
      this.onSoundEffect('match_chime', combo);
      this.onMatch(result.matchResult, clientPos);
    }

    // Warning sound if 6 tiles in tray
    if (this.state.tray.length === 6) {
      this.onSoundEffect('tray_warning');
    }

    if (result.action === 'won') {
      const settlement = calculateSettlement(this.state, this.levelConfig);
      recordLevelCompletion(this.currentLevelId, settlement.stars, settlement.totalScore);
      this.onSoundEffect('level_win');
      this.onWin(settlement);
    } else if (result.action === 'lost') {
      const settlement = calculateSettlement(this.state, this.levelConfig);
      this.onSoundEffect('level_lose');
      this.onLose(settlement);
    }

    this.onStateChange(this.state, this.levelConfig);
    return result;
  }

  handleUndo() {
    if (!this.state) return { success: false };
    const res = undo(this.state);
    if (res.success) {
      this.onSoundEffect('tile_tap');
      this.onStateChange(this.state, this.levelConfig);
    }
    return res;
  }

  handleHint() {
    if (!this.state) return { success: false };
    const res = findHint(this.state);
    if (res.success) {
      this.onSoundEffect('tile_tap');
      this.onStateChange(this.state, this.levelConfig);
    }
    return res;
  }

  togglePause() {
    if (!this.state || !this.state.isTimed) return;
    if (this.state.status === GAME_STATUS.PLAYING) {
      this.state.status = GAME_STATUS.PAUSED;
      this.onStateChange(this.state, this.levelConfig);
      return true;
    } else if (this.state.status === GAME_STATUS.PAUSED) {
      this.state.status = GAME_STATUS.PLAYING;
      this.onStateChange(this.state, this.levelConfig);
      return false;
    }
    return null;
  }

  pause() {
    if (this.state && this.state.isTimed && this.state.status === GAME_STATUS.PLAYING) {
      this.state.status = GAME_STATUS.PAUSED;
      this.onStateChange(this.state, this.levelConfig);
    }
  }

  resume() {
    if (this.state && this.state.isTimed && this.state.status === GAME_STATUS.PAUSED) {
      this.state.status = GAME_STATUS.PLAYING;
      this.onStateChange(this.state, this.levelConfig);
    }
  }

  update(dtSeconds) {
    if (!this.state || this.state.status !== GAME_STATUS.PLAYING) return;
    
    if (this.state.isTimed) {
      stepFrame(this.state, dtSeconds);
      if (this.state.status === GAME_STATUS.LOST) {
        const settlement = calculateSettlement(this.state, this.levelConfig);
        this.onSoundEffect('level_lose');
        this.onLose(settlement);
      }
      this.onStateChange(this.state, this.levelConfig);
    }
  }

  getState() {
    return this.state;
  }

  getLevelConfig() {
    return this.levelConfig;
  }
}
