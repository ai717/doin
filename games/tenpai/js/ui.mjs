/**
 * UI and DOM rendering layer for Tenpai King · Wait Finder (雀神听牌王 · 听牌速判)
 * Pure presentation: handles DOM tree, CSS 3D Mahjong tiles, and Canvas 2D victory particles.
 */

import { TILES, SUITS, CHAPTERS, DAN_RANKS } from './data.mjs';
import { getDanRank } from './score.mjs';
import { t, getLanguage } from './i18n.mjs';

export class TenpaiUI {
  constructor() {
    this.dom = {
      app: document.getElementById('app'),
      handContainer: document.getElementById('hand-tiles'),
      pickerContainer: document.getElementById('tile-picker'),
      resultPanel: document.getElementById('result-panel'),
      canvas: document.getElementById('fireworks-canvas'),

      // HUD
      hudLevelTitle: document.getElementById('hud-level-title'),
      hudScore: document.getElementById('hud-score'),
      hudStreak: document.getElementById('hud-streak'),
      hudDanBadge: document.getElementById('hud-dan-badge'),
      hudTimer: document.getElementById('hud-timer'),

      // Buttons
      btnLevels: document.getElementById('btn-levels'),
      btnSubmit: document.getElementById('btn-submit'),
      btnClear: document.getElementById('btn-clear'),
      btnNext: document.getElementById('btn-next'),
      btnRetry: document.getElementById('btn-retry'),
      btnRestart: document.getElementById('btn-restart'),
      btnPause: document.getElementById('btn-pause'),
      btnSound: document.getElementById('btn-sound'),
      btnLang: document.getElementById('btn-lang'),
      btnRules: document.getElementById('btn-rules'),

      // Modals
      modalLevels: document.getElementById('modal-levels'),
      levelsGrid: document.getElementById('levels-grid'),
      modalRules: document.getElementById('modal-rules'),
      modalPause: document.getElementById('modal-pause'),

      // Result elements
      resultTitle: document.getElementById('result-title'),
      resultScoreBadge: document.getElementById('result-score-badge'),
      resultWaitsList: document.getElementById('result-waits-list'),
      resultMeldsList: document.getElementById('result-melds-list'),
      resultFanList: document.getElementById('result-fan-list')
    };

    this.ctx = this.dom.canvas ? this.dom.canvas.getContext('2d') : null;
    this.particles = [];
    this.selectedTiles = new Set();
    this.targetTile = null;

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

  /**
   * Helper to build Mahjong tile HTML with 3D ivory face and jade backing.
   */
  createTileHTML(tileId, customClass = '') {
    const tileDef = TILES[tileId] || { symbol: '?', color: '#000', nameZh: tileId, nameEn: tileId };
    const lang = getLanguage();
    const nameLabel = lang === 'zh' ? tileDef.nameZh : tileDef.nameEn;

    return `
      <div class="mahjong-tile ${customClass}" data-tile="${tileId}">
        <div class="tile-jade-back"></div>
        <div class="tile-face">
          <div class="tile-gloss"></div>
          <span class="tile-symbol" style="color: ${tileDef.color};">${tileDef.symbol}</span>
          <span class="tile-sub">${nameLabel}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render the 13 standing hand tiles.
   */
  renderHand(tiles13) {
    if (!this.dom.handContainer) return;
    this.dom.handContainer.innerHTML = '';

    tiles13.forEach((tileId) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'hand-tile-wrap';
      wrapper.innerHTML = this.createTileHTML(tileId, 'hand-standing-tile');
      this.dom.handContainer.appendChild(wrapper);
    });
  }

  /**
   * Render Candidate Selection Tiles Picker (34 tiles grouped by suit).
   */
  renderTilePicker(onToggleSelect) {
    if (!this.dom.pickerContainer) return;
    this.dom.pickerContainer.innerHTML = '';

    const groups = ['m', 'p', 's', 'z'];
    const lang = getLanguage();

    groups.forEach(key => {
      const suitDef = SUITS[key];
      const row = document.createElement('div');
      row.className = 'picker-suit-row';

      const label = document.createElement('div');
      label.className = 'picker-suit-label';
      label.textContent = lang === 'zh' ? suitDef.nameZh : suitDef.nameEn;
      row.appendChild(label);

      const tilesContainer = document.createElement('div');
      tilesContainer.className = 'picker-tiles-row';

      const tileIds = Object.keys(TILES).filter(k => TILES[k].suit === g.key);
      tileIds.forEach(id => {
        const isSelected = this.selectedTiles.has(id);
        const isTarget = this.targetTile === id;

        const tileEl = document.createElement('div');
        tileEl.className = `picker-tile-wrap ${isSelected ? 'selected' : ''} ${isTarget ? 'is-target' : ''}`;
        
        let targetBadgeHtml = '';
        if (isTarget) {
          targetBadgeHtml = `<div class="target-flag">${t('targetBadge')}</div>`;
        }

        tileEl.innerHTML = `
          ${targetBadgeHtml}
          ${this.createTileHTML(id, 'selectable-tile')}
        `;

        tileEl.addEventListener('click', () => {
          onToggleSelect(id);
        });

        tilesContainer.appendChild(tileEl);
      });

      row.appendChild(tilesContainer);
      this.dom.pickerContainer.appendChild(row);
    });
  }

  /**
   * Update HUD metrics.
   */
  renderHUD(levelConfig, currentScore, streak, remainingSec, totalScore) {
    const lang = getLanguage();
    if (this.dom.hudLevelTitle) {
      const title = lang === 'zh' ? levelConfig.nameZh : levelConfig.nameEn;
      this.dom.hudLevelTitle.textContent = `${t('levelsBtn')} ${levelConfig.id} · ${title}`;
    }
    if (this.dom.hudScore) {
      this.dom.hudScore.textContent = `${currentScore}`;
    }
    if (this.dom.hudStreak) {
      this.dom.hudStreak.textContent = `${streak}`;
    }
    if (this.dom.hudDanBadge) {
      const dan = getDanRank(totalScore);
      this.dom.hudDanBadge.textContent = lang === 'zh' ? dan.nameZh : dan.nameEn;
      this.dom.hudDanBadge.style.background = dan.badgeColor;
    }
    if (this.dom.hudTimer) {
      this.dom.hudTimer.textContent = `${Math.ceil(remainingSec)}s`;
      if (remainingSec <= 5) {
        this.dom.hudTimer.classList.add('timer-urgent');
      } else {
        this.dom.hudTimer.classList.remove('timer-urgent');
      }
    }
  }

  /**
   * Show results and detailed decomposition.
   */
  showResultPanel(evalResult, levelConfig) {
    if (!this.dom.resultPanel) return;

    // Title and Grade
    if (evalResult.isPerfect) {
      this.dom.resultTitle.textContent = t('correctLabel');
      this.dom.resultTitle.className = 'result-status status-perfect';
    } else if (evalResult.isPassed) {
      this.dom.resultTitle.textContent = t('partialLabel');
      this.dom.resultTitle.className = 'result-status status-passed';
    } else {
      this.dom.resultTitle.textContent = t('failedLabel');
      this.dom.resultTitle.className = 'result-status status-failed';
    }

    if (this.dom.resultScoreBadge) {
      this.dom.resultScoreBadge.textContent = `+${evalResult.totalScore} PTS`;
    }

    // Render Actual Waits & Player Choices
    if (this.dom.resultWaitsList) {
      this.dom.resultWaitsList.innerHTML = '';
      const actualSet = new Set(levelConfig.waits);
      const userSet = new Set(evalResult.userPicks);

      // Union of all tiles to display
      const displayTiles = Array.from(new Set([...levelConfig.waits, ...evalResult.userPicks]));

      displayTiles.forEach(tileId => {
        const isActual = actualSet.has(tileId);
        const isPicked = userSet.has(tileId);
        const isBestFan = (tileId === levelConfig.bestWait);

        let statusClass = '';
        let tagText = '';

        if (isActual && isPicked) {
          statusClass = 'reveal-correct';
          tagText = '✓';
        } else if (isActual && !isPicked) {
          statusClass = 'reveal-missed';
          tagText = '!';
        } else if (!isActual && isPicked) {
          statusClass = 'reveal-wrong';
          tagText = '✗';
        }

        const tileBox = document.createElement('div');
        tileBox.className = `reveal-tile-box ${statusClass} ${isBestFan ? 'gilded-crown' : ''}`;
        
        let crownHtml = '';
        if (isBestFan) {
          crownHtml = `<span class="crown-badge" title="${t('maxFanTitle')}">👑 ${levelConfig.maxFan}${t('fanUnit')}</span>`;
        }

        tileBox.innerHTML = `
          ${crownHtml}
          <span class="status-marker">${tagText}</span>
          ${this.createTileHTML(tileId, 'reveal-tile')}
        `;
        this.dom.resultWaitsList.appendChild(tileBox);
      });
    }

    // Render Melds decomposition
    if (this.dom.resultMeldsList) {
      this.dom.resultMeldsList.innerHTML = '';
      const bestDetail = levelConfig.waitDetails.find(d => d.tileId === levelConfig.bestWait);
      if (bestDetail && bestDetail.melds) {
        bestDetail.melds.forEach(meld => {
          const meldCard = document.createElement('div');
          meldCard.className = 'meld-card';
          meldCard.innerHTML = `
            <div class="meld-tiles">
              ${meld.tiles.map(t => this.createTileHTML(t, 'mini-tile')).join('')}
            </div>
            <div class="meld-type">${meld.type}</div>
          `;
          this.dom.resultMeldsList.appendChild(meldCard);
        });
        if (bestDetail.pair) {
          const pairCard = document.createElement('div');
          pairCard.className = 'meld-card';
          pairCard.innerHTML = `
            <div class="meld-tiles">
              ${this.createTileHTML(bestDetail.pair, 'mini-tile')}
              ${this.createTileHTML(bestDetail.pair, 'mini-tile')}
            </div>
            <div class="meld-type">pair</div>
          `;
          this.dom.resultMeldsList.appendChild(pairCard);
        }
      }
    }

    // Render Fans list
    if (this.dom.resultFanList) {
      this.dom.resultFanList.innerHTML = '';
      const bestDetail = levelConfig.waitDetails.find(d => d.tileId === levelConfig.bestWait);
      const lang = getLanguage();
      if (bestDetail && bestDetail.fanList) {
        bestDetail.fanList.forEach(f => {
          const chip = document.createElement('span');
          chip.className = 'fan-chip';
          const name = lang === 'zh' ? f.nameZh : f.nameEn;
          chip.textContent = `${name} (${f.fan}${t('fanUnit')})`;
          this.dom.resultFanList.appendChild(chip);
        });
      }
    }

    this.dom.resultPanel.classList.add('visible');
  }

  hideResultPanel() {
    if (this.dom.resultPanel) {
      this.dom.resultPanel.classList.remove('visible');
    }
  }

  /**
   * Spawn fireworks / particles.
   */
  spawnFireworks(x, y, color = '#f59e0b') {
    const count = 30;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.02
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
      p.vy += 0.1;
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

  /**
   * Render levels in modal drawer.
   */
  renderLevelsGrid(levels, unlockedLevel, levelScores, onSelectLevel) {
    if (!this.dom.levelsGrid) return;
    this.dom.levelsGrid.innerHTML = '';
    const lang = getLanguage();

    CHAPTERS.forEach(ch => {
      const section = document.createElement('div');
      section.className = 'chapter-section';

      const chTitle = lang === 'zh' ? ch.nameZh : ch.nameEn;
      const chDesc = lang === 'zh' ? ch.descZh : ch.descEn;

      section.innerHTML = `
        <div class="chapter-header">
          <div class="chapter-title">${chTitle}</div>
          <div class="chapter-desc">${chDesc}</div>
        </div>
        <div class="chapter-grid"></div>
      `;

      const grid = section.querySelector('.chapter-grid');
      const [startLvl, endLvl] = ch.levelRange;

      for (let lvl = startLvl; lvl <= endLvl; lvl++) {
        const isUnlocked = lvl <= unlockedLevel;
        const score = levelScores[lvl] || 0;

        const btn = document.createElement('button');
        btn.className = `level-badge ${isUnlocked ? 'unlocked' : 'locked'}`;
        btn.disabled = !isUnlocked;

        btn.innerHTML = `
          <span class="badge-num">${lvl}</span>
          <span class="badge-score">${isUnlocked && score > 0 ? `${score}p` : (isUnlocked ? '·' : '🔒')}</span>
        `;

        if (isUnlocked) {
          btn.addEventListener('click', () => {
            this.hideLevelsModal();
            onSelectLevel(lvl);
          });
        }

        grid.appendChild(btn);
      }

      this.dom.levelsGrid.appendChild(section);
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

  showPauseModal() {
    if (this.dom.modalPause) this.dom.modalPause.classList.add('visible');
  }

  hidePauseModal() {
    if (this.dom.modalPause) this.dom.modalPause.classList.remove('visible');
  }

  /**
   * In-place live i18n text update without reloading or resetting state!
   */
  updateTexts() {
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });

    if (this.dom.btnLang) {
      this.dom.btnLang.textContent = t('langToggle');
    }
  }
}
