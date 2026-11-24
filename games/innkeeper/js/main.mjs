/**
 * 中华客栈 · 跑堂点菜 (Inn Master)
 * 应用装配与全局事件协调器 (rAF 循环、快捷键、失焦保护)
 */

import { createGameController } from "./game.mjs";
import { createTavernRenderer } from "./render.mjs";
import { createUI } from "./ui.mjs";
import { updatePageTranslations, getLocale, setLocale } from "./i18n.mjs";
import { loadRecord } from "./storage.mjs";

window.addEventListener("DOMContentLoaded", () => {
  // 1. 初始化多语言与用户偏好
  const locale = getLocale();
  setLocale(locale);
  updatePageTranslations();

  const record = loadRecord();

  // 2. 实例化控制器 (默认启动第 1 关午市小场，即开即玩)
  const controller = createGameController({
    shiftId: "shift_lunch",
    upgrades: record.upgrades,
  });

  // 3. 实例化 Canvas 渲染器
  const canvas = document.getElementById("tavern-canvas");
  const renderer = createTavernRenderer(canvas);
  renderer.resize();
  window.addEventListener("resize", () => renderer.resize());

  // 4. 实例化 UI 交互层
  const appContainer = document.getElementById("app");
  createUI(controller, appContainer);

  // 5. 主游戏循环 (rAF, 固定上限 dt)
  let lastTime = performance.now();
  function gameLoop(now) {
    const dt = Math.min(0.08, (now - lastTime) / 1000);
    lastTime = now;

    controller.tick(dt);
    renderer.render(controller.getState(), dt);

    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);

  // 6. 全局键盘快捷键
  window.addEventListener("keydown", (e) => {
    // 忽略在输入框中的按键
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    const key = e.key.toLowerCase();
    const state = controller.getState();

    if (key === "p" || key === "escape") {
      e.preventDefault();
      controller.togglePause();
      return;
    }

    if (state.status !== "playing" || controller.getIsPaused()) return;

    if (key >= "1" && key <= "8") {
      const tableIdx = parseInt(key, 10) - 1;
      const table = state.tables.find((t) => t.id === tableIdx);
      if (table) {
        if (table.status === "dirty") {
          controller.enqueue({ type: "clean_table", targetTableId: table.id });
        } else if (table.guest) {
          if (table.guest.state === "paying") {
            controller.enqueue({ type: "checkout_table", targetTableId: table.id });
          } else if (table.guest.state === "waiting") {
            controller.enqueue({ type: "serve_table", targetTableId: table.id });
          }
        }
      }
    } else if (key === "q") {
      // 茶台
      controller.enqueue({ type: "fetch_tea" });
    } else if (key === "w") {
      // 后厨
      controller.enqueue({ type: "fetch_dish", dishId: "dish_noodles" });
    } else if (key === "e") {
      // 柜台
      const paying = state.tables.find((t) => t.guest && t.guest.state === "paying");
      if (paying) {
        controller.enqueue({ type: "checkout_table", targetTableId: paying.id });
      }
    }
  });

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
