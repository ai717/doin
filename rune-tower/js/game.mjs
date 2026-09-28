// 游戏状态控制器（DOM-free，协调 engine、调度状态流转、派发事件、支持章节与存档）

import * as Engine from "./engine.mjs";
import * as Storage from "./storage.mjs";

export class RuneTowerGame {
  constructor({ seed = Date.now(), onStateChange = null, onEvent = null } = {}) {
    this.seed = seed;
    this.onStateChange = onStateChange;
    this.onEvent = onEvent;
    this.state = Engine.createInitialState({ seed });
    this.speedMultiplier = 1;
    this.accumulator = 0;
    this.fixedStep = 1 / 60; // 60Hz 固定物理帧
    this.isPaused = false;
  }

  getState() {
    return this.state;
  }

  setSpeed(mult) {
    if ([1, 2, 3].includes(mult)) {
      this.speedMultiplier = mult;
      this.state = { ...this.state, gameSpeed: mult };
      this._notify();
    }
  }

  toggleSpeed() {
    const next = this.speedMultiplier === 1 ? 2 : this.speedMultiplier === 2 ? 3 : 1;
    this.setSpeed(next);
    return next;
  }

  setPaused(paused) {
    this.isPaused = Boolean(paused);
    this._emitEvents([{ type: this.isPaused ? "game_paused" : "game_resumed" }]);
    this._notify();
  }

  togglePause() {
    this.setPaused(!this.isPaused);
    return this.isPaused;
  }

  startChapter(chapterIndex) {
    this.isPaused = false;
    this.accumulator = 0;
    this.state = Engine.createInitialStateForChapter(chapterIndex, { seed: Date.now() });
    Storage.clearSavedRun();
    this._emitEvents([{ type: "chapter_started", chapter: chapterIndex }]);
    this._notify();
  }

  resumeSavedRun() {
    const saveData = Storage.loadSaveData();
    if (!saveData.savedRun) return false;

    const run = saveData.savedRun;
    this.isPaused = false;
    this.accumulator = 0;
    this.state = {
      ...Engine.createInitialState({ seed: Date.now() }),
      wave: run.wave,
      mana: run.mana,
      crystalHp: run.crystalHp,
      score: run.score,
      kills: run.kills,
      towers: run.towers || {},
      activeRelics: run.activeRelics || [],
      elapsedSeconds: run.elapsedSeconds || 0,
      rerollsLeft: typeof run.rerollsLeft === "number" ? run.rerollsLeft : 2,
      status: "PREPARING",
    };
    this._emitEvents([{ type: "run_resumed", wave: run.wave }]);
    this._notify();
    return true;
  }

  startWave() {
    if (this.isPaused) this.setPaused(false);
    const res = Engine.startWave(this.state);
    if (res.ok) {
      this.state = res.state;
      this._emitEvents(res.state.combatEvents);
      this._notify();
    }
    return res;
  }

  rushWave() {
    const res = Engine.rushWave(this.state);
    if (res.ok) {
      this.state = res.state;
      this._emitEvents(res.state.combatEvents);
      this._notify();
    }
    return res;
  }

  buildTower(pedestalId, type) {
    const res = Engine.buildTower(this.state, pedestalId, type);
    if (res.ok) {
      this.state = res.state;
      this._notify();
    }
    return res;
  }

  upgradeTower(pedestalId) {
    const res = Engine.upgradeTower(this.state, pedestalId);
    if (res.ok) {
      this.state = res.state;
      this._notify();
    }
    return res;
  }

  salvageTower(pedestalId) {
    const res = Engine.salvageTower(this.state, pedestalId);
    if (res.ok) {
      this.state = res.state;
      this._notify();
    }
    return res;
  }

  setFocusTarget(monsterId) {
    this.state = Engine.setFocusTarget(this.state, monsterId);
    this._notify();
  }

  draftRelic(relicId) {
    const res = Engine.draftRelic(this.state, relicId);
    if (res.ok) {
      this.state = res.state;
      this._emitEvents(res.state.combatEvents);
      this._notify();

      // 实时记录存档与统计
      if (this.state.status === "VICTORY") {
        Storage.updateStats({
          wave: 20,
          won: true,
          kills: this.state.kills,
          timeSeconds: Math.round(this.state.elapsedSeconds),
          newRelics: this.state.activeRelics,
        });
        Storage.clearSavedRun();
      } else {
        // 保存当前局内检查点
        Storage.updateStats({
          wave: this.state.wave,
          kills: this.state.kills,
          newRelics: this.state.activeRelics,
        });
        Storage.saveCurrentRun({
          wave: this.state.wave,
          chapter: Math.ceil(this.state.wave / 5),
          mana: this.state.mana,
          crystalHp: this.state.crystalHp,
          score: this.state.score,
          kills: this.state.kills,
          towers: this.state.towers,
          activeRelics: this.state.activeRelics,
          elapsedSeconds: this.state.elapsedSeconds,
          rerollsLeft: this.state.rerollsLeft,
        });
      }
    }
    return res;
  }

  rerollRelics() {
    const res = Engine.rerollRelics(this.state);
    if (res.ok) {
      this.state = res.state;
      this._notify();
    }
    return res;
  }

  restart(seed = Date.now()) {
    this.seed = seed;
    this.accumulator = 0;
    this.isPaused = false;
    this.state = Engine.createInitialState({ seed });
    Storage.clearSavedRun();
    this._notify();
  }

  // 外部 RAF 调用驱动固定步长更新
  step(deltaSeconds) {
    if (this.isPaused || this.state.status !== "COMBAT") return;

    const clampedDt = Math.min(0.1, deltaSeconds) * this.speedMultiplier;
    this.accumulator += clampedDt;

    let subSteps = 0;
    while (this.accumulator >= this.fixedStep && subSteps < 8) {
      const prevState = this.state;
      this.state = Engine.stepFrame(this.state, this.fixedStep);
      this.accumulator -= this.fixedStep;
      subSteps++;

      // 派发战斗事件
      if (this.state.combatEvents && this.state.combatEvents.length > 0) {
        this._emitEvents(this.state.combatEvents);
      }

      // 失败判定触发更新
      if (this.state.status === "GAMEOVER" && prevState.status !== "GAMEOVER") {
        Storage.updateStats({
          wave: this.state.wave,
          won: false,
          kills: this.state.kills,
          timeSeconds: Math.round(this.state.elapsedSeconds),
          newRelics: this.state.activeRelics,
        });
        Storage.clearSavedRun();
        break;
      }
    }

    this._notify();
  }

  _notify() {
    if (typeof this.onStateChange === "function") {
      this.onStateChange(this.state);
    }
  }

  _emitEvents(events) {
    if (typeof this.onEvent === "function" && Array.isArray(events)) {
      for (const ev of events) {
        this.onEvent(ev);
      }
    }
  }
}
