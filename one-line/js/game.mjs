/* filepath: games/one-line/js/game.mjs */
import { OneLineEngine, generateGuaranteedLevel, levelsForSize, levelDifficulty, endlessSpec } from './engine.mjs';
import { OneLineRenderer } from './render.mjs';
import { writeSaveData } from './storage.mjs';
import { calculateStars, extraForwardCount } from './score.mjs';
import { playStepSound, playUndoSound, playVictorySound, playDeadEndSound, playElectricitySurgeSound } from './audio.mjs';

export class OneLineGame {
  constructor(canvas, ui, storageManager) {
    this.canvas = canvas;
    this.ui = ui;
    this.storage = storageManager;
    this.renderer = new OneLineRenderer(canvas);

    this.currentSize = 4;
    this.currentLevelIndex = 1;
    this.mode = 'normal'; // 'normal' | 'endless'
    this.endlessIndex = 1;
    this.levelLabel = '';
    this.engine = null;
    this.elapsedSeconds = 0;
    this.isDragging = false;
    this.isPaused = false;
    this.lastFrameTime = 0;

    this.initLevel(this.currentSize, 1);
  }

  initLevel(size = 4, levelNum = 1) {
    this.mode = 'normal';
    this.currentSize = size;
    this.currentLevelIndex = levelNum;
    this.levelLabel = `${size}×${size} #${levelNum}`;

    // 主线难度随规格与关卡号双升；引擎按难度旋钮调整障碍率与路径曲折度
    const levelData = generateGuaranteedLevel(size, size, levelNum, levelDifficulty(size, levelNum));

    this.engine = new OneLineEngine(levelData);
    this.elapsedSeconds = 0;
    this.shownSecond = -1;
    this.isPaused = false;
    this.renderer.isSurging = false;
    this.renderer.clearHint();
    this.renderer.resetFillAnimation();

    this.ui.hideStatusHint();
    this.ui.updateTime(0);
    this.syncHUD();
  }

  /** 无尽模式第 n 关：盘面与难度来自 endlessSpec，永不到顶 */
  initEndless(n = 1) {
    this.mode = 'endless';
    this.endlessIndex = n;
    const spec = endlessSpec(n);
    this.currentSize = spec.size;
    this.levelLabel = `无尽 #${n}`;

    const levelData = generateGuaranteedLevel(spec.size, spec.size, spec.seed, spec.difficulty);

    this.engine = new OneLineEngine(levelData);
    this.elapsedSeconds = 0;
    this.shownSecond = -1;
    this.isPaused = false;
    this.renderer.isSurging = false;
    this.renderer.clearHint();
    this.renderer.resetFillAnimation();

    this.ui.hideStatusHint();
    this.ui.updateTime(0);
    this.syncHUD();
  }

  handlePointerDown(clientX, clientY) {
    if (!this.engine || this.engine.status === 'won' || this.engine.status === 'clearing') return;

    this.isDragging = true;
    const hit = this.renderer.hitTest(clientX, clientY);
    if (!hit) return;

    this.processMove(hit.r, hit.c);
  }

  handlePointerMove(clientX, clientY) {
    if (!this.isDragging || !this.engine || this.engine.status === 'won' || this.engine.status === 'clearing') return;

    const hit = this.renderer.hitTest(clientX, clientY);
    if (!hit) return;

    this.processMove(hit.r, hit.c);
  }

  handlePointerUp() {
    this.isDragging = false;
  }

  processMove(r, c) {
    if (!this.engine) return;

    const res = this.engine.moveToCell(r, c);
    if (!res.success) return;

    // 玩家路线一旦偏离推荐解，旧提示就失去意义，直接收起
    if (this.renderer.hintEnd >= 0 && res.kind === 'advance' && !this.isPathAligned()) {
      this.renderer.clearHint();
    }

    if (res.kind === 'back' || res.kind === 'jump') {
      playUndoSound();
    } else {
      playStepSound(this.engine.path.length);
    }

    if (this.engine.status === 'clearing') {
      this.triggerSurgeSequence();
    } else if (this.engine.status === 'deadend') {
      playDeadEndSound();
    }

    this.syncHUD();
  }

  /** 玩家已画的路线是否仍是推荐解的前缀 */
  isPathAligned() {
    const path = this.engine.path;
    const solution = this.engine.solution;
    if (!solution || path.length > solution.length) return false;
    for (let i = 0; i < path.length; i++) {
      if (path[i][0] !== solution[i][0] || path[i][1] !== solution[i][1]) return false;
    }
    return true;
  }

  /**
   * 逐步揭示真解：每次点击向前多揭示几格，而不是一次性铺满全解。
   * 玩家路线已偏离推荐解时无法衔接，给出提示让玩家先撤回。
   */
  requestHint() {
    if (!this.engine) return false;
    if (this.engine.status === 'won' || this.engine.status === 'clearing') return false;

    const solution = this.engine.solution;
    if (!solution || solution.length < 2) return false;

    if (!this.isPathAligned()) {
      this.ui.showStatusHint(this.ui.hintBlockedText());
      return false;
    }

    this.engine.hintCount++;
    this.renderer.revealHint(this.engine.path.length - 1, solution.length - 1);
    this.syncHUD();
    return true;
  }

  triggerSurgeSequence() {
    this.isDragging = false;
    this.renderer.startElectricitySurge();
    playElectricitySurgeSound(0.85);

    setTimeout(() => {
      this.engine.setWon();
      this.handleLevelCompleted();
    }, 850);
  }

  undo() {
    if (!this.engine || this.engine.status === 'won' || this.engine.status === 'clearing') return;
    const res = this.engine.undo();
    if (res.success) {
      playUndoSound();
      this.syncHUD();
    }
  }

  reset() {
    if (!this.engine) return;
    this.engine.reset();
    this.elapsedSeconds = 0;
    this.shownSecond = -1;
    this.renderer.isSurging = false;
    this.renderer.clearHint();
    this.renderer.resetFillAnimation();
    this.ui.hideStatusHint();
    this.ui.updateTime(0);
    playUndoSound();
    this.syncHUD();
  }

  handleLevelCompleted() {
    playVictorySound();
    this.renderer.triggerVictoryConfetti();

    const state = this.engine.getState();
    const stars = calculateStars({
      targetCount: state.targetCount,
      forwardCount: state.forwardCount,
      hintCount: state.hintCount,
      elapsedTimeSeconds: this.elapsedSeconds
    });

    const seconds = Math.max(1, Math.floor(this.elapsedSeconds));

    if (this.mode === 'endless') {
      // 无尽模式只记录抵达的最高关号，没有逐关星级与解锁概念
      const best = Math.max(this.storage.endlessBest || 0, this.endlessIndex);
      this.storage.endlessBest = best;
      writeSaveData(() => this.storage);

      this.ui.showVictoryModal({
        stars,
        timeSeconds: this.elapsedSeconds,
        extraSteps: extraForwardCount({ targetCount: state.targetCount, forwardCount: state.forwardCount }),
        hintCount: state.hintCount,
        isLastLevel: false
      });
      return;
    }

    const key = `${this.currentSize}_${this.currentLevelIndex}`;
    const prevStat = this.storage.levelStats[key] || { stars: 0, bestTime: 0 };

    // 通关即落盘，避免刷新或"再玩一次"后成绩丢失
    this.storage.levelStats[key] = {
      stars: Math.max(prevStat.stars, stars),
      bestTime: prevStat.bestTime > 0 ? Math.min(prevStat.bestTime, seconds) : seconds
    };

    // 通关解锁同规格的下一关（每个规格独立推进）
    const sizeKey = String(this.currentSize);
    const nextLevel = Math.min(levelsForSize(this.currentSize), this.currentLevelIndex + 1);
    this.storage.unlocked[sizeKey] = Math.max(this.storage.unlocked[sizeKey] || 1, nextLevel);
    writeSaveData(() => this.storage);

    this.ui.showVictoryModal({
      stars,
      timeSeconds: this.elapsedSeconds,
      extraSteps: extraForwardCount({ targetCount: state.targetCount, forwardCount: state.forwardCount }),
      hintCount: state.hintCount,
      isLastLevel: this.currentLevelIndex >= levelsForSize(this.currentSize)
    });
  }

  nextLevel() {
    if (this.mode === 'endless') {
      this.initEndless(this.endlessIndex + 1);
      return;
    }
    // 本规格全部通关后回到第 1 关，不再无限 +1 溢出选关界面
    const target = this.currentLevelIndex >= levelsForSize(this.currentSize) ? 1 : this.currentLevelIndex + 1;
    this.initLevel(this.currentSize, target);
  }

  syncHUD() {
    if (!this.engine) return;
    this.ui.updateHUD(this.engine.getState(), this.elapsedSeconds, this.levelLabel);
  }

  update(time) {
    if (!this.lastFrameTime) this.lastFrameTime = time;
    const rawDt = (time - this.lastFrameTime) / 1000;
    this.lastFrameTime = time;
    const dt = Math.min(rawDt, 0.1);

    if (this.engine) {
      if (!this.isPaused && this.engine.status === 'playing') {
        this.elapsedSeconds += dt;
        // 时间只在跨秒时写 DOM，其余 HUD 由引擎事件驱动，避免每帧全量刷新
        const whole = Math.floor(this.elapsedSeconds);
        if (whole !== this.shownSecond) {
          this.shownSecond = whole;
          this.ui.updateTime(this.elapsedSeconds);
        }
      }
      this.renderer.render(this.engine.getState(), dt);
    }
  }
}
