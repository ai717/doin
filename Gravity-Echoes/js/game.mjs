import { PhysicsEngine, GAME_STATES, AVAILABLE_RELICS } from './engine.mjs';
import { ScoreSystem } from './score.mjs';
import { loadSaveData, saveGameRecord, saveSoundSetting } from './storage.mjs';
import { sound } from './audio.mjs';

export class GameController {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.scoreSystem = new ScoreSystem();
    this.engine = new PhysicsEngine(800, 600);
    this.savedData = loadSaveData();
    this.lastTime = performance.now();
    this.isAudioMuted = !this.savedData.soundEnabled;
    sound.setEnabled(!this.isAudioMuted);

    this.setupAdaptiveCanvas();
  }

  setupAdaptiveCanvas() {
    const resizeObserver = new ResizeObserver(() => this.handleResize());
    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) {
      resizeObserver.observe(wrapper);
    }
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize();
  }

  handleResize() {
    const wrapper = document.getElementById('canvas-wrapper');
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.height);

    if (w > 0 && h > 0) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.engine.setDimensions(w, h);
    }
  }

  init() {
    this.ui.setAudioIcon(!this.isAudioMuted);
    this.ui.updateTexts();
    this.ui.showStartOverlay(this.savedData.highScore);
    this.startLoop();
  }

  startGame() {
    sound.resume();
    this.scoreSystem.reset();
    this.engine.resetWorld();
    this.engine.loadSector(1);
    this.engine.state = GAME_STATES.PLAYING;
    this.ui.hideStartOverlay();
    this.ui.hideGameOverOverlay();
    this.ui.updateRelicTray([]);
    this.syncHUD();
  }

  restartGame() {
    this.ui.showPauseOverlay(false);
    this.startGame();
  }

  togglePause() {
    if (this.engine.state === GAME_STATES.PLAYING) {
      this.engine.state = GAME_STATES.PAUSED;
      this.ui.showPauseOverlay(true);
    } else if (this.engine.state === GAME_STATES.PAUSED) {
      this.engine.state = GAME_STATES.PLAYING;
      this.ui.showPauseOverlay(false);
      this.lastTime = performance.now();
    }
  }

  toggleAudio() {
    this.isAudioMuted = !this.isAudioMuted;
    sound.setEnabled(!this.isAudioMuted);
    saveSoundSetting(!this.isAudioMuted);
    this.ui.setAudioIcon(!this.isAudioMuted);
  }

  // 全屏光标投影：鼠标即使移出 Canvas，在整个浏览器窗口依然精准映射
  handleGlobalPointerMove(clientX) {
    const rect = this.canvas.getBoundingClientRect();
    // 即使 clientX 在 rect 范围外，线性投影依然生效
    const relativeX = clientX - rect.left;
    const scaleX = this.canvas.width / (rect.width || 1);
    const targetCanvasX = relativeX * scaleX;
    this.engine.setPaddlePosition(targetCanvasX);
  }

  handleTouchDelta(deltaX) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / (rect.width || 1);
    this.engine.movePaddleDelta(deltaX * scaleX * 1.15); // 适度提升移动端灵敏度
  }

  handlePointerTap() {
    if (this.engine.state === GAME_STATES.PLAYING) {
      this.engine.launchBall();
    }
  }

  handleDraftSelect(relicId) {
    this.engine.selectRelic(relicId);
    const activeRelicsList = AVAILABLE_RELICS.filter(r => this.engine.activeRelics.has(r.id));
    this.ui.updateRelicTray(activeRelicsList);
    sound.playSectorClear();
    this.syncHUD();
  }

  syncHUD() {
    const threshold = this.engine.activeRelics.has('relic_event_horizon') ? 70 : 100;
    this.ui.updateHUD(
      this.scoreSystem.getScore(),
      this.engine.sector,
      this.engine.resonance,
      threshold,
      this.engine.lives,
      this.engine.maxLives
    );

    // 同步桌面侧翼数值
    const flankCurvature = document.getElementById('flank-curvature');
    if (flankCurvature) {
      const cur = (this.engine.sector * 0.45).toFixed(2);
      flankCurvature.textContent = `${cur} G`;
    }
    const flankEfficiency = document.getElementById('flank-efficiency');
    if (flankEfficiency) {
      flankEfficiency.textContent = this.engine.isOverdrive ? '250% [OVERDRIVE]' : '100%';
    }
    const flankStatus = document.getElementById('flank-status');
    if (flankStatus) {
      flankStatus.textContent = this.engine.isOverdrive ? 'SUPERCHARGED' : 'STANDBY';
      flankStatus.style.color = this.engine.isOverdrive ? '#f43f5e' : '#38bdf8';
    }
  }

  startLoop() {
    const loop = (time) => {
      const dt = Math.min((time - this.lastTime) / 1000, 0.05);
      this.lastTime = time;

      this.update(dt);
      this.render();

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    if (this.engine.state === GAME_STATES.PLAYING) {
      const events = this.engine.step(dt);
      events.forEach(e => this.processEvent(e));
      this.syncHUD();
    }
  }

  processEvent(e) {
    switch (e.type) {
      case 'PADDLE_HIT':
        sound.playPaddleHit(e.sweetSpot);
        break;
      case 'BRICK_HIT':
        this.scoreSystem.addBrickBreak(e.brick.tier, e.isOverdrive, this.engine.combo);
        sound.playBrickHit(e.destroyed, e.isOverdrive);
        break;
      case 'WARP':
        sound.playSingularityWarp();
        break;
      case 'OVERDRIVE_START':
        sound.playOverdriveExplosion();
        break;
      case 'LIFE_LOST':
        this.scoreSystem.resetStreak();
        sound.playGameOver();
        break;
      case 'SECTOR_CLEARED': {
        this.scoreSystem.addSectorClearBonus(e.sector);
        sound.playSectorClear();
        this.ui.showDraftOverlay(this.engine.draftPool, id => this.handleDraftSelect(id));
        break;
      }
      case 'GAME_OVER': {
        const result = saveGameRecord({
          score: this.scoreSystem.getScore(),
          sector: this.engine.sector
        });
        this.savedData = result;
        this.ui.showGameOverOverlay({
          isVictory: false,
          score: this.scoreSystem.getScore(),
          sector: this.engine.sector,
          highScore: result.highScore
        });
        break;
      }
      case 'VICTORY': {
        const result = saveGameRecord({
          score: this.scoreSystem.getScore(),
          sector: this.engine.sector
        });
        this.savedData = result;
        this.ui.showGameOverOverlay({
          isVictory: true,
          score: this.scoreSystem.getScore(),
          sector: this.engine.sector,
          highScore: result.highScore
        });
        break;
      }
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 背景矩阵网格
    this.renderBackgroundGrid(ctx, w, h);

    // 奇点引力井
    this.engine.singularities.forEach(s => {
      this.renderSingularity(ctx, s);
    });

    // 砖块阵列
    this.engine.bricks.forEach(brick => {
      this.renderBrick(ctx, brick);
    });

    // 操控底板
    this.renderPaddle(ctx, this.engine.paddle);

    // 追踪星屑飞弹
    this.engine.projectiles.forEach(p => {
      ctx.save();
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 弹珠光子核心
    this.engine.balls.forEach(b => {
      this.renderBall(ctx, b);
    });

    // 动态碎片火花
    this.engine.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 超载音爆全屏光效
    if (this.engine.isOverdrive) {
      ctx.save();
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.restore();
    }
  }

  renderBackgroundGrid(ctx, w, h) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    const step = 45;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  renderSingularity(ctx, s) {
    ctx.save();
    const grad = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, s.r * 2.8);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.4, 'rgba(56, 189, 248, 0.7)');
    grad.addColorStop(1, 'rgba(192, 132, 252, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 2.8, 0, Math.PI * 2);
    ctx.fill();

    const pulseR = s.r + Math.sin(s.pulse) * 4.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pulseR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderBrick(ctx, brick) {
    ctx.save();
    const isDamaged = brick.hp < brick.maxHp;
    let baseColor = brick.tier >= 3 ? '#fbbf24' : (brick.tier === 2 ? '#c084fc' : '#38bdf8');
    if (isDamaged) baseColor = '#f43f5e';

    ctx.fillStyle = baseColor;
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 6;

    const r = 4;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(brick.x, brick.y, brick.w, brick.h, r) : ctx.rect(brick.x, brick.y, brick.w, brick.h);
    ctx.fill();

    // 内部微高光
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(brick.x + 3, brick.y + 2, brick.w - 6, 3);
    ctx.restore();
  }

  renderPaddle(ctx, paddle) {
    ctx.save();
    const grad = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y);
    grad.addColorStop(0, '#2dd4bf');
    grad.addColorStop(0.5, '#38bdf8');
    grad.addColorStop(1, '#c084fc');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;

    const r = paddle.h / 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, r) : ctx.rect(paddle.x, paddle.y, paddle.w, paddle.h);
    ctx.fill();

    // 中心共振甜点标记
    ctx.fillStyle = '#ffffff';
    const sweetW = paddle.w * 0.28;
    ctx.fillRect(paddle.x + paddle.w / 2 - sweetW / 2, paddle.y + 2, sweetW, 2.5);
    ctx.restore();
  }

  renderBall(ctx, b) {
    ctx.save();
    const isOverdrive = this.engine.isOverdrive;
    const color = isOverdrive ? '#f43f5e' : (b.isSub ? '#c084fc' : '#38bdf8');

    ctx.shadowColor = color;
    ctx.shadowBlur = isOverdrive ? 18 : 10;
    ctx.fillStyle = color;

    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
