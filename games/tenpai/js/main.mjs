/**
 * Main application entry point for Tenpai King · Wait Finder (雀神听牌王 · 听牌速判)
 * Assembles Game coordinator, UI, Audio, Storage, and i18n together.
 */

import { initLanguage, toggleLanguage, t } from './i18n.mjs';
import { loadSaveData, setSoundPreference } from './storage.mjs';
import { TenpaiUI } from './ui.mjs';
import { TenpaiGame } from './game.mjs';
import {
  setMuted,
  playTileClack,
  playTileSelect,
  playTargetSet,
  playTimerTick,
  playRevealCorrect,
  playRevealWrong,
  playHuFanfare
} from './audio.mjs';

function init() {
  initLanguage();
  const saveData = loadSaveData();
  setMuted(!saveData.soundEnabled);

  const ui = new TenpaiUI();

  const game = new TenpaiGame({
    initialLevel: saveData.currentLevel || 1,
    onStateChange: () => {
      const state = game.getState();
      if (!state.levelConfig) return;

      ui.selectedTiles = new Set(state.userPicks);
      ui.targetTile = state.userTarget;

      ui.renderHand(state.levelConfig.hand);
      ui.renderTilePicker((tileId) => {
        game.togglePick(tileId);
      });

      ui.renderHUD(
        state.levelConfig,
        state.lastEvalResult ? state.lastEvalResult.totalScore : 0,
        state.currentStreak,
        state.remainingSec,
        state.totalScore
      );

      if (ui.dom.btnSubmit) {
        ui.dom.btnSubmit.disabled = state.status !== 'answering' || state.userPicks.length === 0;
      }
      if (ui.dom.btnClear) {
        ui.dom.btnClear.disabled = state.status !== 'answering' || state.userPicks.length === 0;
      }
    },
    onSoundEffect: (name, arg) => {
      switch (name) {
        case 'tile_clack': playTileClack(); break;
        case 'tile_select': playTileSelect(); break;
        case 'target_set': playTargetSet(); break;
        case 'timer_tick': playTimerTick(arg); break;
        case 'reveal_correct': playRevealCorrect(); break;
        case 'reveal_wrong': playRevealWrong(); break;
        case 'hu_fanfare': playHuFanfare(); break;
      }
    },
    onComplete: (evalResult) => {
      const state = game.getState();
      ui.showResultPanel(evalResult, state.levelConfig);
      if (evalResult.isPerfect) {
        const rect = ui.dom.resultPanel.getBoundingClientRect();
        ui.spawnFireworks(rect.left + rect.width / 2, rect.top + rect.height / 3);
      }
    }
  });

  // Sound Button
  const updateSoundBtn = () => {
    if (ui.dom.btnSound) {
      const data = loadSaveData();
      ui.dom.btnSound.textContent = data.soundEnabled ? t('soundOn') : t('soundOff');
    }
  };

  if (ui.dom.btnSound) {
    ui.dom.btnSound.addEventListener('click', () => {
      const current = loadSaveData();
      const next = !current.soundEnabled;
      setSoundPreference(next);
      setMuted(!next);
      updateSoundBtn();
    });
  }

  // Language Button: Hot in-place update without reload
  if (ui.dom.btnLang) {
    ui.dom.btnLang.addEventListener('click', () => {
      toggleLanguage();
      ui.updateTexts();
      updateSoundBtn();
      const state = game.getState();
      if (state.levelConfig) {
        ui.renderHUD(
          state.levelConfig,
          state.lastEvalResult ? state.lastEvalResult.totalScore : 0,
          state.currentStreak,
          state.remainingSec,
          state.totalScore
        );
        ui.renderTilePicker((tileId) => {
          game.togglePick(tileId);
        });
        ui.renderHand(state.levelConfig.hand);
      }
    });
  }

  // Submit and Clear
  if (ui.dom.btnSubmit) {
    ui.dom.btnSubmit.addEventListener('click', () => {
      game.submit();
    });
  }
  if (ui.dom.btnClear) {
    ui.dom.btnClear.addEventListener('click', () => {
      game.clearPicks();
    });
  }

  // Result panel actions
  if (ui.dom.btnNext) {
    ui.dom.btnNext.addEventListener('click', () => {
      ui.hideResultPanel();
      game.nextLevel();
    });
  }
  if (ui.dom.btnRetry) {
    ui.dom.btnRetry.addEventListener('click', () => {
      ui.hideResultPanel();
      game.restart();
    });
  }

  // Pause Button
  if (ui.dom.btnPause) {
    ui.dom.btnPause.addEventListener('click', () => {
      const isPaused = game.togglePause();
      if (isPaused) {
        ui.showPauseModal();
      } else {
        ui.hidePauseModal();
      }
    });
  }

  // Restart Button
  if (ui.dom.btnRestart) {
    ui.dom.btnRestart.addEventListener('click', () => {
      ui.hideResultPanel();
      ui.hidePauseModal();
      game.restart();
    });
  }

  // Level Selection Modal
  const openLevelsModal = () => {
    const data = loadSaveData();
    ui.renderLevelsGrid(
      [],
      data.unlockedLevel,
      data.levelScores,
      (selectedLvl) => {
        ui.hideResultPanel();
        ui.hidePauseModal();
        game.loadLevel(selectedLvl);
      }
    );
    ui.showLevelsModal();
  };

  if (ui.dom.btnLevels) {
    ui.dom.btnLevels.addEventListener('click', openLevelsModal);
  }

  // Rules Modal
  if (ui.dom.btnRules) {
    ui.dom.btnRules.addEventListener('click', () => {
      ui.showRulesModal();
    });
  }

  // Close buttons for modals
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ui.hideLevelsModal();
      ui.hideRulesModal();
      ui.hidePauseModal();
      if (game.getState().status === 'paused') {
        game.resume();
      }
    });
  });

  // Modal resume/restart
  const btnModalResume = document.getElementById('btn-modal-resume');
  if (btnModalResume) {
    btnModalResume.addEventListener('click', () => {
      ui.hidePauseModal();
      game.resume();
    });
  }
  const btnModalRestart = document.getElementById('btn-modal-restart');
  if (btnModalRestart) {
    btnModalRestart.addEventListener('click', () => {
      ui.hidePauseModal();
      game.restart();
    });
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const state = game.getState();
      if (state.status === 'submitting') return;
      if (state.status === 'submitted') {
        ui.hideResultPanel();
        game.nextLevel();
      } else if (state.userPicks.length > 0) {
        game.submit();
      }
    } else if (e.key === 'c' || e.key === 'C') {
      game.clearPicks();
    } else if (e.key === 'r' || e.key === 'R') {
      ui.hideResultPanel();
      ui.hidePauseModal();
      game.restart();
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      const isPaused = game.togglePause();
      if (isPaused) {
        ui.showPauseModal();
      } else {
        ui.hidePauseModal();
      }
    }
  });

  // Visibility change & Blur: Auto-Pause
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.pause();
      ui.showPauseModal();
    }
  });
  window.addEventListener('blur', () => {
    game.pause();
    ui.showPauseModal();
  });

  // Initial texts
  ui.updateTexts();
  updateSoundBtn();

  // Instant Play: start level immediately
  game.loadLevel(saveData.currentLevel || 1);

  // RAF Loop
  let lastTime = performance.now();
  function loop(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    game.update(Math.min(dt, 0.1));
    ui.updateAndDrawParticles();

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

window.addEventListener('DOMContentLoaded', init);
