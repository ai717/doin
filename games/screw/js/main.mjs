/**
 * @file games/screw/js/main.mjs
 * 入口装配：Canvas 工坊渲染、DOM HUD、弹窗、快捷键、自动暂停与全量 i18n 热更新。
 */

import { ScrewGame } from './game.mjs';
import { ScrewRenderer, CANVAS_WIDTH, CANVAS_HEIGHT } from './ui.mjs';
import { t, getCurrentLanguage, setLanguage, htmlLang } from './i18n.mjs';
import {
  setMuted,
  unlockAudio,
  playUnscrew,
  playScrewIn,
  playBoxComplete,
  playPlateSwing,
  playPlateFall,
  playDeny,
  playMagnet,
  playWin,
  playLose,
} from './audio.mjs';
import { formatTime } from './score.mjs';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('stage-canvas');
  if (!canvas) return;

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  let currentLang = getCurrentLanguage();
  const game = new ScrewGame();
  const renderer = new ScrewRenderer(canvas);
  setMuted(!game.isSoundEnabled());

  let magnetArmed = false;
  let suppressPauseVeil = false;
  let toastTimer = null;
  let winTimer = null;
  let lastHudTime = 0;

  const dom = {
    btnLevels: document.getElementById('btn-levels'),
    btnUndo: document.getElementById('btn-undo'),
    btnMagnet: document.getElementById('btn-magnet'),
    btnRestart: document.getElementById('btn-restart'),
    btnPause: document.getElementById('btn-pause'),
    btnSound: document.getElementById('btn-sound'),
    btnHelp: document.getElementById('btn-help'),
    btnLang: document.getElementById('btn-lang'),

    hudChapter: document.getElementById('hud-chapter'),
    hudChapterSub: document.getElementById('hud-chapter-sub'),
    hudRemain: document.getElementById('hud-remain'),
    hudPlates: document.getElementById('hud-plates'),
    hudMoves: document.getElementById('hud-moves'),
    hudUndos: document.getElementById('hud-undos'),
    hudTime: document.getElementById('hud-time'),
    hudQueue: document.getElementById('hud-queue'),
    hudBuffer: document.getElementById('hud-buffer'),
    hudMagnet: document.getElementById('hud-magnet'),

    pauseVeil: document.getElementById('pause-veil'),
    btnResume: document.getElementById('btn-resume'),
    btnPauseRestart: document.getElementById('btn-pause-restart'),
    btnPauseLevels: document.getElementById('btn-pause-levels'),
    btnPauseSound: document.getElementById('btn-pause-sound'),

    dialogRules: document.getElementById('dialog-rules'),
    btnCloseRules: document.getElementById('btn-close-rules'),
    btnStartWork: document.getElementById('btn-start-work'),

    dialogLevels: document.getElementById('dialog-levels'),
    btnCloseLevels: document.getElementById('btn-close-levels'),
    levelsContent: document.getElementById('levels-content'),

    dialogWon: document.getElementById('dialog-won'),
    wonStars: document.getElementById('won-stars'),
    wonTime: document.getElementById('won-time'),
    wonMoves: document.getElementById('won-moves'),
    wonUndos: document.getElementById('won-undos'),
    wonRecord: document.getElementById('won-record'),
    btnNextLevel: document.getElementById('btn-next-level'),
    btnReplayWon: document.getElementById('btn-replay-won'),
    btnLevelsWon: document.getElementById('btn-levels-won'),
    btnCloseWon: document.getElementById('btn-close-won'),

    dialogLost: document.getElementById('dialog-lost'),
    btnUndoLost: document.getElementById('btn-undo-lost'),
    btnReplayLost: document.getElementById('btn-replay-lost'),
    btnLevelsLost: document.getElementById('btn-levels-lost'),

    toast: document.getElementById('toast'),
  };

  function showDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') {
      if (dialog.open) dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
  }

  function anyDialogOpen() {
    return Boolean(document.querySelector('dialog[open]'));
  }

  function openDialog(dialog) {
    if (!dialog) return;
    const state = game.getState();
    if (state && state.status === 'playing' && !game.isPaused()) {
      suppressPauseVeil = true;
      game.pause();
      suppressPauseVeil = false;
    }
    showDialog(dialog);
  }

  function maybeResumeFromDialog() {
    if (anyDialogOpen()) return;
    if (game.isPaused() && dom.pauseVeil && dom.pauseVeil.hidden) {
      const state = game.getState();
      if (state && state.status === 'playing') game.resume();
    }
  }

  [dom.dialogRules, dom.dialogLevels, dom.dialogWon, dom.dialogLost].forEach((dialog) => {
    if (dialog) dialog.addEventListener('close', maybeResumeFromDialog);
  });

  function showPauseVeil() {
    if (!dom.pauseVeil) return;
    dom.pauseVeil.hidden = false;
    updateHud();
  }

  function hidePauseVeil() {
    if (!dom.pauseVeil) return;
    dom.pauseVeil.hidden = true;
  }

  function showToast(key) {
    if (!dom.toast) return;
    dom.toast.textContent = t(key);
    dom.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.classList.remove('show');
    }, 1800);
  }

  function setMagnetArmed(armed) {
    const state = game.getState();
    if (armed && (!state || state.magnetUsed || state.status === 'won')) return;
    magnetArmed = Boolean(armed);
    renderer.setMagnetArmed(magnetArmed);
    if (magnetArmed) showToast('magnetToast');
    updateHud();
  }

  // ---------- 全量 i18n 原地热更新 ----------
  function updateI18nTexts() {
    document.documentElement.lang = htmlLang(currentLang);
    document.title = t('docTitle');

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const key = element.getAttribute('data-i18n');
      if (key) element.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      const key = element.getAttribute('data-i18n-aria');
      if (key) element.setAttribute('aria-label', t(key));
    });
    document.querySelectorAll('[data-i18n-content]').forEach((element) => {
      const key = element.getAttribute('data-i18n-content');
      if (key) element.setAttribute('content', t(key));
    });

    if (dom.btnLang) dom.btnLang.textContent = currentLang === 'zh' ? 'EN' : '中文';
    updateSoundLabels();
    updateHud();
    if (dom.dialogLevels && dom.dialogLevels.open) renderLevels();
  }

  function updateSoundLabels() {
    const label = game.isSoundEnabled() ? t('soundOn') : t('soundOff');
    if (dom.btnSound) dom.btnSound.textContent = label;
    if (dom.btnPauseSound) dom.btnPauseSound.textContent = label;
  }

  function updateTimer() {
    if (dom.hudTime) dom.hudTime.textContent = formatTime(game.getElapsedMs());
  }

  function updateHud() {
    const state = game.getState();
    const level = game.getLevel();
    if (!state || !level) return;
    const chapter = game.getChapter();
    const stats = game.getStats();

    if (dom.hudChapter) dom.hudChapter.textContent = chapter ? t(chapter.nameKey) : '';
    if (dom.hudChapterSub) dom.hudChapterSub.textContent = chapter ? t(chapter.subtitleKey) : '';
    if (dom.hudRemain) dom.hudRemain.textContent = String(stats.boardScrews);
    if (dom.hudPlates) dom.hudPlates.textContent = `${stats.gonePlates}/${stats.totalPlates}`;
    if (dom.hudMoves) dom.hudMoves.textContent = String(state.moves);
    if (dom.hudUndos) dom.hudUndos.textContent = String(game.getUndoCount());
    updateTimer();

    if (dom.hudBuffer) dom.hudBuffer.textContent = `${state.buffer.length}/${state.bufferCapacity}`;
    if (dom.hudMagnet) {
      if (state.magnetUsed) dom.hudMagnet.textContent = t('magnetUsed');
      else if (magnetArmed) dom.hudMagnet.textContent = t('magnetArmed');
      else dom.hudMagnet.textContent = t('magnetReady');
      dom.hudMagnet.classList.toggle('armed', magnetArmed && !state.magnetUsed);
      dom.hudMagnet.classList.toggle('used', state.magnetUsed);
    }

    if (dom.btnUndo) dom.btnUndo.disabled = !game.canUndo() || game.isPaused();
    if (dom.btnMagnet) {
      dom.btnMagnet.disabled = state.magnetUsed || state.status === 'won' || game.isPaused();
      dom.btnMagnet.classList.toggle('armed', magnetArmed);
      dom.btnMagnet.textContent = state.magnetUsed ? t('magnetUsed') : t('magnet');
    }
    if (dom.btnPause) dom.btnPause.disabled = state.status !== 'playing';
    if (dom.btnPauseRestart) dom.btnPauseRestart.disabled = false;

    renderQueue(state);
  }

  function renderQueue(state) {
    if (!dom.hudQueue) return;
    dom.hudQueue.innerHTML = '';
    const end = Math.min(state.boxes.length, state.activeBox + 4);
    if (state.activeBox >= end) {
      const empty = document.createElement('div');
      empty.className = 'queue-empty';
      empty.textContent = t('queueEmpty');
      dom.hudQueue.appendChild(empty);
      return;
    }

    for (let index = state.activeBox; index < end; index += 1) {
      const box = state.boxes[index];
      const item = document.createElement('div');
      item.className = `queue-item color-${box.color}${index === state.activeBox ? ' active' : ''}`;
      const chip = document.createElement('span');
      chip.className = `color-chip chip-${box.color}`;
      const copy = document.createElement('span');
      copy.className = 'queue-copy';
      const name = document.createElement('strong');
      name.textContent = t(`color_${box.color}`);
      const dots = document.createElement('span');
      dots.className = 'queue-dots';
      for (let i = 0; i < 3; i += 1) {
        const dot = document.createElement('i');
        if (i < box.collected) dot.className = 'filled';
        dots.appendChild(dot);
      }
      copy.appendChild(name);
      copy.appendChild(dots);
      item.appendChild(chip);
      item.appendChild(copy);
      if (index === state.activeBox) {
        const badge = document.createElement('em');
        badge.textContent = t('nowBox');
        item.appendChild(badge);
      }
      dom.hudQueue.appendChild(item);
    }
  }

  // ---------- 关卡相册 ----------
  function renderLevels() {
    if (!dom.levelsContent) return;
    dom.levelsContent.innerHTML = '';

    for (const chapter of game.chapters()) {
      const section = document.createElement('section');
      section.className = 'chapter-block';

      const heading = document.createElement('div');
      heading.className = 'chapter-heading';
      const title = document.createElement('h3');
      title.textContent = t(chapter.nameKey);
      const subtitle = document.createElement('p');
      subtitle.textContent = t(chapter.subtitleKey);
      heading.appendChild(title);
      heading.appendChild(subtitle);
      section.appendChild(heading);

      const grid = document.createElement('div');
      grid.className = 'level-grid';

      for (const levelId of chapter.levelIds) {
        const level = game.allLevels().find((item) => item.id === levelId);
        if (!level) continue;
        const unlocked = game.isLevelUnlocked(levelId);
        const record = game.getRecord(levelId);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'level-card';
        button.disabled = !unlocked;
        if (levelId === game.getLevel().id) button.classList.add('current');
        button.setAttribute('aria-label', `${t('stageWord')} ${levelId}: ${t(level.nameKey)}`);

        const number = document.createElement('span');
        number.className = 'level-num';
        number.textContent = String(levelId).padStart(2, '0');

        const name = document.createElement('span');
        name.className = 'level-name';
        name.textContent = t(level.nameKey);

        const stars = document.createElement('span');
        stars.className = 'level-stars';
        if (!unlocked) stars.textContent = '🔒';
        else if (record && record.cleared) {
          stars.textContent = `${'★'.repeat(record.stars)}${'☆'.repeat(3 - record.stars)}`;
        } else {
          stars.textContent = '☆☆☆';
        }

        const meta = document.createElement('span');
        meta.className = 'level-meta';
        if (!unlocked) meta.textContent = t('locked');
        else if (record && record.cleared) meta.textContent = formatTime(record.bestTimeMs);
        else meta.textContent = '—';

        button.appendChild(number);
        button.appendChild(name);
        button.appendChild(stars);
        button.appendChild(meta);
        button.addEventListener('click', () => {
          closeAllDialogs();
          hidePauseVeil();
          setMagnetArmed(false);
          game.loadLevel(levelId);
          renderer.resetForLevel();
          updateHud();
          renderLevels();
        });
        grid.appendChild(button);
      }

      section.appendChild(grid);
      dom.levelsContent.appendChild(section);
    }
  }

  function closeAllDialogs() {
    [dom.dialogRules, dom.dialogLevels, dom.dialogWon, dom.dialogLost].forEach((dialog) => closeDialog(dialog));
  }

  // ---------- 结算弹窗 ----------
  function showWonDialog(result) {
    if (!dom.dialogWon) return;
    const stars = Math.max(0, Math.min(3, result.stars || 0));
    if (dom.wonStars) dom.wonStars.textContent = `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`;
    if (dom.wonTime) dom.wonTime.textContent = formatTime(result.timeMs);
    if (dom.wonMoves) dom.wonMoves.textContent = String(result.moves);
    if (dom.wonUndos) dom.wonUndos.textContent = String(result.undos);

    const record = game.getRecord(game.getLevel().id);
    const next = game.nextLevelId();
    if (dom.wonRecord) {
      if (!next) dom.wonRecord.textContent = t('allClear');
      else if (record && record.bestTimeMs === result.timeMs && record.stars === result.stars) {
        dom.wonRecord.textContent = t('newRecord');
      } else if (record) {
        dom.wonRecord.textContent = `${t('bestTime')} ${formatTime(record.bestTimeMs)}`;
      } else {
        dom.wonRecord.textContent = '';
      }
    }
    if (dom.btnNextLevel) dom.btnNextLevel.hidden = !next;
    showDialog(dom.dialogWon);
  }

  function showLostDialog() {
    if (!dom.dialogLost) return;
    if (dom.btnUndoLost) dom.btnUndoLost.disabled = !game.canUndo();
    showDialog(dom.dialogLost);
  }

  // ---------- 门户战报 ----------
  function reportSession(outcome) {
    const level = game.getLevel();
    const payload = {
      slug: 'screw',
      outcome: outcome.won ? 'WON' : 'LOST',
      score: outcome.stars || 0,
      stars: outcome.stars || 0,
      levelId: level ? level.id : 0,
      timeMs: outcome.timeMs || 0,
      timestamp: Date.now(),
    };
    try {
      const meta = JSON.parse(localStorage.getItem('doin.meta.v1') || '{}');
      meta.recentlyPlayed = [payload.slug, ...((meta.recentlyPlayed || []).filter((slug) => slug !== payload.slug))].slice(0, 8);
      if (payload.outcome === 'WON') meta.totalStars = (meta.totalStars || 0) + payload.stars;
      localStorage.setItem('doin.meta.v1', JSON.stringify(meta));
    } catch (err) {
      // 隐私模式下静默跳过
    }
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'DOIN_GAME_EVENT', payload }, '*');
      }
    } catch (err) {
      // ignore
    }
  }

  function playArrivalSound(delay = 140) {
    setTimeout(() => playScrewIn(), delay);
  }

  // ---------- 游戏事件 ----------
  game.subscribe((event, controller) => {
    if (event.type === 'loaded') {
      renderer.resetForLevel();
      setMagnetArmed(false);
      hidePauseVeil();
      updateHud();
    } else if (event.type === 'state') {
      updateHud();
    } else if (event.type === 'paused') {
      if (!suppressPauseVeil) showPauseVeil();
    } else if (event.type === 'resumed') {
      hidePauseVeil();
      updateHud();
    } else if (event.type === 'undo') {
      renderer.resetForLevel();
      closeDialog(dom.dialogLost);
      updateHud();
    } else if (event.type === 'screw_boxed') {
      renderer.handleEvent(event, controller);
      playArrivalSound(140);
    } else if (event.type === 'screw_buffered') {
      renderer.handleEvent(event, controller);
      playArrivalSound(140);
    } else if (event.type === 'buffer_inflow') {
      renderer.handleEvent(event, controller);
      playArrivalSound(80);
    } else if (event.type === 'box_complete') {
      renderer.handleEvent(event, controller);
      playBoxComplete();
    } else if (event.type === 'plate_swing') {
      renderer.handleEvent(event, controller);
      playPlateSwing();
    } else if (event.type === 'plate_fall') {
      renderer.handleEvent(event, controller);
      playPlateFall();
    } else if (event.type === 'magnet_used') {
      renderer.handleEvent(event, controller);
      setMagnetArmed(false);
      playMagnet();
    } else if (event.type === 'blocked') {
      playDeny();
      renderer.triggerDeny(event.screwId);
      showToast(event.reason === 'covered' ? 'lockedScrew' : 'bufferFull');
    } else if (event.type === 'won') {
      playWin();
      renderer.triggerWin();
      reportSession({ won: true, stars: event.stars, timeMs: event.timeMs });
      if (winTimer) clearTimeout(winTimer);
      winTimer = setTimeout(() => showWonDialog(event), 480);
      updateHud();
    } else if (event.type === 'lost') {
      playLose();
      renderer.triggerLose();
      reportSession({ won: false, timeMs: event.timeMs });
      const state = controller.getState();
      const canRescue = state && !state.magnetUsed && controller.accessibleScrews().length > 0;
      if (winTimer) clearTimeout(winTimer);
      if (canRescue) {
        showToast('jamMagnet');
        updateHud();
      } else {
        winTimer = setTimeout(() => showLostDialog(), 280);
        updateHud();
      }
    } else if (event.type === 'sound') {
      updateSoundLabels();
    }
  });

  // ---------- 指针操作 ----------
  function handlePointerDown(event) {
    event.preventDefault();
    unlockAudio();
    const state = game.getState();
    if (!state || state.status === 'won' || game.isPaused()) return;
    if (state.status === 'lost' && !magnetArmed) return;

    const hit = renderer.hitTest(event.clientX, event.clientY, game);
    if (magnetArmed) {
      if (!hit) {
        setMagnetArmed(false);
        showToast('magnetCancel');
        return;
      }
      if (!hit.accessible) {
        playDeny();
        renderer.triggerDeny(hit.screw.id);
        showToast('lockedScrew');
        return;
      }
      const action = game.magnet(hit.screw.id);
      if (!action) {
        playDeny();
        showToast('magnetEmpty');
      }
      return;
    }

    if (!hit) return;
    if (!hit.accessible) {
      playDeny();
      renderer.triggerDeny(hit.screw.id);
      showToast('lockedScrew');
      return;
    }
    if (!game.canUnscrew(hit.screw.id)) {
      playDeny();
      renderer.triggerDeny(hit.screw.id);
      showToast('bufferFull');
      return;
    }
    playUnscrew();
    const action = game.unscrew(hit.screw.id);
    if (!action) {
      playDeny();
      renderer.triggerDeny(hit.screw.id);
      showToast('bufferFull');
    }
  }

  function handlePointerMove(event) {
    if (game.isPaused()) {
      canvas.style.cursor = 'default';
      return;
    }
    const state = game.getState();
    if (!state || state.status === 'won') {
      canvas.style.cursor = 'default';
      return;
    }
    const hit = renderer.hitTest(event.clientX, event.clientY, game);
    if (magnetArmed) canvas.style.cursor = hit && hit.accessible ? 'crosshair' : 'default';
    else if (state.status === 'lost') canvas.style.cursor = 'default';
    else canvas.style.cursor = hit && hit.accessible ? 'pointer' : 'default';
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerleave', () => {
    canvas.style.cursor = 'default';
  });

  // ---------- 工具栏 ----------
  if (dom.btnHelp) {
    dom.btnHelp.addEventListener('click', () => openDialog(dom.dialogRules));
  }
  if (dom.btnCloseRules) {
    dom.btnCloseRules.addEventListener('click', () => closeDialog(dom.dialogRules));
  }
  if (dom.btnStartWork) {
    dom.btnStartWork.addEventListener('click', () => closeDialog(dom.dialogRules));
  }

  if (dom.btnLevels) {
    dom.btnLevels.addEventListener('click', () => {
      renderLevels();
      openDialog(dom.dialogLevels);
    });
  }
  if (dom.btnCloseLevels) {
    dom.btnCloseLevels.addEventListener('click', () => closeDialog(dom.dialogLevels));
  }
  if (dom.btnPauseLevels) {
    dom.btnPauseLevels.addEventListener('click', () => {
      renderLevels();
      showDialog(dom.dialogLevels);
    });
  }

  if (dom.btnUndo) {
    dom.btnUndo.addEventListener('click', () => {
      if (game.undo()) {
        renderer.resetForLevel();
        updateHud();
      }
    });
  }
  if (dom.btnUndoLost) {
    dom.btnUndoLost.addEventListener('click', () => {
      closeDialog(dom.dialogLost);
      if (game.undo()) {
        renderer.resetForLevel();
        updateHud();
      }
    });
  }

  if (dom.btnRestart) {
    dom.btnRestart.addEventListener('click', () => {
      closeAllDialogs();
      hidePauseVeil();
      game.restart();
      renderer.resetForLevel();
      updateHud();
    });
  }
  if (dom.btnPauseRestart) {
    dom.btnPauseRestart.addEventListener('click', () => {
      hidePauseVeil();
      game.resume();
      game.restart();
      renderer.resetForLevel();
      updateHud();
    });
  }
  if (dom.btnReplayWon) {
    dom.btnReplayWon.addEventListener('click', () => {
      closeDialog(dom.dialogWon);
      game.restart();
      renderer.resetForLevel();
      updateHud();
    });
  }
  if (dom.btnReplayLost) {
    dom.btnReplayLost.addEventListener('click', () => {
      closeDialog(dom.dialogLost);
      game.restart();
      renderer.resetForLevel();
      updateHud();
    });
  }

  if (dom.btnNextLevel) {
    dom.btnNextLevel.addEventListener('click', () => {
      closeDialog(dom.dialogWon);
      const next = game.nextLevelId();
      if (next) {
        game.loadLevel(next);
        renderer.resetForLevel();
        updateHud();
      }
    });
  }

  if (dom.btnLevelsWon) {
    dom.btnLevelsWon.addEventListener('click', () => {
      closeDialog(dom.dialogWon);
      renderLevels();
      showDialog(dom.dialogLevels);
    });
  }
  if (dom.btnLevelsLost) {
    dom.btnLevelsLost.addEventListener('click', () => {
      closeDialog(dom.dialogLost);
      renderLevels();
      showDialog(dom.dialogLevels);
    });
  }
  if (dom.btnCloseWon) {
    dom.btnCloseWon.addEventListener('click', () => closeDialog(dom.dialogWon));
  }

  if (dom.btnMagnet) {
    dom.btnMagnet.addEventListener('click', () => {
      const state = game.getState();
      if (!state || state.magnetUsed || state.status === 'won') return;
      setMagnetArmed(!magnetArmed);
    });
  }

  if (dom.btnPause) {
    dom.btnPause.addEventListener('click', () => {
      const state = game.getState();
      if (!state || state.status !== 'playing') return;
      if (game.isPaused()) game.resume();
      else game.pause();
    });
  }
  if (dom.btnResume) {
    dom.btnResume.addEventListener('click', () => game.resume());
  }

  if (dom.btnSound) {
    dom.btnSound.addEventListener('click', () => {
      game.setSoundEnabled(!game.isSoundEnabled());
      setMuted(!game.isSoundEnabled());
      updateSoundLabels();
    });
  }
  if (dom.btnPauseSound) {
    dom.btnPauseSound.addEventListener('click', () => {
      game.setSoundEnabled(!game.isSoundEnabled());
      setMuted(!game.isSoundEnabled());
      updateSoundLabels();
    });
  }

  if (dom.btnLang) {
    dom.btnLang.addEventListener('click', () => {
      currentLang = currentLang === 'zh' ? 'en' : 'zh';
      setLanguage(currentLang);
      updateI18nTexts();
    });
  }

  // ---------- 快捷键 ----------
  window.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const state = game.getState();
    if (!state) return;

    if (event.key === 'Escape') {
      if (anyDialogOpen()) return;
      if (!dom.pauseVeil.hidden) {
        event.preventDefault();
        game.resume();
      } else if (state.status === 'playing') {
        event.preventDefault();
        game.pause();
      }
      return;
    }

    if (event.key === 'p' || event.key === 'P') {
      if (state.status === 'playing' && !anyDialogOpen()) {
        event.preventDefault();
        game.togglePause();
      }
      return;
    }
    if (event.key === 'z' || event.key === 'Z') {
      event.preventDefault();
      if (game.isPaused()) return;
      if (game.undo()) {
        renderer.resetForLevel();
        updateHud();
      }
      return;
    }
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      closeAllDialogs();
      hidePauseVeil();
      game.restart();
      renderer.resetForLevel();
      updateHud();
      return;
    }
    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      if (game.isPaused()) return;
      if (state.status !== 'won' && !state.magnetUsed) setMagnetArmed(!magnetArmed);
    }
  });

  // ---------- 失焦自动暂停 ----------
  function autoPause() {
    const state = game.getState();
    if (!state || state.status !== 'playing' || game.isPaused()) return;
    if (magnetArmed) setMagnetArmed(false);
    game.pause();
  }
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoPause();
  });

  // ---------- 主循环 ----------
  let lastFrame = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;

    if (!document.hidden) {
      if (!game.isPaused()) renderer.update(dt);
      renderer.render(game);
    }

    if (now - lastHudTime > 240) {
      updateTimer();
      lastHudTime = now;
    }
    requestAnimationFrame(loop);
  }

  // ---------- 初始化 ----------
  renderer.resetForLevel();
  updateI18nTexts();
  updateHud();
  requestAnimationFrame(loop);
});
