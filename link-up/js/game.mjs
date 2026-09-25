// 连连看 link-up · DOM-free 状态控制器：接收 UI 意图，调度 engine，派发事件

import {
  createGame,
  createDaily,
  handleSelect,
  commitEliminate,
  handleHint,
  handleShuffle,
  finishEnded,
  hasMove,
  mulberry32,
  hashString,
  DAILY_SECONDS,
} from "./engine.mjs?v=79c518024932";
import { computeScore, MAX_SCORE } from "./score.mjs?v=79c518024932";

export class Game {
  constructor({ storage, audio }) {
    this._s = storage;
    this._a = audio;
    this._events = {};
    this.state = null;
    this.phase = "menu"; // menu | playing | won | ended
    this.paused = false;
    this.pending = null;
    this._startedAt = 0;
    this._pausedAt = null;
    this._pausedTotal = 0;
    this.result = null;
  }

  on(event, fn) {
    (this._events[event] = this._events[event] || []).push(fn);
    return this;
  }

  emit(event, data) {
    (this._events[event] || []).forEach((fn) => fn(data));
  }

  // ---------- 流程 ----------
  startLevel(levelIndex) {
    this.state = createGame({ levelIndex });
    this.phase = "playing";
    this.paused = false;
    this.pending = null;
    this.result = null;
    this._startedAt = Date.now();
    this._pausedAt = null;
    this._pausedTotal = 0;
    this.emit("start", this.snapshot());
  }

  startDaily(dateStr) {
    this.state = createDaily({ dateStr });
    this.phase = "playing";
    this.paused = false;
    this.pending = null;
    this.result = null;
    this._startedAt = Date.now();
    this._pausedAt = null;
    this._pausedTotal = 0;
    this.emit("start", this.snapshot());
  }

  togglePause() {
    if (this.phase !== "playing" || this.pending) return;
    this.paused = !this.paused;
    if (this.paused) {
      this._pausedAt = Date.now();
    } else {
      if (this._pausedAt) {
        this._pausedTotal += Date.now() - this._pausedAt;
        this._pausedAt = null;
      }
    }
    this.emit(this.paused ? "paused" : "resumed", {});
    this.emit("state", this.snapshot());
  }

  elapsedMs() {
    if (!this._startedAt) return 0;
    const now = Date.now();
    let pausedNow = 0;
    if (this._pausedAt) pausedNow = now - this._pausedAt;
    return Math.max(0, now - this._startedAt - this._pausedTotal - pausedNow);
  }

  dailyRemainMs() {
    if (this.state && this.state.kind === "daily" && this.phase === "playing") {
      return Math.max(0, DAILY_SECONDS * 1000 - this.elapsedMs());
    }
    return null;
  }

  tick(now) {
    if (this.phase !== "playing" || this.paused || !this.state) return;
    if (this.state.kind !== "daily") return;
    if (this.elapsedMs() >= DAILY_SECONDS * 1000) {
      finishEnded(this.state);
      this.phase = "ended";
      this.settle(true);
    }
  }

  // ---------- 玩家意图 ----------
  intentSelect(r, c) {
    if (this.phase !== "playing" || this.paused || this.pending) return;
    const res = handleSelect(this.state, r, c);
    if (!res || !res.action) return;
    switch (res.action) {
      case "select":
        this._a.sfx.select();
        this.emit("state", this.snapshot());
        break;
      case "deselect":
        this._a.sfx.select();
        this.emit("state", this.snapshot());
        break;
      case "reject":
        this._a.sfx.reject();
        this.emit("reject", res.cell);
        this.emit("state", this.snapshot());
        break;
      case "match": {
        this.pending = { a: res.a, b: res.b };
        this._a.sfx.line();
        this.emit("path", { path: res.path });
        break;
      }
      default:
        break;
    }
  }

  confirmPathDone() {
    if (!this.pending) return;
    if (this.phase !== "playing" || !this.state || this.state.status !== "playing") {
      this.pending = null;
      return;
    }
    const { a, b } = this.pending;
    this.pending = null;
    commitEliminate(this.state, a, b);
    this._a.sfx.clear();
    this.emit("burst", { a, b });
    this.emit("state", this.snapshot());
    if (this.state.status === "won") {
      this.settle(false);
    } else if (!hasMove(this.state)) {
      this.emit("noMove", {});
    }
  }

  intentHint() {
    if (this.phase !== "playing" || this.paused || this.pending) return;
    const res = handleHint(this.state);
    if (res.action === "hint") {
      this._a.sfx.select();
      this.emit("hint", { a: res.a, b: res.b });
    } else {
      this.emit("toast", { key: "noHint" });
    }
  }

  intentShuffle() {
    if (this.phase !== "playing" || this.paused || this.pending) return;
    const seed = hashString(
      "shuffle:" + this.state.seed + ":" + this.state.steps + ":" + (this.state.shuffleCount || 0)
    );
    const rng = mulberry32(seed);
    const res = handleShuffle(this.state, rng);
    if (res.action === "shuffle") {
      this._a.sfx.shuffle();
      this.emit("shuffle", {});
      this.emit("toast", { key: "shuffleDone" });
      this.emit("state", this.snapshot());
    }
  }

  // ---------- 结算 ----------
  settle(timedOut) {
    if (!this.state || this.result) return;
    const st = this.state;
    this.phase = timedOut ? "ended" : "won";
    const elapsed = this.elapsedMs();
    const score = computeScore({
      levelIndex: st.levelIndex,
      rows: st.rows,
      cols: st.cols,
      elapsedMs: elapsed,
      comboBonus: st.comboBonus,
    });
    const result = {
      kind: st.kind,
      levelIndex: st.levelIndex,
      dailyDate: st.dailyDate,
      date: st.dailyDate,
      elapsedMs: elapsed,
      steps: st.steps,
      longestCombo: st.longestCombo,
      comboBonus: st.comboBonus,
      score,
      max: MAX_SCORE,
      timedOut,
    };
    const saved = this._s.recordResult(this._s.load(), result);
    this._s.save(saved.data);
    this.result = { ...result, isNewBest: saved.isNewBest };
    this._a.sfx.win();
    this.emit("win", this.result);
  }

  snapshot() {
    const st = this.state;
    if (!st) return null;
    const elapsed = this.elapsedMs();
    return {
      kind: st.kind,
      levelIndex: st.levelIndex,
      dailyDate: st.dailyDate,
      rows: st.rows,
      cols: st.cols,
      variant: st.variant,
      four: st.four,
      grid: st.grid,
      selected: st.selected,
      hintPair: st.hintPair,
      status: st.status,
      steps: st.steps,
      combo: st.combo,
      longestCombo: st.longestCombo,
      comboBonus: st.comboBonus,
      shuffleCount: st.shuffleCount,
      phase: this.phase,
      paused: this.paused,
      elapsedMs: elapsed,
      score: computeScore({
        levelIndex: st.levelIndex,
        rows: st.rows,
        cols: st.cols,
        elapsedMs: elapsed,
        comboBonus: st.comboBonus,
      }),
      max: MAX_SCORE,
    };
  }
}
