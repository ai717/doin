/**
 * @file games/tidy/js/main.mjs
 * 游戏入口装配与全局事件协调中心。
 * 驱动多点触控/鼠标微操拖拽、滚轮/R键旋转、切后台自动暂停与全量 i18n 原地热更新。
 */

import { GameController } from './game.mjs';
import { TidyRenderer, CANVAS_WIDTH, CANVAS_HEIGHT } from './ui.mjs';
import {
  getCurrentLanguage,
  setLanguage,
  t,
  DICTIONARIES,
} from './i18n.mjs';
import {
  setMuted,
  isAudioMuted,
  playPickSound,
  playRotateSound,
  playSnapSound,
  playRejectSound,
  playHintSound,
  playClearSound,
} from './audio.mjs';
import { calculateStars, formatTime, calculateTotalSummary } from './score.mjs';
import { LEVELS } from './levels.mjs';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const controller = new GameController();
  const renderer = new TidyRenderer(canvas);

  let currentLang = getCurrentLanguage();
  let soundEnabled = true;

  // DOM 元素引用
  const dom = {
    btnPause: document.getElementById('btn-pause'),
    btnRestart: document.getElementById('btn-restart'),
    btnLevels: document.getElementById('btn-levels'),
    btnAlbum: document.getElementById('btn-album'),
    btnSound: document.getElementById('btn-sound'),
    btnLang: document.getElementById('btn-lang'),
    btnHint: document.getElementById('btn-hint'),

    hudAct: document.getElementById('hud-act'),
    hudLevel: document.getElementById('hud-level'),
    hudRemaining: document.getElementById('hud-remaining'),
    hudMoves: document.getElementById('hud-moves'),
    hudTime: document.getElementById('hud-time'),

    dialogPause: document.getElementById('dialog-pause'),
    btnResume: document.getElementById('btn-resume'),
    dialogLevels: document.getElementById('dialog-levels'),
    levelsGrid: document.getElementById('levels-grid'),
    btnCloseLevels: document.getElementById('btn-close-levels'),

    dialogClear: document.getElementById('dialog-clear'),
    polaroidLevelName: document.getElementById('polaroid-level-name'),
    polaroidTime: document.getElementById('polaroid-time'),
    polaroidMoves: document.getElementById('polaroid-moves'),
    polaroidStars: document.getElementById('polaroid-stars'),
    btnNextLevel: document.getElementById('btn-next-level'),
    btnRetryLevel: document.getElementById('btn-retry-level'),
    btnCloseClear: document.getElementById('btn-close-clear'),

    dialogAlbum: document.getElementById('dialog-album'),
    albumGrid: document.getElementById('album-grid'),
    albumProgressText: document.getElementById('album-progress-text'),
    btnCloseAlbum: document.getElementById('btn-close-album'),
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

    syncHud();
  }

  // 同步 HUD 面板
  function syncHud() {
    const state = controller.getState();
    if (!state) return;

    const remainingCount = state.items.filter((it) => !it.isSnapped).length;
    const themeKey = `act_${['stationery', 'cosmetic', 'luggage', 'geek', 'bento'][state.level.act - 1]}`;

    if (dom.hudAct) dom.hudAct.textContent = t(themeKey, currentLang);
    if (dom.hudLevel) dom.hudLevel.textContent = `${t('levelBadge', currentLang)} ${state.level.id}`;
    if (dom.hudRemaining) dom.hudRemaining.textContent = `${remainingCount} / ${state.items.length}`;
    if (dom.hudMoves) dom.hudMoves.textContent = state.moves.toString();
    if (dom.hudTime) dom.hudTime.textContent = formatTime(state.elapsedTime);
  }

  // 获取 Pointer 在 Canvas 内部标准坐标
  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  // 检测被点击的物品 (拾取判定)
  function getClickedItem(pos) {
    const state = controller.getState();
    // 逆序查找（优先选择最上层渲染的物品）
    for (let i = state.items.length - 1; i >= 0; i--) {
      const item = state.items[i];
      let itemX = item.x;
      let itemY = item.y;

      if (item.isSnapped) {
        const slot = state.slots.find((sl) => sl.id === item.snappedSlotId);
        if (slot) {
          itemX = slot.worldX ?? (35 + 14 + slot.x);
          itemY = slot.worldY ?? (30 + 14 + slot.y);
        }
      }

      const hw = item.width / 2 + 10;
      const hh = item.height / 2 + 10;
      const dist = Math.hypot(pos.x - itemX, pos.y - itemY);

      if (dist < Math.max(hw, hh)) {
        return item;
      }
    }
    return null;
  }

  // 鼠标 / 触屏拖拽与旋转交互
  let isPointerDown = false;
  let pointerStartPos = { x: 0, y: 0 };
  let activeItemId = null;
  let hasMovedSignificantly = false;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);

    const pos = getCanvasCoords(e);
    isPointerDown = true;
    pointerStartPos = pos;
    hasMovedSignificantly = false;

    const clickedItem = getClickedItem(pos);
    if (clickedItem) {
      activeItemId = clickedItem.id;
      controller.pickUp(clickedItem.id, pos.x, pos.y);
      handleEvents();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!isPointerDown || !activeItemId) return;
    const pos = getCanvasCoords(e);

    const distFromStart = Math.hypot(pos.x - pointerStartPos.x, pos.y - pointerStartPos.y);
    if (distFromStart > 8) {
      hasMovedSignificantly = true;
    }

    controller.move(pos.x, pos.y);
  });

  function handlePointerRelease(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (activeItemId) {
      // 若几乎没有发生拖拽位移，判定为单点轻触 -> 顺时针旋转 90°（不触发落槽吸附或失误判定）
      if (!hasMovedSignificantly) {
        controller.rotate(activeItemId, 1);
        const state = controller.getState();
        const it = state.items.find((item) => item.id === activeItemId);
        if (it) it.isDragging = false;
        state.heldItemId = null;
        handleEvents();
      } else {
        controller.release();
        handleEvents();
      }
      activeItemId = null;
    }
  }

  canvas.addEventListener('pointerup', handlePointerRelease);
  canvas.addEventListener('pointercancel', handlePointerRelease);

  // 鼠标滚轮旋转当前拖拽或悬浮的物件
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const pos = getCanvasCoords(e);
    const targetItem = controller.getState().heldItemId
      ? controller.getState().items.find((it) => it.id === controller.getState().heldItemId)
      : getClickedItem(pos);

    if (targetItem && !targetItem.isSnapped) {
      const dir = e.deltaY > 0 ? 1 : -1;
      controller.rotate(targetItem.id, dir);
      handleEvents();
    }
  }, { passive: false });

  // 键盘全局快捷键 (R: 旋转, P/Esc: 暂停, H: 提示)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'r' || e.key === 'R' || e.key === ' ') {
      e.preventDefault();
      const state = controller.getState();
      const targetId = state.heldItemId || (state.items.find((it) => !it.isSnapped) || {}).id;
      if (targetId) {
        controller.rotate(targetId, 1);
        handleEvents();
      }
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      togglePause();
    } else if (e.key === 'h' || e.key === 'H') {
      e.preventDefault();
      controller.hint();
      handleEvents();
    }
  });

  // 处理状态机音效与视效事件
  function handleEvents() {
    const state = controller.getState();
    if (!state || !state.events) return;

    for (const ev of state.events) {
      if (ev.type === 'pick_up' || ev.type === 'pick_out') {
        playPickSound();
      } else if (ev.type === 'rotate') {
        playRotateSound();
      } else if (ev.type === 'snap_in') {
        playSnapSound(ev.material);
        const slot = state.slots.find((sl) => sl.id === ev.slotId);
        if (slot) {
          renderer.triggerParticles(35 + 14 + slot.x, 30 + 14 + slot.y, '#f9e79f');
        }
      } else if (ev.type === 'snap_reject') {
        playRejectSound();
      } else if (ev.type === 'hint_activated') {
        playHintSound();
      } else if (ev.type === 'level_clear') {
        playClearSound();
        showClearModal(state);
      }
    }
    syncHud();
  }

  // 弹出通关拍立得卡片模态窗
  function showClearModal(state) {
    const stars = calculateStars({
      cleared: true,
      failedAttempts: state.failedAttempts,
      elapsedTime: state.elapsedTime,
      targetSeconds: state.level.targetSeconds || 45,
    });

    if (dom.polaroidLevelName) {
      const themeKey = `act_${['stationery', 'cosmetic', 'luggage', 'geek', 'bento'][state.level.act - 1]}`;
      dom.polaroidLevelName.textContent = `${t(themeKey, currentLang)} · ${t('levelBadge', currentLang)} ${state.level.id}`;
    }
    if (dom.polaroidTime) dom.polaroidTime.textContent = formatTime(state.elapsedTime);
    if (dom.polaroidMoves) dom.polaroidMoves.textContent = state.moves.toString();
    if (dom.polaroidStars) {
      dom.polaroidStars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    }

    if (dom.dialogClear && typeof dom.dialogClear.showModal === 'function') {
      dom.dialogClear.showModal();
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
      if (level.id === controller.currentLevelId) {
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

  // 渲染拍立得强迫症图鉴相册
  function renderAlbumGrid() {
    if (!dom.albumGrid) return;
    dom.albumGrid.innerHTML = '';

    const storage = controller.storage;
    const summary = calculateTotalSummary(storage.records);

    if (dom.albumProgressText) {
      dom.albumProgressText.textContent = `${summary.clearedCount} / 24 (${summary.totalStars} / 72 ★)`;
    }

    LEVELS.forEach((level) => {
      const rec = storage.records[level.id];
      const isCleared = rec && rec.stars > 0;
      const themeKey = `act_${['stationery', 'cosmetic', 'luggage', 'geek', 'bento'][level.act - 1]}`;

      const card = document.createElement('div');
      card.className = `album-card ${isCleared ? 'cleared' : 'locked'}`;

      card.innerHTML = `
        <div class="polaroid-frame">
          <div class="polaroid-photo">
            <span class="album-icon">${isCleared ? '✨' : '🔒'}</span>
            <span class="album-stamp">${isCleared ? 'PERFECT' : ''}</span>
          </div>
          <div class="polaroid-caption">
            <div class="album-level-title">${t(themeKey, currentLang)} #${level.id}</div>
            <div class="album-stars">${isCleared ? '★'.repeat(rec.stars) : '---'}</div>
          </div>
        </div>
      `;

      if (isCleared) {
        card.addEventListener('click', () => {
          controller.loadLevel(level.id);
          if (dom.dialogAlbum && dom.dialogAlbum.open) {
            dom.dialogAlbum.close();
          }
        });
      }

      dom.albumGrid.appendChild(card);
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
  if (dom.btnHint) {
    dom.btnHint.addEventListener('click', () => {
      controller.hint();
      handleEvents();
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

  if (dom.btnAlbum) {
    dom.btnAlbum.addEventListener('click', () => {
      renderAlbumGrid();
      if (dom.dialogAlbum && typeof dom.dialogAlbum.showModal === 'function') {
        dom.dialogAlbum.showModal();
      }
    });
  }
  if (dom.btnCloseAlbum) {
    dom.btnCloseAlbum.addEventListener('click', () => dom.dialogAlbum.close());
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
      if (dom.dialogClear && dom.dialogClear.open) dom.dialogClear.close();
      controller.loadNextLevel();
      syncHud();
    });
  }
  if (dom.btnRetryLevel) {
    dom.btnRetryLevel.addEventListener('click', () => {
      if (dom.dialogClear && dom.dialogClear.open) dom.dialogClear.close();
      controller.restart();
      syncHud();
    });
  }
  if (dom.btnCloseClear) {
    dom.btnCloseClear.addEventListener('click', () => {
      if (dom.dialogClear && dom.dialogClear.open) dom.dialogClear.close();
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
    const dt = Math.min(0.1, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    controller.step(dt);
    renderer.update(dt);
    renderer.render(controller.getState());

    requestAnimationFrame(gameLoop);
  }

  // 初始化
  updateI18nTexts();
  requestAnimationFrame(gameLoop);
});
