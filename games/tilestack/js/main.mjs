/**
 * Main application entry point for TileStack (千层瓦片 · 叠叠消)
 * Glues Game coordinator, UI, Audio, Storage, and i18n together.
 */

import { initLanguage, toggleLanguage, t } from './i18n.mjs';
import { loadSaveData, setSoundPreference } from './storage.mjs';
import { TileStackUI } from './ui.mjs';
import { TileStackGame } from './game.mjs';
import {
  setMuted,
  playTileTap,
  playTrayLand,
  playMatchChime,
  playIceShatter,
  playKeyUnlock,
  playTrayWarning,
  playLevelWin,
  playLevelLoss
} from './audio.mjs';

function init() {
  initLanguage();
  const saveData = loadSaveData();
  setMuted(!saveData.soundEnabled);

  const ui = new TileStackUI();

  // Create game coordinator
  const game = new TileStackGame({
    initialLevel: saveData.currentLevel || 1,
    onStateChange: (state, config) => {
      ui.setTheme(config.chapterTheme);
      ui.renderTower(state, (tileId, tileEl) => {
        const rect = tileEl.getBoundingClientRect();
        game.handleTileClick(tileId, {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        });
      });
      ui.renderTray(state);
      ui.renderHUD(state, config);
    },
    onMatch: (matchResult, clientPos) => {
      if (clientPos) {
        ui.spawnMatchParticles(clientPos.x, clientPos.y);
      } else {
        const trayEl = document.getElementById('tray-slots');
        if (trayEl) {
          const r = trayEl.getBoundingClientRect();
          ui.spawnMatchParticles(r.left + r.width / 2, r.top + r.height / 2);
        }
      }
    },
    onSoundEffect: (name, arg) => {
      switch (name) {
        case 'tile_tap': playTileTap(); break;
        case 'tray_land': playTrayLand(); break;
        case 'match_chime': playMatchChime(arg || 1); break;
        case 'ice_shatter': playIceShatter(); break;
        case 'key_unlock': playKeyUnlock(); break;
        case 'tray_warning': playTrayWarning(); break;
        case 'level_win': playLevelWin(); break;
        case 'level_lose': playLevelLoss(); break;
      }
    },
    onWin: (settlement) => {
      ui.showSettlement(true, settlement, () => {
        ui.hideSettlement();
        game.nextLevel();
      }, () => {
        ui.hideSettlement();
        game.restart();
      }, () => {});
    },
    onLose: (settlement) => {
      ui.showSettlement(false, settlement, () => {}, () => {
        ui.hideSettlement();
        game.restart();
      }, () => {
        ui.hideSettlement();
        game.handleUndo();
      });
    }
  });

  // Sound toggle button setup
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

  // Language toggle button setup: HOT UPDATE, NO RELOAD!
  if (ui.dom.btnLang) {
    ui.dom.btnLang.addEventListener('click', () => {
      toggleLanguage();
      ui.updateTexts();
      updateSoundBtn();
      const state = game.getState();
      const config = game.getLevelConfig();
      if (state && config) {
        ui.renderHUD(state, config);
        ui.renderTower(state, (tileId, tileEl) => {
          const rect = tileEl.getBoundingClientRect();
          game.handleTileClick(tileId, {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          });
        });
        ui.renderTray(state);
      }
    });
  }

  // Header controls
  if (ui.dom.btnRestart) {
    ui.dom.btnRestart.addEventListener('click', () => {
      ui.hideSettlement();
      ui.hidePauseModal();
      game.restart();
    });
  }

  if (ui.dom.btnUndo) {
    ui.dom.btnUndo.addEventListener('click', () => {
      game.handleUndo();
    });
  }

  if (ui.dom.btnHint) {
    ui.dom.btnHint.addEventListener('click', () => {
      const res = game.handleHint();
      if (res.success && res.tileIds) {
        ui.setHintedTiles(res.tileIds);
      }
    });
  }

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

  // Level selection modal
  const openLevelsModal = () => {
    const data = loadSaveData();
    ui.renderLevelsGrid(
      game.getLevelConfig() ? [game.getLevelConfig()] : [],
      data.unlockedLevel,
      data.levelStars,
      (selectedLvl) => {
        ui.hideSettlement();
        ui.hidePauseModal();
        game.loadLevel(selectedLvl);
      }
    );
    ui.showLevelsModal();
  };

  if (ui.dom.btnLevels) {
    ui.dom.btnLevels.addEventListener('click', openLevelsModal);
  }

  // Settlement dialog actions
  if (ui.dom.btnNextLevel) {
    ui.dom.btnNextLevel.addEventListener('click', () => {
      ui.hideSettlement();
      game.nextLevel();
    });
  }
  if (ui.dom.btnTryAgain) {
    ui.dom.btnTryAgain.addEventListener('click', () => {
      ui.hideSettlement();
      game.restart();
    });
  }
  if (ui.dom.btnUndoLast) {
    ui.dom.btnUndoLast.addEventListener('click', () => {
      ui.hideSettlement();
      game.handleUndo();
    });
  }

  // Rules modal
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
      if (game.getState() && game.getState().status === 'paused') {
        game.resume();
      }
    });
  });

  // Resume button inside pause modal
  const btnModalResume = document.getElementById('btn-modal-resume');
  if (btnModalResume) {
    btnModalResume.addEventListener('click', () => {
      ui.hidePauseModal();
      game.resume();
    });
  }

  // Restart button inside pause modal
  const btnModalRestart = document.getElementById('btn-modal-restart');
  if (btnModalRestart) {
    btnModalRestart.addEventListener('click', () => {
      ui.hidePauseModal();
      game.restart();
    });
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') {
      const res = game.handleHint();
      if (res.success && res.tileIds) {
        ui.setHintedTiles(res.tileIds);
      }
    } else if (e.key === ' ' || e.key === 'z' || e.key === 'Z') {
      game.handleUndo();
    } else if (e.key === 'r' || e.key === 'R') {
      ui.hideSettlement();
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

  // Visibility and blur handling: Silent Auto-Pause
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      game.pause();
      if (game.getState() && game.getState().isTimed) {
        ui.showPauseModal();
      }
    }
  });
  window.addEventListener('blur', () => {
    game.pause();
    if (game.getState() && game.getState().isTimed) {
      ui.showPauseModal();
    }
  });

  // Render text for initial language
  ui.updateTexts();
  updateSoundBtn();

  // Instant Play: start level immediately
  game.loadLevel(saveData.currentLevel || 1);

  // RAF animation loop
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
