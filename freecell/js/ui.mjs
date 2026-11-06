import { strings, htmlLang } from './i18n.mjs';

export class FreeCellUI {
  constructor() {
    this.dom = {
      dealNumber: document.getElementById('deal-number'),
      scoreDisplay: document.getElementById('score-display'),
      timerDisplay: document.getElementById('timer-display'),
      movesDisplay: document.getElementById('moves-display'),
      btnUndo: document.getElementById('btn-undo'),
      btnLang: document.getElementById('btn-lang'),
      btnSound: document.getElementById('btn-sound'),
      iconSoundOn: document.getElementById('icon-sound-on'),
      iconSoundOff: document.getElementById('icon-sound-off'),
      modalOverlay: document.getElementById('modal-overlay'),
      modalRules: document.getElementById('modal-rules'),
      modalPause: document.getElementById('modal-pause'),
      modalGameover: document.getElementById('modal-gameover'),
      finalScore: document.getElementById('final-score'),
      finalTime: document.getElementById('final-time'),
      finalMoves: document.getElementById('final-moves'),
      labelDeal: document.getElementById('label-deal'),
      labelScore: document.getElementById('label-score'),
      labelTime: document.getElementById('label-time'),
      labelMoves: document.getElementById('label-moves'),
      textNewGame: document.getElementById('text-new-game'),
      textRestart: document.getElementById('text-restart'),
      textUndo: document.getElementById('text-undo'),
      textHint: document.getElementById('text-hint'),
      textPause: document.getElementById('text-pause'),
      rulesTitle: document.getElementById('rules-title'),
      rulesContent: document.getElementById('rules-content'),
      btnRulesClose: document.getElementById('btn-rules-close'),
      pauseTitle: document.getElementById('pause-title'),
      pauseDesc: document.getElementById('pause-desc'),
      btnResume: document.getElementById('btn-resume'),
      gameoverTitle: document.getElementById('gameover-title'),
      labelSettleScore: document.getElementById('label-settle-score'),
      labelSettleTime: document.getElementById('label-settle-time'),
      labelSettleMoves: document.getElementById('label-settle-moves'),
      btnPlayAgain: document.getElementById('btn-play-again'),
      portalHomeLink: document.getElementById('portal-home-link'),
      btnRules: document.getElementById('btn-rules')
    };
  }

  updateStats(dealNumber, score, seconds, moves, canUndo) {
    if (this.dom.dealNumber) this.dom.dealNumber.textContent = `#${dealNumber}`;
    if (this.dom.scoreDisplay) this.dom.scoreDisplay.textContent = String(score);
    if (this.dom.timerDisplay) this.dom.timerDisplay.textContent = this.formatTime(seconds);
    if (this.dom.movesDisplay) this.dom.movesDisplay.textContent = String(moves);
    if (this.dom.btnUndo) this.dom.btnUndo.disabled = !canUndo;
  }

  formatTime(totalSec) {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  updateSoundIcon(muted) {
    if (this.dom.iconSoundOn && this.dom.iconSoundOff) {
      if (muted) {
        this.dom.iconSoundOn.classList.add('hidden');
        this.dom.iconSoundOff.classList.remove('hidden');
      } else {
        this.dom.iconSoundOn.classList.remove('hidden');
        this.dom.iconSoundOff.classList.add('hidden');
      }
    }
  }

  updateLanguage(locale) {
    const dict = strings[locale] || strings.zh;
    document.documentElement.lang = htmlLang(locale);

    if (this.dom.btnLang) {
      this.dom.btnLang.textContent = locale === 'zh' ? 'EN' : '中';
    }

    if (this.dom.labelDeal) this.dom.labelDeal.textContent = dict.deal;
    if (this.dom.labelScore) this.dom.labelScore.textContent = dict.score;
    if (this.dom.labelTime) this.dom.labelTime.textContent = dict.time;
    if (this.dom.labelMoves) this.dom.labelMoves.textContent = dict.moves;

    if (this.dom.textNewGame) this.dom.textNewGame.textContent = dict.newGame;
    if (this.dom.textRestart) this.dom.textRestart.textContent = dict.restart;
    if (this.dom.textUndo) this.dom.textUndo.textContent = dict.undo;
    if (this.dom.textHint) this.dom.textHint.textContent = dict.hint;
    if (this.dom.textPause) this.dom.textPause.textContent = dict.pause;

    if (this.dom.rulesTitle) this.dom.rulesTitle.textContent = dict.rulesTitle;
    if (this.dom.btnRulesClose) this.dom.btnRulesClose.textContent = dict.rulesClose;
    if (this.dom.pauseTitle) this.dom.pauseTitle.textContent = dict.pausedTitle;
    if (this.dom.pauseDesc) this.dom.pauseDesc.textContent = dict.pausedDesc;
    if (this.dom.btnResume) this.dom.btnResume.textContent = dict.resume;
    if (this.dom.gameoverTitle) this.dom.gameoverTitle.textContent = dict.winTitle;

    if (this.dom.labelSettleScore) this.dom.labelSettleScore.textContent = dict.settleScore;
    if (this.dom.labelSettleTime) this.dom.labelSettleTime.textContent = dict.settleTime;
    if (this.dom.labelSettleMoves) this.dom.labelSettleMoves.textContent = dict.settleMoves;
    if (this.dom.btnPlayAgain) this.dom.btnPlayAgain.textContent = dict.playAgain;

    if (this.dom.portalHomeLink) this.dom.portalHomeLink.setAttribute('title', dict.portalHome);
    if (this.dom.btnSound) this.dom.btnSound.setAttribute('title', dict.soundToggle);
    if (this.dom.btnLang) this.dom.btnLang.setAttribute('title', dict.langToggle);
    if (this.dom.btnRules) this.dom.btnRules.setAttribute('title', dict.rulesTitle);

    if (this.dom.rulesContent) {
      this.dom.rulesContent.innerHTML = `
        <p>${dict.rule1}</p>
        <p>${dict.rule2}</p>
        <p>${dict.rule3}</p>
        <p>${dict.rule4}</p>
        <p>${dict.rule5}</p>
      `;
    }
  }

  showModal(name) {
    if (!this.dom.modalOverlay) return;
    this.dom.modalOverlay.classList.remove('hidden');
    this.dom.modalRules.classList.add('hidden');
    this.dom.modalPause.classList.add('hidden');
    this.dom.modalGameover.classList.add('hidden');

    if (name === 'rules') {
      this.dom.modalRules.classList.remove('hidden');
      this.dom.btnRulesClose.focus();
    } else if (name === 'pause') {
      this.dom.modalPause.classList.remove('hidden');
      this.dom.btnResume.focus();
    } else if (name === 'gameover') {
      this.dom.modalGameover.classList.remove('hidden');
      this.dom.btnPlayAgain.focus();
    }
  }

  hideModals() {
    if (!this.dom.modalOverlay) return;
    this.dom.modalOverlay.classList.add('hidden');
    this.dom.modalRules.classList.add('hidden');
    this.dom.modalPause.classList.add('hidden');
    this.dom.modalGameover.classList.add('hidden');
  }

  showVictory(score, seconds, moves) {
    if (this.dom.finalScore) this.dom.finalScore.textContent = String(score);
    if (this.dom.finalTime) this.dom.finalTime.textContent = this.formatTime(seconds);
    if (this.dom.finalMoves) this.dom.finalMoves.textContent = String(moves);
    this.showModal('gameover');
  }
}
