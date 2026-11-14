import { UIManager } from './ui.mjs';
import { Renderer } from './render.mjs';
import { Game, STATES } from './game.mjs';
import { audio } from './audio.mjs';
import { detectLocale, saveLocale } from './i18n.mjs';
import { loadGameData, saveGameData } from './storage.mjs';

function bootstrap() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  const ui = new UIManager();
  const renderer = new Renderer(canvas);
  const game = new Game(canvas, ui);

  // 1. 初始化并持久化主题与难度
  const stored = loadGameData();
  ui.updateThemeUI(stored.theme);
  renderer.setTheme(stored.theme);

  ui.updateDifficultyUI(stored.difficulty);
  game.setDifficulty(stored.difficulty);

  // 2. 初始化多语言
  let currentLocale = detectLocale();
  ui.renderI18n(currentLocale);

  // 3. 初始化音频
  audio.setEnabled(stored.soundEnabled);
  ui.updateSoundIcon(stored.soundEnabled);
  ui.updateHUD(0, stored.bestScore, 3, 1);

  // 4. 顶栏工具按钮事件
  const btnTheme = document.getElementById('btn-theme');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const nextTheme = stored.theme === 'dark' ? 'light' : 'dark';
      stored.theme = nextTheme;
      saveGameData(stored);
      ui.updateThemeUI(nextTheme);
      renderer.setTheme(nextTheme);
    });
  }

  const btnSound = document.getElementById('btn-sound');
  if (btnSound) {
    btnSound.addEventListener('click', () => {
      const next = !audio.isEnabled();
      audio.setEnabled(next);
      ui.updateSoundIcon(next);
      stored.soundEnabled = next;
      saveGameData(stored);
    });
  }

  const btnLang = document.getElementById('btn-lang');
  if (btnLang) {
    btnLang.addEventListener('click', () => {
      currentLocale = currentLocale === 'zh' ? 'en' : 'zh';
      saveLocale(currentLocale);
      ui.renderI18n(currentLocale);
      ui.updatePauseButtonState(game.state === STATES.PAUSED, currentLocale);
    });
  }

  // 5. 难度按钮切换事件
  const diffButtons = document.querySelectorAll('[data-diff]');
  for (const btn of diffButtons) {
    btn.addEventListener('click', (e) => {
      const targetDiff = e.currentTarget.getAttribute('data-diff');
      game.setDifficulty(targetDiff);
    });
  }

  // 6. 模态框与仪表盘快捷按钮事件
  const btnStart = document.getElementById('btn-start');
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      audio.initContext();
      game.start();
    });
  }

  const btnHelp = document.getElementById('btn-help');
  if (btnHelp) {
    btnHelp.addEventListener('click', () => {
      ui.showModal(ui.modalRules);
    });
  }

  const btnCloseRules = document.getElementById('btn-close-rules');
  if (btnCloseRules) {
    btnCloseRules.addEventListener('click', () => {
      ui.hideModal(ui.modalRules);
    });
  }

  const btnResume = document.getElementById('btn-resume');
  if (btnResume) {
    btnResume.addEventListener('click', () => {
      game.resume();
    });
  }

  const btnRestartPause = document.getElementById('btn-restart-pause');
  if (btnRestartPause) {
    btnRestartPause.addEventListener('click', () => {
      game.start();
    });
  }

  const btnReplay = document.getElementById('btn-replay');
  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      game.start();
    });
  }

  const btnSidePause = document.getElementById('btn-side-pause');
  if (btnSidePause) {
    btnSidePause.addEventListener('click', () => {
      if (game.state === STATES.PLAYING || game.state === STATES.PAUSED) {
        game.togglePause();
        ui.updatePauseButtonState(game.state === STATES.PAUSED, currentLocale);
      }
    });
  }

  const btnSideRestart = document.getElementById('btn-side-restart');
  if (btnSideRestart) {
    btnSideRestart.addEventListener('click', () => {
      game.start();
    });
  }

  // 7. 键盘操作绑定
  window.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        game.handleInput('UP');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        game.handleInput('DOWN');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        game.handleInput('LEFT');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        game.handleInput('RIGHT');
        break;
      case 'p':
      case 'P':
      case ' ':
        e.preventDefault();
        if (game.state === STATES.PLAYING || game.state === STATES.PAUSED) {
          game.togglePause();
          ui.updatePauseButtonState(game.state === STATES.PAUSED, currentLocale);
        }
        break;
    }
  });

  // 8. 移动端虚拟方向按键
  const bindTouch = (id, action) => {
    const el = document.getElementById(id);
    if (!el) return;
    const trigger = (e) => {
      e.preventDefault();
      audio.initContext();
      action();
    };
    el.addEventListener('touchstart', trigger, { passive: false });
    el.addEventListener('click', trigger);
  };

  bindTouch('vbtn-up', () => game.handleInput('UP'));
  bindTouch('vbtn-down', () => game.handleInput('DOWN'));
  bindTouch('vbtn-left', () => game.handleInput('LEFT'));
  bindTouch('vbtn-right', () => game.handleInput('RIGHT'));
  bindTouch('vbtn-pause', () => {
    game.togglePause();
    ui.updatePauseButtonState(game.state === STATES.PAUSED, currentLocale);
  });

  // 9. 移动端画布轻滑手势
  let touchStartX = 0;
  let touchStartY = 0;
  canvas.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    },
    { passive: true }
  );

  canvas.addEventListener(
    'touchend',
    (e) => {
      if (!e.changedTouches || !e.changedTouches[0]) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (Math.max(absX, absY) > 20) {
        if (absX > absY) {
          game.handleInput(dx > 0 ? 'RIGHT' : 'LEFT');
        } else {
          game.handleInput(dy > 0 ? 'DOWN' : 'UP');
        }
      }
    },
    { passive: true }
  );

  // 10. 视口尺寸自适应
  window.addEventListener('resize', () => {
    renderer.setupDpr();
  });

  // 11. 启动 rAF 主循环
  function loop(timestamp) {
    game.update(timestamp, renderer);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
