import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

test("Markup: index.html 语义标记与核心契约合规", () => {
  const htmlPath = resolve(root, "index.html");
  assert.ok(existsSync(htmlPath), "index.html 必须存在");

  const html = readFileSync(htmlPath, "utf8");

  // 返回门户首页
  assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/, "必须包含 id='back-home' 且 href='/' 的返回首页链接");

  // noscript 兜底
  assert.match(html, /<noscript>/, "必须包含 <noscript> 兜底说明");

  // meta 与 favicon
  assert.match(html, /<meta[^>]+name="description"/, "必须包含 description meta");
  assert.match(html, /<link[^>]+rel="icon"/, "必须包含 favicon 图标");

  // 缓存失效占位符 ?v=dev
  const localAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^(https?:)?\/\//.test(u) && !u.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(u));

  assert.ok(localAssets.length >= 2, "必须包含至少样式与主脚本");
  for (const asset of localAssets) {
    assert.ok(asset.includes("?v=dev"), `资源链接必须带有 ?v=dev: ${asset}`);
  }

  // ES Module 入口脚本
  assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/, "入口脚本必须是 module 类型");

  // 关键画布元素与模态窗
  assert.match(html, /<canvas[^>]+id="game-canvas"/, "必须包含游戏画布 #game-canvas");
  assert.match(html, /id="modal-pause"/, "必须包含暂停弹窗 #modal-pause");
  assert.match(html, /id="modal-chapters"/, "必须包含章节选关弹窗 #modal-chapters");
});

test("Markup: style.css 包含动效降级声明与 [hidden] 样式守卫", () => {
  const cssPath = resolve(root, "css", "style.css");
  assert.ok(existsSync(cssPath), "css/style.css 必须存在");
  const css = readFileSync(cssPath, "utf8");

  assert.ok(css.includes("prefers-reduced-motion"), "必须包含 prefers-reduced-motion 动效降级");
  assert.ok(css.includes("[hidden]"), "必须包含 [hidden] 样式守卫");
});

