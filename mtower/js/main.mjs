/**
 * @file games/mtower/js/main.mjs
 * 游戏入口装配与全局事件协调中心。
 * 驱动 11x11 地牢步进、临界值算盘悬停分析、无限撤销、飞行罗盘、怪物手册与全量 i18n 热更新。
 */

import { GameController } from './game.mjs';
import { MTowerRenderer, TILE_SIZE, CANVAS_SIZE } from './ui.mjs';
import { getCurrentLanguage, setLanguage, t } from './i18n.mjs';
import {
  setMuted,
  playMoveSound,
  playDoorSound,
  playItemSound,
  playGemSound,
  playAttackSound,
  playStairsSound,
  playHolySound,
  playWinFanfare,
} from './audio.mjs';
import { calculateScore, formatTime } from './score.mjs';
import { calculateBattle, calculateThresholds } from './engine.mjs';
import { MONSTERS, ITEMS, GRID } from './data.mjs';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const controller = new GameController({ mode: 'classic50' });
  const renderer = new MTowerRenderer(canvas);

  let currentLang = getCurrentLanguage();
  let soundEnabled = true;

  // DOM 元素引用
  const dom = {
    btnBackHome: document.getElementById('back-home'),
    btnMode: document.getElementById('btn-mode'),
    btnRules: document.getElementById('btn-rules'),
    btnFly: document.getElementById('btn-fly'),
    btnManual: document.getElementById('btn-manual'),
    btnUndo: document.getElementById('btn-undo'),
    btnRestart: document.getElementById('btn-restart'),
    btnPause: document.getElementById('btn-pause'),
    btnSound: document.getElementById('btn-sound'),
    btnLang: document.getElementById('btn-lang'),

    // HUD 状态显示
    hudFloor: document.getElementById('hud-floor'),
    hudHp: document.getElementById('hud-hp'),
    hudAtk: document.getElementById('hud-atk'),
    hudDef: document.getElementById('hud-def'),
    hudGold: document.getElementById('hud-gold'),
    hudKeyY: document.getElementById('hud-key-y'),
    hudKeyB: document.getElementById('hud-key-b'),
    hudKeyR: document.getElementById('hud-key-r'),
    hudRelicsList: document.getElementById('hud-relics-list'),

    // 临界值悬停算盘 Tooltip
    tooltip: document.getElementById('threshold-tooltip'),

    // 虚拟方向键 (移动端)
    dpadUp: document.getElementById('dpad-up'),
    dpadDown: document.getElementById('dpad-down'),
    dpadLeft: document.getElementById('dpad-left'),
    dpadRight: document.getElementById('dpad-right'),
    dpadUndo: document.getElementById('dpad-undo'),

    // 弹窗
    dialogRules: document.getElementById('dialog-rules'),
    btnCloseRules: document.getElementById('btn-close-rules'),
    btnStartQuest: document.getElementById('btn-start-quest'),

    dialogFly: document.getElementById('dialog-fly'),
    flyFloorsGrid: document.getElementById('fly-floors-grid'),
    btnCloseFly: document.getElementById('btn-close-fly'),

    dialogManual: document.getElementById('dialog-manual'),
    manualList: document.getElementById('manual-list'),
    btnCloseManual: document.getElementById('btn-close-manual'),

    dialogPause: document.getElementById('dialog-pause'),
    btnResume: document.getElementById('btn-resume'),

    dialogWon: document.getElementById('dialog-won'),
    wonScore: document.getElementById('won-score'),
    wonRank: document.getElementById('won-rank'),
    wonStars: document.getElementById('won-stars'),
    btnPlayAgain: document.getElementById('btn-play-again'),
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
      dom.btnMode.textContent = controller.mode === 'classic50' ? t('modeClassic', currentLang) : t('modeFast', currentLang);
    }

    syncHud();
  }

  // 同步 HUD 属性面板
  function syncHud() {
    const state = controller.getState();
    if (!state || !state.hero) return;

    if (dom.hudFloor) dom.hudFloor.textContent = `${state.currentFloor} ${t('floorBadge', currentLang)}`;
    if (dom.hudHp) dom.hudHp.textContent = state.hero.hp.toString();
    if (dom.hudAtk) dom.hudAtk.textContent = state.hero.atk.toString();
    if (dom.hudDef) dom.hudDef.textContent = state.hero.def.toString();
    if (dom.hudGold) dom.hudGold.textContent = state.hero.gold.toString();

    if (dom.hudKeyY) dom.hudKeyY.textContent = state.hero.keys.y.toString();
    if (dom.hudKeyB) dom.hudKeyB.textContent = state.hero.keys.b.toString();
    if (dom.hudKeyR) dom.hudKeyR.textContent = state.hero.keys.r.toString();

    // 渲染法宝徽标
    if (dom.hudRelicsList) {
      dom.hudRelicsList.innerHTML = '';
      const relics = state.hero.relics || {};
      const relicBadges = [];

      if (relics.wings) relicBadges.push({ icon: '🕊️', nameKey: 'relic_wings' });
      if (relics.holyCross) relicBadges.push({ icon: '✝️', nameKey: 'relic_holy_cross' });
      if (relics.dragonSlayer) relicBadges.push({ icon: '🗡️', nameKey: 'relic_dragon_slayer' });
      if (relics.holyWater > 0) relicBadges.push({ icon: '🧪', count: relics.holyWater, nameKey: 'relic_holy_water', action: 'water' });
      if (relics.earthquake > 0) relicBadges.push({ icon: '📜', count: relics.earthquake, nameKey: 'relic_earthquake', action: 'quake' });

      relicBadges.forEach((r) => {
        const item = document.createElement('div');
        item.className = 'relic-badge';
        item.title = t(r.nameKey, currentLang);
        item.innerHTML = `<span class="relic-icon">${r.icon}</span>${r.count ? `<span class="relic-num">${r.count}</span>` : ''}`;
        if (r.action === 'water') {
          item.style.cursor = 'pointer';
          item.addEventListener('click', () => {
            controller.useHolyWater();
            playHolySound();
            syncHud();
          });
        } else if (r.action === 'quake') {
          item.style.cursor = 'pointer';
          item.addEventListener('click', () => {
            controller.useEarthquake();
            playDoorSound();
            syncHud();
          });
        }
        dom.hudRelicsList.appendChild(item);
      });
    }

    // 飞行按钮激活状态
    if (dom.btnFly) {
      dom.btnFly.disabled = !state.hero.relics?.wings;
    }
  }

  // 响应引擎动作事件（音效与浮动数字）
  function handleEvents() {
    const events = controller.getState().events || [];
    for (const ev of events) {
      if (ev.type === 'move') {
        playMoveSound();
      } else if (ev.type === 'pickup') {
        if (ev.item.type === 'gem') {
          playGemSound(ev.item.stat === 'def');
          renderer.addFloatingText(ev.x, ev.y, `+${ev.item.val} ${ev.item.stat.toUpperCase()}`, ev.item.color);
        } else if (ev.item.type === 'potion') {
          playItemSound();
          renderer.addFloatingText(ev.x, ev.y, `+${ev.item.val} HP`, '#2ed573');
        } else if (ev.item.type === 'key') {
          playItemSound();
          renderer.addFloatingText(ev.x, ev.y, `+1 KEY`, ev.item.color);
        } else if (ev.item.type === 'relic') {
          playHolySound();
          renderer.addFloatingText(ev.x, ev.y, t(ev.item.nameKey, currentLang), '#ffd54f');
        } else {
          playItemSound();
        }
        syncHud();
      } else if (ev.type === 'open_door') {
        playDoorSound();
        syncHud();
      } else if (ev.type === 'combat') {
        playAttackSound(ev.monster.isBoss);
        if (ev.damage > 0) {
          renderer.addFloatingText(controller.getState().hero.x, controller.getState().hero.y, `-${ev.damage}`, '#ff4757');
        }
        syncHud();
      } else if (ev.type === 'floor_change') {
        playStairsSound(ev.to > ev.from);
        syncHud();
      } else if (ev.type === 'victory') {
        playWinFanfare();
        syncHud();
        showWonDialog();
      }
    }
  }

  function showWonDialog() {
    if (!dom.dialogWon) return;
    const scoreResult = calculateScore(controller.getState());
    if (dom.wonScore) dom.wonScore.textContent = scoreResult.score.toString();
    if (dom.wonRank) dom.wonRank.textContent = t(scoreResult.titleKey, currentLang);
    if (dom.wonStars) dom.wonStars.textContent = '★'.repeat(scoreResult.stars) + '☆'.repeat(3 - scoreResult.stars);

    if (typeof dom.dialogWon.showModal === 'function') {
      dom.dialogWon.showModal();
    }
  }

  // 临界值悬停算盘智能解析展示
  function updateHoverTooltip(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((clientX - rect.left) / rect.width) * GRID);
    const y = Math.floor(((clientY - rect.top) / rect.height) * GRID);

    if (x < 0 || y < 0 || x >= GRID || y >= GRID) {
      renderer.setHoverCell(null);
      if (dom.tooltip) dom.tooltip.style.display = 'none';
      return;
    }

    renderer.setHoverCell({ x, y });

    const state = controller.getState();
    const curFIdx = state.currentFloor - 1;
    const floorObj = state.floors[curFIdx];
    const ch = floorObj.map[y]?.[x];
    const monId = floorObj.monsters?.[ch];

    if (!monId || !dom.tooltip) {
      dom.tooltip.style.display = 'none';
      return;
    }

    const monster = MONSTERS[monId];
    const hero = state.hero;
    const battle = calculateBattle(hero, monster);
    const thresholds = calculateThresholds(hero, monster);

    let html = `
      <div class="tip-header">
        <strong style="color:${monster.color}">${t(monster.nameKey, currentLang)}</strong>
        <span class="tip-stats">HP:${monster.hp} 攻:${monster.atk} 防:${monster.def}</span>
      </div>
      <div class="tip-battle">
        ${!battle.canWin ? `<span class="tip-loss danger">${t('cannotPierce', currentLang)}</span>` : 
          (battle.damage === 0 ? `<span class="tip-loss win">${t('zeroDamage', currentLang)}</span>` : 
            `<span class="tip-loss warning">${t('damage', currentLang)}: <strong>${battle.damage}</strong> (${battle.turns} ${t('turns', currentLang)})</span>`)}
      </div>
    `;

    // 攻防临界值推演条目
    const hints = [];
    if (thresholds.atkThreshold) {
      if (thresholds.atkThreshold.unlocksPierce) {
        hints.push(`<div class="tip-hint atk">⚡ ${t('pierceNeeded', currentLang).replace('{atk}', thresholds.atkThreshold.deltaAtk)}</div>`);
      } else {
        hints.push(`<div class="tip-hint atk">⚔️ ${t('needAtk', currentLang).replace('{atk}', thresholds.atkThreshold.deltaAtk).replace('{hp}', thresholds.atkThreshold.savedHp)}</div>`);
      }
    }
    if (thresholds.defThreshold) {
      hints.push(`<div class="tip-hint def">🛡️ ${t('needDef', currentLang).replace('{def}', thresholds.defThreshold.deltaDef)}</div>`);
    }

    if (hints.length > 0) {
      html += `<div class="tip-thresholds">${hints.join('')}</div>`;
    }

    dom.tooltip.innerHTML = html;
    dom.tooltip.style.display = 'block';

    // 定位悬停框
    const tipX = Math.min(window.innerWidth - 240, clientX + 16);
    const tipY = Math.min(window.innerHeight - 150, clientY + 16);
    dom.tooltip.style.left = `${tipX}px`;
    dom.tooltip.style.top = `${tipY}px`;
  }

  canvas.addEventListener('pointermove', (e) => {
    updateHoverTooltip(e.clientX, e.clientY);
  });

  canvas.addEventListener('pointerleave', () => {
    renderer.setHoverCell(null);
    if (dom.tooltip) dom.tooltip.style.display = 'none';
  });

  // 鼠标点击画布移动 (相邻走位或自动寻路)
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const tx = Math.floor(((e.clientX - rect.left) / rect.width) * GRID);
    const ty = Math.floor(((e.clientY - rect.top) / rect.height) * GRID);

    const hero = controller.getState().hero;
    const dx = tx - hero.x;
    const dy = ty - hero.y;

    if (Math.abs(dx) + Math.abs(dy) === 1) {
      controller.move(dx, dy);
      handleEvents();
      syncHud();
    }
  });

  // 键盘操作绑定
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      controller.move(0, -1);
      handleEvents();
      syncHud();
    } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      controller.move(0, 1);
      handleEvents();
      syncHud();
    } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
      e.preventDefault();
      controller.move(0, -1);
      handleEvents();
      syncHud();
    } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
      e.preventDefault();
      controller.move(1, 0);
      handleEvents();
      syncHud();
    } else if (e.code === 'KeyZ') {
      e.preventDefault();
      controller.undo();
      syncHud();
    } else if (e.code === 'KeyF') {
      e.preventDefault();
      openFlyDialog();
    } else if (e.code === 'KeyM') {
      e.preventDefault();
      openManualDialog();
    } else if (e.code === 'KeyR') {
      e.preventDefault();
      controller.restart();
      syncHud();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      e.preventDefault();
      togglePause();
    }
  });

  // 虚拟十字按键 (移动端)
  if (dom.dpadUp) dom.dpadUp.addEventListener('click', () => { controller.move(0, -1); handleEvents(); syncHud(); });
  if (dom.dpadDown) dom.dpadDown.addEventListener('click', () => { controller.move(0, 1); handleEvents(); syncHud(); });
  if (dom.dpadLeft) dom.dpadLeft.addEventListener('click', () => { controller.move(-1, 0); handleEvents(); syncHud(); });
  if (dom.dpadRight) dom.dpadRight.addEventListener('click', () => { controller.move(1, 0); handleEvents(); syncHud(); });
  if (dom.dpadUndo) dom.dpadUndo.addEventListener('click', () => { controller.undo(); syncHud(); });

  // 弹窗逻辑
  function togglePause() {
    const isPaused = controller.togglePause();
    if (isPaused) {
      if (dom.dialogPause && typeof dom.dialogPause.showModal === 'function') dom.dialogPause.showModal();
    } else {
      if (dom.dialogPause && dom.dialogPause.open) dom.dialogPause.close();
    }
  }

  function openFlyDialog() {
    if (!dom.dialogFly || !controller.getState().hero.relics?.wings) return;
    dom.flyFloorsGrid.innerHTML = '';
    const maxF = controller.getState().maxFloorReached;

    for (let f = 1; f <= maxF; f++) {
      const btn = document.createElement('button');
      btn.className = `tactile-btn ${f === controller.getState().currentFloor ? 'primary-btn' : ''}`;
      btn.textContent = `${f}F`;
      btn.addEventListener('click', () => {
        controller.fly(f);
        if (dom.dialogFly.open) dom.dialogFly.close();
        playStairsSound();
        syncHud();
      });
      dom.flyFloorsGrid.appendChild(btn);
    }

    if (typeof dom.dialogFly.showModal === 'function') dom.dialogFly.showModal();
  }

  function openManualDialog() {
    if (!dom.dialogManual) return;
    dom.manualList.innerHTML = '';
    const state = controller.getState();
    const curFIdx = state.currentFloor - 1;
    const floorObj = state.floors[curFIdx];

    const presentMonsterIds = new Set(Object.values(floorObj.monsters || {}));
    if (presentMonsterIds.size === 0) {
      dom.manualList.innerHTML = `<div class="empty-manual">${t('noMonsters', currentLang)}</div>`;
    } else {
      presentMonsterIds.forEach((monId) => {
        const monster = MONSTERS[monId];
        const battle = calculateBattle(state.hero, monster);
        const card = document.createElement('div');
        card.className = 'manual-card';
        card.innerHTML = `
          <div class="manual-left">
            <span class="manual-name" style="color:${monster.color}">${t(monster.nameKey, currentLang)}</span>
            <span class="manual-props">HP:${monster.hp} 攻:${monster.atk} 防:${monster.def} 金:${monster.gold}</span>
          </div>
          <div class="manual-right">
            ${!battle.canWin ? `<span class="badge danger">${t('cannotPierce', currentLang)}</span>` : 
              (battle.damage === 0 ? `<span class="badge win">${t('zeroDamage', currentLang)}</span>` : 
                `<span class="badge warning">${t('damage', currentLang)}: ${battle.damage}</span>`)}
          </div>
        `;
        dom.manualList.appendChild(card);
      });
    }

    if (typeof dom.dialogManual.showModal === 'function') dom.dialogManual.showModal();
  }

  // 顶栏按钮绑定
  if (dom.btnRules) {
    dom.btnRules.addEventListener('click', () => {
      if (dom.dialogRules && typeof dom.dialogRules.showModal === 'function') dom.dialogRules.showModal();
    });
  }
  if (dom.btnCloseRules) dom.btnCloseRules.addEventListener('click', () => dom.dialogRules.close());
  if (dom.btnStartQuest) dom.btnStartQuest.addEventListener('click', () => dom.dialogRules.close());

  if (dom.btnFly) dom.btnFly.addEventListener('click', openFlyDialog);
  if (dom.btnCloseFly) dom.btnCloseFly.addEventListener('click', () => dom.dialogFly.close());

  if (dom.btnManual) dom.btnManual.addEventListener('click', openManualDialog);
  if (dom.btnCloseManual) dom.btnCloseManual.addEventListener('click', () => dom.dialogManual.close());

  if (dom.btnUndo) dom.btnUndo.addEventListener('click', () => { controller.undo(); syncHud(); });
  if (dom.btnRestart) dom.btnRestart.addEventListener('click', () => { controller.restart(); syncHud(); });
  if (dom.btnPause) dom.btnPause.addEventListener('click', togglePause);
  if (dom.btnResume) dom.btnResume.addEventListener('click', togglePause);

  if (dom.btnMode) {
    dom.btnMode.addEventListener('click', () => {
      const nextMode = controller.mode === 'classic50' ? 'fast25' : 'classic50';
      controller.setMode(nextMode);
      dom.btnMode.textContent = nextMode === 'classic50' ? t('modeClassic', currentLang) : t('modeFast', currentLang);
      syncHud();
    });
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

  if (dom.btnPlayAgain) dom.btnPlayAgain.addEventListener('click', () => { dom.dialogWon.close(); controller.restart(); syncHud(); });
  if (dom.btnCloseWon) dom.btnCloseWon.addEventListener('click', () => dom.dialogWon.close());

  // 循环渲染与时序更新
  let lastTime = performance.now();
  function gameLoop(timestamp) {
    const dt = Math.min(0.05, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    if (!document.hidden) {
      controller.updateTimer(dt);
      renderer.update(dt);
      renderer.render(controller.getState());
    }

    requestAnimationFrame(gameLoop);
  }

  // 初始化启动
  updateI18nTexts();
  requestAnimationFrame(gameLoop);
});
