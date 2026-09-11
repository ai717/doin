// filepath: games/jigsaw/js/game.mjs
// 状态机与流程控制：接收 UI 意图 -> 调 engine 纯规则 -> 维护计时/步数/重排次数/光标 -> 广播变化。
// 本模块不碰 DOM；渲染与交互由 render.mjs / ui.mjs 负责。
// 安全底线：非 PLAYING 状态下的一切操作都是安全 no-op，绝不允许抛错或改坏状态。

import {
  applyMove,
  createState,
  isSolved,
  isLocked,
  inBounds,
  sameCell,
  restore,
  snapshot,
  shuffle as shuffleState,
} from "./engine.mjs";
import { LEVELS, LEVEL_COUNT, levelAt, dailyLevel, todayKey } from "./levels.mjs";
import { scoreRun, perfectScoreFor } from "./score.mjs";
import * as storage from "./storage.mjs";

export const PHASE = {
  READY: "ready",
  PLAYING: "playing",
  WON: "won",
};

/** 每关的重排机会（PRD §2 MVP 第 5 条） */
export const RESHUFFLE_LIMIT = 3;

const defaultNow = () =>
  typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

export class Game {
  constructor(options = {}) {
    this.now = typeof options.now === "function" ? options.now : defaultNow;
    this.rng = typeof options.rng === "function" ? options.rng : null;
    this.listeners = new Set();
    this.levelIndex = 0;
    this.dailyKey = null;
    this.phase = PHASE.READY;
    this.selected = null;
    this.cursor = { r: 0, c: 0 };
    this.elapsedMs = 0;
    this.lastTick = 0;
    this.timerPaused = false;
    this.reshufflesLeft = RESHUFFLE_LIMIT;
    this.result = null;
    this.state = createState(LEVELS[0].n, LEVELS[0].seed);
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

  get n() {
    return this.state.n;
  }

  get isDaily() {
    return this.dailyKey !== null;
  }

  get playing() {
    return this.phase === PHASE.PLAYING;
  }

  get moves() {
    return this.state.moves;
  }

  get par() {
    return this.level.par;
  }

  get perfect() {
    return perfectScoreFor(this.isDaily);
  }

  get timeMs() {
    if (this.phase !== PHASE.PLAYING || this.timerPaused) return this.elapsedMs;
    return this.elapsedMs + Math.max(0, this.now() - this.lastTick);
  }

  get lockedCount() {
    let count = 0;
    for (let r = 0; r < this.state.n; r++) {
      for (let c = 0; c < this.state.n; c++) {
        if (this.state.locked[r][c]) count++;
      }
    }
    return count;
  }

  progressSnapshot() {
    return snapshot(this.state);
  }

  // ---------- 流程 ----------

  resetRun() {
    this.phase = PHASE.READY;
    this.selected = null;
    this.cursor = { r: 0, c: 0 };
    this.elapsedMs = 0;
    this.lastTick = 0;
    this.timerPaused = false;
    this.reshufflesLeft = RESHUFFLE_LIMIT;
    this.result = null;
  }

  /** 载入第 index 关（不自动开始，停在 READY）；options.snapshot 可续上存档局面 */
  loadLevel(index, options = {}) {
    const safe = Number.isInteger(index) ? Math.min(LEVEL_COUNT - 1, Math.max(0, index)) : 0;
    this.levelIndex = safe;
    this.dailyKey = null;
    this.resetRun();
    const level = this.level;
    this.state = options.snapshot
      ? restore(level, options.snapshot)
      : createState(level.n, level.seed);
    this.persist();
    this.emit("level");
    return this;
  }

  /** 载入今日精选：按日期 hash 选关，全服同题；成绩单独记录，不影响主线解锁 */
  loadDaily(dateKeyValue = todayKey(), options = {}) {
    const key = typeof dateKeyValue === "string" ? dateKeyValue : todayKey();
    const level = dailyLevel(key);
    this.levelIndex = level.index;
    this.dailyKey = key;
    this.resetRun();
    this.state = options.snapshot
      ? restore(level, options.snapshot)
      : createState(level.n, level.seed);
    this.emit("level");
    return this;
  }

  start() {
    if (this.phase === PHASE.PLAYING) return this;
    if (this.phase === PHASE.WON) {
      this.restart();
      return this;
    }
    this.phase = PHASE.PLAYING;
    this.lastTick = this.now();
    this.timerPaused = false;
    this.emit("start");
    return this;
  }

  restart() {
    const level = this.level;
    this.phase = PHASE.PLAYING;
    this.state = createState(level.n, level.seed);
    this.selected = null;
    this.cursor = { r: 0, c: 0 };
    this.elapsedMs = 0;
    this.lastTick = this.now();
    this.timerPaused = false;
    this.reshufflesLeft = RESHUFFLE_LIMIT;
    this.result = null;
    this.persist();
    this.emit("restart");
    return this;
  }

  /** 结算下一关；已是最后一关则原地重玩 */
  nextLevel() {
    if (this.isDaily) {
      this.restart();
      return this;
    }
    const next = Math.min(LEVEL_COUNT - 1, this.levelIndex + 1);
    this.loadLevel(next);
    this.start();
    return this;
  }

  /** 切后台时暂停计时（拼图没有帧循环，棋盘不需要暂停） */
  pauseTimer() {
    if (this.phase !== PHASE.PLAYING || this.timerPaused) return false;
    this.elapsedMs = this.timeMs;
    this.timerPaused = true;
    return true;
  }

  resumeTimer() {
    if (this.phase !== PHASE.PLAYING || !this.timerPaused) return false;
    this.lastTick = this.now();
    this.timerPaused = false;
    return true;
  }

  // ---------- 选择与光标 ----------

  select(cell) {
    this.selected = inBounds(this.state, cell) ? { r: cell.r, c: cell.c } : null;
    this.emit("select");
    return this.selected;
  }

  moveCursor(dr, dc) {
    const n = this.state.n;
    this.cursor = {
      r: Math.min(n - 1, Math.max(0, this.cursor.r + (Number.isFinite(dr) ? dr : 0))),
      c: Math.min(n - 1, Math.max(0, this.cursor.c + (Number.isFinite(dc) ? dc : 0))),
    };
    this.emit("cursor");
    return this.cursor;
  }

  /**
   * 点/按一格：没选中就选中它，已选中且是同一格就取消，否则尝试与选中格交换。
   * 返回 { action, reason, locked }，action 为 null 表示这一步没生效（不抛错）。
   */
  tap(cell) {
    const idle = { action: null, reason: "idle", locked: [] };
    if (this.phase !== PHASE.PLAYING) return idle;
    if (!inBounds(this.state, cell)) return { ...idle, reason: "outside" };
    this.cursor = { r: cell.r, c: cell.c };
    if (isLocked(this.state, cell.r, cell.c)) return { ...idle, reason: "locked" };

    if (!this.selected) {
      this.select(cell);
      return { action: "select", reason: null, locked: [], cell: this.selected };
    }
    if (sameCell(this.selected, cell)) {
      this.select(null);
      return { action: "deselect", reason: null, locked: [] };
    }
    // 目标非法时保留原选中，玩家可以直接再点另一格
    return this.swap(this.selected, cell);
  }

  // ---------- 操作 ----------

  /** 交换两块。合法必执行；已锁定 / 同格 / 终止态都返回 action: null。 */
  swap(from, to) {
    const idle = { action: null, reason: "idle", locked: [] };
    if (this.phase !== PHASE.PLAYING) return idle;
    const outcome = applyMove(this.state, { from, to });
    if (!outcome.action) return outcome;
    this.state = outcome.state;
    this.selected = null;
    this.afterMove();
    return outcome;
  }

  /** 重排未锁定碎片；次数用完或局面无可重排时返回 ok: false，且不消耗次数 */
  reshuffle() {
    if (this.phase !== PHASE.PLAYING) return { ok: false, reason: "idle", left: this.reshufflesLeft };
    if (this.reshufflesLeft <= 0) return { ok: false, reason: "empty", left: 0 };
    const outcome = shuffleState(this.state, this.rng ?? undefined);
    if (!outcome.action) return { ok: false, reason: "nomove", left: this.reshufflesLeft };
    this.state = outcome.state;
    this.selected = null;
    this.reshufflesLeft -= 1;
    this.persist();
    this.emit("shuffle");
    return { ok: true, reason: null, left: this.reshufflesLeft };
  }

  afterMove() {
    if (isSolved(this.state)) {
      this.finish();
      return;
    }
    this.persist();
    this.emit("move");
  }

  finish() {
    this.elapsedMs = this.timeMs;
    this.timerPaused = true;
    this.phase = PHASE.WON;

    const timeMs = Math.round(this.elapsedMs);
    const isDaily = this.isDaily;
    const breakdown = scoreRun({
      moves: this.state.moves,
      timeMs,
      par: this.level.par,
      isDaily,
    });
    const outcome = isDaily
      ? storage.recordDaily(this.dailyKey, { score: breakdown.total })
      : storage.recordResult(this.level.id, {
          score: breakdown.total,
          moves: this.state.moves,
          timeMs,
        });

    this.result = {
      levelId: this.level.id,
      levelIndex: this.levelIndex,
      isDaily,
      dailyKey: this.dailyKey,
      moves: this.state.moves,
      par: this.level.par,
      timeMs,
      perfect: perfectScoreFor(isDaily),
      ...breakdown,
      isNewBest: outcome.isNewBest,
      isLast: !isDaily && this.levelIndex >= LEVEL_COUNT - 1,
      save: outcome.data,
    };
    this.emit("win");
  }

  /** 只持久化主线进行中局面；今日精选是每日一次性玩法，不占用 current 槽位 */
  persist() {
    if (this.isDaily) return false;
    return storage.setCurrent(this.level.id, snapshot(this.state));
  }
}

/** 便捷工厂：按存档里的 current 载入主线进度 */
export function createGame(options = {}) {
  const game = new Game(options);
  const saved = storage.load();
  const index = saved.current?.levelId
    ? LEVELS.findIndex((level) => level.id === saved.current.levelId)
    : 0;
  game.loadLevel(index < 0 ? 0 : index, { snapshot: saved.current?.state ?? null });
  return game;
}
