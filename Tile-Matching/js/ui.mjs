import { BOARD_ROWS, BOARD_COLS, SPECIAL_TYPES } from './engine.mjs';

const SVGS = {
  c1: `
    <svg viewBox="0 0 54 54">
      <defs>
        <radialGradient id="g_c1" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#ffe4e6" />
          <stop offset="25%" stop-color="#fb7185" />
          <stop offset="70%" stop-color="#e11d48" />
          <stop offset="100%" stop-color="#881337" />
        </radialGradient>
      </defs>
      <path d="M27,14 C21,6 10,8 10,18 C10,28 27,45 27,45 C27,45 44,28 44,18 C44,8 33,6 27,14 Z" fill="url(#g_c1)" />
      <path d="M27,18 C23,12 15,13 15,20 C15,26 27,38 27,38 C27,38 39,26 39,20 C39,13 31,12 27,18 Z" fill="#ffffff" opacity="0.32" />
      <circle cx="18" cy="16" r="3.5" fill="#ffffff" opacity="0.85" />
    </svg>
  `,
  c2: `
    <svg viewBox="0 0 54 54">
      <defs>
        <linearGradient id="g_c2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#ffedd5" />
          <stop offset="30%" stop-color="#fb923c" />
          <stop offset="75%" stop-color="#ea580c" />
          <stop offset="100%" stop-color="#7c2d12" />
        </linearGradient>
      </defs>
      <polygon points="27,4 50,27 27,50 4,27" fill="url(#g_c2)" />
      <polygon points="27,12 42,27 27,42 12,27" fill="#ffffff" opacity="0.3" />
      <polygon points="27,16 35,27 27,27" fill="#ffffff" opacity="0.85" />
    </svg>
  `,
  c3: `
    <svg viewBox="0 0 54 54">
      <defs>
        <radialGradient id="g_c3" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stop-color="#fef9c3" />
          <stop offset="35%" stop-color="#facc15" />
          <stop offset="75%" stop-color="#ca8a04" />
          <stop offset="100%" stop-color="#713f12" />
        </radialGradient>
      </defs>
      <polygon points="27,3 34,18 50,21 38,32 42,48 27,40 12,48 16,32 4,21 20,18" fill="url(#g_c3)" />
      <circle cx="27" cy="27" r="9" fill="#ffffff" opacity="0.45" />
      <circle cx="24" cy="24" r="3.5" fill="#ffffff" opacity="0.9" />
    </svg>
  `,
  c4: `
    <svg viewBox="0 0 54 54">
      <defs>
        <linearGradient id="g_c4" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stop-color="#dcfce7" />
          <stop offset="30%" stop-color="#4ade80" />
          <stop offset="70%" stop-color="#16a34a" />
          <stop offset="100%" stop-color="#064e3b" />
        </linearGradient>
      </defs>
      <rect x="7" y="7" width="40" height="40" rx="14" fill="url(#g_c4)" />
      <path d="M27,12 C27,12 33,18 33,23 C33,27 27,27 27,27 C27,27 27,33 23,33 C18,33 18,27 18,27 C18,27 12,27 12,23 C12,18 18,18 18,18 C18,18 18,12 23,12 C27,12 27,12 27,12 Z" fill="#ffffff" opacity="0.38" />
      <circle cx="16" cy="16" r="3" fill="#ffffff" opacity="0.85" />
    </svg>
  `,
  c5: `
    <svg viewBox="0 0 54 54">
      <defs>
        <linearGradient id="g_c5" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stop-color="#e0f2fe" />
          <stop offset="25%" stop-color="#38bdf8" />
          <stop offset="70%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#082f49" />
        </linearGradient>
      </defs>
      <path d="M27,4 C27,4 47,24 47,33 C47,44 38,50 27,50 C16,50 7,44 7,33 C7,24 27,4 27,4 Z" fill="url(#g_c5)" />
      <path d="M27,12 C27,12 40,26 40,33 C40,41 34,44 27,44 C20,44 14,41 14,33 C14,26 27,12 27,12 Z" fill="#ffffff" opacity="0.3" />
      <ellipse cx="21" cy="24" rx="3.5" ry="5" transform="rotate(-20 21 24)" fill="#ffffff" opacity="0.85" />
    </svg>
  `,
  c6: `
    <svg viewBox="0 0 54 54">
      <defs>
        <radialGradient id="g_c6" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#f3e8ff" />
          <stop offset="35%" stop-color="#c084fc" />
          <stop offset="75%" stop-color="#7e22ce" />
          <stop offset="100%" stop-color="#3b0764" />
        </radialGradient>
      </defs>
      <polygon points="27,5 47,16 47,38 27,49 7,38 7,16" fill="url(#g_c6)" />
      <polygon points="27,12 41,20 41,34 27,42 13,34 13,20" fill="#ffffff" opacity="0.28" />
      <circle cx="21" cy="18" r="3.5" fill="#ffffff" opacity="0.9" />
    </svg>
  `,
  rowRocketBadge: `
    <g filter="drop-shadow(0 0 8px #38bdf8)">
      <rect x="2" y="21" width="50" height="12" rx="6" fill="#0284c7" opacity="0.9" />
      <rect x="4" y="23" width="46" height="8" rx="4" fill="#e0f2fe" />
      <polygon points="12,17 2,27 12,37" fill="#ffffff" />
      <polygon points="42,17 52,27 42,37" fill="#ffffff" />
    </g>
  `,
  colRocketBadge: `
    <g filter="drop-shadow(0 0 8px #38bdf8)">
      <rect x="21" y="2" width="12" height="50" rx="6" fill="#0284c7" opacity="0.9" />
      <rect x="23" y="4" width="8" height="46" rx="4" fill="#e0f2fe" />
      <polygon points="17,12 27,2 37,12" fill="#ffffff" />
      <polygon points="17,42 27,52 37,42" fill="#ffffff" />
    </g>
  `,
  bombBadge: `
    <g filter="drop-shadow(0 0 10px #facc15)">
      <circle cx="27" cy="27" r="23" fill="none" stroke="#facc15" stroke-width="3" stroke-dasharray="7,4" />
      <circle cx="27" cy="27" r="14" fill="#0f0c22" stroke="#fde047" stroke-width="2.5" />
      <polygon points="27,16 30,23 38,27 30,31 27,38 24,31 16,27 24,23" fill="#facc15" />
    </g>
  `,
  rainbowPolyhedron: `
    <svg viewBox="0 0 54 54">
      <defs>
        <radialGradient id="rb-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="35%" stop-color="#facc15" />
          <stop offset="65%" stop-color="#ec4899" />
          <stop offset="100%" stop-color="#38bdf8" />
        </radialGradient>
      </defs>
      <circle cx="27" cy="27" r="23" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-dasharray="4,4" />
      <polygon points="27,4 34,19 50,27 34,35 27,50 20,35 4,27 20,19" fill="url(#rb-core)" filter="drop-shadow(0 0 12px rgba(236,72,153,0.95))" />
      <polygon points="27,12 31,23 42,27 31,31 27,42 23,31 12,27 23,23" fill="#ffffff" opacity="0.95" />
    </svg>
  `
};

export class UIManager {
  constructor() {
    this.boardInteractive = document.getElementById('board-interactive');
    this.boardBg = document.getElementById('board-grid-bg');
    this.fxLayer = document.getElementById('fx-layer');
    this.comboBanner = document.getElementById('combo-banner');
    this.shuffleBanner = document.getElementById('shuffle-banner');

    this.goalsContainer = document.getElementById('goals-container');
    this.movesValEl = document.getElementById('hud-moves');
    this.scoreValEl = document.getElementById('hud-score');
    this.levelNumEl = document.getElementById('hud-level-number');
    this.levelDescEl = document.getElementById('hud-level-desc');
    this.starContainer = document.getElementById('hud-star-container');

    this.levelModal = document.getElementById('level-modal');
    this.levelGridList = document.getElementById('level-grid-list');
    this.resultModal = document.getElementById('result-modal');
    this.resultTitle = document.getElementById('result-title');
    this.resultBadge = document.getElementById('result-badge');
    this.resultStars = document.getElementById('result-stars');
    this.resultDesc = document.getElementById('result-desc');
    this.resultScoreVal = document.getElementById('result-score-val');
    this.resultMovesVal = document.getElementById('result-moves-val');
    this.resultBestVal = document.getElementById('result-best-val');

    this.soundOnIcon = document.getElementById('icon-sound-on');
    this.soundOffIcon = document.getElementById('icon-sound-off');
    this.langTag = document.querySelector('.lang-tag');

    // 严密的二维元素引用映射表：[r][c] -> HTMLElement
    this.gridDom = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
    this.onTileClickHandler = null;

    this.createBackgroundGrid();
    this.bindBoardPointerEvents();
  }

  createBackgroundGrid() {
    this.boardBg.innerHTML = '';
    for (let i = 0; i < BOARD_ROWS * BOARD_COLS; i++) {
      const slot = document.createElement('div');
      slot.className = 'grid-cell-slot';
      this.boardBg.appendChild(slot);
    }
  }

  bindBoardPointerEvents() {
    this.boardInteractive.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!this.onTileClickHandler) return;

      const rect = this.boardInteractive.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

      const c = Math.floor((x / rect.width) * BOARD_COLS);
      const r = Math.floor((y / rect.height) * BOARD_ROWS);

      if (r >= 0 && r < BOARD_ROWS && c >= 0 && c < BOARD_COLS) {
        this.onTileClickHandler(r, c);
      }
    });
  }

  applyTransform(el, r, c, animate = true) {
    if (!animate) {
      el.style.transition = 'none';
    } else {
      el.style.transition = '';
    }
    el.style.transform = `translate3d(${c * 100}%, ${r * 100}%, 0)`;
    if (!animate) {
      void el.offsetHeight;
      el.style.transition = '';
    }
  }

  createTileNode(tileData) {
    const el = document.createElement('div');
    el.className = 'tile-node';
    el.dataset.uid = String(tileData.uid);
    el.style.width = `${100 / BOARD_COLS}%`;
    el.style.height = `${100 / BOARD_ROWS}%`;
    this.updateTileInner(el, tileData);
    return el;
  }

  updateTileInner(el, tileData) {
    if (tileData.special === SPECIAL_TYPES.RAINBOW) {
      el.innerHTML = SVGS.rainbowPolyhedron;
      return;
    }

    const baseSvg = SVGS[`c${tileData.color}`] || '';
    let badgeSvg = '';

    if (tileData.special === SPECIAL_TYPES.ROW_ROCKET) badgeSvg = SVGS.rowRocketBadge;
    else if (tileData.special === SPECIAL_TYPES.COL_ROCKET) badgeSvg = SVGS.colRocketBadge;
    else if (tileData.special === SPECIAL_TYPES.BOMB) badgeSvg = SVGS.bombBadge;

    if (badgeSvg) {
      el.innerHTML = `
        <div style="position:relative;width:92%;height:92%;display:flex;align-items:center;justify-content:center;">
          ${baseSvg}
          <svg style="position:absolute;inset:0;pointer-events:none;" viewBox="0 0 54 54">${badgeSvg}</svg>
        </div>
      `;
    } else {
      el.innerHTML = baseSvg;
    }
  }

  // 严格初始化与清空
  renderInitialBoard(grid, onTileClick) {
    this.boardInteractive.innerHTML = '';
    this.gridDom = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
    this.onTileClickHandler = onTileClick;

    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const tileData = grid[r][c];
        if (tileData) {
          const el = this.createTileNode(tileData);
          this.applyTransform(el, r, c, false);
          this.boardInteractive.appendChild(el);
          this.gridDom[r][c] = el;
        }
      }
    }
  }

  getTileElementAt(r, c) {
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return null;
    return this.gridDom[r][c];
  }

  animateSwap(p1, p2) {
    return new Promise((resolve) => {
      const el1 = this.gridDom[p1.r][p1.c];
      const el2 = this.gridDom[p2.r][p2.c];

      if (el1 && el2) {
        this.applyTransform(el1, p2.r, p2.c, true);
        this.applyTransform(el2, p1.r, p1.c, true);

        // 同步内存指针
        this.gridDom[p1.r][p1.c] = el2;
        this.gridDom[p2.r][p2.c] = el1;
      }

      setTimeout(resolve, 340);
    });
  }

  animatePreBurst(clearedCoords) {
    return new Promise((resolve) => {
      clearedCoords.forEach(({ r, c }) => {
        const el = this.gridDom[r][c];
        if (el) el.classList.add('pre-burst');
      });
      setTimeout(resolve, 200);
    });
  }

  animateElimination(clearedCoords, creations = []) {
    return new Promise((resolve) => {
      const creationMap = new Map();
      creations.forEach((c) => creationMap.set(`${c.r},${c.c}`, c));

      clearedCoords.forEach(({ r, c }) => {
        const el = this.gridDom[r][c];
        if (!el) return;

        el.classList.remove('pre-burst');
        const isCreation = creationMap.has(`${r},${c}`);

        if (!isCreation) {
          el.classList.add('exploding');
          this.createExplodeParticles(r, c);
        } else {
          el.style.transform += ' scale(1.35) rotate(180deg)';
        }
      });

      setTimeout(() => {
        clearedCoords.forEach(({ r, c }) => {
          const isCreation = creationMap.has(`${r},${c}`);
          const el = this.gridDom[r][c];
          if (el && !isCreation) {
            el.remove();
            this.gridDom[r][c] = null;
          }
        });
        resolve();
      }, 340);
    });
  }

  createExplodeParticles(r, c) {
    const originX = (c + 0.5) * (100 / BOARD_COLS);
    const originY = (r + 0.5) * (100 / BOARD_ROWS);

    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.style.cssText = `
        position: absolute;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #fde047;
        top: ${originY}%;
        left: ${originX}%;
        pointer-events: none;
        z-index: 15;
        box-shadow: 0 0 10px #facc15;
        transition: all 420ms cubic-bezier(0.2, 0.8, 0.4, 1);
      `;
      this.fxLayer.appendChild(p);

      const rad = (Math.PI * 2 * i) / 8;
      const dist = 32 + Math.random() * 24;
      requestAnimationFrame(() => {
        p.style.transform = `translate(${Math.cos(rad) * dist}px, ${Math.sin(rad) * dist}px) scale(0)`;
        p.style.opacity = '0';
      });

      setTimeout(() => p.remove(), 440);
    }
  }

  // 绝对可靠的下落动画与指针迁移流水线
  animateDropsAndSpawns(dropSteps) {
    return new Promise((resolve) => {
      const newGridDom = Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));

      // 1. 保留不需要移动的图元到新矩阵
      for (let r = 0; r < BOARD_ROWS; r++) {
        for (let c = 0; c < BOARD_COLS; c++) {
          if (this.gridDom[r][c] && !dropSteps.some((s) => s.from.r === r && s.from.c === c)) {
            newGridDom[r][c] = this.gridDom[r][c];
          }
        }
      }

      // 2. 预先将新生成的方块挂载在负高度（棋盘上方对应的列），关闭过渡
      dropSteps.forEach((step) => {
        if (step.isNew) {
          const el = this.createTileNode(step.tileData);
          this.applyTransform(el, step.from.r, step.from.c, false);
          this.boardInteractive.appendChild(el);
          step.domElement = el;
        } else {
          step.domElement = this.gridDom[step.from.r][step.from.c];
        }
        newGridDom[step.to.r][step.to.c] = step.domElement;
      });

      // 强制重排，保证浏览器捕捉到顶部初始状态
      void this.boardInteractive.offsetHeight;

      // 3. 统一滑落到目的地
      requestAnimationFrame(() => {
        dropSteps.forEach((step) => {
          if (step.domElement) {
            this.applyTransform(step.domElement, step.to.r, step.to.c, true);
          }
        });
      });

      // 4. 更新全局指针并触发触底形变
      this.gridDom = newGridDom;

      setTimeout(() => {
        dropSteps.forEach((step) => {
          if (step.domElement) {
            step.domElement.classList.add('bounce-land');
            setTimeout(() => step.domElement.classList.remove('bounce-land'), 280);
          }
        });
        resolve();
      }, 460);
    });
  }

  // 绝对全盘 DOM 状态校准：扫除任何残余或空位，强力兜底保真
  synchronizeBoard(grid) {
    for (let r = 0; r < BOARD_ROWS; r++) {
      for (let c = 0; c < BOARD_COLS; c++) {
        const data = grid[r][c];
        let el = this.gridDom[r][c];

        if (data) {
          if (!el || el.dataset.uid !== String(data.uid)) {
            if (el) el.remove();
            el = this.createTileNode(data);
            this.boardInteractive.appendChild(el);
            this.gridDom[r][c] = el;
          }
          this.applyTransform(el, r, c, false);
          this.updateTileInner(el, data);
        } else {
          if (el) {
            el.remove();
            this.gridDom[r][c] = null;
          }
        }
      }
    }
  }

  updateTileVisual(r, c, tileData) {
    const el = this.gridDom[r][c];
    if (el) {
      el.dataset.uid = String(tileData.uid);
      this.applyTransform(el, r, c, false);
      this.updateTileInner(el, tileData);
    }
  }

  setSelected(pos, isSelected) {
    if (!pos) return;
    const el = this.gridDom[pos.r][pos.c];
    if (el) {
      if (isSelected) el.classList.add('selected');
      else el.classList.remove('selected');
    }
  }

  showHint(pairs) {
    this.clearHint();
    if (!pairs || !Array.isArray(pairs)) return;
    pairs.forEach((p) => {
      const el = this.gridDom[p.r][p.c];
      if (el) el.classList.add('hint');
    });
  }

  clearHint() {
    this.boardInteractive.querySelectorAll('.tile-node.hint').forEach((el) => {
      el.classList.remove('hint');
    });
  }

  showCombo(text) {
    this.comboBanner.textContent = text;
    this.comboBanner.classList.remove('hidden');
    void this.comboBanner.offsetWidth;
    setTimeout(() => {
      this.comboBanner.classList.add('hidden');
    }, 850);
  }

  showShuffleBanner(text) {
    this.shuffleBanner.textContent = text;
    this.shuffleBanner.classList.remove('hidden');
    setTimeout(() => {
      this.shuffleBanner.classList.add('hidden');
    }, 1200);
  }

  updateHUD(remainingGoals, moves, score, levelCfg, i18nManager) {
    this.movesValEl.textContent = String(moves);
    this.scoreValEl.textContent = String(score);
    this.levelNumEl.textContent = i18nManager.t('levelTitle', { n: levelCfg.id });

    const isZh = i18nManager.getLanguage() === 'zh';
    this.levelDescEl.textContent = isZh ? levelCfg.descZh : levelCfg.descEn;

    this.goalsContainer.innerHTML = '';
    for (const [colorStr, targetNeed] of Object.entries(remainingGoals)) {
      const color = Number(colorStr);
      const isDone = targetNeed <= 0;
      const item = document.createElement('div');
      item.className = `goal-item ${isDone ? 'done' : ''}`;
      item.innerHTML = `
        <div class="goal-icon-box">${SVGS[`c${color}`] || ''}</div>
        <span class="goal-count">${isDone ? '✓' : targetNeed}</span>
      `;
      this.goalsContainer.appendChild(item);
    }

    const stars = this.starContainer.querySelectorAll('.star');
    stars.forEach((s, idx) => {
      if (moves >= levelCfg.starThresholdMoves[idx]) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
  }

  renderLevelSelector(levels, unlockedLevel, levelStars, onSelectLevel) {
    this.levelGridList.innerHTML = '';
    levels.forEach((lvl) => {
      const btn = document.createElement('button');
      btn.className = 'level-card-btn';
      const isLocked = lvl.id > unlockedLevel;
      if (isLocked) {
        btn.classList.add('locked');
      } else {
        btn.addEventListener('click', () => {
          this.levelModal.classList.add('hidden');
          onSelectLevel(lvl.id);
        });
      }

      const starCount = levelStars[lvl.id] || 0;
      const starStr = '★'.repeat(starCount) + '☆'.repeat(3 - starCount);

      btn.innerHTML = `
        <span class="btn-num">${lvl.id}</span>
        <span class="btn-stars">${isLocked ? '🔒' : starStr}</span>
      `;
      this.levelGridList.appendChild(btn);
    });
  }

  showResultModal(isWin, score, movesBonus, starCount, i18nManager) {
    this.resultTitle.textContent = isWin ? i18nManager.t('victoryTitle') : i18nManager.t('defeatTitle');
    this.resultBadge.textContent = isWin ? '👑' : '💔';
    this.resultDesc.textContent = isWin ? i18nManager.t('victoryDesc') : i18nManager.t('defeatDesc');
    this.resultStars.textContent = isWin ? ('★'.repeat(starCount) + '☆'.repeat(3 - starCount)) : '☆☆☆';

    this.resultScoreVal.textContent = String(score);
    this.resultMovesVal.textContent = String(movesBonus);

    this.resultModal.classList.remove('hidden');
  }

  hideResultModal() {
    this.resultModal.classList.add('hidden');
  }

  setAudioIcon(enabled) {
    if (enabled) {
      this.soundOnIcon.classList.remove('hidden');
      this.soundOffIcon.classList.add('hidden');
    } else {
      this.soundOnIcon.classList.add('hidden');
      this.soundOffIcon.classList.remove('hidden');
    }
  }

  setLangTag(lang) {
    if (this.langTag) {
      this.langTag.textContent = lang === 'zh' ? 'EN' : '中';
    }
  }
}
