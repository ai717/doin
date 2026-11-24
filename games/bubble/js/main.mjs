/**
 * 极简泡泡堂 · 水泡大作战 (Bubble Arena Lite)
 * 应用装配与全局事件协调器 (rAF 循环、键位监听、失焦保护)
 */

import { createGameController } from "./game.mjs";
import { createArenaRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { updatePageTranslations, getLocale, setLocale } from "./i18n.mjs";
import { loadRecord } from "./storage.mjs";

window.addEventListener("DOMContentLoaded", () => {
  // 1. 初始化多语言与用户偏好
  const locale = getLocale();
  setLocale(locale);
  updatePageTranslations();

  const record = loadRecord();

  // 2. 实例化控制器 (默认启动第 1 关夏日水上乐园，即开即玩)
  const controller = createGameController({
    mapId: "map_pool",
    mode: "solo",
    aiLevel: record.aiLevel,
  });

  // 3. 实例化 Canvas 渲染器
  const canvas = document.getElementById("arena-canvas");
  const renderer = createArenaRenderer(canvas);
  renderer.resize();
  window.addEventListener("resize", () => renderer.resize());

  // 4. 实例化 UI 交互层
  const appContainer = document.getElementById("app");
  createUI(controller, appContainer);

  // 5. 主游戏循环 (rAF, 固定上限 dt)
  let lastTime = performance.now();
  function gameLoop(now) {
    const dt = Math.min(0.06, (now - lastTime) / 1000);
    lastTime = now;

    controller.tick(dt);
    renderer.render(controller.getState(), dt);

    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);

  // 6. 全局键盘操作监听
  const activeKeys = new Set();

  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    const key = e.key.toLowerCase();
    activeKeys.add(key);

    if (key === "p" || key === "escape") {
      e.preventDefault();
      controller.togglePause();
      return;
    }

    if (controller.getIsPaused() || controller.getState().status !== "playing") return;

    // P1 动作
    if (e.code === "Space") {
      e.preventDefault();
      controller.drop(0);
    } else if (key === "j") {
      e.preventDefault();
      controller.needle(0);
    }

    // P2 动作 (同屏双人)
    if (e.code === "Enter" || e.code === "Numpad0") {
      e.preventDefault();
      controller.drop(1);
    } else if (e.code === "Numpad1") {
      e.preventDefault();
      controller.needle(1);
    }

    updateKeyInputs();
  });

  window.addEventListener("keyup", (e) => {
    const key = e.key.toLowerCase();
    activeKeys.delete(key);
    updateKeyInputs();
  });

  function updateKeyInputs() {
    // P1 方向 (WASD)
    controller.setPlayerInput(0, "up", activeKeys.has("w"));
    controller.setPlayerInput(0, "down", activeKeys.has("s"));
    controller.setPlayerInput(0, "left", activeKeys.has("a"));
    controller.setPlayerInput(0, "right", activeKeys.has("d"));

    // P2 方向 (Arrows)
    controller.setPlayerInput(1, "up", activeKeys.has("arrowup"));
    controller.setPlayerInput(1, "down", activeKeys.has("arrowdown"));
    controller.setPlayerInput(1, "left", activeKeys.has("arrowleft"));
    controller.setPlayerInput(1, "right", activeKeys.has("arrowright"));
  }

  // 7. 失焦与切后台自动暂停 (Visibility Auto-Pause)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      controller.pause();
    }
  });
  window.addEventListener("blur", () => {
    controller.pause();
  });
});
