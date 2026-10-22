// markup.test.mjs —— 页面骨架契约：返回键 / noscript / 缓存占位 / 相对路径 / i18n 标记闭包 / ID 闭包 / 零外链。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");

test("必含返回门户链接（唯一绝对路径例外）", () => {
  assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/);
});

test("必含 noscript 兜底", () => {
  assert.match(html, /<noscript/i);
});

test("本地资源一律 ?v=dev 占位", () => {
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:)?\/\//.test(url) || url.startsWith("data:") || url.startsWith("/")) continue;
    assert.match(url, /\?v=dev/, `未带版本占位: ${url}`);
  }
  assert.match(html, /css\/style\.css\?v=dev/);
  assert.match(html, /js\/main\.mjs\?v=dev/);
});

test("零外部网络依赖：无 CDN / webfont / 外链资源 / 统计广告标签", () => {
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(html, /gtag|googletagmanager|adsbygoogle|google-analytics/i);
});

test("入口为 ES module 且含 meta description / favicon / lang", () => {
  assert.match(html, /<script[^>]+type="module"/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /<html[^>]+lang="/);
});

test("HTML 汉字节点全部带 data-i18n 或由 JS 动态覆盖", () => {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const jsCode = ["engine.mjs", "game.mjs", "storage.mjs", "ui.mjs", "main.mjs", "i18n.mjs", "audio.mjs"]
    .map((name) => readFileSync(resolve(gameDir, "js", name), "utf8"))
    .join("\n");
  const unhandled = [];
  for (const m of clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)) {
    const tag = m[1].toLowerCase();
    if (tag === "title" || tag === "script") continue;
    if (m[2].includes("data-i18n")) continue;
    const id = m[2].match(/id="([^"]+)"/)?.[1];
    if (id && jsCode.includes(`"${id}"`)) continue;
    unhandled.push(`<${tag}> ${m[3].slice(0, 12)}`);
  }
  assert.deepEqual(unhandled, []);
});

test("ID 闭包：ui.mjs / main.mjs 引用的元素 id 必须存在于 HTML", () => {
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
  const missing = [];
  for (const name of ["ui.mjs", "main.mjs"]) {
    const src = readFileSync(resolve(gameDir, "js", name), "utf8");
    for (const m of src.matchAll(/\$\("([\w-]+)"\)/g)) {
      if (!ids.has(m[1])) missing.push(`${name}: #${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("CSS 含 reduced-motion 降级与移动端底部避让", () => {
  const css = readFileSync(resolve(gameDir, "css", "style.css"), "utf8");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /max\(68px/);
  assert.match(css, /touch-action/);
});

test("必须挂 window.__wordle 调试句柄（项目硬约定）", () => {
  const main = readFileSync(resolve(gameDir, "js", "main.mjs"), "utf8");
  assert.match(main, /window\.__wordle\s*=\s*\{/, "main.mjs 必须挂 window.__wordle");
  assert.match(main, /get game\(\)/, "句柄的 game 必须走 getter，永远拿得到最新控制器");
});
