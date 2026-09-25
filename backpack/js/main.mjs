// main.mjs — 背包竞技场装配入口：创建控制器与 UI，绑定全局交互。

import { createController } from "./game.mjs";
import { createUI } from "./ui.mjs";
import { load, save, loadRun, saveRun, clearRun } from "./storage.mjs";
import { loadLocale } from "./i18n.mjs";
import { unlock } from "./audio.mjs";

function boot() {
  const savedState = load();
  const savedRun = loadRun();
  const controller = createController({
    lang: loadLocale(),
    savedState,
    savedRun,
  });

  const ui = createUI(controller, { save, loadSave: load, saveRun, loadRun, clearRun });
  ui.init();

  // 手势解锁音频
  window.addEventListener("pointerdown", () => unlock(), { once: true });
  window.addEventListener("keydown", () => unlock(), { once: true });

  // 键盘捷径：R 旋转选中物品，X/Delete/Backspace 出售或放回，Esc 关闭面板
  window.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      ui.rotateFocused();
    } else if (e.key === "x" || e.key === "X" || e.key === "Delete" || e.key === "Backspace") {
      if (!e.target || e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      e.preventDefault();
      ui.sellFocused();
    } else if (e.key === "Escape") {
      ui.closeOverlay();
    }
  });

  // 视口变化时重算棋盘尺寸
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => ui.render(), 120);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
