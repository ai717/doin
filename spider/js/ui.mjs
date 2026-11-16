// Spider Solitaire UI & Render Module
// Pure DOM rendering and touch/mouse interaction handling.

import { SUIT_SYMBOLS, RANK_NAMES } from './engine.mjs';
import { strings, htmlLang } from './i18n.mjs';
import { CHAPTERS, LEVELS } from './levels.mjs';
import { loadGameData } from './storage.mjs';

export class SpiderUI {
  constructor({ controller, onSelectLevel, onToggleLang, onToggleSound }) {
    this.controller = controller;
    this.onSelectLevel = onSelectLevel || (() => {});
    this.onToggleLang = onToggleLang || (() => {});
    this.onToggleSound = onToggleSound || (() => {});

    this.selected = null; // { colIndex, cardIndex }
    this.currentHint = null;
    this.locale = 'zh';

    // Drag tracking
    this.dragState = null;

    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.el = {
      langHtml: document.documentElement,
      pageTitle: document.title,
      gameBrandName: document.getElementById('game-brand-name'),
      metaDesc: document.querySelector('meta[name="description"]'),
      backHome: document.getElementById('back-home'),
      btnLang: document.getElementById('btn-lang'),
      btnSound: document.getElementById('btn-sound'),
      btnRules: document.getElementById('btn-rules'),

      boardStage: document.querySelector('.board-stage'),
      foundationsSection: document.querySelector('.foundations-section'),
      controlDock: document.querySelector('.control-dock'),

      stockCocoon: document.getElementById('stock-cocoon'),
      stockBadge: document.getElementById('stock-badge'),
      stockTitle: document.getElementById('stock-title'),
      stockSub: document.getElementById('stock-sub'),

      foundationSlots: document.querySelectorAll('.foundation-slot'),
      tableauColumns: document.querySelectorAll('.tableau-column'),

      plaqueChapter: document.getElementById('plaque-chapter'),
      plaqueSubtitle: document.getElementById('plaque-subtitle'),
      btnSelectLevel: document.getElementById('btn-select-level'),

      statRuns: document.getElementById('stat-runs'),
      statMoves: document.getElementById('stat-moves'),
      statPar: document.getElementById('stat-par'),
      statTime: document.getElementById('stat-time'),
      statScore: document.getElementById('stat-score'),

      lblRuns: document.getElementById('lbl-runs'),
      lblMoves: document.getElementById('lbl-moves'),
      lblPar: document.getElementById('lbl-par'),
      lblTime: document.getElementById('lbl-time'),
      lblScore: document.getElementById('lbl-score'),

      modeTabs: document.querySelectorAll('.mode-tab'),
      btnDeal: document.getElementById('btn-deal'),
      btnUndo: document.getElementById('btn-undo'),
      btnHint: document.getElementById('btn-hint'),
      btnRestart: document.getElementById('btn-restart'),

      // Modals
      rulesModal: document.getElementById('rules-modal'),
      btnRulesClose: document.getElementById('btn-rules-close'),
      rulesTitle: document.getElementById('rules-title'),
      ruleItems: document.querySelectorAll('.rule-item'),

      levelModal: document.getElementById('level-modal'),
      levelModalTitle: document.getElementById('level-modal-title'),
      levelGrid: document.getElementById('level-grid'),
      btnLevelModalClose: document.getElementById('btn-level-modal-close'),

      victoryModal: document.getElementById('victory-modal'),
      victoryTitle: document.getElementById('victory-title'),
      victoryDesc: document.getElementById('victory-desc'),
      victoryStars: document.getElementById('victory-stars'),
      vStatScoreLbl: document.getElementById('v-stat-score-lbl'),
      vStatScoreVal: document.getElementById('v-stat-score-val'),
      vStatMovesLbl: document.getElementById('v-stat-moves-lbl'),
      vStatMovesVal: document.getElementById('v-stat-moves-val'),
      vStatTimeLbl: document.getElementById('v-stat-time-lbl'),
      vStatTimeVal: document.getElementById('v-stat-time-val'),
      btnNextLevel: document.getElementById('btn-next-level'),
      btnReplay: document.getElementById('btn-replay')
    };
  }

  bindEvents() {
    // Header controls
    this.el.btnLang.addEventListener('click', () => this.onToggleLang());
    this.el.btnSound.addEventListener('click', () => this.onToggleSound());
    this.el.btnRules.addEventListener('click', () => this.openRulesModal());
    this.el.btnRulesClose.addEventListener('click', () => this.closeRulesModal());

    // Stock deals
    this.el.stockCocoon.addEventListener('click', () => this.controller.dealStock());
    this.el.btnDeal.addEventListener('click', () => this.controller.dealStock());

    // Action buttons
    this.el.btnUndo.addEventListener('click', () => this.controller.undo());
    this.el.btnHint.addEventListener('click', () => this.triggerHint());
    this.el.btnRestart.addEventListener('click', () => this.controller.restart());
    this.el.btnSelectLevel.addEventListener('click', () => this.openLevelModal());
    this.el.btnLevelModalClose.addEventListener('click', () => this.closeLevelModal());

    // Mode tabs
    this.el.modeTabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        if (mode === 'story') {
          this.controller.startStoryLevel(LEVELS[0].id);
        } else if (mode === 'endless') {
          this.controller.startEndless(2);
        } else if (mode === 'daily') {
          this.controller.startDaily();
        }
        this.updateActiveTab(mode);
      });
    });

    // Tableau column clicks (for dropping or moving into empty column)
    this.el.tableauColumns.forEach((colEl, colIndex) => {
      colEl.addEventListener('click', (e) => {
        // If clicking on empty column space
        if (e.target === colEl && this.selected !== null) {
          this.controller.moveCards(this.selected.colIndex, this.selected.cardIndex, colIndex);
          this.clearSelection();
        }
      });
    });

    // Victory modal
    this.el.btnReplay.addEventListener('click', () => {
      this.closeVictoryModal();
      this.controller.restart();
    });

    this.el.btnNextLevel.addEventListener('click', () => {
      this.closeVictoryModal();
      if (this.controller.mode === 'story' && this.controller.currentLevel) {
        const curIdx = LEVELS.findIndex((l) => l.id === this.controller.currentLevel.id);
        const nextIdx = (curIdx + 1) % LEVELS.length;
        this.controller.startStoryLevel(LEVELS[nextIdx].id);
      } else {
        this.controller.startEndless(this.controller.suitCount);
      }
    });

    // Close modals on clicking backdrop
    [this.el.rulesModal, this.el.levelModal, this.el.victoryModal].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('open');
        }
      });
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (e.key === 'z' || e.key === 'Z') {
        this.controller.undo();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        this.controller.dealStock();
      } else if (e.key === 'h' || e.key === 'H') {
        this.triggerHint();
      }
    });
  }

  setLocale(loc) {
    this.locale = loc;
    const t = strings[loc] || strings.zh;

    this.el.langHtml.setAttribute('lang', htmlLang(loc));
    document.title = t.title;

    if (this.el.gameBrandName) {
      this.el.gameBrandName.textContent = t.brandName;
    }
    if (this.el.metaDesc) {
      this.el.metaDesc.setAttribute('content', t.metaDesc);
    }
    if (this.el.boardStage) {
      this.el.boardStage.setAttribute('aria-label', t.ariaBoard);
    }
    if (this.el.foundationsSection) {
      this.el.foundationsSection.setAttribute('aria-label', t.ariaFoundations);
    }
    if (this.el.controlDock) {
      this.el.controlDock.setAttribute('aria-label', t.ariaControlDock);
    }
    if (this.el.stockCocoon) {
      this.el.stockCocoon.setAttribute('title', t.dealTip);
    }

    if (this.el.backHome) {
      this.el.backHome.setAttribute('aria-label', t.backHome);
      const span = this.el.backHome.querySelector('span');
      if (span) span.textContent = t.backHome;
    }

    if (this.el.btnLang) {
      this.el.btnLang.textContent = t.langSwitch;
      this.el.btnLang.setAttribute('aria-label', t.langAria);
    }
    if (this.el.btnSound) this.el.btnSound.setAttribute('aria-label', t.soundToggle);
    if (this.el.btnRules) {
      this.el.btnRules.setAttribute('aria-label', t.rules);
      const txt = this.el.btnRules.querySelector('.btn-text');
      if (txt) txt.textContent = t.rules;
    }

    this.el.stockTitle.textContent = t.deal;
    this.el.stockSub.textContent = t.stockDealsLeft;

    this.el.lblRuns.textContent = t.runsCleared;
    this.el.lblMoves.textContent = t.moves;
    this.el.lblPar.textContent = t.par;
    this.el.lblTime.textContent = t.time;
    this.el.lblScore.textContent = t.score;

    this.el.btnDeal.querySelector('.btn-label').textContent = t.deal;
    this.el.btnUndo.querySelector('.btn-label').textContent = t.undo;
    this.el.btnHint.querySelector('.btn-label').textContent = t.hint;
    this.el.btnRestart.querySelector('.btn-label').textContent = t.restart;
    this.el.btnSelectLevel.textContent = t.selectLevel;

    // Mode tabs
    this.el.modeTabs.forEach((tab) => {
      const mode = tab.dataset.mode;
      if (mode === 'story') tab.textContent = t.modeStory;
      if (mode === 'endless') tab.textContent = t.modeEndless;
      if (mode === 'daily') tab.textContent = t.modeDaily;
    });

    // Rules modal text
    this.el.rulesTitle.textContent = t.rulesTitle;
    this.el.btnRulesClose.textContent = t.rulesClose;
    if (this.el.ruleItems[0]) this.el.ruleItems[0].textContent = t.rule1;
    if (this.el.ruleItems[1]) this.el.ruleItems[1].textContent = t.rule2;
    if (this.el.ruleItems[2]) this.el.ruleItems[2].textContent = t.rule3;
    if (this.el.ruleItems[3]) this.el.ruleItems[3].textContent = t.rule4;
    if (this.el.ruleItems[4]) this.el.ruleItems[4].textContent = t.rule5;

    // Modals
    this.el.levelModalTitle.textContent = t.levelSelectTitle;
    this.el.btnLevelModalClose.textContent = t.close;

    this.el.victoryTitle.textContent = t.winTitle;
    this.el.victoryDesc.textContent = t.winDesc;
    this.el.vStatScoreLbl.textContent = t.statScore;
    this.el.vStatMovesLbl.textContent = t.statMoves;
    this.el.vStatTimeLbl.textContent = t.statTime;
    this.el.btnNextLevel.textContent = t.nextLevel;
    this.el.btnReplay.textContent = t.replay;

    this.updatePlaque();
  }

  updatePlaque() {
    const t = strings[this.locale] || strings.zh;
    if (this.controller.mode === 'story' && this.controller.currentLevel) {
      const lvl = this.controller.currentLevel;
      const chKey = lvl.chapterId === 'chapter_1' ? 'chapter1' : lvl.chapterId === 'chapter_2' ? 'chapter2' : 'chapter3';
      const subKey = chKey + 'Subtitle';
      this.el.plaqueChapter.textContent = `${t[chKey]} · ${t.levelLabel.replace('{current}', lvl.levelIndex)}`;
      this.el.plaqueSubtitle.textContent = t[subKey] || '';
      this.el.btnSelectLevel.style.display = 'block';
    } else if (this.controller.mode === 'endless') {
      const diffKey = this.controller.suitCount === 4 ? 'diffFourSuits' : this.controller.suitCount === 3 ? 'diffThreeSuits' : 'diffTwoSuits';
      this.el.plaqueChapter.textContent = `${t.modeEndless} · ${t[diffKey]}`;
      this.el.plaqueSubtitle.textContent = t.endlessSubtitle;
      this.el.btnSelectLevel.style.display = 'none';
    } else {
      this.el.plaqueChapter.textContent = t.modeDaily;
      this.el.plaqueSubtitle.textContent = t.dailySubtitle;
      this.el.btnSelectLevel.style.display = 'none';
    }
  }

  updateActiveTab(mode) {
    this.el.modeTabs.forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.mode === mode);
    });
  }

  render(state) {
    const t = strings[this.locale] || strings.zh;

    // Update stats
    this.el.statRuns.textContent = `${state.completedRuns.length}/8`;
    this.el.statMoves.textContent = state.moves;
    this.el.statPar.textContent = state.par;
    this.el.statScore.textContent = state.score;

    const m = Math.floor(state.timeSeconds / 60);
    const s = state.timeSeconds % 60;
    this.el.statTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    // Update stock cocoon
    const dealsLeft = state.dealsLeft;
    this.el.stockBadge.textContent = `${dealsLeft}/5`;
    this.el.stockCocoon.classList.toggle('disabled', dealsLeft === 0);
    this.el.btnDeal.disabled = dealsLeft === 0;
    this.el.btnUndo.disabled = !state.canUndo;

    // Update foundation slots
    this.el.foundationSlots.forEach((slot, idx) => {
      if (idx < state.completedRuns.length) {
        const run = state.completedRuns[idx];
        const suit = run[0].suit;
        slot.classList.add('completed');
        slot.textContent = SUIT_SYMBOLS[suit];
      } else {
        slot.classList.remove('completed');
        slot.textContent = '🕷️';
      }
    });

    this.updatePlaque();
    this.renderColumns(state.columns);
  }

  renderColumns(columns) {
    this.el.tableauColumns.forEach((colEl, colIdx) => {
      colEl.innerHTML = '';
      const cards = columns[colIdx];
      const count = cards.length;

      // Dynamic spacing calculation based on card count to fit smoothly
      let faceDownGap = 16;
      let faceUpGap = 26;
      if (count > 16) {
        faceDownGap = Math.max(8, Math.floor(180 / count));
        faceUpGap = Math.max(14, Math.floor(320 / count));
      }

      let currentTop = 0;
      cards.forEach((card, cardIdx) => {
        const cardEl = this.createCardElement(card, colIdx, cardIdx);
        cardEl.style.top = `${currentTop}px`;
        cardEl.style.zIndex = cardIdx + 1;

        if (this.selected && this.selected.colIndex === colIdx && cardIdx >= this.selected.cardIndex) {
          cardEl.classList.add('selected');
        }

        if (
          this.currentHint &&
          this.currentHint.fromCol === colIdx &&
          cardIdx >= this.currentHint.cardIndex
        ) {
          cardEl.classList.add('hint-source');
        }

        colEl.appendChild(cardEl);

        currentTop += card.faceUp ? faceUpGap : faceDownGap;
      });

      if (this.currentHint && this.currentHint.toCol === colIdx) {
        colEl.classList.add('hint-target');
      } else {
        colEl.classList.remove('hint-target');
      }
    });
  }

  createCardElement(card, colIdx, cardIdx) {
    const el = document.createElement('div');
    el.className = `card ${card.faceUp ? 'face-up' : 'face-down'} suit-${card.suit}`;
    el.dataset.col = colIdx;
    el.dataset.cardIdx = cardIdx;

    if (card.faceUp) {
      const sym = SUIT_SYMBOLS[card.suit];
      const rank = RANK_NAMES[card.rank];

      el.innerHTML = `
        <div class="card-top">
          <span class="card-rank">${rank}</span>
          <span class="card-suit">${sym}</span>
        </div>
        <div class="card-center">${sym}</div>
        <div class="card-bottom">
          <span class="card-rank">${rank}</span>
          <span class="card-suit">${sym}</span>
        </div>
      `;

      // Click to select or move
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleCardClick(colIdx, cardIdx);
      });

      // Double click to smart auto-move
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.controller.smartMove(colIdx, cardIdx);
        this.clearSelection();
      });
    }

    return el;
  }

  handleCardClick(colIdx, cardIdx) {
    // If no card currently selected
    if (this.selected === null) {
      if (this.controller.engine.isMovableSequence(this.controller.engine.columns[colIdx], cardIdx)) {
        this.selected = { colIndex: colIdx, cardIndex: cardIdx };
        this.clearHint();
        this.controller.emitChange();
      }
      return;
    }

    // If clicking on same column
    if (this.selected.colIndex === colIdx) {
      if (this.selected.cardIndex === cardIdx) {
        // Deselect
        this.clearSelection();
      } else if (this.controller.engine.isMovableSequence(this.controller.engine.columns[colIdx], cardIdx)) {
        // Change selection
        this.selected = { colIndex: colIdx, cardIndex: cardIdx };
        this.controller.emitChange();
      }
      return;
    }

    // Attempt move to clicked column
    const moved = this.controller.moveCards(this.selected.colIndex, this.selected.cardIndex, colIdx);
    this.clearSelection();
    if (!moved) {
      // If clicking a movable card in another column, switch selection to it
      if (this.controller.engine.isMovableSequence(this.controller.engine.columns[colIdx], cardIdx)) {
        this.selected = { colIndex: colIdx, cardIndex: cardIdx };
        this.controller.emitChange();
      }
    }
  }

  clearSelection() {
    this.selected = null;
    this.controller.emitChange();
  }

  triggerHint() {
    const hint = this.controller.getHint();
    if (hint) {
      this.currentHint = hint;
      this.controller.emitChange();
      setTimeout(() => {
        this.clearHint();
      }, 3000);
    }
  }

  clearHint() {
    this.currentHint = null;
    this.controller.emitChange();
  }

  openRulesModal() {
    this.el.rulesModal.classList.add('open');
  }

  closeRulesModal() {
    this.el.rulesModal.classList.remove('open');
  }

  openLevelModal() {
    this.renderLevelGrid();
    this.el.levelModal.classList.add('open');
  }

  closeLevelModal() {
    this.el.levelModal.classList.remove('open');
  }

  renderLevelGrid() {
    const data = loadGameData();
    const progress = data.levelProgress || {};
    this.el.levelGrid.innerHTML = '';

    LEVELS.forEach((level) => {
      const btn = document.createElement('button');
      btn.className = 'level-card-btn';
      if (this.controller.currentLevel && this.controller.currentLevel.id === level.id) {
        btn.classList.add('active');
      }

      const prog = progress[level.id];
      const starsCount = prog ? prog.stars : 0;
      const starsDisplay = '★'.repeat(starsCount) + '☆'.repeat(3 - starsCount);

      btn.innerHTML = `
        <span>${level.levelIndex}</span>
        <span class="level-stars-mini">${starsCount > 0 ? starsDisplay : ''}</span>
      `;

      btn.addEventListener('click', () => {
        this.closeLevelModal();
        this.controller.startStoryLevel(level.id);
      });

      this.el.levelGrid.appendChild(btn);
    });
  }

  showVictoryModal({ score, moves, timeSeconds, stars }) {
    const m = Math.floor(timeSeconds / 60);
    const s = timeSeconds % 60;

    this.el.victoryStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.el.vStatScoreVal.textContent = score;
    this.el.vStatMovesVal.textContent = moves;
    this.el.vStatTimeVal.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    this.el.victoryModal.classList.add('open');
  }

  closeVictoryModal() {
    this.el.victoryModal.classList.remove('open');
  }
}
