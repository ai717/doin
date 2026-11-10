/**
 * @file games/screw/js/game.mjs
 * DOM-Free 状态机控制器：接收 UI 意图，调度 engine，维护撤销栈、计时与结算。
 */

import {
  createState,
  cloneState,
  unscrew,
  useMagnet,
  canUnscrew,
  canUseMagnet,
  isScrewAccessible,
  listAccessibleScrews,
  stats,
  evaluateStatus,
  STATUS,
} from './engine.mjs';
import { LEVELS, levelById, nextLevelId, CHAPTERS, chapterById } from './levels.mjs';
import {
  loadStorage,
  saveStorage,
  recordLevelClear,
  setLastLevel,
  setSoundEnabled,
  TOTAL_LEVELS,
} from './storage.mjs';
import { calculateStars, parTimeMs } from './score.mjs';

export class ScrewGame {
  constructor(options = {}) {
    this.listeners = [];
    this.storage = options.storage || loadStorage();
    this.soundEnabled = this.storage.sound !== false;
    this.paused = false;
    this.engine = null;
    this.level = null;
    this.history = [];
    this.undoCount = 0;
    this.elapsedMs = 0;
    this.runStartedAt = Date.now();
    this.lastResult = null;

    const savedId = Math.min(this.storage.lastLevelId || 1, this.storage.unlockedLevel || 1);
    this.loadLevel(savedId);
  }

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== fn);
    };
  }

  emit(type, payload = {}) {
    const event = { type, ...payload };
    for (const fn of this.listeners) fn(event, this);
  }

  // ---------- 装载 ----------
  loadLevel(id) {
    const level = levelById(id) || levelById(1);
    this.level = level;
    this.engine = createState(level);
    this.history = [];
    this.undoCount = 0;
    this.elapsedMs = 0;
    this.runStartedAt = Date.now();
    this.paused = false;
    this.lastResult = null;
    this.storage = setLastLevel(level.id);
    this.emit('loaded', { levelId: level.id });
    this.emit('state', {});
    return this.engine;
  }

  restart() {
    return this.loadLevel(this.level ? this.level.id : 1);
  }

  nextLevelId() {
    return this.level ? nextLevelId(this.level.id) : null;
  }

  // ---------- 计时与暂停 ----------
  getElapsedMs() {
    if (this.paused) return this.elapsedMs;
    return this.elapsedMs + (Date.now() - this.runStartedAt);
  }

  pause() {
    if (this.paused) return true;
    this.elapsedMs = this.getElapsedMs();
    this.paused = true;
    this.emit('paused', {});
    return true;
  }

  resume() {
    if (!this.paused) return false;
    this.runStartedAt = Date.now();
    this.paused = false;
    this.emit('resumed', {});
    return true;
  }

  togglePause() {
    return this.paused ? (this.resume(), false) : (this.pause(), true);
  }

  isPaused() {
    return this.paused;
  }

  // ---------- 操作 ----------
  canUnscrew(screwId) {
    return !this.paused && this.engine && canUnscrew(this.engine, screwId);
  }

  canMagnet(screwId) {
    return !this.paused && this.engine && canUseMagnet(this.engine, screwId);
  }

  isAccessible(screwId) {
    return Boolean(this.engine) && isScrewAccessible(this.engine, screwId);
  }

  accessibleScrews() {
    return this.engine ? listAccessibleScrews(this.engine) : [];
  }

  unscrew(screwId) {
    if (!this.engine || this.paused) return null;
    const result = unscrew(this.engine, screwId);
    if (!result.action) {
      this.emit('blocked', {
        screwId,
        reason: this.isAccessible(screwId) ? 'buffer_full' : 'covered',
      });
      return null;
    }

    this.history.push(cloneState(this.engine));
    this.engine = result.state;
    this.emit('action', { action: result.action, engine: this.engine });
    for (const event of result.state.events) this.emit(event.type, event);
    this.afterAction();
    return result.action;
  }

  magnet(screwId) {
    if (!this.engine || this.paused) return null;
    const result = useMagnet(this.engine, screwId);
    if (!result.action) {
      this.emit('blocked', { screwId, reason: 'magnet_unavailable' });
      return null;
    }

    this.history.push(cloneState(this.engine));
    this.engine = result.state;
    this.emit('action', { action: result.action, engine: this.engine });
    for (const event of result.state.events) this.emit(event.type, event);
    this.afterAction();
    return result.action;
  }

  undo() {
    if (!this.engine || this.engine.status === STATUS.WON || !this.history.length) return false;
    const previous = this.history.pop();
    this.engine = previous;
    this.undoCount += 1;
    this.lastResult = null;
    this.emit('undo', { undoCount: this.undoCount, engine: this.engine });
    this.emit('state', {});
    return true;
  }

  canUndo() {
    return Boolean(this.engine) && this.engine.status !== STATUS.WON && this.history.length > 0;
  }

  afterAction() {
    const status = evaluateStatus(this.engine);
    this.engine.status = status;

    if (status === STATUS.WON) {
      const timeMs = this.getElapsedMs();
      const stars = calculateStars({
        status,
        elapsedMs: timeMs,
        undos: this.undoCount,
        level: this.level,
      });
      const result = {
        levelId: this.level.id,
        stars,
        timeMs,
        moves: this.engine.moves,
        undos: this.undoCount,
      };
      this.lastResult = result;
      this.storage = recordLevelClear(this.level.id, result);
      this.emit('won', result);
    } else if (status === STATUS.LOST) {
      this.lastResult = {
        levelId: this.level.id,
        timeMs: this.getElapsedMs(),
        moves: this.engine.moves,
        undos: this.undoCount,
      };
      this.emit('lost', this.lastResult);
    }
    this.emit('state', {});
  }

  // ---------- 查询 ----------
  getState() {
    return this.engine;
  }

  getLevel() {
    return this.level;
  }

  getUndoCount() {
    return this.undoCount;
  }

  getStats() {
    return this.engine ? stats(this.engine) : null;
  }

  getChapter() {
    return this.level ? chapterById(this.level.chapter) : null;
  }

  getParTimeMs() {
    return this.level ? parTimeMs(this.level) : 0;
  }

  getRecords() {
    return this.storage.records;
  }

  getUnlockedLevel() {
    return this.storage.unlockedLevel;
  }

  getRecord(levelId) {
    return this.storage.records[levelId] || null;
  }

  isSoundEnabled() {
    return this.soundEnabled;
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = Boolean(enabled);
    this.storage = setSoundEnabled(this.soundEnabled);
    this.emit('sound', { enabled: this.soundEnabled });
  }

  // ---------- 仅供 UI 展示 ----------
  isLevelUnlocked(levelId) {
    return Number(levelId) <= this.storage.unlockedLevel;
  }

  totalLevels() {
    return TOTAL_LEVELS;
  }

  allLevels() {
    return LEVELS;
  }

  chapters() {
    return CHAPTERS;
  }
}

export { STATUS, LEVELS, TOTAL_LEVELS };
