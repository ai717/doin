/**
 * UI and DOM rendering layer for TileStack (千层瓦片 · 叠叠消)
 * Pure presentation: handles DOM tree, CSS 3D transforms, and Canvas 2D match particles.
 */

import { GAME_CONSTANTS, TILE_DEFINITIONS, CHAPTERS } from './data.mjs';
import { isTileBlocked } from './engine.mjs';
import { t, getLanguage } from './i18n.mjs';

export class TileStackUI {
  constructor() {
    this.dom = {
      // Containers
      app: document.getElementById('app'),
      tower: document.getElementById('tower-board'),
      tray: document.getElementById('tray-slots'),
      canvas: document.getElementById('effects-canvas'),
      
      // HUD
      hudLevelName: document.getElementById('hud-level-name'),
      hudScore: document.getElementById('hud-score'),
      hudSteps: document.getElementById('hud-steps'),
      hudTilesLeft: document.getElementById('hud-tiles-left'),
      hudLayersLeft: document.getElementById('hud-layers-left'),
      hudTimer: document.getElementById('hud-timer'),
      hudTimerWrap: document.getElementById('hud-timer-wrap'),
      
      // Buttons
      btnLevels: document.getElementById('btn-levels'),
      btnHint: document.getElementById('btn-hint'),
      btnUndo: document.getElementById('btn-undo'),
      btnRestart: document.getElementById('btn-restart'),
      btnPause: document.getElementById('btn-pause'),
      btnSound: document.getElementById('btn-sound'),
      btnLang: document.getElementById('btn-lang'),
      btnRules: document.getElementById('btn-rules'),
      
      // Drawers and Modals
      modalLevels: document.getElementById('modal-levels'),
      levelsGrid: document.getElementById('levels-grid'),
      modalRules: document.getElementById('modal-rules'),
      modalSettlement: document.getElementById('modal-settlement'),
      modalPause: document.getElementById('modal-pause'),
      settlementTitle: document.getElementById('settlement-title'),
      settlementDesc: document.getElementById('settlement-desc'),
      settlementStars: document.getElementById('settlement-stars'),
      settlementScore: document.getElementById('settlement-score'),
      settlementSteps: document.getElementById('settlement-steps'),
      btnNextLevel: document.getElementById('btn-next-level'),
      btnTryAgain: document.getElementById('btn-try-again'),
      btnUndoLast: document.getElementById('btn-undo-last')
    };

    this.ctx = this.dom.canvas ? this.dom.canvas.getContext('2d') : null;
    this.particles = [];
    this.hintedTileIds = new Set();
    this.activeTheme = 'porcelain';

    this.initCanvasResize();
  }

  initCanvasResize() {
    if (!this.dom.canvas) return;
    const resize = () => {
      const rect = this.dom.canvas.getBoundingClientRect();
      this.dom.canvas.width = rect.width * (window.devicePixelRatio || 1);
      this.dom.canvas.height = rect.height * (window.devicePixelRatio || 1);
      if (this.ctx) {
        this.ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
      }
    };
    window.addEventListener('resize', resize);
    resize();
  }

  setTheme(theme) {
    this.activeTheme = theme;
    if (this.dom.app) {
      this.dom.app.dataset.theme = theme;
    }
  }

  /**
   * Render the 3D tiered tile tower.
   */
  renderTower(gameState, onTileClick) {
    if (!this.dom.tower) return;
    const boardTiles = gameState.boardTiles;
    this.dom.tower.innerHTML = '';

    // Calculate maximum layer for tier calculation
    let maxLayer = 0;
    boardTiles.forEach(t => {
      if (t.layer > maxLayer) maxLayer = t.layer;
    });

    boardTiles.forEach(tile => {
      const isBlocked = isTileBlocked(tile, boardTiles);
      const isKeyLocked = tile.special === 'lock' && gameState.unlockedKeys <= 0;
      const isFree = !isBlocked && !isKeyLocked;
      const isHinted = this.hintedTileIds.has(tile.id);

      const tileEl = document.createElement('div');
      tileEl.className = `tile ${isFree ? 'tile-free' : 'tile-blocked'}`;
      if (tile.special) tileEl.classList.add(`special-${tile.special}`);
      if (isHinted) tileEl.classList.add('tile-hinted');

      // 3D positioning
      const depthZ = tile.layer * GAME_CONSTANTS.LAYER_DEPTH_Z;
      tileEl.style.left = `calc(50% + ${tile.x}px)`;
      tileEl.style.top = `calc(50% + ${tile.y}px)`;
      tileEl.style.zIndex = `${tile.layer * 20 + Math.floor(tile.y / 5) + 100}`;
      tileEl.style.transform = `translate3d(-50%, -50%, ${depthZ}px)`;

      // Tile face content
      const def = TILE_DEFINITIONS[tile.type] || { icon: '🪨', nameZh: '', nameEn: '', color: '#1a5ba0' };
      const lang = getLanguage();
      const label = lang === 'zh' ? def.nameZh : def.nameEn;

      let badgeHtml = '';
      if (tile.special === 'frozen') {
        badgeHtml = `<span class="tile-badge badge-frozen">❄️${tile.frozenHits > 1 ? '×2' : ''}</span>`;
      } else if (tile.special === 'key') {
        badgeHtml = `<span class="tile-badge badge-key">🗝️</span>`;
      } else if (tile.special === 'lock') {
        badgeHtml = `<span class="tile-badge badge-lock">🔒</span>`;
      } else if (tile.special === 'wild') {
        badgeHtml = `<span class="tile-badge badge-wild">🌈</span>`;
      }

      tileEl.innerHTML = `
        <div class="tile-card">
          <div class="tile-glaze"></div>
          ${badgeHtml}
          <div class="tile-icon">${def.icon}</div>
          <div class="tile-label">${label}</div>
        </div>
      `;

      if (isFree) {
        tileEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onTileClick(tile.id, tileEl);
        });
      }

      this.dom.tower.appendChild(tileEl);
    });

    // Update layer gauge
    if (this.dom.hudLayersLeft) {
      this.dom.hudLayersLeft.textContent = `${boardTiles.length > 0 ? maxLayer + 1 : 0}`;
    }
  }

  /**
   * Render the 7-slot wooden tray.
   */
  renderTray(gameState) {
    if (!this.dom.tray) return;
    this.dom.tray.innerHTML = '';
    const tray = gameState.tray;

    // Check warning state (6 tiles = 1 slot left)
    const trayContainer = document.getElementById('tray-container');
    if (trayContainer) {
      if (tray.length >= GAME_CONSTANTS.TRAY_CAPACITY - 1) {
        trayContainer.classList.add('tray-warning');
      } else {
        trayContainer.classList.remove('tray-warning');
      }
    }

    // Render 7 slots
    for (let i = 0; i < GAME_CONSTANTS.TRAY_CAPACITY; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'tray-slot';

      const tile = tray[i];
      if (tile) {
        const def = TILE_DEFINITIONS[tile.type] || { icon: '🪨', nameZh: '', nameEn: '' };
        const lang = getLanguage();
        const label = lang === 'zh' ? def.nameZh : def.nameEn;

        const tileEl = document.createElement('div');
        tileEl.className = `tile tray-tile ${tile.special ? `special-${tile.special}` : ''}`;
        tileEl.innerHTML = `
          <div class="tile-card">
            <div class="tile-glaze"></div>
            <div class="tile-icon">${def.icon}</div>
            <div class="tile-label">${label}</div>
          </div>
        `;
        slotEl.appendChild(tileEl);
      }

      this.dom.tray.appendChild(slotEl);
    }
  }

  /**
   * Render HUD elements (Level, Score, Steps, Tiles Left, Timer).
   */
  renderHUD(gameState, levelConfig) {
    const lang = getLanguage();
    if (this.dom.hudLevelName) {
      const levelTitle = lang === 'zh' ? levelConfig.nameZh : levelConfig.nameEn;
      this.dom.hudLevelName.textContent = `${t('levelTitle')} ${levelConfig.id} · ${levelTitle}`;
    }
    if (this.dom.hudScore) {
      this.dom.hudScore.textContent = `${gameState.score}`;
    }
    if (this.dom.hudSteps) {
      this.dom.hudSteps.textContent = `${gameState.steps}`;
    }
    if (this.dom.hudTilesLeft) {
      this.dom.hudTilesLeft.textContent = `${gameState.boardTiles.length}`;
    }
    if (this.dom.hudTimerWrap && this.dom.hudTimer) {
      if (gameState.isTimed) {
        this.dom.hudTimerWrap.style.display = 'flex';
        const sec = Math.ceil(gameState.timeRemaining);
        const mins = Math.floor(sec / 60);
        const remain = sec % 60;
        this.dom.hudTimer.textContent = `${mins}:${remain < 10 ? '0' : ''}${remain}`;
        if (sec <= 15) {
          this.dom.hudTimer.classList.add('timer-danger');
        } else {
          this.dom.hudTimer.classList.remove('timer-danger');
        }
      } else {
        this.dom.hudTimerWrap.style.display = 'none';
      }
    }
    if (this.dom.btnHint) {
      const left = Math.max(0, GAME_CONSTANTS.MAX_HINTS - gameState.hintsUsed);
      this.dom.btnHint.textContent = `${t('hintBtn')} (${left})`;
      this.dom.btnHint.disabled = left <= 0;
    }
    if (this.dom.btnUndo) {
      this.dom.btnUndo.disabled = gameState.undoStack.length === 0;
    }
  }

  /**
   * Spawn celebratory match particles on canvas.
   */
  spawnMatchParticles(x, y, color = '#38bdf8') {
    const count = 24;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
        decay: 0.025 + Math.random() * 0.025
      });
    }
  }

  updateAndDrawParticles() {
    if (!this.ctx || !this.dom.canvas) return;
    const rect = this.dom.canvas.getBoundingClientRect();
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.12; // gravity
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  setHintedTiles(tileIds) {
    this.hintedTileIds = new Set(tileIds);
    setTimeout(() => {
      this.hintedTileIds.clear();
      const hintedEls = document.querySelectorAll('.tile-hinted');
      hintedEls.forEach(el => el.classList.remove('tile-hinted'));
    }, 2800);
  }

  /**
   * Open / Close Level Selection Modal
   */
  renderLevelsGrid(levels, unlockedLevel, levelStars, onSelectLevel) {
    if (!this.dom.levelsGrid) return;
    this.dom.levelsGrid.innerHTML = '';

    CHAPTERS.forEach((ch, chIdx) => {
      const chSection = document.createElement('div');
      chSection.className = 'chapter-section';

      const lang = getLanguage();
      const chTitle = lang === 'zh' ? ch.nameZh : ch.nameEn;
      const chDesc = lang === 'zh' ? ch.descZh : ch.descEn;

      chSection.innerHTML = `
        <div class="chapter-header">
          <div class="chapter-title">${chTitle}</div>
          <div class="chapter-desc">${chDesc}</div>
        </div>
        <div class="chapter-levels-grid"></div>
      `;

      const gridEl = chSection.querySelector('.chapter-levels-grid');
      const [startLvl, endLvl] = ch.levelRange;

      for (let lvl = startLvl; lvl <= endLvl; lvl++) {
        const isUnlocked = lvl <= unlockedLevel;
        const stars = levelStars[lvl] || 0;

        const btn = document.createElement('button');
        btn.className = `level-card ${isUnlocked ? 'unlocked' : 'locked'}`;
        btn.disabled = !isUnlocked;

        let starsHtml = '';
        for (let s = 1; s <= 3; s++) {
          starsHtml += `<span class="star-icon ${s <= stars ? 'active' : ''}">★</span>`;
        }

        btn.innerHTML = `
          <div class="level-num">${lvl}</div>
          <div class="level-stars">${isUnlocked ? starsHtml : '🔒'}</div>
        `;

        if (isUnlocked) {
          btn.addEventListener('click', () => {
            this.hideLevelsModal();
            onSelectLevel(lvl);
          });
        }

        gridEl.appendChild(btn);
      }

      this.dom.levelsGrid.appendChild(chSection);
    });
  }

  showLevelsModal() {
    if (this.dom.modalLevels) this.dom.modalLevels.classList.add('visible');
  }

  hideLevelsModal() {
    if (this.dom.modalLevels) this.dom.modalLevels.classList.remove('visible');
  }

  showRulesModal() {
    if (this.dom.modalRules) this.dom.modalRules.classList.add('visible');
  }

  hideRulesModal() {
    if (this.dom.modalRules) this.dom.modalRules.classList.remove('visible');
  }

  showPauseModal(onModalClose) {
    if (this.dom.modalPause) this.dom.modalPause.classList.add('visible');
  }

  hidePauseModal() {
    if (this.dom.modalPause) this.dom.modalPause.classList.remove('visible');
  }

  showSettlement(won, settlementData, onNext, onRestart, onUndo) {
    if (!this.dom.modalSettlement) return;

    if (won) {
      this.dom.settlementTitle.textContent = t('winTitle');
      this.dom.settlementDesc.textContent = t('winDesc');
      if (this.dom.btnNextLevel) this.dom.btnNextLevel.style.display = 'inline-block';
      if (this.dom.btnUndoLast) this.dom.btnUndoLast.style.display = 'none';

      let starsHtml = '';
      for (let s = 1; s <= 3; s++) {
        starsHtml += `<span class="settle-star ${s <= settlementData.stars ? 'earned' : ''}">★</span>`;
      }
      this.dom.settlementStars.innerHTML = starsHtml;
      this.dom.settlementScore.textContent = `${t('finalScore')}: ${settlementData.totalScore}`;
      this.dom.settlementSteps.textContent = `${t('stepsLabel')}: ${settlementData.steps}`;
    } else {
      this.dom.settlementTitle.textContent = t('lossTitle');
      this.dom.settlementDesc.textContent = t('lossDesc');
      this.dom.settlementStars.innerHTML = '';
      if (this.dom.btnNextLevel) this.dom.btnNextLevel.style.display = 'none';
      if (this.dom.btnUndoLast) this.dom.btnUndoLast.style.display = 'inline-block';
      this.dom.settlementScore.textContent = `${t('stepsLabel')}: ${settlementData.steps}`;
      this.dom.settlementSteps.textContent = '';
    }

    this.dom.modalSettlement.classList.add('visible');
  }

  hideSettlement() {
    if (this.dom.modalSettlement) this.dom.modalSettlement.classList.remove('visible');
  }

  /**
   * In-place live i18n text update without reloading or resetting game state!
   */
  updateTexts() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });

    const placeholders = document.querySelectorAll('[data-i18n-title]');
    placeholders.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.setAttribute('title', t(key));
      }
    });

    if (this.dom.btnLang) {
      this.dom.btnLang.textContent = t('langToggle');
    }
  }
}
