// Piano Tiles — DOM-free 状态控制器
// 封装 engine 的调度，派发事件给 UI 层订阅

import {
  createState, start as engineStart, pause as enginePause, resume as engineResume,
  reset as engineReset, stepFrame, tryHit, computeRank, comboMultiplier,
} from "./engine.mjs";

export class Game {
  constructor(options = {}) {
    this.state = createState(options);
    this._listeners = new Map();
    this._raf = null;
    this._lastTs = 0;
    this._running = false;
  }

  // ===== 事件系统 =====
  on(event, fn) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(fn);
    return () => this._listeners.get(event)?.delete(fn);
  }
  _emit(event, payload) {
    const set = this._listeners.get(event);
    if (!set) return;
    for (const fn of set) fn(payload);
  }

  // ===== 游戏生命周期 =====
  start() {
    engineStart(this.state);
    this._running = true;
    this._lastTs = 0;
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
    this._emit("start", this.getSnapshot());
  }

  pause() {
    enginePause(this.state);
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._emit("pause", this.getSnapshot());
  }

  resume() {
    engineResume(this.state);
    this._running = true;
    this._lastTs = 0;
    this._raf = requestAnimationFrame(this._loop);
    this._emit("resume", this.getSnapshot());
  }

  restart() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._running = false;
    engineReset(this.state);
    this._emit("reset", this.getSnapshot());
  }

  // ===== 主循环 =====
  _loop(ts) {
    if (!this._running) return;
    if (!this._lastTs) this._lastTs = ts;
    let dt = (ts - this._lastTs) / 1000;
    this._lastTs = ts;

    // 限制单帧最大 dt（切到后台回来时 dt 可能巨大）
    if (dt > 0.1) dt = 0.1;

    const prevMisses = this.state.misses;
    stepFrame(this.state, dt);

    // 漏黑事件
    if (this.state.misses > prevMisses) {
      this._emit("miss", { reason: "missed", misses: this.state.misses });
    }

    this._emit("tick", this.getSnapshot());

    if (this.state.gameOver) {
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      this._emit("gameover", this.getSnapshot());
      return;
    }
    this._raf = requestAnimationFrame(this._loop);
  }

  // ===== 玩家输入 =====
  handleHit(col) {
    const prevMisses = this.state.misses;
    const prevCombo = this.state.combo;
    const result = tryHit(this.state, col);

    if (!result.ok) {
      // 点白失误
      if (result.reason === "white" && this.state.misses > prevMisses) {
        this._emit("miss", { reason: "white", misses: this.state.misses });
        if (this.state.gameOver) {
          this._running = false;
          if (this._raf) cancelAnimationFrame(this._raf);
          this._emit("gameover", this.getSnapshot());
        }
      }
      return result;
    }

    // 命中成功
    this._emit("hit", {
      ...result,
      combo: this.state.combo,
      prevCombo,
      multiplier: comboMultiplier(this.state.combo),
    });

    if (this.state.gameOver) {
      this._running = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._emit("gameover", this.getSnapshot());
    }
    return result;
  }

  // ===== 快照（给 UI 渲染用） =====
  getSnapshot() {
    const rank = computeRank(this.state.maxCombo);
    return {
      tiles: this.state.tiles.map((t) => ({ ...t })),
      score: this.state.score,
      combo: this.state.combo,
      maxCombo: this.state.maxCombo,
      misses: this.state.misses,
      speed: this.state.speed,
      running: this.state.running,
      gameOver: this.state.gameOver,
      paused: this.state.paused,
      multiplier: comboMultiplier(this.state.combo),
      rank: rank ? rank.name : null,
      rankEn: rank ? rank.en : null,
      config: { ...this.state.config },
    };
  }
}
