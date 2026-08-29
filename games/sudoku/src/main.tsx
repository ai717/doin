import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";

// SPA 回退守卫：
// GitHub Pages 把未知路径(如 /sudoku/play 深链、或门户错误链接)都回退到仓库根 404.html，
// 而 root 404.html 即本数独 App 本身。
// - 访问 /sudoku/* → 正常渲染对应子路由（深链可用）；
// - 访问其它路径（门户 404）→ 直接回门户首页，避免出现"门户 404 却显示数独游戏"的怪现象。
const path = window.location.pathname;
if (path !== "/sudoku" && !path.startsWith("/sudoku/")) {
  window.location.replace("/");
} else {
  const router = getRouter();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
