// 符文塔防主装配入口（事件监听、RAF 循环、键鼠与触控接入）

import { RuneTowerGame } from "./game.mjs";
import { RuneTowerRenderer } from "./render.mjs";
import { RuneTowerUI } from "./ui.mjs";
import { sound } from "./audio.mjs";
import { PEDESTALS, WORLD_WIDTH, WORLD_HEIGHT } from "./engine.mjs";
import { loadSaveData, writeSaveData } from "./storage.mjs";
import { getLanguage, setLanguage, t } from "./i18n.mjs";

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("game-canvas");
  if (!canvas) return;

  // 恢复声音偏好与全站语言
  const saveData = loadSaveData();
  sound.toggle(saveData.soundEnabled);
  document.documentElement.lang = getLanguage();

  const audioBtn = document.getElementById("btn-audio");
  const updateAudioBtn = () => {
    if (audioBtn) {
      audioBtn.textContent = sound.enabled ? t("soundOn") : t("soundOff");
    }
  };
  updateAudioBtn();

  if (audioBtn) {
    audioBtn.addEventListener("click", () => {
      const state = sound.toggle();
      writeSaveData({ ...loadSaveData(), soundEnabled: state });
      updateAudioBtn();
    });
  }

  // 实例化渲染器与游戏控制器
  const renderer = new RuneTowerRenderer(canvas);

  let ui = null;
  const game = new RuneTowerGame({
    seed: Date.now(),
    onStateChange: (state) => {
      if (ui) ui.update(state);
    },
    onEvent: (ev) => {
      handleCombatSound(ev);
    },
  });

  ui = new RuneTowerUI({
    game,
    onAction: (action, payload) => {
      // 外部操作回调
    },
  });

  // 视口自适应
  window.addEventListener("resize", () => {
    renderer.resize();
  });

  // 坐标转换工具函数
  function getCanvasLogicalCoords(evt) {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    const scaleX = WORLD_WIDTH / rect.width;
    const scaleY = WORLD_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // 点击/触控画布交互
  function handleCanvasClick(coords) {
    sound.init();
    const state = game.getState();

    // 1. 优先判定是否点击魔物（集火标记）
    for (const m of state.monsters) {
      if (Math.hypot(m.x - coords.x, m.y - coords.y) <= m.radius + 16) {
        game.setFocusTarget(m.id);
        return;
      }
    }

    // 2. 判定是否点击符文基座
    for (const p of PEDESTALS) {
      if (Math.hypot(p.x - coords.x, p.y - coords.y) <= 32) {
        renderer.setSelectedPedestal(p.id);
        ui.openPedestalPanel(p.id);
        return;
      }
    }

    // 3. 点击空白区域：取消选中与关闭面板
    renderer.setSelectedPedestal(null);
    ui.closePedestalPanel();
  }

  canvas.addEventListener("click", (evt) => {
    const coords = getCanvasLogicalCoords(evt);
    handleCanvasClick(coords);
  });

  canvas.addEventListener("touchstart", (evt) => {
    const coords = getCanvasLogicalCoords(evt);
    handleCanvasClick(coords);
  }, { passive: true });

  canvas.addEventListener("mousemove", (evt) => {
    const coords = getCanvasLogicalCoords(evt);
    let hovered = null;
    for (const p of PEDESTALS) {
      if (Math.hypot(p.x - coords.x, p.y - coords.y) <= 30) {
        hovered = p.id;
        break;
      }
    }
    renderer.setHoveredPedestal(hovered);
  });

  // 全键盘快捷键支持
  window.addEventListener("keydown", (evt) => {
    const key = evt.key.toUpperCase();
    const selId = renderer.selectedPedestalId;

    if (evt.code === "Space") {
      evt.preventDefault();
      game.toggleSpeed();
    } else if (key === "P") {
      game.togglePause();
      ui.syncPauseModal();
    } else if (key === "R") {
      const state = game.getState();
      if (state.status === "PREPARING") game.startWave();
      else if (state.status === "COMBAT") game.rushWave();
    } else if (key === "ESCAPE") {
      if (renderer.selectedPedestalId) {
        renderer.setSelectedPedestal(null);
        ui.closePedestalPanel();
      } else if (!ui.elements.chaptersModal.classList.contains("hidden")) {
        ui.closeChaptersModal();
      } else {
        game.togglePause();
        ui.syncPauseModal();
      }
    } else if (selId) {
      if (key === "1") game.buildTower(selId, "arcane");
      else if (key === "2") game.buildTower(selId, "flame");
      else if (key === "3") game.buildTower(selId, "frost");
      else if (key === "4") game.buildTower(selId, "storm");
      else if (key === "U") game.upgradeTower(selId);
      else if (key === "X") game.salvageTower(selId);

      if (ui) ui.renderPedestalPanel(selId);
    }
  });

  // 音效分发处理
  function handleCombatSound(ev) {
    if (!sound.enabled) return;
    switch (ev.type) {
      case "tower_fire":
        sound.playTowerFire(ev.towerType);
        break;
      case "wave_start":
        sound.playWaveStart();
        break;
      case "relic_chosen":
        sound.playRelicDraft();
        break;
      case "monster_escaped":
        sound.playCrystalHurt();
        break;
      case "victory":
        sound.playVictory();
        break;
      case "defeat":
        sound.playDefeat();
        break;
    }
  }

  // RAF 渲染与物理帧步进循环
  let lastTimestamp = performance.now();
  function loop(now) {
    const dt = (now - lastTimestamp) / 1000;
    lastTimestamp = now;

    game.step(dt);
    renderer.render(game.getState(), dt);

    requestAnimationFrame(loop);
  }

  // 初始更新
  ui.update(game.getState());
  requestAnimationFrame(loop);
});
