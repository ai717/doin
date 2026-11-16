// 装配入口：初始化 UI、绑定全局事件、语言热更新。
import { createApp } from "./ui.mjs";
import { getLocale } from "./i18n.mjs";

const app = createApp();

// 调试句柄（项目硬约定）：window.__<slug>，排查与自动化冒烟用
window.__xiangqi = {
  game: app.game,
  app: app.app,
  applyLocale: (lang) => app.applyLocale(lang),
};

// 全站语言联动（跨游戏窗口共享 doin.lang，其他标签页切换时同步）
try {
  window.addEventListener("storage", (event) => {
    if (event.key === "doin.lang" && event.newValue && event.newValue !== getLocale()) {
      app.applyLocale(event.newValue);
    }
  });
} catch {
  // 忽略
}
