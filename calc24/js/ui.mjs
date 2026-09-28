// ui.mjs — Calc 24 唯一碰 DOM 的层
// 负责：渲染卡牌、处理点击、显示运算符面板、胜负弹窗、关卡地图

import { Calc24Game } from './game.mjs';
import { t, applyToDOM, getLang, setLang } from './i18n.mjs';
import { click, merge, win as winSfx, lose as loseSfx, hint as hintSfx, invalid as invalidSfx, ready as readySfx, unlock, setMuted } from './audio.mjs';
import * as storage from './storage.mjs';
import { LEVELS } from './levels.mjs';
import { CLASSIC_HARDS } from './classics.mjs';

// ============ 渲染器 ============
export class UI {
  constructor() {
    this.game = new Calc24Game();
    this.root = document.getElementById('game-root');
    this.board = document.getElementById('board');
    this.opPanel = document.getElementById('op-panel');
    // 初始隐藏，选两张牌后浮出（_positionOpPanel 定位到两选中牌中间）
    this.opPanel.hidden = true;

    this.overlay = document.getElementById('overlay');
    this.resultDlg = document.getElementById('dlg-result');
    this.mapDlg = document.getElementById('dlg-map');
    this.rulesDlg = document.getElementById('dlg-rules');

    this.loaded = storage.load();

    this._bindGameEvents();
    this._bindDomEvents();

    // 自启动：从 storage 恢复到上次关卡，否则 Ch1 L1
    const cur = this.loaded.current || { mode: 'chapter', chapterIdx: 0, levelIdx: 0 };
    if (cur.mode === 'classic') this.game.startClassic(cur.classicIdx ?? 0);
    else this.game.startChapter(cur.chapterIdx ?? 0, cur.levelIdx ?? 0);
  }

  // ============ 事件绑定 ============
  _bindGameEvents() {
    this.game.on('state', () => {
      this.renderState();
      this._highlightOp(this.game.pendingOp); // 每次 state 变化同步运算符高亮
    });
    this.game.on('ready', () => { this._showOpPanel(); readySfx(); });
    this.game.on('merge', ({ op }) => { merge(op); this._hideOpPanel(); this._highlightOp(null); });
    this.game.on('invalid', () => invalidSfx());
    this.game.on('won', ({ stars, steps }) => {
      winSfx();
      // 存成绩（infinite 模式不存，没有关卡 id）
      if (this.game.ctx.mode === 'chapter') {
        storage.updateLevelRecord({
          mode: 'chapter', chapterIdx: this.game.ctx.chapterIdx, levelIdx: this.game.ctx.levelIdx, stars, steps,
        });
      } else if (this.game.ctx.mode === 'classic') {
        storage.updateLevelRecord({ mode: 'classic', idxInClassic: this.game.ctx.classicIdx, stars, steps });
      }
      this.showResult(true, stars, steps);
    });
    this.game.on('lost', () => { loseSfx(); this.showResult(false, 0, this.game.state.steps); });
    this.game.on('hint', () => hintSfx());
  }

  _bindDomEvents() {
    // 关卡按钮
    document.getElementById('btn-start').addEventListener('click', () => this.showMap());
    document.getElementById('btn-infinite').addEventListener('click', () => {
      this._closeAllDlgs();
      this.game.startInfinite();
    });
    document.getElementById('btn-chapters').addEventListener('click', () => this.showMap('chapter'));
    document.getElementById('btn-classic').addEventListener('click', () => this.showMap('classic'));

    // 顶部工具
    document.getElementById('btn-lang').addEventListener('click', () => {
      const cur = getLang() === 'en' ? 'zh' : 'en';
      setLang(cur); applyToDOM();
      document.getElementById('btn-lang').textContent = cur === 'en' ? '中' : 'EN';
    });
    document.getElementById('btn-sound').addEventListener('click', (e) => {
      const m = !e.currentTarget.dataset.muted;
      e.currentTarget.dataset.muted = m;
      e.currentTarget.textContent = m ? '🔇' : '🔊';
      setMuted(!!m);
    });
    document.getElementById('btn-help').addEventListener('click', () => this.showRules());

    // 操作条
    document.getElementById('btn-undo').addEventListener('click', () => { unlock(); click(); this.game.undo(); });
    document.getElementById('btn-hint').addEventListener('click', () => { unlock(); click(); this.game.requestHint(); this.renderHint(); });
    document.getElementById('btn-reset').addEventListener('click', () => { unlock(); click(); this.game.reset(); });

    // 运算符面板（计算器范式：数字→运算符→数字）
    for (const op of ['+', '-', '*', '/']) {
      document.getElementById('op-' + op).addEventListener('click', () => {
        unlock();
        click();
        this.game.selectOperator(op);
        this._highlightOp(op);
      });
    }

    // 结果弹窗按钮
    document.getElementById('result-retry').addEventListener('click', () => { this._closeAllDlgs(); this.game.reset(); });
    document.getElementById('result-map').addEventListener('click', () => { this._closeAllDlgs(); this.showMap(); });
    document.getElementById('result-next').addEventListener('click', () => {
      this._closeAllDlgs();
      if (this.game.ctx.mode === 'infinite') {
        this.game.startInfinite();
      } else if (this.game.ctx.mode === 'chapter') {
        const { chapterIdx, levelIdx } = this.game.ctx;
        const perCh = LEVELS.chapters[0].levels.length;
        if (levelIdx + 1 < perCh) this.game.startChapter(chapterIdx, levelIdx + 1);
        else if (chapterIdx + 1 < LEVELS.chapters.length) this.game.startChapter(chapterIdx + 1, 0);
        else this.showMap();
      } else {
        const next = this.game.ctx.classicIdx + 1;
        if (next < CLASSIC_HARDS.length) this.game.startClassic(next);
        else this.showMap();
      }
    });

    // 弹窗关闭（点空白 / 点 close 按钮 → 统一全关）
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay) this._closeAllDlgs();
    });
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this._closeAllDlgs());
    });

    // 首次解锁 audio
    document.addEventListener('click', () => unlock(), { once: true });

    // 窗口 resize 时重新定位运算符面板
    window.addEventListener('resize', () => {
      if (!this.opPanel.hidden) this._positionOpPanel();
    });
  }

  // ============ 主渲染 ============
  renderState() {
    if (!this.game.state) return;
    const s = this.game.state;

    // HUD
    const hc = document.getElementById('hud-chapter');
    const hs = document.getElementById('hud-steps');
    const hh = document.getElementById('hud-hints');
    if (hc) hc.textContent = this._levelLabel();
    if (hs) hs.textContent = s.steps;
    if (hh) hh.textContent = s.hintsUsed;

    // 渲染牌
    if (!this.board) return;
    this.board.innerHTML = '';
    s.cards.forEach(card => {
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.id = card.id;

      // 已选中 → 加 class
      if (s.selectedIds.includes(card.id)) el.classList.add('selected');

      if (card.isResult) {
        // 结果牌：小尺寸 + 金色渐变
        el.classList.add('result');
        el.innerHTML = `
          <div class="card-front result-front">
            <div class="card-val">${card.label}</div>
            <div class="card-expr">${card.expr || ''}</div>
          </div>
        `;
      } else {
        // 纯数字卡：居中大字号 + 小数字角标
        el.innerHTML = `
          <div class="card-front">
            <div class="corner tl">${card.value}</div>
            <div class="card-center">${card.value}</div>
            <div class="corner br">${card.value}</div>
          </div>
        `;
      }

      el.addEventListener('click', () => {
        if (s.status !== 'playing') return;
        click();
        this.game.selectCard(card.id);
      });

      this.board.appendChild(el);
    });

    // 计算器范式：选 1 张就显示运算符面板
    if (s.selectedIds.length !== 1) this._hideOpPanel();
  }

  _levelLabel() {
    if (this.game.ctx.mode === 'infinite') return t('infiniteMode');
    if (this.game.ctx.mode === 'classic') return `${t('classicMode')} #${this.game.ctx.classicIdx + 1}`;
    return `${t('chapter', { n: this.game.ctx.chapterIdx + 1 })} · ${LEVELS.chapters[this.game.ctx.chapterIdx].title} · L${this.game.ctx.levelIdx + 1}`;
  }

  // ============ 弹窗互斥关闭 ============
  _closeAllDlgs() {
    this.resultDlg.hidden = true;
    this.mapDlg.hidden = true;
    this.rulesDlg.hidden = true;
    this.overlay.hidden = true;
  }

  // ============ 运算符浮出面板（felt 内水平居中，board 下方）============
  _showOpPanel() {
    if (!this.game.state || this.game.state.selectedIds.length !== 1) return;
    this.opPanel.hidden = false;
    requestAnimationFrame(() => this._positionOpPanel());
  }
  _hideOpPanel() { this.opPanel.hidden = true; }
  _positionOpPanel() {
    const board = this.board;
    const feltRect = this.opPanel.parentElement.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    this.opPanel.style.left = '50%';
    const topOffset = boardRect.bottom - feltRect.top + 16;
    this.opPanel.style.top = topOffset + 'px';
    this.opPanel.style.transform = 'translate(-50%, 0)';
  }
  /** 高亮当前已选运算符按钮（或 null 清掉） */
  _highlightOp(op) {
    for (const sym of ['+', '-', '*', '/']) {
      const btn = document.getElementById('op-' + sym);
      if (!btn) continue;
      if (sym === op) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  }

  // ============ 结果弹窗 ============
  showResult(won, stars, steps) {
    this._closeAllDlgs(); // 先关其他弹窗！

    document.getElementById('result-title').textContent = t(won ? 'winTitle' : 'loseTitle');
    document.getElementById('result-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    document.getElementById('result-steps').textContent = t('winSteps', { n: steps });
    document.getElementById('result-next').hidden = !won; // 输了不显示 next

    // infinite 模式胜利 → next 就是再来一道随机
    if (won && this.game.ctx.mode === 'infinite') {
      document.getElementById('result-next').textContent = t('nextRandom');
      document.getElementById('result-next').disabled = false;
    } else {
      const isLastChapter = this.game.ctx.mode === 'chapter' &&
        this.game.ctx.chapterIdx === LEVELS.chapters.length - 1 &&
        this.game.ctx.levelIdx === LEVELS.chapters[0].levels.length - 1;
      const isLastClassic = this.game.ctx.mode === 'classic' &&
        this.game.ctx.classicIdx === CLASSIC_HARDS.length - 1;
      if (won && (isLastChapter || isLastClassic)) {
        document.getElementById('result-next').textContent = t('allCleared');
        document.getElementById('result-next').disabled = true;
      } else {
        document.getElementById('result-next').textContent = t('winNext');
        document.getElementById('result-next').disabled = false;
      }
    }

    this.overlay.hidden = false;
    this.resultDlg.hidden = false;
  }

  // ============ 关卡地图 ============
  showMap(preferredMode) {
    this._closeAllDlgs(); // 先关其他弹窗！

    const data = storage.load();

    // Tab
    const mode = preferredMode || data.current?.mode || 'chapter';
    document.querySelectorAll('.map-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    const grid = document.getElementById('map-grid');
    grid.innerHTML = '';

    if (mode === 'infinite') {
      // 无限随机：一个大按钮直接开玩
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;align-items:center;padding:20px 0;';
      const startBtn = document.createElement('button');
      startBtn.className = 'btn primary';
      startBtn.style.cssText = 'font-size:1.15rem;padding:14px 32px;';
      startBtn.textContent = t('infiniteMode');
      startBtn.addEventListener('click', () => {
        this._closeAllDlgs();
        this.game.startInfinite();
      });
      wrap.appendChild(startBtn);
      const hint = document.createElement('div');
      hint.className = 'panel-note';
      hint.style.cssText = 'text-align:center;opacity:.85;';
      hint.textContent = t('infiniteHint');
      wrap.appendChild(hint);
      grid.appendChild(wrap);
    } else if (mode === 'classic') {
      CLASSIC_HARDS.forEach((_cards, idx) => {
        const rec = data.classic[String(idx)];
        const btn = document.createElement('button');
        btn.className = 'map-cell classic';
        btn.innerHTML = `
          <div class="cell-num">#${idx + 1}</div>
          <div class="cell-stars">${rec ? '★'.repeat(rec.stars) : '☆☆☆'}</div>
        `;
        btn.addEventListener('click', () => {
          this._closeAllDlgs();
          this.game.startClassic(idx);
        });
        grid.appendChild(btn);
      });
    } else {
      LEVELS.chapters.forEach((ch, ci) => {
        ch.levels.forEach((lv, li) => {
          const rec = data.chapters[ci]?.[li];
          const btn = document.createElement('button');
          btn.className = 'map-cell';
          btn.innerHTML = `
            <div class="cell-num">${ci + 1}-${li + 1}</div>
            <div class="cell-stars">${rec ? '★'.repeat(rec.stars) : '☆☆☆'}</div>
          `;
          btn.addEventListener('click', () => {
            this._closeAllDlgs();
            this.game.startChapter(ci, li);
          });
          grid.appendChild(btn);
        });
      });
    }

    this.overlay.hidden = false;
    this.mapDlg.hidden = false;

    // Tab 切换（已绑定一次，但确保切换互斥）
    document.querySelectorAll('.map-tab').forEach(btn => {
      btn.onclick = () => this.showMap(btn.dataset.mode);
    });
  }

  _miniCard(v) {
    const s = v === 1 ? 'A' : v === 11 ? 'J' : v === 12 ? 'Q' : v === 13 ? 'K' : v;
    return `<span class="mini-card">${s}</span>`;
  }

  // ============ 规则弹窗 ============
  showRules() {
    this._closeAllDlgs(); // 先关其他弹窗！
    document.getElementById('rules-title').textContent = t('rulesTitle');
    document.getElementById('rules-body').textContent = t('rulesBody');
    this.overlay.hidden = false;
    this.rulesDlg.hidden = false;
  }

  // ============ Hint 高亮 ============
  renderHint() {
    const hint = this.game.hintInfo;
    if (!hint) return;
    // 在牌上做呼吸脉动（hint 两张）
    document.querySelectorAll('.card').forEach(c => {
      const val = this.game.state.cards.find(sc => sc.id === c.dataset.id)?.value;
      // 简化：如果牌值匹配 hint 的两个数之一，加 hint class
      if (val === hint.cardA || val === hint.cardB) c.classList.add('hint-pulse');
    });
    setTimeout(() => {
      document.querySelectorAll('.card.hint-pulse').forEach(c => c.classList.remove('hint-pulse'));
    }, 3000);
  }
}
