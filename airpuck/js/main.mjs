/**
 * @file games/airpuck/js/main.mjs
 * 游戏入口装配与全局事件协调中心。
 * 驱动同屏双人/人机双轨控制、手感平滑积分、音效合成与全量 i18n 原地热更新。
 */

import { GameController } from './game.mjs';
import { AirPuckRenderer, CANVAS_WIDTH, CANVAS_HEIGHT } from './ui.mjs';
import {
  getCurrentLanguage,
  setLanguage,
  t,
  DICTIONARIES,
} from './i18n.mjs';
import {
  setMuted,
  isAudioMuted,
  playHitSound,
  playWallSound,
  playDashSound,
  playBoosterSound,
  playBumperSound,
  playGoalSound,
  playWinFanfare,
} from './audio.mjs';
import { calculateStars, formatTime } from './score.mjs';
import { LEVELS } from './levels.mjs';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const controller = new GameController();
  const renderer = new AirPuckRenderer(canvas);

  let currentLang = getCurrentLanguage();
  let soundEnabled = true;

  // DOM 元素引用
  const dom = {
    btnPause: document.getElementById('btn-pause'),
    btnRestart: document.getElementById('btn-restart'),
    btnLevels: document.getElementById('btn-levels'),
    btnMode: document.getElementById('btn-mode'),
    btnRules: document.getElementById('btn-rules'),
    btnSound: document.getElementById('btn-sound'),
    btnLang: document.getElementById('btn-lang'),

    hudAct: document.getElementById('hud-act'),
    hudLevel: document.getElementById('hud-level'),
    hudP1Score: document.getElementById('hud-p1-score'),
    hudP2Score: document.getElementById('hud-p2-score'),
    hudSpeed: document.getElementById('hud-speed'),
    hudP1Dash: document.getElementById('hud-p1-dash'),
    hudP2Dash: document.getElementById('hud-p2-dash'),
    hudP1DashBadge: document.getElementById('hud-p1-dash-badge'),
    hudP2DashBadge: document.getElementById('hud-p2-dash-badge'),
    hudP2Title: document.getElementById('hud-p2-title'),
    hudP2Ctrl: document.getElementById('hud-p2-ctrl'),

    dialogRules: document.getElementById('dialog-rules'),
    btnCloseRules: document.getElementById('btn-close-rules'),
    btnStartPlay: document.getElementById('btn-start-play'),

    dialogPause: document.getElementById('dialog-pause'),
    btnResume: document.getElementById('btn-resume'),
    dialogLevels: document.getElementById('dialog-levels'),
    levelsGrid: document.getElementById('levels-grid'),
    btnCloseLevels: document.getElementById('btn-close-levels'),

    dialogWon: document.getElementById('dialog-won'),
    wonTitle: document.getElementById('won-title'),
    wonScore: document.getElementById('won-score'),
    wonTime: document.getElementById('won-time'),
    wonSpeed: document.getElementById('won-speed'),
    wonStars: document.getElementById('won-stars'),
    btnNextLevel: document.getElementById('btn-next-level'),
    btnRetryMatch: document.getElementById('btn-retry-match'),
    btnCloseWon: document.getElementById('btn-close-won'),
  };

  // 键盘按键按下状态集
  const keysDown = new Set();

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    keysDown.add(e.code);

    if (e.code === 'Space') {
      e.preventDefault();
      controller.p1Dash();
    } else if (e.code === 'ShiftRight' || e.code === 'Enter') {
      e.preventDefault();
      controller.p2Dash();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      controller.restart();
      syncHud();
    } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
      e.preventDefault();
      togglePause();
    }
  });

  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.code);
  });

  // 根据当前按键输入实时更新手柄方向矢量
  function pollKeyboardInputs() {
    // P1 (WASD)
    let p1X = 0;
    let p1Y = 0;
    if (keysDown.has('KeyW')) p1Y -= 1;
    if (keysDown.has('KeyS')) p1Y += 1;
    if (keysDown.has('KeyA')) p1X -= 1;
    if (keysDown.has('KeyD')) p1X += 1;
    controller.setP1Input(p1X, p1Y);

    // P2 in 2P mode (Arrows)
    if (controller.mode === '2p') {
      let p2X = 0;
      let p2Y = 0;
      if (keysDown.has('ArrowUp')) p2Y -= 1;
      if (keysDown.has('ArrowDown')) p2Y += 1;
      if (keysDown.has('ArrowLeft')) p2X -= 1;
      if (keysDown.has('ArrowRight')) p2X += 1;
      controller.setP2Input(p2X, p2Y);
    }
  }

  // 触屏 / 鼠标微操拖拽支持 (Pointer Events)
  const activePointers = new Map();

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const pos = getCanvasPos(e);

    // 根据落点处于左半场还是右半场分配控制槽位
    const side = pos.x < CANVAS_WIDTH / 2 ? 'p1' : (controller.mode === '2p' ? 'p2' : null);
    if (side) {
      activePointers.set(e.pointerId, { side, lastX: pos.x, lastY: pos.y });
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;
    const ptr = activePointers.get(e.pointerId);
    const pos = getCanvasPos(e);

    const striker = ptr.side === 'p1' ? controller.getState().p1 : controller.getState().p2;
    const dx = pos.x - striker.x;
    const dy = pos.y - striker.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 5) {
      const ix = dx / dist;
      const iy = dy / dist;
      if (ptr.side === 'p1') controller.setP1Input(ix, iy);
      else controller.setP2Input(ix, iy);
    } else {
      if (ptr.side === 'p1') controller.setP1Input(0, 0);
      else controller.setP2Input(0, 0);
    }
  });

  function releasePointer(e) {
    if (activePointers.has(e.pointerId)) {
      const ptr = activePointers.get(e.pointerId);
      if (ptr.side === 'p1') controller.setP1Input(0, 0);
      else controller.setP2Input(0, 0);
      activePointers.delete(e.pointerId);
    }
  }

  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);

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
      dom.btnMode.textContent = controller.mode === 'ai' ? t('mode2p', currentLang) : t('modeAi', currentLang);
    }

    syncHud();
  }

  // 同步 HUD 仪表数据
  function syncHud() {
    const state = controller.getState();
    if (!state) return;

    if (dom.hudP1Score) dom.hudP1Score.textContent = state.scoreP1.toString();
    if (dom.hudP2Score) dom.hudP2Score.textContent = state.scoreP2.toString();

    const speedKmH = Math.round(state.maxPuckSpeed * 0.1);
    if (dom.hudSpeed) dom.hudSpeed.textContent = speedKmH.toString();

    // 突进扣杀状态指示（杜绝文本重复，高亮脉冲点）
    const p1Ready = state.p1.dashCooldown <= 0;
    if (dom.hudP1Dash) {
      dom.hudP1Dash.textContent = p1Ready ? t('dashReady', currentLang) : t('dashCooldown', currentLang);
    }
    if (dom.hudP1DashBadge) {
      dom.hudP1DashBadge.className = `dash-pill ${p1Ready ? 'ready' : 'charging'}`;
    }

    const p2Ready = state.p2.dashCooldown <= 0;
    if (dom.hudP2Dash) {
      dom.hudP2Dash.textContent = p2Ready ? t('dashReady', currentLang) : t('dashCooldown', currentLang);
    }
    if (dom.hudP2DashBadge) {
      dom.hudP2DashBadge.className = `dash-pill ${p2Ready ? 'ready' : 'charging'}`;
    }

    if (dom.hudP2Title) {
      dom.hudP2Title.textContent = controller.mode === 'ai' ? t('aiName', currentLang) : t('p2Name', currentLang);
    }
    if (dom.hudP2Ctrl) {
      dom.hudP2Ctrl.textContent = controller.mode === 'ai' ? t('aiControls', currentLang) : t('p2Controls', currentLang);
    }

    if (controller.mode === 'ai') {
      const actThemes = ['act_classic', 'act_ice', 'act_neon', 'act_magnetic', 'act_void'];
      const actKey = actThemes[state.level.act - 1] || 'act_classic';
      if (dom.hudAct) dom.hudAct.textContent = t(actKey, currentLang);
      if (dom.hudLevel) dom.hudLevel.textContent = `${t('levelBadge', currentLang)} ${state.level.id} · ${t(state.level.nameKey, currentLang)}`;
    } else {
      if (dom.hudAct) dom.hudAct.textContent = t('mode2p', currentLang);
      if (dom.hudLevel) dom.hudLevel.textContent = t('targetScoreBadge', currentLang);
    }
  }

  // 响应物理引擎事件
  function handleEvents() {
    const events = controller.getState().events || [];
    for (const ev of events) {
      if (ev.type === 'puck_hit') {
        playHitSound(ev.speed, ev.isDashing);
        renderer.triggerSparks(ev.x, ev.y, ev.isDashing ? 28 : 14, ev.side === 'p1' ? '#ff2d55' : '#00d2d3');
        if (ev.isDashing) {
          renderer.triggerShake(0.2, 6);
        }
      } else if (ev.type === 'wall_bounce') {
        playWallSound(300);
        renderer.triggerSparks(ev.x, ev.y, 8, '#4a90e2');
      } else if (ev.type === 'dash') {
        playDashSound();
      } else if (ev.type === 'booster_trigger') {
        playBoosterSound();
        renderer.triggerSparks(ev.x, ev.y, 22, '#ffd54f');
      } else if (ev.type === 'bumper_hit') {
        playBumperSound();
        renderer.triggerSparks(ev.x, ev.y, 24, '#ff2d55');
      } else if (ev.type === 'goal_score') {
        playGoalSound(ev.scorer);
        renderer.triggerGoalExplosion(ev.scorer);
        syncHud();
      } else if (ev.type === 'match_win') {
        playWinFanfare();
        syncHud();
        showWonDialog(ev.winner, ev.scoreP1, ev.scoreP2);
      }
    }
  }

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

  function showWonDialog(winner, scoreP1, scoreP2) {
    if (!dom.dialogWon) return;

    if (dom.wonScore) dom.wonScore.textContent = `${scoreP1} - ${scoreP2}`;
    if (dom.wonTime) dom.wonTime.textContent = formatTime(controller.getState().elapsedTime);
    if (dom.wonSpeed) dom.wonSpeed.textContent = `${Math.round(controller.getState().maxPuckSpeed * 0.1)} km/h`;

    if (controller.mode === 'ai') {
      const isP1Win = winner === 'p1';
      dom.wonTitle.textContent = isP1Win ? t('wonTitle', currentLang) : t('failedTitle', currentLang);

      const starsResult = calculateStars(controller.getState(), controller.getState().level);
      if (dom.wonStars) {
        dom.wonStars.textContent = isP1Win ? '★'.repeat(starsResult.stars) + '☆'.repeat(3 - starsResult.stars) : '☆☆☆';
      }
      if (dom.btnNextLevel) {
        dom.btnNextLevel.style.display = isP1Win && controller.currentLevelId < 22 ? 'inline-flex' : 'none';
      }
    } else {
      dom.wonTitle.textContent = winner === 'p1' ? t('p1WinTitle', currentLang) : t('p2WinTitle', currentLang);
      if (dom.wonStars) dom.wonStars.textContent = '🏆';
      if (dom.btnNextLevel) dom.btnNextLevel.style.display = 'none';
    }

    if (typeof dom.dialogWon.showModal === 'function') {
      dom.dialogWon.showModal();
    }
  }

  // 渲染关卡选择列表
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
      if (level.id === controller.currentLevelId && controller.mode === 'ai') {
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

  // 按键与弹窗监听绑定
  if (dom.btnRules) {
    dom.btnRules.addEventListener('click', () => {
      if (dom.dialogRules && typeof dom.dialogRules.showModal === 'function') {
        dom.dialogRules.showModal();
      }
    });
  }
  if (dom.btnCloseRules) {
    dom.btnCloseRules.addEventListener('click', () => {
      if (dom.dialogRules && dom.dialogRules.open) dom.dialogRules.close();
    });
  }
  if (dom.btnStartPlay) {
    dom.btnStartPlay.addEventListener('click', () => {
      if (dom.dialogRules && dom.dialogRules.open) dom.dialogRules.close();
    });
  }

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
      const nextMode = controller.mode === 'ai' ? '2p' : 'ai';
      controller.setMode(nextMode);
      dom.btnMode.textContent = nextMode === 'ai' ? t('mode2p', currentLang) : t('modeAi', currentLang);
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

  if (dom.btnNextLevel) {
    dom.btnNextLevel.addEventListener('click', () => {
      if (dom.dialogWon && dom.dialogWon.open) dom.dialogWon.close();
      controller.loadNextLevel();
      syncHud();
    });
  }
  if (dom.btnRetryMatch) {
    dom.btnRetryMatch.addEventListener('click', () => {
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

  // 主循环：切后台或暂停时跳过物理密集运算与重绘，彻底杜绝风扇狂转
  let lastTime = performance.now();
  function gameLoop(timestamp) {
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    if (!document.hidden) {
      if (!controller.isPaused()) {
        pollKeyboardInputs();
        controller.step(dt);
        renderer.update(dt);
        handleEvents();
      }
      renderer.render(controller.getState());
    }

    requestAnimationFrame(gameLoop);
  }

  // 初始化装配
  updateI18nTexts();
  requestAnimationFrame(gameLoop);
});
