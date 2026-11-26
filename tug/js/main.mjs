/**
 * @file games/tug/js/main.mjs
 * 装配入口中心。绑定键盘 A/L 与触屏、协调 WebAudio 音色、管理倒计时与原地热更新。
 */

import { GameController } from './game.mjs';
import { ArenaRenderer } from './ui.mjs';
import { getLanguage, setLanguage, applyI18nToDOM, t } from './i18n.mjs';
import {
  setSoundEnabled,
  isSoundEnabled,
  playWhistleSound,
  playPullSound,
  playPerfectSound,
  playRopeStrainSound,
  playFootSkidSound,
  playMudSplashSound,
  playWinSound,
} from './audio.mjs';
import { calculateStars, calculateTotalSummary } from './score.mjs';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('stage');
  if (!canvas) return;

  const controller = new GameController();
  const renderer = new ArenaRenderer(canvas);

  // 初始化音效开关
  const initialSound = controller.storage.sound ?? true;
  setSoundEnabled(initialSound);
  updateSoundUI(initialSound);

  // 初始化多语言
  const currentLang = getLanguage();
  applyI18nToDOM(currentLang);
  renderer.setLanguage(currentLang);
  updateUI(controller.getState(), controller.getLevel());

  // 视窗缩放适配
  window.addEventListener('resize', () => {
    renderer.setupResolution();
  });

  // 1. 物理事件与音效协调
  let lastRopeCreakTime = 0;
  let lastSkidSoundTime = 0;

  controller.onEvent((ev) => {
    switch (ev.type) {
      case 'whistle_go':
        playWhistleSound();
        break;
      case 'pull_tap':
        playPullSound(ev.side === 'red');
        if (ev.isPerfect) {
          playPerfectSound();
          const ropeCenter = 400 + controller.getState().ropeX;
          const x = ev.side === 'red' ? ropeCenter - 180 : ropeCenter + 180;
          renderer.spawnSparks(x, 290, ev.side === 'red');
        }
        break;
      case 'round_win':
        playMudSplashSound();
        renderer.spawnMudSplash(400, 320);
        break;
      case 'match_win':
        playWinSound();
        setTimeout(() => {
          showMatchResultModal(true);
        }, 1200);
        break;
      case 'match_lost':
        setTimeout(() => {
          showMatchResultModal(false);
        }, 1200);
        break;
    }
  });

  // 2. 键盘控制 (A/W / L/K/ArrowRight / P / R / Space)
  const btnPullRed = document.getElementById('btn-pull-red');
  const btnPullBlue = document.getElementById('btn-pull-blue');

  function isRedKey(e) {
    return e.code === 'KeyA' || e.key === 'a' || e.key === 'A' ||
           e.code === 'KeyW' || e.key === 'w' || e.key === 'W';
  }

  function isBlueKey(e) {
    return e.code === 'KeyL' || e.key === 'l' || e.key === 'L' ||
           e.code === 'KeyK' || e.key === 'k' || e.key === 'K' ||
           e.code === 'ArrowRight' || e.code === 'ArrowUp';
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) {
      if (isRedKey(e) || isBlueKey(e) || e.code === 'Space') {
        e.preventDefault();
      }
      return;
    }

    if (isRedKey(e)) {
      controller.pullRed();
      animatePress(btnPullRed);
      e.preventDefault();
    } else if (isBlueKey(e)) {
      if (controller.mode === '2p') {
        controller.pullBlue();
        animatePress(btnPullBlue);
      } else {
        showToast(t('hud.hintMode1p', getLanguage()));
      }
      e.preventDefault();
    } else if (e.code === 'KeyP') {
      const paused = controller.togglePause();
      updatePauseUI(paused);
      e.preventDefault();
    } else if (e.code === 'KeyR') {
      controller.restartMatch();
      updatePauseUI(false);
      closeModals();
      e.preventDefault();
    }
  });

  function animatePress(btn) {
    if (!btn) return;
    btn.classList.add('pressed');
    setTimeout(() => {
      btn.classList.remove('pressed');
    }, 60);
  }

  function showToast(text) {
    const toast = document.getElementById('stage-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }

  // 3. 触屏与点击拉力按钮绑定
  btnPullRed?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    controller.pullRed();
    animatePress(btnPullRed);
  });

  btnPullBlue?.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (controller.mode === '2p') {
      controller.pullBlue();
      animatePress(btnPullBlue);
    } else {
      showToast(t('hud.hintMode1p', getLanguage()));
    }
  });

  // 4. 顶栏与控制底座按钮
  const btnMode = document.getElementById('btn-mode');
  const btnPause = document.getElementById('btn-pause');
  const btnRestart = document.getElementById('btn-restart');
  const btnLevels = document.getElementById('btn-levels');
  const btnLang = document.getElementById('btn-lang');
  const btnSound = document.getElementById('btn-sound');
  const btnHelp = document.getElementById('btn-help');

  btnMode?.addEventListener('click', () => {
    const nextMode = controller.mode === '1p' ? '2p' : '1p';
    controller.setMode(nextMode);
    updateModeUI(nextMode);
    updateUI(controller.getState(), controller.getLevel());
  });

  btnPause?.addEventListener('click', () => {
    const paused = controller.togglePause();
    updatePauseUI(paused);
  });

  canvas.addEventListener('click', () => {
    if (controller.isPaused()) {
      controller.setPaused(false);
      updatePauseUI(false);
    }
  });

  btnRestart?.addEventListener('click', () => {
    controller.restartMatch();
    updatePauseUI(false);
    closeModals();
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
    updateUI(controller.getState(), controller.getLevel());
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

  // 5. 切后台与失焦自动暂停保护
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && controller.getState().status === 'pulling') {
      controller.setPaused(true);
      updatePauseUI(true);
    }
  });

  window.addEventListener('blur', () => {
    if (controller.getState().status === 'pulling') {
      controller.setPaused(true);
      updatePauseUI(true);
    }
  });

  // 6. 弹窗交互
  const modalWin = document.getElementById('modal-win');
  const modalLevels = document.getElementById('modal-levels');

  document.getElementById('btn-win-next')?.addEventListener('click', () => {
    modalWin?.close();
    if (controller.mode === '1p') {
      controller.nextLevel();
    } else {
      controller.restartMatch();
    }
    updatePauseUI(false);
    updateUI(controller.getState(), controller.getLevel());
  });

  document.getElementById('btn-win-replay')?.addEventListener('click', () => {
    modalWin?.close();
    controller.restartMatch();
    updatePauseUI(false);
  });

  document.getElementById('btn-win-levels')?.addEventListener('click', () => {
    modalWin?.close();
    openLevelsModal();
  });

  function closeModals() {
    modalWin?.close();
    modalLevels?.close();
  }

  function showMatchResultModal(isRedWin) {
    const lang = getLanguage();
    const titleEl = document.getElementById('win-title');
    const subtitleEl = document.getElementById('win-subtitle');
    const starsWrap = document.getElementById('win-stars-wrap');
    const nextBtn = document.getElementById('btn-win-next');

    if (controller.mode === '1p') {
      if (starsWrap) starsWrap.hidden = false;
      if (nextBtn) nextBtn.textContent = t('btns.next', lang);

      if (isRedWin) {
        if (titleEl) {
          titleEl.textContent = t('win.titleSingleWin', lang);
          titleEl.style.color = 'var(--gold-primary)';
        }
        if (subtitleEl) subtitleEl.textContent = t('win.subtitleRed', lang);

        const stars = calculateStars(controller.getState());
        document.getElementById('win-star-1')?.classList.toggle('achieved', stars.star1);
        document.getElementById('win-star-2')?.classList.toggle('achieved', stars.star2);
        document.getElementById('win-star-3')?.classList.toggle('achieved', stars.star3);
      } else {
        if (titleEl) {
          titleEl.textContent = t('win.titleSingleFail', lang);
          titleEl.style.color = 'var(--red-team)';
        }
        if (subtitleEl) subtitleEl.textContent = t('win.subtitleBlue', lang);
        document.getElementById('win-star-1')?.classList.remove('achieved');
        document.getElementById('win-star-2')?.classList.remove('achieved');
        document.getElementById('win-star-3')?.classList.remove('achieved');
      }
    } else {
      // 2P 双人对决模式
      if (starsWrap) starsWrap.hidden = true;
      if (nextBtn) nextBtn.textContent = t('btns.retry', lang);

      if (isRedWin) {
        if (titleEl) {
          titleEl.textContent = t('win.titleRed', lang);
          titleEl.style.color = 'var(--red-team)';
        }
        if (subtitleEl) subtitleEl.textContent = t('win.subtitleRed', lang);
      } else {
        if (titleEl) {
          titleEl.textContent = t('win.titleBlue', lang);
          titleEl.style.color = 'var(--blue-team)';
        }
        if (subtitleEl) subtitleEl.textContent = t('win.subtitleBlue', lang);
      }
    }

    modalWin?.showModal();
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
        updateUI(controller.getState(), controller.getLevel());
      });

      grid.appendChild(btn);
    }

    modalLevels?.showModal();
  }

  // 7. UI 状态渲染同步
  function updateModeUI(mode) {
    const modeText = document.getElementById('mode-text');
    const nameBlue = document.getElementById('name-blue');
    const blueKeyHint = document.getElementById('blue-key-hint');
    const btnLevels = document.getElementById('btn-levels');
    const lang = getLanguage();

    if (mode === '1p') {
      if (modeText) modeText.textContent = t('modes.single', lang);
      if (blueKeyHint) blueKeyHint.textContent = 'AI';
      if (btnLevels) btnLevels.style.display = 'inline-flex';
    } else {
      if (modeText) modeText.textContent = t('modes.versus', lang);
      if (nameBlue) nameBlue.textContent = 'Player 2';
      if (blueKeyHint) blueKeyHint.textContent = '[L]';
      if (btnLevels) btnLevels.style.display = 'none';
    }
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

  function updateUI(state, level) {
    const lang = getLanguage();

    // 更新标题与关卡描述
    const stageTitleEl = document.getElementById('stage-act-title');
    const nameBlue = document.getElementById('name-blue');

    if (controller.mode === '1p') {
      const levelTitle = t(`levelNames.${level.key}`, lang);
      if (stageTitleEl) {
        stageTitleEl.textContent = `Stage ${level.id}: ${levelTitle}`;
      }
      if (nameBlue) {
        nameBlue.textContent = t(`aiNames.${level.aiNameKey}`, lang);
      }
    } else {
      if (stageTitleEl) {
        stageTitleEl.textContent = t('modes.versus', lang);
      }
      if (nameBlue) {
        nameBlue.textContent = 'Player 2';
      }
    }

    // 局数指示
    const roundDescEl = document.getElementById('stage-round-desc');
    if (roundDescEl) {
      roundDescEl.textContent = `BO3 · ${t('hud.round', lang)} ${state.round} ${t('hud.roundUnit', lang)}`;
    }

    // 比分与 BO3 状态灯
    const scoreRedEl = document.getElementById('score-red-val');
    const scoreBlueEl = document.getElementById('score-blue-val');
    if (scoreRedEl) scoreRedEl.textContent = String(state.scores.red);
    if (scoreBlueEl) scoreBlueEl.textContent = String(state.scores.blue);

    const dotR1 = document.getElementById('dot-r1');
    const dotR2 = document.getElementById('dot-r2');
    const dotB1 = document.getElementById('dot-b1');
    const dotB2 = document.getElementById('dot-b2');

    dotR1?.classList.toggle('red-won', state.scores.red >= 1);
    dotR2?.classList.toggle('red-won', state.scores.red >= 2);
    dotB1?.classList.toggle('blue-won', state.scores.blue >= 1);
    dotB2?.classList.toggle('blue-won', state.scores.blue >= 2);

    // 实时 CPS
    const cpsRedEl = document.getElementById('cps-red-val');
    const cpsBlueEl = document.getElementById('cps-blue-val');
    if (cpsRedEl) cpsRedEl.textContent = state.stats.redCps.toFixed(1);
    if (cpsBlueEl) cpsBlueEl.textContent = state.stats.blueCps.toFixed(1);

    // 暴击数
    const perfRedEl = document.getElementById('perfect-red-val');
    const perfBlueEl = document.getElementById('perfect-blue-val');
    if (perfRedEl) perfRedEl.textContent = String(state.stats.redPerfects);
    if (perfBlueEl) perfBlueEl.textContent = String(state.stats.bluePerfects);
  }

  // 8. 主物理与动画时钟循环
  let lastTime = performance.now();

  function loop(now) {
    const rawDt = (now - lastTime) / 1000;
    lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    // 推进物理与状态机
    controller.step(dt);
    const state = controller.getState();

    // 绘制主竞技舞台
    renderer.render(state, dt);

    // 暂停时绘制遮罩
    if (controller.isPaused()) {
      renderer.drawPauseOverlay(renderer.ctx);
    }

    // 麻绳与滑步轻声
    if (state.status === 'pulling') {
      if (state.tension > 0.8 && now - lastRopeCreakTime > 900) {
        playRopeStrainSound();
        lastRopeCreakTime = now;
      }
      if (Math.abs(state.ropeV) > 40 && now - lastSkidSoundTime > 300) {
        playFootSkidSound();
        lastSkidSoundTime = now;
      }
    }

    // 刷新仪表
    updateUI(state, controller.getLevel());

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});
