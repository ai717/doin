/**
 * @file games/pin/js/main.mjs
 * 游戏入口装配与全局事件协调中心。
 * 驱动单键极速击发、瞬时重开、切后台自动暂停与全量 i18n 原地热更新。
 */

import { GameController } from './game.mjs';
import { PinRenderer, CANVAS_WIDTH, CANVAS_HEIGHT } from './ui.mjs';
import {
  getCurrentLanguage,
  setLanguage,
  t,
  DICTIONARIES,
} from './i18n.mjs';
import {
  setMuted,
  isAudioMuted,
  playLaunchSound,
  playHitSound,
  playCollisionSound,
  playWinSound,
} from './audio.mjs';
import { calculateStars, formatTime, calculateTotalSummary } from './score.mjs';
import { LEVELS } from './levels.mjs';
import { WHEEL_CX, WHEEL_CY, WHEEL_RADIUS } from './engine.mjs';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const controller = new GameController();
  const renderer = new PinRenderer(canvas);

  let currentLang = getCurrentLanguage();
  let soundEnabled = true;

  // DOM 元素引用
  const dom = {
    btnPause: document.getElementById('btn-pause'),
    btnRestart: document.getElementById('btn-restart'),
    btnLevels: document.getElementById('btn-levels'),
    btnMode: document.getElementById('btn-mode'),
    btnSound: document.getElementById('btn-sound'),
    btnLang: document.getElementById('btn-lang'),

    hudAct: document.getElementById('hud-act'),
    hudLevel: document.getElementById('hud-level'),
    hudRemain: document.getElementById('hud-remain'),
    hudCombo: document.getElementById('hud-combo'),
    hudSpeed: document.getElementById('hud-speed'),
    hudDir: document.getElementById('hud-dir'),

    dialogPause: document.getElementById('dialog-pause'),
    btnResume: document.getElementById('btn-resume'),
    dialogLevels: document.getElementById('dialog-levels'),
    levelsGrid: document.getElementById('levels-grid'),
    btnCloseLevels: document.getElementById('btn-close-levels'),

    dialogWon: document.getElementById('dialog-won'),
    wonLevelTitle: document.getElementById('won-level-title'),
    wonTime: document.getElementById('won-time'),
    wonCombo: document.getElementById('won-combo'),
    wonStars: document.getElementById('won-stars'),
    btnNextLevel: document.getElementById('btn-next-level'),
    btnRetryLevel: document.getElementById('btn-retry-level'),
    btnCloseWon: document.getElementById('btn-close-won'),
  };

  // 全量 i18n 文本热替换
  function updateI18nTexts() {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        el.textContent = t(key, currentLang);
      }
    });

    if (dom.btnSound) {
      dom.btnSound.textContent = soundEnabled ? t('soundOn', currentLang) : t('soundOff', currentLang);
    }
    if (dom.btnLang) {
      dom.btnLang.textContent = currentLang === 'zh' ? 'English' : '中文';
    }
    if (dom.btnMode) {
      dom.btnMode.textContent = controller.mode === 'level' ? t('modeEndless', currentLang) : t('modeLevel', currentLang);
    }

    syncHud();
  }

  // 同步 HUD 面板
  function syncHud() {
    const state = controller.getState();
    if (!state) return;

    if (state.mode === 'endless') {
      if (dom.hudAct) dom.hudAct.textContent = t('modeEndless', currentLang);
      if (dom.hudLevel) dom.hudLevel.textContent = `${t('endlessScore', currentLang)}: ${state.endlessScore}`;
      if (dom.hudRemain) dom.hudRemain.textContent = `${t('highScoreLabel', currentLang)}: ${controller.storage.endlessHighScore}`;
    } else {
      const themeKey = `act_${['apprentice', 'pendulum', 'steam', 'tempest', 'celestial'][state.level.act - 1]}`;
      if (dom.hudAct) dom.hudAct.textContent = t(themeKey, currentLang);
      if (dom.hudLevel) dom.hudLevel.textContent = `${t('levelBadge', currentLang)} ${state.level.id}`;
      if (dom.hudRemain) dom.hudRemain.textContent = `${state.pendingCount}`;
    }

    if (dom.hudCombo) {
      dom.hudCombo.textContent = state.combo > 1 ? `x${state.combo} 🔥` : '-';
    }

    if (dom.hudSpeed) {
      dom.hudSpeed.textContent = `${Math.abs(state.currentSpeed).toFixed(1)} rad/s`;
    }

    if (dom.hudDir) {
      dom.hudDir.textContent = state.currentSpeed >= 0 ? t('cwLabel', currentLang) : t('ccwLabel', currentLang);
    }
  }

  // 击发控制
  function handleLaunch() {
    const state = controller.getState();
    if (state.status === 'failed') {
      // 失败后点击任意区域秒速复位重开
      controller.restart();
      syncHud();
      return;
    }
    if (state.status === 'won') {
      return;
    }

    controller.launch();
    handleEvents();
  }

  // 点击 / 触屏击发
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    handleLaunch();
  });

  const btnLaunchPad = document.getElementById('btn-launch-pad');
  if (btnLaunchPad) {
    btnLaunchPad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handleLaunch();
    });
  }

  // 全局键盘监听 (Space: 击发, R: 秒速重开, P/Esc: 暂停)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      handleLaunch();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      controller.restart();
      syncHud();
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      togglePause();
    }
  });

  // 状态机事件响应 (音效与震颤)
  function handleEvents() {
    const state = controller.getState();
    if (!state || !state.events) return;

    for (const ev of state.events) {
      if (ev.type === 'pin_launch') {
        playLaunchSound();
      } else if (ev.type === 'pin_hit') {
        playHitSound(ev.combo);
        // 在碰撞入点计算火星位置
        const hitX = WHEEL_CX + Math.cos(Math.PI / 2) * WHEEL_RADIUS;
        const hitY = WHEEL_CY + Math.sin(Math.PI / 2) * WHEEL_RADIUS;
        renderer.triggerSparks(hitX, hitY, 14, '#ffd54f');
      } else if (ev.type === 'pin_collision') {
        playCollisionSound();
        const hitX = WHEEL_CX + Math.cos(Math.PI / 2) * WHEEL_RADIUS;
        const hitY = WHEEL_CY + Math.sin(Math.PI / 2) * WHEEL_RADIUS;
        renderer.triggerSparks(hitX, hitY, 32, '#ff5252');
        renderer.triggerShake(0.28, 6);
      } else if (ev.type === 'level_won') {
        playWinSound();
        renderer.triggerSparks(WHEEL_CX, WHEEL_CY, 48, '#ffd54f');
        showWonModal(state);
      }
    }

    syncHud();
  }

  // 弹出通关奖励弹窗
  function showWonModal(state) {
    const stars = calculateStars({
      cleared: true,
      maxCombo: state.maxCombo,
      elapsedTime: state.elapsedTime,
      targetSeconds: state.level.targetSeconds || 30,
    });

    if (dom.wonLevelTitle) {
      const themeKey = `act_${['apprentice', 'pendulum', 'steam', 'tempest', 'celestial'][state.level.act - 1]}`;
      dom.wonLevelTitle.textContent = `${t(themeKey, currentLang)} · ${t('levelBadge', currentLang)} ${state.level.id}`;
    }
    if (dom.wonTime) dom.wonTime.textContent = formatTime(state.elapsedTime);
    if (dom.wonCombo) dom.wonCombo.textContent = state.maxCombo.toString();
    if (dom.wonStars) {
      dom.wonStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    }

    if (dom.dialogWon && typeof dom.dialogWon.showModal === 'function') {
      dom.dialogWon.showModal();
    }
  }

  // 暂停控制
  function togglePause() {
    const isPaused = controller.togglePause();
    if (isPaused) {
      if (dom.dialogPause && typeof dom.dialogPause.showModal === 'function') {
        dom.dialogPause.showModal();
      }
    } else {
      if (dom.dialogPause && dom.dialogPause.open) {
        dom.dialogPause.close();
      }
    }
  }

  // 渲染关卡选择器网格
  function renderLevelsGrid() {
    if (!dom.levelsGrid) return;
    dom.levelsGrid.innerHTML = '';

    const storage = controller.storage;
    LEVELS.forEach((level) => {
      const btn = document.createElement('button');
      btn.className = 'level-card';
      const isUnlocked = level.id <= storage.unlockedLevel;
      const rec = storage.records[level.id];
      const starsCount = rec ? rec.stars : 0;

      btn.disabled = !isUnlocked;
      if (level.id === controller.currentLevelId && controller.mode === 'level') {
        btn.classList.add('active');
      }

      btn.innerHTML = `
        <span class="level-num">${level.id}</span>
        <span class="level-stars">${isUnlocked ? ('★'.repeat(starsCount) + '☆'.repeat(3 - starsCount)) : '🔒'}</span>
      `;

      btn.addEventListener('click', () => {
        controller.loadLevel(level.id);
        if (dom.dialogLevels && dom.dialogLevels.open) {
          dom.dialogLevels.close();
        }
        syncHud();
      });

      dom.levelsGrid.appendChild(btn);
    });
  }

  // 系统按键绑定
  if (dom.btnPause) dom.btnPause.addEventListener('click', togglePause);
  if (dom.btnResume) dom.btnResume.addEventListener('click', togglePause);
  if (dom.btnRestart) {
    dom.btnRestart.addEventListener('click', () => {
      controller.restart();
      syncHud();
    });
  }

  if (dom.btnMode) {
    dom.btnMode.addEventListener('click', () => {
      const targetMode = controller.mode === 'level' ? 'endless' : 'level';
      controller.setMode(targetMode);
      dom.btnMode.textContent = targetMode === 'level' ? t('modeEndless', currentLang) : t('modeLevel', currentLang);
      syncHud();
    });
  }

  if (dom.btnLevels) {
    dom.btnLevels.addEventListener('click', () => {
      renderLevelsGrid();
      if (dom.dialogLevels && typeof dom.dialogLevels.showModal === 'function') {
        dom.dialogLevels.showModal();
      }
    });
  }
  if (dom.btnCloseLevels) {
    dom.btnCloseLevels.addEventListener('click', () => dom.dialogLevels.close());
  }

  if (dom.btnSound) {
    dom.btnSound.addEventListener('click', () => {
      soundEnabled = !soundEnabled;
      setMuted(!soundEnabled);
      dom.btnSound.textContent = soundEnabled ? t('soundOn', currentLang) : t('soundOff', currentLang);
    });
  }

  if (dom.btnLang) {
    dom.btnLang.addEventListener('click', () => {
      currentLang = currentLang === 'zh' ? 'en' : 'zh';
      setLanguage(currentLang);
      updateI18nTexts();
    });
  }

  // 通关弹窗按键
  if (dom.btnNextLevel) {
    dom.btnNextLevel.addEventListener('click', () => {
      if (dom.dialogWon && dom.dialogWon.open) dom.dialogWon.close();
      controller.loadNextLevel();
      syncHud();
    });
  }
  if (dom.btnRetryLevel) {
    dom.btnRetryLevel.addEventListener('click', () => {
      if (dom.dialogWon && dom.dialogWon.open) dom.dialogWon.close();
      controller.restart();
      syncHud();
    });
  }
  if (dom.btnCloseWon) {
    dom.btnCloseWon.addEventListener('click', () => {
      if (dom.dialogWon && dom.dialogWon.open) dom.dialogWon.close();
    });
  }

  // 页面切后台自动静默暂停
  window.addEventListener('blur', () => {
    if (!controller.isPaused() && controller.getState().status === 'playing') {
      controller.pause();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !controller.isPaused() && controller.getState().status === 'playing') {
      controller.pause();
    }
  });

  // 主循环
  let lastTime = performance.now();
  function gameLoop(timestamp) {
    const dt = Math.min(0.08, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    controller.step(dt);
    renderer.update(dt);
    renderer.render(controller.getState());

    // 检查飞行完成后的事件
    handleEvents();

    requestAnimationFrame(gameLoop);
  }

  // 初始化
  updateI18nTexts();
  requestAnimationFrame(gameLoop);
});
