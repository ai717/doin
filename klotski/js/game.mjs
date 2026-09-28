// filepath: games/klotski/js/game.mjs
// 状态机与流程控制：接收 UI 意图 -> 调 engine 纯规则 -> 维护计时/步数/选中块 -> 广播变化。
// 本模块不碰 DOM；渲染与交互由 render.mjs / ui.mjs 负责。
// 安全底线：非 PLAYING 状态下的一切操作都是安全 no-op，绝不允许抛错或改坏状态。

import {
  applyMove,
  applySlide,
  createState,
  isSolved,
  undo as undoState,
  restore,
  snapshot,
  anyLegalMove,
  DIR_NAMES,
} from "./engine.mjs";
import { LEVELS, LEVEL_COUNT, levelAt, difficultyOf } from "./levels.mjs";
import { scoreRun, starsFor } from "./score.mjs";
import * as storage from "./storage.mjs";

export const PHASE = {
  READY: "ready",
  PLAYING: "playing",
  PAUSED: "paused",
  WON: "won",
};

const defaultNow = () => (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now());

export class Game {
  constructor(options = {}) {
    this.now = typeof options.now === "function" ? options.now : defaultNow;
    this.listeners = new Set();
    this.levelIndex = 0;
    this.phase = PHASE.READY;
    this.selectedId = null;
    this.elapsedMs = 0;
    this.lastTick = 0;
    this.result = null;
    this.state = createState(LEVELS[0]);
  }

  // ---------- 订阅 ----------

  subscribe(fn) {
    if (typeof fn !== "function") return () => {};
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(reason = "change") {
    for (const fn of this.listeners) {
      try {
        fn(this, reason);
      } catch {
        /* 单个订阅者出错不影响其它订阅者 */
      }
    }
  }

  // ---------- 只读派生 ----------

  get level() {
    return levelAt(this.levelIndex);
  }

  get playing() {
    return this.phase === PHASE.PLAYING;
  }

  get moves() {
    return this.state.moves;
  }

  get timeMs() {
    if (this.phase !== PHASE.PLAYING) return this.elapsedMs;
    return this.elapsedMs + Math.max(0, this.now() - this.lastTick);
  }

  get par() {
    return this.level.par;
  }

  get difficulty() {
    return difficultyOf(this.level.par);
  }

  /** 结算快照，用于存档与渲染 */
  progressSnapshot() {
    return snapshot(this.state);
  }

  // ---------- 流程 ----------

  /** 载入第 index 关（不自动开始，停在 READY） */
  loadLevel(index) {
    const safe = Number.isInteger(index) ? index : 0;
    this.levelIndex = Math.min(LEVEL_COUNT - 1, Math.max(0, safe));
    this.phase = PHASE.READY;
    this.selectedId = null;
    this.elapsedMs = 0;
    this.lastTick = 0;
    this.result = null;
    this.state = createState(this.level);
    storage.setCurrent(this.levelIndex);
    this.emit("level");
    return this;
  }

  /** 用存档中的局面继续；快照非法则回退到关卡初始状态 */
  resumeSnapshot(snap) {
    if (snap) this.state = restore(this.level, snap);
    return this;
  }

  start() {
    if (this.phase === PHASE.PLAYING) return this;
    if (this.phase === PHASE.WON) {
      this.restart();
      return this;
    }
    if (this.phase === PHASE.READY) {
      this.elapsedMs = 0;
      this.state = createState(this.level);
      this.selectedId = null;
    }
    this.phase = PHASE.PLAYING;
    this.lastTick = this.now();
    this.emit("start");
    return this;
  }

  pause() {
    if (this.phase !== PHASE.PLAYING) return false;
    this.elapsedMs = this.timeMs;
    this.phase = PHASE.PAUSED;
    this.emit("pause");
    return true;
  }

  resume() {
    if (this.phase !== PHASE.PAUSED) return false;
    this.phase = PHASE.PLAYING;
    this.lastTick = this.now();
    this.emit("resume");
    return true;
  }

  togglePause() {
    if (this.phase === PHASE.PLAYING) return this.pause();
    if (this.phase === PHASE.PAUSED) return this.resume();
    return false;
  }

  restart() {
    this.phase = PHASE.PLAYING;
    this.state = createState(this.level);
    this.selectedId = null;
    this.elapsedMs = 0;
    this.lastTick = this.now();
    this.result = null;
    this.emit("restart");
    return this;
  }

  /** 结算下一关；已是最后一关则原地重玩最后一关 */
  nextLevel() {
    const next = Math.min(LEVEL_COUNT - 1, this.levelIndex + 1);
    this.loadLevel(next);
    this.start();
    return this;
  }

  // ---------- 操作 ----------

  select(id) {
    const exists = this.state.pieces.some((piece) => piece.id === id);
    this.selectedId = exists ? id : null;
    this.emit("select");
    return this.selectedId;
  }

  /** 键盘/按钮：移动一格。返回是否真的动了 */
  move(id, dir) {
    if (this.phase !== PHASE.PLAYING) return false;
    if (DIR_NAMES.indexOf(dir) < 0) return false;
    const next = applyMove(this.state, id, dir);
    if (!next) return false;
    this.state = next;
    this.selectedId = id;
    this.afterMove();
    return true;
  }

  /** 拖拽：一次滑动 distance 格（每格 1 步）。被挡住时也尽量走完能走的部分 */
  slide(id, dir, distance) {
    if (this.phase !== PHASE.PLAYING) return 0;
    const dist = Math.floor(Number(distance));
    if (!Number.isFinite(dist) || dist <= 0) return 0;
    const before = this.state.moves;
    const next = applySlide(this.state, id, dir, dist);
    if (!next) return 0;
    this.state = next;
    this.selectedId = id;
    this.afterMove();
    return this.state.moves - before;
  }

  undo() {
    if (this.phase !== PHASE.PLAYING && this.phase !== PHASE.PAUSED) return false;
    const prev = undoState(this.state);
    if (!prev) return false;
    this.state = prev;
    if (this.phase === PHASE.PAUSED) {
      this.phase = PHASE.PLAYING;
      this.lastTick = this.now();
    }
    this.emit("undo");
    return true;
  }

  afterMove() {
    if (isSolved(this.state)) {
      this.finish();
      return;
    }
    this.emit("move");
  }

  finish() {
    this.elapsedMs = this.timeMs;
    this.phase = PHASE.WON;
    const timeMs = Math.round(this.elapsedMs);
    const breakdown = scoreRun({ moves: this.state.moves, timeMs, par: this.level.par });
    const stars = starsFor(breakdown.total);
    const { data, isNewBest } = storage.recordResult(this.level.id, {
      score: breakdown.total,
      moves: this.state.moves,
      timeMs,
      stars,
    });
    this.result = {
      levelId: this.level.id,
      levelIndex: this.levelIndex,
      moves: this.state.moves,
      par: this.level.par,
      timeMs,
      ...breakdown,
      stars,
      isNewBest,
      isLast: this.levelIndex >= LEVEL_COUNT - 1,
      save: data,
    };
    this.emit("win");
  }

  /** 由 rAF 驱动；只做计时推进，不产生渲染副作用 */
  tick() {
    if (this.phase !== PHASE.PLAYING) return false;
    return true;
  }

  /** 兜底自检：理论上恒为 true（所有关卡均经最优解验证） */
  hasLegalMove() {
    return anyLegalMove(this.state);
  }
}

/** 便捷工厂：按存档里的 current 载入 */
export function createGame(options = {}) {
  const game = new Game(options);
  const saved = storage.load();
  const index = Number.isInteger(saved.current) ? saved.current : 0;
  game.loadLevel(index);
  return game;
}
