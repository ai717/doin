// markup.test.mjs — 标记与模块契约测试（T1/T2 门禁对应的静态检查）

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  const path = join(ROOT, rel);
  assert.ok(existsSync(path), `文件必须存在: ${rel}`);
  return readFileSync(path, "utf8");
}

test("index.html：语义骨架完整（返回/无脚本/缓存占位/元信息）", () => {
  const html = read("index.html");
  assert.match(html, /<a[^>]*id="back-home"[^>]*href="\/"/, "必须有返回门户链接 href=/");
  assert.match(html, /<noscript>[\s\S]*<\/noscript>/, "必须有 noscript 提示");
  assert.match(html, /<html lang="/, "必须有 lang 属性");
  assert.match(html, /<link rel="stylesheet" href="css\/style\.css\?v=dev"/, "样式必须带 ?v=dev 占位");
  assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev">/, "模块脚本必须带 ?v=dev 占位");
  assert.match(html, /<meta name="description" content="[^"]+"/, "必须有 meta description");
  assert.match(html, /<link rel="icon"[^>]*href="favicon\.svg"/, "必须有 favicon 链接");
  assert.match(html, /<meta name="viewport"[^>]*viewport-fit=cover/, "viewport 需支持安全区");
  // 引用文件全部存在
  for (const rel of ["css/style.css", "js/main.mjs", "favicon.svg"]) {
    assert.ok(existsSync(join(ROOT, rel)), `引用的资源必须存在: ${rel}`);
  }
});

test("js 源码含全站共享语言 key（doin.lang）", () => {
  const i18n = read("js/i18n.mjs");
  assert.match(i18n, /doin\.lang/, "语言偏好必须使用全站共享 key doin.lang");
});

test("engine.mjs 严格 DOM-free（注释剥离后无 document/window/localStorage）", () => {
  const src = read("js/engine.mjs");
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  for (const token of ["document.", "window.", "localStorage", "alert("]) {
    assert.ok(!stripped.includes(token), `engine.mjs 不得出现 ${token}`);
  }
});

test("storage.mjs 存储集中在 try/catch 内", () => {
  const src = read("js/storage.mjs");
  assert.match(src, /try\s*\{[\s\S]*localStorage[\s\S]*?\}\s*catch/, "localStorage 访问必须包在 try/catch");
});

test("data.mjs 数据完整性：物品/配方/职业/对手/残局互不引用缺失 id", () => {
  const data = read("js/data.mjs");
  assert.match(data, /export const ITEMS = \{/, "必须有物品表");
  assert.match(data, /export const RECIPES = \[/, "必须有配方表");
  assert.match(data, /export const PUZZLES = \[/, "必须有残局关卡表");
  assert.match(data, /export const ENEMIES = \{/, "必须有对手表");
  assert.ok((data.match(/id: "/g) || []).length > 40, "物品/对手条目数量合理");
});

test("测试目录至少 4 个正式测试文件", () => {
  const files = ["engine.test.mjs", "storage.test.mjs", "i18n.test.mjs", "markup.test.mjs"];
  for (const f of files) {
    assert.ok(existsSync(join(ROOT, "tests", f)), `tests/${f} 必须存在`);
  }
});
