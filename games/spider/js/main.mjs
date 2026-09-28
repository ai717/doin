// Spider Solitaire Main Entry Point

import { SpiderGameController } from './game.mjs';
import { SpiderUI } from './ui.mjs';
import { loadLocale, saveLocale } from './i18n.mjs';
import { sound } from './audio.mjs';
import { saveGameData } from './storage.mjs';
import { LEVELS } from './levels.mjs';

document.addEventListener('DOMContentLoaded', () => {
  // First unlock sound on any user gesture
  const unlockAudio = () => {
    sound.unlock();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  let currentLocale = loadLocale();

  let ui = null;
  const controller = new SpiderGameController({
    onStateChange: (state) => {
      if (ui) ui.render(state);
    },
    onVictory: (summary) => {
      if (ui) ui.showVictoryModal(summary);
    },
    onRunCleared: (_run) => {
      // Run clearing hook for animations/effects
    }
  });

  ui = new SpiderUI({
    controller,
    onToggleLang: () => {
      currentLocale = currentLocale === 'zh' ? 'en' : 'zh';
      saveLocale(currentLocale);
      ui.setLocale(currentLocale);
      controller.emitChange();
    },
    onToggleSound: () => {
      const isMuted = sound.toggleMute();
      saveGameData({ soundMuted: isMuted });
    }
  });

  // Apply initial locale immediately across all DOM elements
  ui.setLocale(currentLocale);

  // Start with Chapter 1, Level 1
  controller.startStoryLevel(LEVELS[0].id);
});
