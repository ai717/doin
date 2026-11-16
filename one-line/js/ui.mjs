import { strings, DEFAULT_LOCALE, format } from './i18n.mjs';
import { unlockedLevelFor } from './storage.mjs';
import { levelsForSize } from './engine.mjs';
import { formatSeconds } from './score.mjs';

export class OneLineUI {
  constructor() {
    this.locale = DEFAULT_LOCALE;
    this.elements = {
      title: document.getElementById('txt-title'),
      btnHowToPlay: document.getElementById('btn-how-to-play'),
      btnAudioToggle: document.getElementById('btn-audio-toggle'),
      iconSoundOn: document.getElementById('icon-sound-on'),
      iconSoundOff: document.getElementById('icon-sound-off'),
      btnLangToggle: document.getElementById('btn-lang-toggle'),

      lblLevel: document.getElementById('lbl-level'),
      valLevel: document.getElementById('val-level'),
      lblProgress: document.getElementById('lbl-progress'),
      valProgressBar: document.getElementById('val-progress-bar'),
      valProgressText: document.getElementById('val-progress-text'),
      lblTime: document.getElementById('lbl-time'),
      valTime: document.getElementById('val-time'),

      statusHint: document.getElementById('status-hint'),
      btnUndo: document.getElementById('btn-undo'),
      txtUndo: document.getElementById('txt-undo'),
      btnReset: document.getElementById('btn-reset'),
      txtReset: document.getElementById('txt-reset'),
      btnHint: document.getElementById('btn-hint'),
      txtHint: document.getElementById('txt-hint'),
      btnSelectLevel: document.getElementById('btn-select-level'),
      txtLevels: document.getElementById('txt-levels'),

      modalHelp: document.getElementById('modal-help'),
      helpTitle: document.getElementById('help-title'),
      helpDesc1: document.getElementById('help-desc-1'),
      helpDesc2: document.getElementById('help-desc-2'),
      helpDesc3: document.getElementById('help-desc-3'),
      helpDesc4: document.getElementById('help-desc-4'),
      btnCloseHelp: document.getElementById('btn-close-help'),
      btnConfirmHelp: document.getElementById('btn-confirm-help'),

      modalLevels: document.getElementById('modal-levels'),
      levelsTitle: document.getElementById('levels-title'),
      btnCloseLevels: document.getElementById('btn-close-levels'),
      sizeSelectorRow: document.getElementById('size-selector-row'),
      levelListContainer: document.getElementById('level-list-container'),
      btnEndless: document.getElementById('btn-endless'),
      txtEndless: document.getElementById('txt-endless'),
      valEndlessProgress: document.getElementById('val-endless-progress'),

      modalVictory: document.getElementById('modal-victory'),
      victoryTitle: document.getElementById('victory-title'),
      victoryStars: document.getElementById('victory-stars'),
      lblVicTime: document.getElementById('lbl-vic-time'),
      valVicTime: document.getElementById('val-vic-time'),
      lblVicExtra: document.getElementById('lbl-vic-extra'),
      valVicExtra: document.getElementById('val-vic-extra'),
      lblVicHint: document.getElementById('lbl-vic-hint'),
      valVicHint: document.getElementById('val-vic-hint'),
      btnReplay: document.getElementById('btn-replay'),
      btnNextLevel: document.getElementById('btn-next-level')
    };
  }

  updateLocale(lang) {
    const s = strings[lang] || strings.zh;
    const el = this.elements;
    this.locale = strings[lang] ? lang : DEFAULT_LOCALE;

    if (el.title) el.title.textContent = s.appTitle;
    if (el.lblLevel) el.lblLevel.textContent = s.level;
    if (el.lblProgress) el.lblProgress.textContent = s.progress;
    if (el.lblTime) el.lblTime.textContent = s.time;
    if (el.txtUndo) el.txtUndo.textContent = s.undo;
    if (el.txtReset) el.txtReset.textContent = s.reset;
    if (el.txtHint) el.txtHint.textContent = lang === 'zh' ? '提示' : 'Hint';
    if (el.txtLevels) el.txtLevels.textContent = s.levels;
    if (el.btnLangToggle) el.btnLangToggle.textContent = s.switchLang;

    if (el.helpTitle) el.helpTitle.textContent = s.howToPlayTitle;
    if (el.helpDesc1) el.helpDesc1.textContent = s.howToPlay1;
    if (el.helpDesc2) el.helpDesc2.textContent = s.howToPlay2;
    if (el.helpDesc3) el.helpDesc3.textContent = s.howToPlay3;
    if (el.helpDesc4) el.helpDesc4.textContent = s.howToPlay4;
    if (el.btnConfirmHelp) el.btnConfirmHelp.textContent = s.gotIt;
    if (el.levelsTitle) el.levelsTitle.textContent = s.selectLevel;
    if (el.txtEndless) el.txtEndless.textContent = s.endless;
    if (el.victoryTitle) el.victoryTitle.textContent = s.victoryTitle;
    if (el.lblVicTime) el.lblVicTime.textContent = s.vicTime;
    if (el.lblVicExtra) el.lblVicExtra.textContent = s.vicExtra;
    if (el.lblVicHint) el.lblVicHint.textContent = s.vicHint;
    if (el.btnReplay) el.btnReplay.textContent = s.replay;
    if (el.btnNextLevel) el.btnNextLevel.textContent = s.nextLevel;
  }

  updateAudioButton(isMuted) {
    const el = this.elements;
    if (!el.iconSoundOn || !el.iconSoundOff) return;
    if (isMuted) {
      el.iconSoundOn.classList.add('hidden');
      el.iconSoundOff.classList.remove('hidden');
    } else {
      el.iconSoundOn.classList.remove('hidden');
      el.iconSoundOff.classList.add('hidden');
    }
  }

  /** 秒级刷新：主循环只在跨秒时调用，避免每帧写 DOM */
  updateTime(elapsedSeconds) {
    if (this.elements.valTime) {
      this.elements.valTime.textContent = formatSeconds(elapsedSeconds);
    }
  }

  hintBlockedText() {
    return (strings[this.locale] || strings[DEFAULT_LOCALE]).hintBlocked;
  }

  updateHUD(state, elapsedSeconds, levelLabel = '') {
    const el = this.elements;
    if (el.valLevel) {
      el.valLevel.textContent = levelLabel || `${state.levelId}`;
    }
    this.updateTime(elapsedSeconds);

    const current = state.stepCount;
    const total = state.targetCount;
    const percentage = total > 0 ? Math.floor((current / total) * 100) : 0;

    if (el.valProgressBar) {
      el.valProgressBar.style.width = `${percentage}%`;
    }
    if (el.valProgressText) {
      el.valProgressText.textContent = `${current} / ${total}`;
    }

    if (el.statusHint) {
      if (state.status === 'deadend') {
        el.statusHint.classList.remove('hidden');
        el.statusHint.textContent = (strings[this.locale] || strings[DEFAULT_LOCALE]).deadEnd;
      } else {
        el.statusHint.classList.add('hidden');
      }
    }
  }

  showStatusHint(text) {
    if (this.elements.statusHint) {
      this.elements.statusHint.textContent = text;
      this.elements.statusHint.classList.remove('hidden');
    }
  }

  hideStatusHint() {
    if (this.elements.statusHint) {
      this.elements.statusHint.classList.add('hidden');
    }
  }

  renderLevelSelection(currentSize, currentLevel, saveData = {}, onSelectSize, onSelectLevel) {
    const el = this.elements;
    const s = strings[this.locale] || strings[DEFAULT_LOCALE];
    const levelStats = saveData.levelStats || {};
    const unlocked = unlockedLevelFor(saveData, currentSize);

    const row = this.elements.sizeSelectorRow;
    if (row) {
      const pills = row.querySelectorAll('.size-pill');
      pills.forEach((p) => {
        const sz = parseInt(p.dataset.size, 10);
        if (sz === currentSize) {
          p.classList.add('active');
        } else {
          p.classList.remove('active');
        }
        p.onclick = () => onSelectSize(sz);
      });
    }

    const container = this.elements.levelListContainer;
    if (!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= levelsForSize(currentSize); i++) {
      const isCurrent = i === currentLevel;
      const locked = i > unlocked;
      const stat = levelStats[`${currentSize}_${i}`] || { stars: 0 };

      const card = document.createElement('button');
      card.className = `level-cell${isCurrent ? ' active' : ''}${locked ? ' locked' : ''}`;
      card.setAttribute('aria-label', locked ? `第 ${i} 关 · ${s.locked}` : `第 ${i} 关`);

      const numSpan = document.createElement('span');
      numSpan.className = 'level-num';
      numSpan.textContent = String(i);
      card.appendChild(numSpan);

      const starsMini = document.createElement('span');
      starsMini.className = 'level-stars-mini';
      if (locked) {
        starsMini.textContent = '\u{1F512}';
        card.setAttribute('aria-disabled', 'true');
      } else {
        starsMini.textContent = stat.stars > 0 ? '★'.repeat(stat.stars) : '☆☆☆';
        card.addEventListener('click', () => {
          onSelectLevel(i);
          this.closeModal('modalLevels');
        });
      }
      card.appendChild(starsMini);

      container.appendChild(card);
    }

    // 无尽卡片：显示已抵达的最高关号
    const best = saveData && typeof saveData.endlessBest === 'number' ? saveData.endlessBest : 0;
    if (el.txtEndless) el.txtEndless.textContent = s.endless;
    if (el.valEndlessProgress) {
      el.valEndlessProgress.textContent = best > 0
        ? format(s.endlessBest, { n: best })
        : s.endlessStart;
    }
  }

  showVictoryModal({ stars, timeSeconds, extraSteps, hintCount, isLastLevel }) {
    const el = this.elements;
    const s = strings[this.locale] || strings[DEFAULT_LOCALE];

    if (el.valVicTime) el.valVicTime.textContent = formatSeconds(timeSeconds);
    if (el.valVicExtra) el.valVicExtra.textContent = String(extraSteps);
    if (el.valVicHint) el.valVicHint.textContent = String(hintCount);

    // 本规格最后一关：提示全部通关，并收起"下一关"
    if (el.victoryTitle) el.victoryTitle.textContent = isLastLevel ? s.allCleared : s.victoryTitle;
    if (el.btnNextLevel) el.btnNextLevel.classList.toggle('hidden', Boolean(isLastLevel));

    if (el.victoryStars) {
      el.victoryStars.innerHTML = '';
      for (let i = 1; i <= 3; i++) {
        const starSpan = document.createElement('span');
        starSpan.className = `star-icon ${i <= stars ? 'full' : ''}`;
        starSpan.innerHTML = '&#9733;';
        el.victoryStars.appendChild(starSpan);
      }
    }

    this.openModal('modalVictory');
  }

  openModal(modalKey) {
    const el = this.elements[modalKey];
    if (el) el.classList.remove('hidden');
  }

  closeModal(modalKey) {
    const el = this.elements[modalKey];
    if (el) el.classList.add('hidden');
  }
}
