import { FreeCellEngine } from './engine.mjs';
import { ScoreCalculator } from './score.mjs';
import { sound } from './audio.mjs';
import { saveGameData, loadGameData, clearSavedGame } from './storage.mjs';

export const GAME_STATES = {
  READY: 'READY',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER'
};

export class FreeCellGame {
  constructor(renderer, ui) {
    this.renderer = renderer;
    this.ui = ui;
    this.engine = new FreeCellEngine();
    this.state = GAME_STATES.READY;

    this.seconds = 0;
    this.timerInterval = null;

    this.interaction = {
      selected: null,
      drag: null,
      hint: null
    };

    // 双击与手势检测器
    this.lastTap = {
      time: 0,
      targetKey: null
    };

    this.gesture = {
      startX: 0,
      startY: 0,
      startTime: 0,
      target: null
    };

    this.lastFrameTime = performance.now();
  }

  getTargetKey(target) {
    if (!target) return null;
    return `${target.type}_${target.index}_${target.cardIndex ?? 0}`;
  }

  cancelInteraction() {
    this.interaction.drag = null;
    this.interaction.selected = null;
    this.interaction.hint = null;
  }

  startNewGame(dealNumber = null) {
    const nextDeal = dealNumber !== null ? dealNumber : Math.floor(Math.random() * 32000) + 1;
    this.engine.init(nextDeal);
    this.state = GAME_STATES.PLAYING;
    this.seconds = 0;
    this.cancelInteraction();

    this.resetTimer();
    this.startTimer();
    this.ui.hideModals();
    this.syncUI();

    const data = loadGameData();
    saveGameData({
      gamesPlayed: data.gamesPlayed + 1,
      savedGame: {
        dealNumber: nextDeal,
        snapshot: this.engine.takeSnapshot(),
        seconds: this.seconds
      }
    });
  }

  restartCurrentGame() {
    this.startNewGame(this.engine.dealNumber);
  }

  pauseGame() {
    if (this.state !== GAME_STATES.PLAYING) return;
    this.state = GAME_STATES.PAUSED;
    this.cancelInteraction();
    this.stopTimer();
    this.ui.showModal('pause');
  }

  resumeGame() {
    if (this.state !== GAME_STATES.PAUSED) return;
    this.state = GAME_STATES.PLAYING;
    this.startTimer();
    this.ui.hideModals();
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (this.state === GAME_STATES.PLAYING) {
        this.seconds++;
        this.ui.updateStats(
          this.engine.dealNumber,
          this.engine.score,
          this.seconds,
          this.engine.movesCount,
          this.engine.history.length > 0
        );
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  resetTimer() {
    this.stopTimer();
    this.seconds = 0;
  }

  undo() {
    if (this.state !== GAME_STATES.PLAYING) return;
    if (this.engine.undo()) {
      sound.playUndo();
      this.cancelInteraction();
      this.syncUI();
    }
  }

  triggerHint() {
    if (this.state !== GAME_STATES.PLAYING) return;
    const hint = this.engine.findAnyHintMove();
    if (hint) {
      this.interaction.hint = hint;
      setTimeout(() => {
        if (this.interaction.hint === hint) {
          this.interaction.hint = null;
        }
      }, 1500);
    }
  }

  checkAutoMoves() {
    if (this.state !== GAME_STATES.PLAYING) return false;
    const safeMove = this.engine.findSafeAutoMove();
    if (safeMove) {
      const moved = this.engine.moveCards(safeMove);
      if (moved) {
        sound.playFoundation();
        this.syncUI();
        if (this.engine.isWon) {
          this.handleVictory();
          return false;
        }
        setTimeout(() => this.checkAutoMoves(), 120);
        return true;
      }
    }
    return false;
  }

  handlePointerDown(clientX, clientY, button = 0) {
    if (this.state !== GAME_STATES.PLAYING) return;
    sound.unlock();

    // 任何右键行为直接取消选中/放下卡牌
    if (button === 2) {
      this.cancelInteraction();
      return;
    }

    const target = this.renderer.getCardAtPosition(clientX, clientY, this.engine);
    this.gesture.startX = clientX;
    this.gesture.startY = clientY;
    this.gesture.startTime = performance.now();
    this.gesture.target = target;

    if (!target) {
      this.cancelInteraction();
      return;
    }

    const now = performance.now();
    const currentKey = this.getTargetKey(target);

    // 显式精准双击判断（320ms 内敲击同一个有效目标）
    if (currentKey && this.lastTap.targetKey === currentKey && (now - this.lastTap.time < 320)) {
      this.lastTap.time = 0;
      this.lastTap.targetKey = null;
      this.cancelInteraction();
      this.smartAutoMove(target);
      return;
    }

    this.lastTap.time = now;
    this.lastTap.targetKey = currentKey;

    const rect = this.renderer.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // 已有选中的牌时，再次点击走转移逻辑
    if (this.interaction.selected) {
      const src = this.interaction.selected;
      this.interaction.selected = null;
      this.interaction.drag = null;

      if (src.type === target.type && src.index === target.index) {
        this.smartAutoMove(src);
      } else {
        this.executeMove(src, target);
      }
      return;
    }

    // 选中与准备轻度拖拽
    if (target.type === 'cell' || (target.type === 'cascade' && target.card)) {
      let cards = [];
      let startX = 0;
      let startY = 0;

      if (target.type === 'cell') {
        cards = [target.card];
        startX = this.renderer.layout.cellPositions[target.index].x;
        startY = this.renderer.layout.cellPositions[target.index].y;
      } else {
        const cascade = this.engine.cascades[target.index];
        cards = cascade.slice(target.cardIndex);
        startX = this.renderer.layout.cascadePositions[target.index].x;
        startY = this.renderer.layout.cascadePositions[target.index].y + target.cardIndex * this.renderer.layout.cardVerticalOverlap;
      }

      this.interaction.drag = {
        source: target,
        cards,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
        offsetX: Math.max(0, Math.min(x - startX, this.renderer.layout.cardWidth)),
        offsetY: Math.max(0, Math.min(y - startY, this.renderer.layout.cardHeight))
      };
      this.interaction.selected = target;
    }
  }

  handlePointerMove(clientX, clientY) {
    if (!this.interaction.drag) return;
    const rect = this.renderer.canvas.getBoundingClientRect();
    this.interaction.drag.currentX = clientX - rect.left;
    this.interaction.drag.currentY = clientY - rect.top;
  }

  handlePointerUp(clientX, clientY) {
    const activeDrag = this.interaction.drag;
    this.interaction.drag = null;

    const dx = clientX - this.gesture.startX;
    const dy = clientY - this.gesture.startY;
    const dt = performance.now() - this.gesture.startTime;
    const dist = Math.hypot(dx, dy);

    // 手势轻扫快速判定 (Swipe Gesture: 距离 > 30px 且耗时 < 350ms)
    if (this.gesture.target && dist > 30 && dt < 350) {
      const isVertical = Math.abs(dy) > Math.abs(dx);
      this.cancelInteraction();

      if (isVertical) {
        if (dy < 0) {
          // 上划 -> 尝试推进本位槽
          this.trySendToFoundation(this.gesture.target);
          return;
        } else {
          // 下划 -> 尝试接龙
          this.trySendToCascade(this.gesture.target);
          return;
        }
      } else {
        if (dx < 0) {
          // 左划 -> 尝试推入中转空当
          this.trySendToFreeCell(this.gesture.target);
          return;
        }
      }
    }

    if (!activeDrag) return;

    // 微小位移保留选中
    if (dist < 6) {
      return;
    }

    const dropTarget = this.renderer.getCardAtPosition(clientX, clientY, this.engine);
    this.interaction.selected = null;

    if (!dropTarget) return;
    if (activeDrag.source.type === dropTarget.type && activeDrag.source.index === dropTarget.index) {
      return;
    }

    this.executeMove(activeDrag.source, dropTarget);
  }

  smartAutoMove(source) {
    if (this.trySendToFoundation(source)) return;
    if (this.trySendToCascade(source)) return;
    if (this.trySendToFreeCell(source)) return;
  }

  trySendToFoundation(source) {
    const card = source.card;
    if (!card) return false;

    for (let f = 0; f < 4; f++) {
      const top = this.engine.getFoundationTop(f);
      const action = {
        from: { type: source.type, index: source.index },
        to: { type: 'foundation', index: f },
        count: 1
      };
      if (this.engine.moveCards(action)) {
        sound.playFoundation();
        this.syncUI();
        if (this.engine.isWon) this.handleVictory();
        else this.checkAutoMoves();
        return true;
      }
    }
    return false;
  }

  trySendToCascade(source) {
    const card = source.card;
    if (!card) return false;
    const count = source.count || 1;

    for (let c = 0; c < 8; c++) {
      if (source.type === 'cascade' && source.index === c) continue;
      const action = {
        from: { type: source.type, index: source.index },
        to: { type: 'cascade', index: c },
        count
      };
      if (this.engine.moveCards(action)) {
        sound.playCardDrop();
        this.syncUI();
        if (this.engine.isWon) this.handleVictory();
        else this.checkAutoMoves();
        return true;
      }
    }
    return false;
  }

  trySendToFreeCell(source) {
    if (source.type !== 'cascade') return false;
    const emptyCell = this.engine.cells.findIndex(c => c === null);
    if (emptyCell !== -1) {
      const action = {
        from: { type: 'cascade', index: source.index },
        to: { type: 'cell', index: emptyCell },
        count: 1
      };
      if (this.engine.moveCards(action)) {
        sound.playCardDrop();
        this.syncUI();
        this.checkAutoMoves();
        return true;
      }
    }
    return false;
  }

  executeMove(source, destination) {
    let destType = destination.type;
    let destIndex = destination.index;

    if (destType === 'empty-cell') destType = 'cell';
    if (destType === 'empty-cascade') destType = 'cascade';

    const count = source.count || 1;
    const action = {
      from: { type: source.type, index: source.index },
      to: { type: destType, index: destIndex },
      count
    };

    const success = this.engine.moveCards(action);
    if (success) {
      if (destType === 'foundation') {
        sound.playFoundation();
      } else {
        sound.playCardDrop();
      }
      this.syncUI();
      if (this.engine.isWon) {
        this.handleVictory();
      } else {
        this.checkAutoMoves();
      }
    }
  }

  handleVictory() {
    this.state = GAME_STATES.GAMEOVER;
    this.stopTimer();
    this.cancelInteraction();
    sound.playVictory();

    const finalScore = ScoreCalculator.finalizeGameScore(this.engine.score, this.seconds, this.engine.movesCount);
    const data = loadGameData();

    saveGameData({
      highScore: Math.max(data.highScore, finalScore),
      bestTime: data.bestTime === 0 ? this.seconds : Math.min(data.bestTime, this.seconds),
      gamesWon: data.gamesWon + 1
    });

    clearSavedGame();
    this.ui.showVictory(finalScore, this.seconds, this.engine.movesCount);
  }

  syncUI() {
    this.ui.updateStats(
      this.engine.dealNumber,
      this.engine.score,
      this.seconds,
      this.engine.movesCount,
      this.engine.history.length > 0
    );
  }

  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = currentTime;

    if (this.engine.isWon) {
      this.renderer.spawnVictoryParticles();
      this.renderer.updateParticles(dt);
    }

    this.renderer.render(this.engine, this.interaction);
    requestAnimationFrame(t => this.loop(t));
  }
}
