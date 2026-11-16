// 盲盒记忆牌 — 入口装配，绑定事件协调全局
// 初始化时全量覆盖文本；切语言时热更新（绝不 location.reload）

import { createUI } from "./ui.mjs";
import { applyLocale, loadLocale } from "./i18n.mjs";
import { unlock as unlockAudio } from "./audio.mjs";

function boot() {
  const root = document.getElementById("game-root");
  if (!root) return;
  const ui = createUI(root);

  // 首次用户交互解锁音频上下文
  const unlockOnce = () => {
    unlockAudio();
    document.removeEventListener("pointerdown", unlockOnce);
    document.removeEventListener("keydown", unlockOnce);
  };
  document.addEventListener("pointerdown", unlockOnce);
  document.addEventListener("keydown", unlockOnce);

  // 防止音频状态丢失：每次刷新后应用一次 locale
  applyLocale(ui.locale);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}