// markup.test.mjs — 语义骨架与模块装配契约（T1 门禁 + 装配闭合）。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const html = read("index.html");
const mainJs = read("js/main.mjs");
const engineJs = read("js/engine.mjs");
const storageJs = read("js/storage.mjs");
const i18nJs = read("js/i18n.mjs");
const css = read("css/style.css");
const htmlIds = () => new Set([...html.matchAll(/id="([^"]+)"/g)].map((x) => x[1]));

test("T1：语义骨架必备件", () => {
  assert.ok(html.includes('<a href="/"'), "返回首页绝对链接");
  assert.ok(/<noscript>[\s\S]*<\/noscript>/.test(html), "noscript 提示");
  assert.ok(/<meta\s+name="description"/.test(html), "SEO 描述");
  assert.ok(html.includes('rel="icon"'), "favicon 链接");
});

test("T1：本地资源全部带 ?v=dev 缓存占位", () => {
  const links = [...html.matchAll(/<(?:link|script)\s+[^>]*(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 2, "至少含 css 与脚本");
  for (const href of links) {
    if (href.startsWith("data:") || href.startsWith("https:")) continue;
    if (!/\.(js|mjs|css)$/.test(href)) continue; // 仅校验参与构建缓存的 js/css
    assert.ok(/\?v=dev$/.test(href), `${href} 必须带 ?v=dev`);
  }
});

test("T1：main.mjs 引用的元素 id 全部存在于 index.html", () => {
  const used = new Set();
  const pat = /\$\s*\(\s*"([^"]+)"\s*\)|getElementById\s*\(\s*"([^"]+)"\s*\)/g;
  let m;
  while ((m = pat.exec(mainJs))) {
    if (m[1]) used.add(m[1]);
    if (m[2]) used.add(m[2]);
  }
  const missing = [...used].filter((id) => !htmlIds().has(id));
  assert.deepEqual(missing, [], "main 引用的 id 必须存在");
});

test("T1：i18n 文案映射键全部命中页面元素", () => {
  const mapSrc = mainJs.match(/const TEXT_MAP = (\{[\s\S]*?\n\});/);
  assert.ok(mapSrc, "TEXT_MAP 存在");
  const entries = [...mapSrc[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)].map((x) => [x[1], x[2]]);
  assert.ok(entries.length > 30, "文案映射覆盖充分");
  for (const [id] of entries) {
    assert.ok(htmlIds().has(id), `TEXT_MAP 的 ${id} 存在于 HTML`);
  }
});

test("八大不变量：模块无 DOM / 共享偏好 / 存档 key / 降级", () => {
  assert.ok(!/document\.|window\.|localStorage|alert\s*\(/.test(engineJs), "engine 纯逻辑不碰 DOM/存储/alert");
  assert.ok(storageJs.includes("doin.mow.v1"), "存档 key 统一");
  assert.ok(i18nJs.includes("doin.lang"), "语言偏好统一共享 key");
  assert.ok(storageJs.includes("try") && storageJs.includes("catch"), "storage 集中 try/catch");
  assert.ok(!/alert\s*\(/.test(mainJs.replace(/window\.confirm/g, "")), "main 无 alert 报错（confirm 仅限破坏性确认）");
});

test("工程红线：移动端安全区 / 动效降级 / 触摸禁用", () => {
  assert.ok(/overscroll-behavior\s*:\s*none/.test(css), "禁止橡皮筋滚动");
  assert.ok(/touch-action\s*:\s*none/.test(css), "触控区禁用默认手势");
  assert.ok(/max\(68px,\s*calc\(16px\s*\+\s*env\(safe-area-inset-bottom\)\)\)/.test(css), "移动端底部广告安全留白");
  assert.ok(/prefers-reduced-motion/.test(css), "动效降级媒体查询");
  assert.ok(css.includes("#stage-canvas"), "画布样式存在");
});
