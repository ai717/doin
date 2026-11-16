import { t, getCurrentLanguage } from './i18n.mjs';

export class UIRenderer {
  constructor() {
    this.hudScore = document.getElementById('hud-score');
    this.hudSector = document.getElementById('hud-sector');
    this.hudResonanceBar = document.getElementById('hud-resonance-bar');
    this.hudLivesContainer = document.getElementById('hud-lives');
    this.activeRelicsContainer = document.getElementById('active-relics');

    this.overlayStart = document.getElementById('overlay-start');
    this.overlayDraft = document.getElementById('overlay-draft');
    this.overlayPause = document.getElementById('overlay-pause');
    this.overlayGameOver = document.getElementById('overlay-gameover');

    this.draftChoicesGrid = document.getElementById('draft-choices');

    this.startHighScore = document.getElementById('start-high-score');
    this.gameoverTitle = document.getElementById('gameover-title');
    this.gameoverDesc = document.getElementById('gameover-desc');
    this.gameoverScore = document.getElementById('gameover-score');
    this.gameoverSector = document.getElementById('gameover-sector');
    this.gameoverHigh = document.getElementById('gameover-high');
    this.touchHint = document.getElementById('touch-hint');

    this.audioIconOn = document.getElementById('audio-icon-on');
    this.audioIconOff = document.getElementById('audio-icon-off');
    this.pauseIcon = document.getElementById('pause-icon');
    this.playIcon = document.getElementById('play-icon');
    this.langIndicator = document.getElementById('lang-indicator');
  }

  updateTexts() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key);
      }
    });
    this.langIndicator.textContent = getCurrentLanguage().toUpperCase();
  }

  updateHUD(score, sector, resonance, maxResonance, lives, maxLives) {
    this.hudScore.textContent = score.toLocaleString();
    this.hudSector.textContent = `${sector} / 5`;
    const pct = Math.min(100, Math.max(0, (resonance / maxResonance) * 100));
    this.hudResonanceBar.style.width = `${pct}%`;

    let pipsHtml = '';
    for (let i = 0; i < maxLives; i++) {
      const active = i < lives ? 'active' : '';
      pipsHtml += `<span class="life-pip ${active}"></span>`;
    }
    this.hudLivesContainer.innerHTML = pipsHtml;
  }

  updateRelicTray(activeRelicsList) {
    const emptyHtml = `<span class="relic-empty">${t('noRelics')}</span>`;
    if (!activeRelicsList || activeRelicsList.length === 0) {
      this.activeRelicsContainer.innerHTML = emptyHtml;
      return;
    }

    let html = '';
    activeRelicsList.forEach(r => {
      const name = t(`${r.id}_name`);
      html += `<span class="relic-chip"><i>${r.icon}</i> ${name}</span>`;
    });
    this.activeRelicsContainer.innerHTML = html;
  }

  showStartOverlay(highScore = 0) {
    this.startHighScore.textContent = highScore.toLocaleString();
    this.overlayStart.classList.remove('hidden');
    this.overlayDraft.classList.add('hidden');
    this.overlayPause.classList.add('hidden');
    this.overlayGameOver.classList.add('hidden');
    this.touchHint.classList.add('hidden');
  }

  hideStartOverlay() {
    this.overlayStart.classList.add('hidden');
    this.touchHint.classList.remove('hidden');
    setTimeout(() => {
      this.touchHint.classList.add('hidden');
    }, 4500);
  }

  showDraftOverlay(relics, onSelectCallback) {
    this.draftChoicesGrid.innerHTML = '';
    relics.forEach(relic => {
      const card = document.createElement('div');
      card.className = 'draft-card';
      const name = t(`${relic.id}_name`);
      const desc = t(`${relic.id}_desc`);
      card.innerHTML = `
        <div class="draft-icon">${relic.icon}</div>
        <div class="draft-name">${name}</div>
        <div class="draft-desc">${desc}</div>
      `;
      card.addEventListener('click', () => {
        this.overlayDraft.classList.add('hidden');
        onSelectCallback(relic.id);
      });
      this.draftChoicesGrid.appendChild(card);
    });
    this.overlayDraft.classList.remove('hidden');
  }

  showPauseOverlay(isPaused) {
    if (isPaused) {
      this.overlayPause.classList.remove('hidden');
      this.pauseIcon.classList.add('hidden');
      this.playIcon.classList.remove('hidden');
    } else {
      this.overlayPause.classList.add('hidden');
      this.pauseIcon.classList.remove('hidden');
      this.playIcon.classList.add('hidden');
    }
  }

  showGameOverOverlay({ isVictory = false, score = 0, sector = 1, highScore = 0 }) {
    this.gameoverTitle.textContent = isVictory ? t('victoryTitle') : t('gameOverTitle');
    this.gameoverDesc.textContent = isVictory ? t('victoryDesc') : t('gameOverDesc');
    this.gameoverScore.textContent = score.toLocaleString();
    this.gameoverSector.textContent = `${sector} / 5`;
    this.gameoverHigh.textContent = highScore.toLocaleString();
    this.overlayGameOver.classList.remove('hidden');
    this.touchHint.classList.add('hidden');
  }

  hideGameOverOverlay() {
    this.overlayGameOver.classList.add('hidden');
  }

  setAudioIcon(enabled) {
    if (enabled) {
      this.audioIconOn.classList.remove('hidden');
      this.audioIconOff.classList.add('hidden');
    } else {
      this.audioIconOn.classList.add('hidden');
      this.audioIconOff.classList.remove('hidden');
    }
  }
}
