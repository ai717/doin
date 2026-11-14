/* filepath: games/one-line/js/main.mjs */
import { loadLocale, saveLocale } from './i18n.mjs';
import { loadSaveData, writeSaveData } from './storage.mjs';
import { initAudio, setMuted, getMuted } from './audio.mjs';
import { OneLineUI } from './ui.mjs';
import { OneLineGame } from './game.mjs';

function initApp() {
  const savedData = loadSaveData();
  let currentLang = loadLocale();
  initAudio(savedData.audioMuted);

  const canvas = document.getElementById('game-canvas');
  const stageWrapper = document.getElementById('stage-wrapper');
  const ui = new OneLineUI();
  const game = new OneLineGame(canvas, ui, savedData);

  function applyLanguage(lang) {
    currentLang = lang;
    document.documentElement.lang = lang;
    ui.updateLocale(lang);
    saveLocale(lang);
  }
  applyLanguage(currentLang);
  ui.updateAudioButton(getMuted());

  // 使用 ResizeObserver 替代脆弱的单次 window.resize
  // 保证只要 DOM 盒子有尺寸，Canvas 就会立刻刷新像素分辨率
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const rect = entry.contentRect;
      if (rect.width > 0 && rect.height > 0) {
        game.renderer.resize(rect.width, rect.height);
        game.syncHUD();
      }
    }
  });
  ro.observe(stageWrapper);

  // 兜底硬刷新尺寸
  function forceResize() {
    const rect = stageWrapper.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      game.renderer.resize(rect.width, rect.height);
      game.syncHUD();
    }
  }
  window.addEventListener('resize', forceResize);
  setTimeout(forceResize, 50);
  setTimeout(forceResize, 200);

  function getPos(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const p = getPos(e);
    game.handlePointerDown(p.x, p.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    e.preventDefault();
    // 高分屏上浏览器会把多次移动合并到一个事件里，取回每一帧的中间点再喂给引擎，
    // 配合 MAX_BRIDGE 兜底，快速划动不会漏格断笔
    let coalesced = [];
    try {
      if (typeof e.getCoalescedEvents === 'function') coalesced = e.getCoalescedEvents();
    } catch {
      coalesced = [];
    }

    if (coalesced.length > 1) {
      for (const ce of coalesced) {
        const p = getPos(ce);
        game.handlePointerMove(p.x, p.y);
      }
      return;
    }

    const p = getPos(e);
    game.handlePointerMove(p.x, p.y);
  });

  canvas.addEventListener('pointerup', (e) => {
    e.preventDefault();
    try { canvas.releasePointerCapture(e.pointerId); } catch {}
    game.handlePointerUp();
  });

  canvas.addEventListener('pointercancel', () => game.handlePointerUp());

  ui.elements.btnUndo.addEventListener('click', () => game.undo());
  ui.elements.btnReset.addEventListener('click', () => {
    game.renderer.clearHint();
    game.reset();
  });

  const btnHint = document.getElementById('btn-hint');
  if (btnHint) {
    btnHint.addEventListener('click', () => {
      game.requestHint();
    });
  }

  ui.elements.btnSelectLevel.addEventListener('click', () => {
    const openMenu = (sz) => {
      ui.renderLevelSelection(
        sz,
        game.currentLevelIndex,
        savedData,
        (newSize) => openMenu(newSize),
        (selectedLevel) => {
          game.renderer.clearHint();
          game.initLevel(sz, selectedLevel);
        }
      );
    };
    openMenu(game.currentSize);
    ui.openModal('modalLevels');
  });

  ui.elements.btnCloseLevels.addEventListener('click', () => ui.closeModal('modalLevels'));

  // 无尽卡片：从未通关进度续接；还没玩过则从第一关开始
  if (ui.elements.btnEndless) {
    ui.elements.btnEndless.addEventListener('click', () => {
      const best = savedData.endlessBest || 0;
      const startAt = best > 0 ? best + 1 : 1;
      ui.closeModal('modalLevels');
      game.renderer.clearHint();
      game.initEndless(startAt);
    });
  }

  ui.elements.btnAudioToggle.addEventListener('click', () => {
    const nextMuted = !getMuted();
    setMuted(nextMuted);
    ui.updateAudioButton(nextMuted);
    writeSaveData((data) => {
      data.audioMuted = nextMuted;
      return data;
    });
  });

  ui.elements.btnLangToggle.addEventListener('click', () => {
    applyLanguage(currentLang === 'zh' ? 'en' : 'zh');
  });

  ui.elements.btnHowToPlay.addEventListener('click', () => ui.openModal('modalHelp'));
  ui.elements.btnCloseHelp.addEventListener('click', () => ui.closeModal('modalHelp'));
  ui.elements.btnConfirmHelp.addEventListener('click', () => ui.closeModal('modalHelp'));

  ui.elements.btnReplay.addEventListener('click', () => {
    ui.closeModal('modalVictory');
    game.renderer.clearHint();
    game.reset();
  });

  ui.elements.btnNextLevel.addEventListener('click', () => {
    ui.closeModal('modalVictory');
    game.renderer.clearHint();
    game.nextLevel();
    writeSaveData(() => savedData);
  });

  function loop(time) {
    game.update(time);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
