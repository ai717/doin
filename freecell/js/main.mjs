import { FreeCellRenderer } from './render.mjs';
import { FreeCellUI } from './ui.mjs';
import { FreeCellGame } from './game.mjs';
import { sound } from './audio.mjs';
import { loadLocale, saveLocale } from './i18n.mjs';
import { loadGameData, saveGameData } from './storage.mjs';
import { DIFFICULTY_SEEDS } from './engine.mjs';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  const canvas = document.getElementById('game-canvas');
  if (!canvas || !container) return;

  const renderer = new FreeCellRenderer(canvas);
  const ui = new FreeCellUI();
  const game = new FreeCellGame(renderer, ui);

  let currentLocale = loadLocale();
  ui.updateLanguage(currentLocale);

  const storageData = loadGameData();
  sound.setMuted(storageData.soundMuted);
  ui.updateSoundIcon(storageData.soundMuted);

  renderer.resize();
  window.addEventListener('resize', () => {
    renderer.resize();
  });

  // 全局拦截右键并作为“取消选中/放下手中卡牌”动作
  const blockAndCancel = e => {
    e.preventDefault();
    e.stopPropagation();
    game.cancelInteraction();
    return false;
  };
  window.addEventListener('contextmenu', blockAndCancel, { capture: true });
  document.addEventListener('contextmenu', blockAndCancel, { capture: true });
  canvas.addEventListener('contextmenu', blockAndCancel, { capture: true });

  const btnNewGame = document.getElementById('btn-new-game');
  const btnRestart = document.getElementById('btn-restart');
  const btnUndo = document.getElementById('btn-undo');
  const btnHint = document.getElementById('btn-hint');
  const btnPause = document.getElementById('btn-pause');
  const btnSound = document.getElementById('btn-sound');
  const btnLang = document.getElementById('btn-lang');
  const btnRules = document.getElementById('btn-rules');
  const btnRulesClose = document.getElementById('btn-rules-close');
  const btnResume = document.getElementById('btn-resume');
  const btnPlayAgain = document.getElementById('btn-play-again');
  const selectDifficulty = document.getElementById('select-difficulty');

  const startWithDifficulty = (diff) => {
    let nextDeal;
    if (diff === 'easy') {
      const list = DIFFICULTY_SEEDS.easy;
      nextDeal = list[Math.floor(Math.random() * list.length)];
    } else if (diff === 'normal') {
      const list = DIFFICULTY_SEEDS.normal;
      nextDeal = list[Math.floor(Math.random() * list.length)];
    } else {
      nextDeal = Math.floor(Math.random() * 32000) + 1;
    }
    game.engine.difficulty = diff;
    game.startNewGame(nextDeal);
  };

  if (selectDifficulty) {
    selectDifficulty.addEventListener('change', (e) => {
      startWithDifficulty(e.target.value);
    });
  }

  if (btnNewGame) {
    btnNewGame.addEventListener('click', () => {
      const diff = selectDifficulty ? selectDifficulty.value : 'normal';
      startWithDifficulty(diff);
    });
  }

  if (btnRestart) btnRestart.addEventListener('click', () => game.restartCurrentGame());
  if (btnUndo) btnUndo.addEventListener('click', () => game.undo());
  if (btnHint) btnHint.addEventListener('click', () => game.triggerHint());
  if (btnPause) btnPause.addEventListener('click', () => game.pauseGame());
  if (btnResume) btnResume.addEventListener('click', () => game.resumeGame());
  if (btnPlayAgain) {
    btnPlayAgain.addEventListener('click', () => {
      const diff = selectDifficulty ? selectDifficulty.value : 'normal';
      startWithDifficulty(diff);
    });
  }

  if (btnRules) {
    btnRules.addEventListener('click', () => {
      game.pauseGame();
      ui.showModal('rules');
    });
  }

  if (btnRulesClose) {
    btnRulesClose.addEventListener('click', () => {
      ui.hideModals();
      game.resumeGame();
    });
  }

  if (btnSound) {
    btnSound.addEventListener('click', () => {
      sound.unlock();
      const muted = sound.toggleMute();
      ui.updateSoundIcon(muted);
      saveGameData({ soundMuted: muted });
    });
  }

  if (btnLang) {
    btnLang.addEventListener('click', () => {
      currentLocale = currentLocale === 'zh' ? 'en' : 'zh';
      saveLocale(currentLocale);
      ui.updateLanguage(currentLocale);
    });
  }

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    game.handlePointerDown(e.clientX, e.clientY, e.button);
  });

  window.addEventListener('pointermove', e => {
    game.handlePointerMove(e.clientX, e.clientY);
  });

  window.addEventListener('pointerup', e => {
    game.handlePointerUp(e.clientX, e.clientY);
  });

  window.addEventListener('pointercancel', () => {
    game.cancelInteraction();
  });

  window.addEventListener('blur', () => {
    game.cancelInteraction();
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      game.undo();
    } else if (e.key === 'h' || e.key === 'H') {
      game.triggerHint();
    } else if (e.key === 'Escape') {
      if (game.interaction.drag || game.interaction.selected) {
        game.cancelInteraction();
      } else if (game.state === 'PLAYING') {
        game.pauseGame();
      } else if (game.state === 'PAUSED') {
        game.resumeGame();
      }
    }
  });

  // 默认启动普通难度的经典第 #1 号牌局
  startWithDifficulty('normal');
  requestAnimationFrame(t => game.loop(t));
});
