import { strings, htmlLang } from './i18n.mjs';

export class UIManager {
  constructor() {
    this.hudScore = document.getElementById('hud-score');
    this.hudBest = document.getElementById('hud-best');
    this.hudLength = document.getElementById('hud-length');
    this.hudCombo = document.getElementById('hud-combo');
    this.hudDiffBadge = document.getElementById('hud-difficulty-badge');

    this.modalWelcome = document.getElementById('modal-welcome');
    this.modalPause = document.getElementById('modal-pause');
    this.modalGameover = document.getElementById('modal-gameover');
    this.modalRules = document.getElementById('modal-rules');

    this.settleScore = document.getElementById('settle-score');
    this.settleBest = document.getElementById('settle-best');
    this.settleApples = document.getElementById('settle-apples');

    this.langLabel = document.getElementById('lang-label');
    this.soundIcon = document.getElementById('sound-icon');
    this.themeIcon = document.getElementById('theme-icon');
    this.btnSidePause = document.getElementById('btn-side-pause');
  }

  updateHUD(score, best, length, combo = 1) {
    if (this.hudScore) this.hudScore.textContent = String(score);
    if (this.hudBest) this.hudBest.textContent = String(best);
    if (this.hudLength) this.hudLength.textContent = String(length);
    if (this.hudCombo) this.hudCombo.textContent = `x${combo}`;
  }

  updateDifficultyUI(diff) {
    if (this.hudDiffBadge) {
      this.hudDiffBadge.textContent = diff.toUpperCase();
    }

    const diffBtns = document.querySelectorAll('[data-diff]');
    for (const btn of diffBtns) {
      if (btn.getAttribute('data-diff') === diff) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  }

  showModal(modal) {
    if (modal) {
      modal.classList.remove('hidden');
      modal.setAttribute('aria-hidden', 'false');
    }
  }

  hideModal(modal) {
    if (modal) {
      modal.classList.add('hidden');
      modal.setAttribute('aria-hidden', 'true');
    }
  }

  hideAllModals() {
    this.hideModal(this.modalWelcome);
    this.hideModal(this.modalPause);
    this.hideModal(this.modalGameover);
    this.hideModal(this.modalRules);
  }

  showGameOver(score, best, apples) {
    if (this.settleScore) this.settleScore.textContent = String(score);
    if (this.settleBest) this.settleBest.textContent = String(best);
    if (this.settleApples) this.settleApples.textContent = String(apples);
    this.showModal(this.modalGameover);
  }

  renderI18n(locale) {
    const dict = strings[locale] || strings.zh;
    document.documentElement.lang = htmlLang(locale);

    const elements = document.querySelectorAll('[data-i18n]');
    for (const el of elements) {
      const key = el.getAttribute('data-i18n');
      if (dict[key]) {
        el.textContent = dict[key];
      }
    }

    if (this.langLabel) {
      this.langLabel.textContent = locale === 'zh' ? 'EN' : '中文';
    }
  }

  updateSoundIcon(enabled) {
    if (this.soundIcon) {
      this.soundIcon.textContent = enabled ? '🔊' : '🔇';
    }
  }

  updateThemeUI(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (this.themeIcon) {
      this.themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }

  updatePauseButtonState(isPaused, currentLocale = 'zh') {
    if (!this.btnSidePause) return;
    const dict = strings[currentLocale] || strings.zh;
    this.btnSidePause.textContent = isPaused ? dict.btnSideResume : dict.btnSidePause;
  }
}
