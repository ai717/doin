/**
 * Main application entrypoint for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * Mounts UI, engine, storage, audio and binds user controls.
 */

import { LubanGame } from './game.mjs';
import { LubanUI } from './ui.mjs';
import { LEVELS } from './levels.mjs';
import {
  initLanguage,
  toggleLanguage,
  t
} from './i18n.mjs';
import {
  loadSaveData,
  saveData,
  setSoundPreference
} from './storage.mjs';
import {
  setMuted,
  getMuted,
  playWoodSlide,
  playWoodThud,
  playTenonClack,
  playViewRotate,
  playHintChime,
  playLevelWin
} from './audio.mjs';

function init() {
  initLanguage();
  const saveData = loadSaveData();

  setMuted(!saveData.soundEnabled);

  const ui = new LubanUI();

  const game = new LubanGame({
    initialLevel: saveData.currentLevel || 1,

    onStateChange: (state, config) => {
      ui.setViewAngle(state.viewAngle);
      ui.renderAssembly(state.remainingBlocks, (blockId) => {
        game.handleBlockClick(blockId);
      });
      ui.renderTray(state.extractedBlocks);
      ui.renderHUD(state, config);
    },

    onSoundEffect: (name) => {
      switch (name) {
        case 'wood_slide':
          playWoodSlide();
          break;
        case 'wood_thud':
          playWoodThud();
          break;
        case 'tenon_clack':
          playTenonClack();
          break;
        case 'view_rotate':
          playViewRotate();
          break;
        case 'hint_chime':
          playHintChime();
          break;
        case 'level_win':
          playLevelWin();
          break;
        default:
          break;
      }
    },

    onBlockBlocked: (blockId, blockers) => {
      ui.triggerBlockedFeedback(blockId, blockers);
    },

    onBlockSlide: (blockId, block, onDone) => {
      ui.animateSlideOut(blockId, block, onDone);
    },

    onWin: (summary) => {
      const stageRect = ui.dom.stage3d ? ui.dom.stage3d.getBoundingClientRect() : { left: 300, top: 300 };
      ui.spawnSawdustParticles(stageRect.left + 150, stageRect.top + 100, '#d99457');
      ui.spawnSawdustParticles(stageRect.left + 100, stageRect.top + 150, '#f0c070');
      ui.showSettlement(
        summary,
        () => {
          ui.hideSettlement();
          game.nextLevel();
        },
        () => {
          ui.hideSettlement();
          game.restart();
        }
      );
    }
  });

  // Wire buttons
  if (ui.dom.btnLevels) {
    ui.dom.btnLevels.addEventListener('click', () => {
      const curData = loadSaveData();
      ui.renderLevelsGrid(LEVELS, curData.unlockedLevel, curData.levelRatings, (lvl) => {
        game.loadLevel(lvl);
      });
      ui.showLevelsModal();
    });
  }

  if (ui.dom.btnRotate) {
    ui.dom.btnRotate.addEventListener('click', () => {
      game.handleRotate(1);
    });
  }

  if (ui.dom.btnHint) {
    ui.dom.btnHint.addEventListener('click', () => {
      const res = game.handleHint();
      if (res.success && res.movableBlockIds) {
        ui.setHintedBlocks(res.movableBlockIds);
      }
    });
  }

  if (ui.dom.btnUndo) {
    ui.dom.btnUndo.addEventListener('click', () => {
      game.handleUndo();
    });
  }

  if (ui.dom.btnRestart) {
    ui.dom.btnRestart.addEventListener('click', () => {
      game.restart();
    });
  }

  if (ui.dom.btnSound) {
    const updateSoundLabel = () => {
      ui.dom.btnSound.textContent = getMuted() ? t('soundOff') : t('soundOn');
    };
    updateSoundLabel();

    ui.dom.btnSound.addEventListener('click', () => {
      const nextMuted = !getMuted();
      setMuted(nextMuted);
      setSoundPreference(!nextMuted);
      updateSoundLabel();
    });
  }

  if (ui.dom.btnLang) {
    ui.dom.btnLang.addEventListener('click', () => {
      toggleLanguage();
      ui.updateTexts();
      if (ui.dom.btnSound) {
        ui.dom.btnSound.textContent = getMuted() ? t('soundOff') : t('soundOn');
      }
      const st = game.getState();
      const cfg = game.getLevelConfig();
      if (st && cfg) {
        ui.renderHUD(st, cfg);
        ui.renderTray(st.extractedBlocks);
      }
      const curData = loadSaveData();
      ui.renderLevelsGrid(LEVELS, curData.unlockedLevel, curData.levelRatings, (lvl) => {
        game.loadLevel(lvl);
      });
    });
  }

  if (ui.dom.btnRules) {
    ui.dom.btnRules.addEventListener('click', () => {
      ui.showRulesModal();
    });
  }

  // Close modals
  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      ui.hideLevelsModal();
      ui.hideRulesModal();
      ui.hideSettlement();
    });
  });

  // Modal backdrop click
  [ui.dom.modalLevels, ui.dom.modalRules, ui.dom.modalSettlement].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('visible');
      }
    });
  });

  if (ui.dom.btnNextLevel) {
    ui.dom.btnNextLevel.addEventListener('click', () => {
      ui.hideSettlement();
      game.nextLevel();
    });
  }

  if (ui.dom.btnReplayLevel) {
    ui.dom.btnReplayLevel.addEventListener('click', () => {
      ui.hideSettlement();
      game.restart();
    });
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      game.handleRotate(1);
    } else if (e.key === 'u' || e.key === 'U' || (e.ctrlKey && e.key === 'z')) {
      e.preventDefault();
      game.handleUndo();
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      const res = game.handleHint();
      if (res.success && res.movableBlockIds) {
        ui.setHintedBlocks(res.movableBlockIds);
      }
    } else if (e.key === 'Escape') {
      ui.hideLevelsModal();
      ui.hideRulesModal();
      ui.hideSettlement();
    }
  });

  // Visibility and blur handling
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Game is paused in background
    }
  });

  // Render loop for sawdust particles
  function loop() {
    ui.updateAndDrawParticles();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // Initial load
  ui.updateTexts();
  game.loadLevel(saveData.currentLevel || 1);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
