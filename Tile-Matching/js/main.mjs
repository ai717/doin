import { UIManager } from './ui.mjs';
import { GameManager } from './game.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const ui = new UIManager();
  const game = new GameManager(ui);

  // 绑定交互控制
  document.getElementById('btn-restart').addEventListener('click', () => {
    game.loadLevel(game.currentLevelId);
  });

  document.getElementById('btn-hint').addEventListener('click', () => {
    game.showHint();
  });

  document.getElementById('btn-audio').addEventListener('click', () => {
    game.toggleSound();
  });

  document.getElementById('btn-lang').addEventListener('click', () => {
    game.toggleLanguage();
  });

  document.getElementById('btn-select-level').addEventListener('click', () => {
    game.openLevelSelect();
  });

  document.getElementById('btn-close-level-modal').addEventListener('click', () => {
    ui.levelModal.classList.add('hidden');
  });

  document.getElementById('btn-result-replay').addEventListener('click', () => {
    ui.hideResultModal();
    game.loadLevel(game.currentLevelId);
  });

  document.getElementById('btn-result-next').addEventListener('click', () => {
    game.nextLevel();
  });

  // 全量文案与游戏引擎就绪启动
  game.refreshTexts();
  game.init();
});
