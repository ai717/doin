/**
 * UI and DOM rendering layer for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * Pure presentation: handles DOM tree, CSS 3D isometric lock rendering, and Canvas 2D wood particles.
 */

import { WOOD_STAINS, CHAPTERS, RATINGS } from './data.mjs';
import { canBlockMove } from './engine.mjs';
import { t, getLanguage } from './i18n.mjs';

export class LubanUI {
  constructor() {
    this.dom = {
      app: document.getElementById('app'),
      stage3d: document.getElementById('lock-stage-3d'),
      assembly: document.getElementById('lock-assembly'),
      tray: document.getElementById('tray-blocks'),
      canvas: document.getElementById('sawdust-canvas'),

      // HUD
      hudLevelTitle: document.getElementById('hud-level-title'),
      hudRemainingCount: document.getElementById('hud-remaining-count'),
      hudSteps: document.getElementById('hud-steps'),
      hudOptimal: document.getElementById('hud-optimal'),
      hudAngleIndicator: document.getElementById('hud-angle-indicator'),

      // Buttons
      btnLevels: document.getElementById('btn-levels'),
      btnRotate: document.getElementById('btn-rotate'),
      btnHint: document.getElementById('btn-hint'),
      btnUndo: document.getElementById('btn-undo'),
      btnRestart: document.getElementById('btn-restart'),
      btnSound: document.getElementById('btn-sound'),
      btnLang: document.getElementById('btn-lang'),
      btnRules: document.getElementById('btn-rules'),

      // Modals
      modalLevels: document.getElementById('modal-levels'),
      levelsGrid: document.getElementById('levels-grid'),
      modalRules: document.getElementById('modal-rules'),
      modalSettlement: document.getElementById('modal-settlement'),

      // Settlement
      settlementRating: document.getElementById('settlement-rating'),
      settlementSteps: document.getElementById('settlement-steps'),
      settlementTrivia: document.getElementById('settlement-trivia'),
      btnNextLevel: document.getElementById('btn-next-level'),
      btnReplayLevel: document.getElementById('btn-replay-level')
    };

    this.ctx = this.dom.canvas ? this.dom.canvas.getContext('2d') : null;
    this.particles = [];
    this.hintedBlockIds = new Set();
    this.flashingBlockerIds = new Set();

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
   * Set 3D isometric view rotation angle (0, 90, 180, 270).
   */
  setViewAngle(angle) {
    if (this.dom.stage3d) {
      this.dom.stage3d.style.transform = `rotateX(58deg) rotateZ(${-45 + angle}deg)`;
    }
    if (this.dom.hudAngleIndicator) {
      this.dom.hudAngleIndicator.textContent = `${angle}°`;
    }
  }

  /**
   * Render the 3D interlocking lock assembly.
   */
  renderAssembly(remainingBlocks, onBlockClick) {
    if (!this.dom.assembly) return;
    this.dom.assembly.innerHTML = '';

    remainingBlocks.forEach(block => {
      const moveCheck = canBlockMove(block, remainingBlocks);
      const isFree = moveCheck.canMove;
      const isHinted = this.hintedBlockIds.has(block.id);
      const isFlashingBlocker = this.flashingBlockerIds.has(block.id);

      const blockWrap = document.createElement('div');
      blockWrap.className = `block-3d-wrap ${isFree ? 'is-free' : 'is-blocked'}`;
      if (block.isKey) blockWrap.classList.add('is-key-block');
      if (isHinted) blockWrap.classList.add('is-hinted');
      if (isFlashingBlocker) blockWrap.classList.add('flash-blocker');

      blockWrap.dataset.id = block.id;

      // 3D positioning
      const { x, y, z } = block.pos;
      blockWrap.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
      blockWrap.style.setProperty('--x', `${x}px`);
      blockWrap.style.setProperty('--y', `${y}px`);
      blockWrap.style.setProperty('--z', `${z}px`);

      // Build 3D box faces based on axis
      const stain = WOOD_STAINS[block.stain] || WOOD_STAINS.cedar;
      const isX = block.axis === 'x';
      const isY = block.axis === 'y';
      const isZ = block.axis === 'z';

      const w = isX ? block.length : block.thickness;
      const h = isY ? block.length : block.thickness;
      const d = isZ ? block.length : block.thickness;

      // 6 airtight, mathematically closed faces of the solid wooden cuboid:
      // Front (+Z): size w x h, centered at [0, 0, d/2]
      // Back (-Z): size w x h, centered at [0, 0, -d/2]
      // Right (+X): size d x h, centered at [w/2, 0, 0]
      // Left (-X): size d x h, centered at [-w/2, 0, 0]
      // Top (-Y, screen up): size w x d, centered at [0, -h/2, 0]
      // Bottom (+Y, screen down): size w x d, centered at [0, h/2, 0]
      const labelHtml = `<span class="block-label">${block.label}</span>`;

      blockWrap.innerHTML = `
        <div class="prism-face face-front" style="width: ${w}px; height: ${h}px; left: ${-w / 2}px; top: ${-h / 2}px; transform: translateZ(${d / 2}px); background: ${stain.colorLeft};">
          ${labelHtml}
        </div>
        <div class="prism-face face-back" style="width: ${w}px; height: ${h}px; left: ${-w / 2}px; top: ${-h / 2}px; transform: rotateY(180deg) translateZ(${d / 2}px); background: ${stain.colorRight};">
          ${labelHtml}
        </div>
        <div class="prism-face face-right" style="width: ${d}px; height: ${h}px; left: ${-d / 2}px; top: ${-h / 2}px; transform: rotateY(90deg) translateZ(${w / 2}px); background: ${stain.colorRight};">
          ${labelHtml}
        </div>
        <div class="prism-face face-left" style="width: ${d}px; height: ${h}px; left: ${-d / 2}px; top: ${-h / 2}px; transform: rotateY(-90deg) translateZ(${w / 2}px); background: ${stain.colorLeft};">
          ${labelHtml}
        </div>
        <div class="prism-face face-top" style="width: ${w}px; height: ${d}px; left: ${-w / 2}px; top: ${-d / 2}px; transform: rotateX(90deg) translateZ(${h / 2}px); background: ${stain.colorTop};">
          ${labelHtml}
        </div>
        <div class="prism-face face-bottom" style="width: ${w}px; height: ${d}px; left: ${-w / 2}px; top: ${-d / 2}px; transform: rotateX(-90deg) translateZ(${h / 2}px); background: ${stain.colorRight};">
        </div>
      `;

      blockWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        onBlockClick(block.id, blockWrap);
      });

      this.dom.assembly.appendChild(blockWrap);
    });
  }

  /**
   * Render side wooden tray holding extracted blocks.
   */
  renderTray(extractedBlocks) {
    if (!this.dom.tray) return;
    this.dom.tray.innerHTML = '';

    extractedBlocks.forEach(block => {
      const stain = WOOD_STAINS[block.stain] || WOOD_STAINS.cedar;
      const item = document.createElement('div');
      item.className = 'tray-block-item';
      item.style.borderColor = stain.colorTop;
      item.innerHTML = `
        <span class="tray-label-badge" style="background: ${stain.colorLeft};">${block.label}</span>
        <span class="tray-name">${block.isKey ? t('ruleKey').slice(0, 4) : block.axis.toUpperCase() + '-' + block.label}</span>
      `;
      this.dom.tray.appendChild(item);
    });
  }

  /**
   * Play wiggle animation when a block is blocked and flash its obstructing blockers.
   */
  triggerBlockedFeedback(blockId, blockerIds) {
    const el = document.querySelector(`.block-3d-wrap[data-id="${blockId}"]`);
    if (el) {
      el.classList.remove('wiggle-blocked');
      // trigger reflow
      void el.offsetWidth;
      el.classList.add('wiggle-blocked');
    }

    this.flashingBlockerIds = new Set(blockerIds);
    blockerIds.forEach(bId => {
      const bEl = document.querySelector(`.block-3d-wrap[data-id="${bId}"]`);
      if (bEl) bEl.classList.add('flash-blocker');
    });

    setTimeout(() => {
      this.flashingBlockerIds.clear();
      document.querySelectorAll('.flash-blocker').forEach(b => b.classList.remove('flash-blocker'));
    }, 900);
  }

  /**
   * Animate a free block sliding out along its primary axis.
   */
  animateSlideOut(blockId, block, onComplete) {
    const el = document.querySelector(`.block-3d-wrap[data-id="${blockId}"]`);
    if (!el) {
      onComplete();
      return;
    }

    const dist = 240 * block.slideDir;
    let dx = 0, dy = 0, dz = 0;
    if (block.axis === 'x') dx = dist;
    else if (block.axis === 'y') dy = dist;
    else dz = dist;

    el.style.transition = 'transform 0.28s cubic-bezier(0.2, 0.9, 0.3, 1), opacity 0.28s ease';
    el.style.transform = `translate3d(${block.pos.x + dx}px, ${block.pos.y + dy}px, ${block.pos.z + dz}px)`;
    el.style.opacity = '0';

    setTimeout(onComplete, 290);
  }

  /**
   * Update HUD statistics.
   */
  renderHUD(gameState, levelConfig) {
    const lang = getLanguage();
    if (this.dom.hudLevelTitle) {
      const title = lang === 'zh' ? levelConfig.nameZh : levelConfig.nameEn;
      this.dom.hudLevelTitle.textContent = `${t('levelTitle')} ${levelConfig.id} · ${title}`;
    }
    if (this.dom.hudRemainingCount) {
      this.dom.hudRemainingCount.textContent = `${gameState.remainingBlocks.length}`;
    }
    if (this.dom.hudSteps) {
      this.dom.hudSteps.textContent = `${gameState.steps}`;
    }
    if (this.dom.hudOptimal) {
      this.dom.hudOptimal.textContent = `${levelConfig.optimalMoves}`;
    }
    if (this.dom.btnUndo) {
      this.dom.btnUndo.disabled = gameState.undoStack.length === 0;
    }
  }

  /**
   * Set hint highlights on movable blocks.
   */
  setHintedBlocks(blockIds) {
    this.hintedBlockIds = new Set(blockIds);
    blockIds.forEach(id => {
      const el = document.querySelector(`.block-3d-wrap[data-id="${id}"]`);
      if (el) el.classList.add('is-hinted');
    });

    setTimeout(() => {
      this.hintedBlockIds.clear();
      document.querySelectorAll('.is-hinted').forEach(el => el.classList.remove('is-hinted'));
    }, 2800);
  }

  /**
   * Spawn sawdust / wood shavings celebration particles on canvas.
   */
  spawnSawdustParticles(x, y, color = '#d99457') {
    const count = 35;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 5.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2.5 + Math.random() * 4,
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

  /**
   * Show victory settlement modal with tenon rating and trivia quote.
   */
  showSettlement(summary, onNext, onReplay) {
    if (!this.dom.modalSettlement) return;

    const lang = getLanguage();
    const ratingName = lang === 'zh' ? summary.rating.nameZh : summary.rating.nameEn;

    if (this.dom.settlementRating) {
      let starsHtml = '';
      for (let s = 1; s <= 3; s++) {
        starsHtml += `<span class="rating-star ${s <= summary.stars ? 'earned' : ''}">★</span>`;
      }
      this.dom.settlementRating.innerHTML = `
        <div class="rating-icon">${summary.rating.icon}</div>
        <div class="rating-title">${ratingName}</div>
        <div class="rating-stars">${starsHtml}</div>
      `;
    }

    if (this.dom.settlementSteps) {
      this.dom.settlementSteps.textContent = `${t('stepsLabel')}: ${summary.steps} (${t('optimalSteps')}: ${summary.optimalMoves})`;
    }

    if (this.dom.settlementTrivia) {
      const quote = lang === 'zh' ? summary.triviaZh : summary.triviaEn;
      this.dom.settlementTrivia.textContent = `“${quote}”`;
    }

    this.dom.modalSettlement.classList.add('visible');
  }

  hideSettlement() {
    if (this.dom.modalSettlement) this.dom.modalSettlement.classList.remove('visible');
  }

  /**
   * Render 36 levels in the modal gallery drawer.
   */
  renderLevelsGrid(levels, unlockedLevel, levelRatings, onSelectLevel) {
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
        const ratingId = levelRatings[lvl] || null;

        let badgeIcon = isUnlocked ? '🔓' : '🔒';
        if (ratingId && RATINGS[ratingId]) {
          badgeIcon = RATINGS[ratingId].icon;
        }

        const btn = document.createElement('button');
        btn.className = `level-badge ${isUnlocked ? 'unlocked' : 'locked'}`;
        btn.disabled = !isUnlocked;

        btn.innerHTML = `
          <span class="badge-num">${lvl}</span>
          <span class="badge-status">${badgeIcon}</span>
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

    if (this.dom.btnLang) {
      this.dom.btnLang.textContent = t('langToggle');
    }
  }
}
