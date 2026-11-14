/**
 * @file games/sleepwalker/js/main.mjs
 * 入口装配中心，绑定事件、协调物理时钟与微缩剧场渲染。
 */

import { GameController } from './game.mjs';
import { DioramaRenderer } from './ui.mjs';
import { STAGE_WIDTH, STAGE_HEIGHT } from './engine.mjs';
import { getLanguage, setLanguage, applyI18nToDOM, t } from './i18n.mjs';
import {
  setSoundEnabled,
  isSoundEnabled,
  playStepSound,
  playGadgetClickSound,
  playBounceSound,
  playBubbleSound,
  playScareSound,
  playSnoreSound,
  playRewindSound,
  playWinSound,
} from './audio.mjs';
import { calculateStars, calculateTotalSummary } from './score.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('stage');
  if (!canvas) return;

  const controller = new GameController();
  const renderer = new DioramaRenderer(canvas);

  // 初始化音效开关状态
  const initialSound = controller.storage.sound ?? true;
  setSoundEnabled(initialSound);
  updateSoundUI(initialSound);

  // 初始化多语言静态覆盖
  const currentLang = getLanguage();
  applyI18nToDOM(currentLang);
  renderer.setLanguage(currentLang);
  updateHUD(controller.getState(), controller.getLevel());

  // 首屏游戏玩法提示气泡
  setTimeout(() => {
    showToast(t('hud.tutorialStart', getLanguage()));
  }, 400);

  // 1. 视窗缩放与高清屏适配
  window.addEventListener('resize', () => {
    renderer.setupResolution();
  });

  // 2. 音频与瞬态事件协调
  let lastStepSoundTime = 0;
  controller.onEvent((ev) => {
    switch (ev.type) {
      case 'gadget_click':
        playGadgetClickSound();
        break;
      case 'bounce':
        playBounceSound();
        break;
      case 'bubble':
        playBubbleSound();
        showToast('+1 ★ Dream Bubble');
        break;
      case 'scare':
        playScareSound();
        break;
      case 'rewind':
        playRewindSound();
        renderer.triggerRewindEffect();
        showToast('<< REWIND 5s');
        break;
      case 'level_won':
        playWinSound();
        playSnoreSound();
        renderer.spawnConfetti(STAGE_WIDTH - 100, 320);
        setTimeout(() => {
          showWinModal(ev);
        }, 600);
        break;
      case 'level_lost':
        setTimeout(() => {
          showFailModal(ev);
        }, 800);
        break;
    }
  });

  // 3. 画布坐标转换与交互
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (STAGE_WIDTH / rect.width);
    const y = (clientY - rect.top) * (STAGE_HEIGHT / rect.height);
    return { x, y };
  }

  canvas.addEventListener('click', (e) => {
    if (controller.isPaused()) {
      controller.setPaused(false);
      updatePauseUI(false);
      return;
    }
    const { x, y } = getCanvasCoords(e);
    controller.clickAt(x, y);
  });

  canvas.addEventListener('mousemove', (e) => {
    const { x, y } = getCanvasCoords(e);
    const state = controller.getState();
    let hovered = null;
    for (const id in state.gadgets) {
      const g = state.gadgets[id];
      if (x >= g.x - 12 && x <= g.x + g.w + 12 && y >= g.y - 12 && y <= g.y + g.h + 12) {
        hovered = g.id;
        break;
      }
    }
    renderer.setHoveredGadget(hovered);
    canvas.style.cursor = hovered ? 'pointer' : 'default';
  });

  canvas.addEventListener('mouseleave', () => {
    renderer.setHoveredGadget(null);
  });

  // 4. 控制台按钮事件
  const btnRewind = document.getElementById('btn-rewind');
  const btnRestart = document.getElementById('btn-restart');
  const btnFast = document.getElementById('btn-fast');
  const btnPause = document.getElementById('btn-pause');
  const btnLevels = document.getElementById('btn-levels');
  const btnLang = document.getElementById('btn-lang');
  const btnSound = document.getElementById('btn-sound');
  const btnHelp = document.getElementById('btn-help');

  btnRewind?.addEventListener('click', () => {
    controller.rewind(5);
    updatePauseUI(false);
    closeModals();
  });

  btnRestart?.addEventListener('click', () => {
    controller.restartLevel();
    updatePauseUI(false);
    closeModals();
  });

  btnFast?.addEventListener('click', () => {
    const isFast = controller.toggleFastForward();
    btnFast.setAttribute('aria-pressed', String(isFast));
  });

  btnPause?.addEventListener('click', () => {
    const p = controller.togglePause();
    updatePauseUI(p);
  });

  btnLevels?.addEventListener('click', () => {
    openLevelsModal();
  });

  btnLang?.addEventListener('click', () => {
    const current = getLanguage();
    const next = current === 'zh' ? 'en' : 'zh';
    setLanguage(next);
    applyI18nToDOM(next);
    renderer.setLanguage(next);
    updateHUD(controller.getState(), controller.getLevel());
    updatePauseUI(controller.isPaused());
  });

  btnSound?.addEventListener('click', () => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    controller.storage.sound = next;
    updateSoundUI(next);
  });

  btnHelp?.addEventListener('click', () => {
    const modal = document.getElementById('modal-help');
    modal?.showModal();
  });

  // 5. 键盘快捷键 (Space, Z, R, P)
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Space') {
      controller.setFastForward(true);
      btnFast?.setAttribute('aria-pressed', 'true');
      e.preventDefault();
    } else if (e.code === 'KeyZ') {
      controller.rewind(5);
      updatePauseUI(false);
      closeModals();
      e.preventDefault();
    } else if (e.code === 'KeyR') {
      controller.restartLevel();
      updatePauseUI(false);
      closeModals();
      e.preventDefault();
    } else if (e.code === 'KeyP') {
      const p = controller.togglePause();
      updatePauseUI(p);
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      if (!controller.storage.fastSpeed) {
        controller.setFastForward(false);
        btnFast?.setAttribute('aria-pressed', 'false');
      }
    }
  });

  // 6. 弹窗内部交互
  const modalWin = document.getElementById('modal-win');
  const modalFail = document.getElementById('modal-fail');
  const modalLevels = document.getElementById('modal-levels');

  document.getElementById('btn-win-next')?.addEventListener('click', () => {
    modalWin?.close();
    controller.nextLevel();
    updatePauseUI(false);
    updateHUD(controller.getState(), controller.getLevel());
  });

  document.getElementById('btn-win-replay')?.addEventListener('click', () => {
    modalWin?.close();
    controller.restartLevel();
    updatePauseUI(false);
  });

  document.getElementById('btn-win-levels')?.addEventListener('click', () => {
    modalWin?.close();
    openLevelsModal();
  });

  document.getElementById('btn-fail-rewind')?.addEventListener('click', () => {
    modalFail?.close();
    controller.rewind(5);
    updatePauseUI(false);
  });

  document.getElementById('btn-fail-restart')?.addEventListener('click', () => {
    modalFail?.close();
    controller.restartLevel();
    updatePauseUI(false);
  });

  document.getElementById('btn-fail-levels')?.addEventListener('click', () => {
    modalFail?.close();
    openLevelsModal();
  });

  function closeModals() {
    modalWin?.close();
    modalFail?.close();
  }

  function showWinModal(ev) {
    const starResult = calculateStars(controller.getState());
    const star1Row = document.getElementById('win-star-1');
    const star2Row = document.getElementById('win-star-2');
    const star3Row = document.getElementById('win-star-3');

    star1Row?.classList.toggle('achieved', starResult.star1);
    star2Row?.classList.toggle('achieved', starResult.star2);
    star3Row?.classList.toggle('achieved', starResult.star3);

    const timeValEl = document.getElementById('win-time-val');
    if (timeValEl) {
      timeValEl.textContent = `${(ev.time || 0).toFixed(1)}s`;
    }

    modalWin?.showModal();
  }

  function showFailModal(ev) {
    modalFail?.showModal();
  }

  function openLevelsModal() {
    const grid = document.getElementById('levels-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const unlocked = controller.storage.unlockedLevel || 1;
    const lang = getLanguage();

    const summary = calculateTotalSummary(controller.storage);
    const summaryBadge = document.getElementById('levels-summary-badge');
    if (summaryBadge) {
      summaryBadge.textContent = `${summary.totalStars} / ${summary.maxStars} ★`;
    }

    for (let i = 1; i <= controller.totalLevels; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-card-btn';
      if (i === controller.currentLevel.id) {
        btn.classList.add('current');
      }

      const isLocked = (i > unlocked);
      btn.disabled = isLocked;

      const starsCount = controller.storage.stars[i] || 0;
      let starIcons = '☆☆☆';
      if (starsCount === 1) starIcons = '★☆☆';
      if (starsCount === 2) starIcons = '★★☆';
      if (starsCount === 3) starIcons = '★★★';

      const levelTitle = t(`levelNames.level_${i}`, lang);

      btn.innerHTML = `
        <span class="level-card-num">${i}</span>
        <span class="level-card-stars">${isLocked ? '🔒' : starIcons}</span>
        <span class="level-card-title">${isLocked ? '—' : levelTitle}</span>
      `;

      btn.addEventListener('click', () => {
        controller.loadLevel(i);
        modalLevels?.close();
        updateHUD(controller.getState(), controller.getLevel());
      });

      grid.appendChild(btn);
    }

    modalLevels?.showModal();
  }

  function showToast(text) {
    const toast = document.getElementById('stage-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.hidden = true;
    }, 1500);
  }

  function updateSoundUI(on) {
    const btn = document.getElementById('btn-sound');
    const icon = document.getElementById('sound-icon');
    if (btn) btn.setAttribute('aria-pressed', String(on));
    if (icon) icon.textContent = on ? '🔊' : '🔇';
  }

  function updatePauseUI(paused) {
    const btn = document.getElementById('btn-pause');
    const icon = document.getElementById('pause-icon');
    const text = document.getElementById('pause-text');
    const lang = getLanguage();
    if (btn) btn.setAttribute('aria-pressed', String(paused));
    if (icon) icon.textContent = paused ? '▶' : '⏸';
    if (text) text.textContent = paused ? t('btns.resume', lang) : t('btns.pause', lang);
  }

  function updateHUD(state, level) {
    const lang = getLanguage();
    const chapterNames = [
      '',
      t('chapters.act1', lang),
      t('chapters.act2', lang),
      t('chapters.act3', lang),
      t('chapters.act4', lang),
      t('chapters.act5', lang),
    ];

    const actBadge = document.getElementById('hud-chapter-badge');
    if (actBadge) actBadge.textContent = `Act ${level.act}`;

    const levelNameEl = document.getElementById('hud-level-name');
    if (levelNameEl) levelNameEl.textContent = t(`levelNames.${level.key}`, lang);

    const stageNumEl = document.getElementById('hud-stage-num');
    if (stageNumEl) stageNumEl.textContent = `Stage ${level.id} / ${controller.totalLevels}`;

    const bpmValEl = document.getElementById('hud-bpm-val');
    if (bpmValEl) bpmValEl.textContent = Math.round(state.heartRate);

    const bpmTextEl = document.getElementById('hud-bpm-text');
    if (bpmTextEl) {
      if (state.heartRate >= 140) {
        bpmTextEl.textContent = t('hud.bpmPanic', lang);
        bpmTextEl.style.color = 'var(--danger-color)';
      } else if (state.heartRate >= 100) {
        bpmTextEl.textContent = t('hud.bpmHigh', lang);
        bpmTextEl.style.color = 'var(--gold-primary)';
      } else {
        bpmTextEl.textContent = t('hud.bpmNormal', lang);
        bpmTextEl.style.color = 'var(--success-color)';
      }
    }

    const bubblesSlot = document.getElementById('hud-bubbles-slot');
    if (bubblesSlot) {
      const icons = bubblesSlot.querySelectorAll('.bubble-icon');
      state.bubbles.forEach((b, idx) => {
        if (icons[idx]) {
          icons[idx].classList.toggle('active', b.collected);
        }
      });
    }

    const bubblesCountEl = document.getElementById('hud-bubbles-count');
    if (bubblesCountEl) {
      const collected = state.bubbles.filter((b) => b.collected).length;
      bubblesCountEl.textContent = `${collected} / 3`;
    }

    // 更新机关列表
    const gadgetsList = document.getElementById('hud-gadgets-list');
    const gadgetsCount = document.getElementById('hud-gadgets-count');
    if (gadgetsList) {
      const gKeys = Object.keys(state.gadgets);
      if (gadgetsCount) gadgetsCount.textContent = String(gKeys.length);
      gadgetsList.innerHTML = '';
      gKeys.slice(0, 4).forEach((k) => {
        const g = state.gadgets[k];
        const li = document.createElement('li');
        li.innerHTML = `<span class="status-dot ${g.active ? 'active' : ''}"></span><span>${g.id.replace('g_', '')}</span>`;
        gadgetsList.appendChild(li);
      });
    }
  }

  // 7. 主渲染与物理时钟循环
  let lastTime = performance.now();

  function loop(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    // 推进状态机
    controller.step(dt);
    const state = controller.getState();

    // 绘制剧场
    renderer.render(state, dt);

    // 周期性轻声脚步声
    if (state.walker.state === 'walk' && now - lastStepSoundTime > 320) {
      playStepSound();
      lastStepSoundTime = now;
    }

    // 更新 HUD
    updateHUD(state, controller.getLevel());

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
