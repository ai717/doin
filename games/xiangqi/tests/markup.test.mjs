// 页面骨架契约测试：返回门户、缓存占位、语义兜底、i18n 键双向闭合。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
const { strings } = await import("../js/i18n.mjs");

test("返回门户链接：<a href=\"/\" id=\"back-home\">", () => {
  assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/);
});

test("本地 js/css 资源全部携带 ?v=dev 缓存占位", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(assets.length > 0, "未发现本地资源引用");
  const unversioned = assets.filter((v) => !v.includes("?v=dev"));
  assert.deepEqual(unversioned, []);
});

test("noscript 兜底、meta description、favicon、html lang、module 入口", () => {
  assert.match(html, /<noscript/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /rel="icon"/);
  assert.match(html, /<html[^>]+lang="/);
  assert.match(html, /<script[^>]+type="module"/);
  assert.ok(existsSync(resolve(gameDir, "favicon.svg")), "favicon 文件缺失");
});

test("data-i18n / data-i18n-aria 引用的键必须存在于 zh 词典", () => {
  const keys = [...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 10, `i18n 键覆盖过少：${keys.length}`);
  const zhKeys = new Set(Object.keys(strings.zh));
  const missing = keys.filter((key) => !zhKeys.has(key));
  assert.deepEqual(missing, []);
});

test("关卡/章节等静态中文均带 data-i18n 或 JS 覆盖（title/script 豁免）", () => {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const nodes = [...clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)];
  const unhandled = [];
  for (const m of nodes) {
    const tag = m[1].toLowerCase();
    if (tag === "title" || tag === "script") continue;
    if (!m[3].trim()) continue;
    if (m[2].includes("data-i18n")) continue;
    const id = m[2].match(/id="([^"]+)"/)?.[1];
    if (!id) unhandled.push(`<${tag}> ${m[3].trim().slice(0, 12)}`);
  }
  assert.deepEqual(unhandled, []);
});

test("必须挂 window.__xiangqi 调试句柄（项目硬约定）", () => {
  const main = readFileSync(resolve(gameDir, "js", "main.mjs"), "utf8");
  assert.match(main, /window\.__xiangqi\s*=\s*\{/, "main.mjs 必须挂 window.__xiangqi");
});
