// markup.test.mjs：?v=dev 占位、#back-home 链接、noscript、meta、favicon、DOM/JS 引用闭合。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const gameDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");

test("本地资源均带 ?v=dev 占位", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(assets.length > 0, "应有本地资源");
  for (const a of assets) {
    assert.ok(a.includes("?v=dev"), `${a} 缺 ?v=dev`);
  }
});

test("存在返回首页链接", () => {
  assert.ok(/<a[^>]+href="\/"/.test(html), "缺返回首页链接");
  assert.ok(/id="back-home"/.test(html), "缺 id=back-home");
});

test("存在 noscript 兜底", () => {
  assert.ok(/<noscript/.test(html), "缺 noscript");
});

test("存在 meta description 与 favicon", () => {
  assert.ok(/<meta[^>]+name="description"/.test(html), "缺 meta description");
  assert.ok(/rel="icon"/.test(html), "缺 favicon");
});

test("html lang 属性", () => {
  assert.ok(/<html[^>]+lang="/.test(html), "缺 html lang");
});

test("入口脚本为 ES module", () => {
  assert.ok(/<script[^>]+type="module"/.test(html), "入口应为 ES module");
});

test("DOM id 与 main.mjs 引用闭合", () => {
  const main = readFileSync(resolve(gameDir, "js", "main.mjs"), "utf8");
  // 提取 main.mjs 中 byId 引用的 id
  const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const byIdRefs = [...main.matchAll(/byId\("([^"]+)"\)/g)].map((m) => m[1]);
  for (const id of byIdRefs) {
    assert.ok(ids.includes(id), `main.mjs 引用 id="${id}" 但 index.html 不存在`);
  }
});

test("关键 DOM 元素存在", () => {
  for (const id of ["board", "rays-layer", "level-panel", "result-layer", "help-layer"]) {
    assert.ok(html.includes(`id="${id}"`), `缺 id="${id}"`);
  }
});
