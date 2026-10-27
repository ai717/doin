import { initLanguage, toggleLanguage } from './i18n.mjs';
import { UIRenderer } from './ui.mjs';
import { GameController } from './game.mjs';

window.addEventListener('DOMContentLoaded', () => {
  initLanguage();

  const canvas = document.getElementById('game-canvas');
  const stage = document.getElementById('desktop-wrapper') || document.body;
  const ui = new UIRenderer();
  const game = new GameController(canvas, ui);

  game.init();

  // 1. 彻底禁用游戏盘与画布区域的默认右键菜单
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  // 2. 按钮操作绑定
  document.getElementById('btn-start').addEventListener('click', () => game.startGame());
  document.getElementById('btn-play-again').addEventListener('click', () => game.startGame());
  document.getElementById('btn-resume').addEventListener('click', () => game.togglePause());
  document.getElementById('btn-restart-pause').addEventListener('click', () => game.restartGame());
  document.getElementById('pause-btn').addEventListener('click', () => game.togglePause());
  document.getElementById('audio-btn').addEventListener('click', () => game.toggleAudio());
  document.getElementById('lang-btn').addEventListener('click', () => {
    toggleLanguage();
    ui.updateTexts();
    game.syncHUD();
  });

  // 3. 全局指针与鼠标事件
  let isPointerDown = false;
  let lastTouchX = null;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      game.handleGlobalPointerMove(e.clientX);
    } else if (isPointerDown && e.pointerType === 'touch') {
      if (lastTouchX !== null) {
        const dx = e.clientX - lastTouchX;
        game.handleTouchDelta(dx);
      }
      lastTouchX = e.clientX;
    }
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    // 右键点击同样阻止默认行为，并可用于蓄势发射
    if (e.button === 2) {
      e.preventDefault();
    }
    isPointerDown = true;
    if (e.pointerType === 'touch') {
      lastTouchX = e.clientX;
    } else {
      game.handleGlobalPointerMove(e.clientX);
    }
  });

  window.addEventListener('pointerup', (e) => {
    if (e.button === 2) {
      e.preventDefault();
    }
    isPointerDown = false;
    lastTouchX = null;
    game.handlePointerTap();
  });

  // 4. 移动端防缩放与手势防抖
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });

  // 5. 键盘操作
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      game.handlePointerTap();
    } else if (e.code === 'KeyP') {
      e.preventDefault();
      game.togglePause();
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      game.engine.movePaddleDelta(-30);
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      game.engine.movePaddleDelta(30);
    }
  });
});
