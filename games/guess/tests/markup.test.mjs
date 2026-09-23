import { bandIntervalPercent } from "../js/ui.mjs";
// markup.test.mjs —— 装配契约：index.html 与 js/css 互相闭合，缓存占位与外部依赖合规

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css", "style.css"), "utf8");
const jsDir = resolve(root, "js");
const jsFiles = readdirSync(jsDir).filter((n) => n.endsWith(".mjs"));
const jsSources = new Map(jsFiles.map((n) => [n, readFileSync(resolve(jsDir, n), "utf8")]));
const allJs = [...jsSources.values()].join("\n");
const testsDir = resolve(root, "tests");
const testsSource = readdirSync(testsDir)
  .filter((n) => n.endsWith(".test.mjs"))
  .map((n) => readFileSync(resolve(testsDir, n), "utf8"))
  .join("\n");

function idsIn(markup) {
  return new Set([...markup.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
}

test("index.html 具备门户装配所需的全部锚点", () => {
  const ids = idsIn(html);
  for (const id of ["back-home", "stage-bar", "stage-core", "sonar-stage", "hunter-cabin", "sonar-band", "band-live", "echo-log", "btn-fire"]) {
    assert.ok(ids.has(id), `index.html 缺少 #${id}`);
  }
  assert.match(html, /<a[^>]+href="\/"/, "缺返回门户链接");
  assert.match(html, /<noscript/, "缺 noscript 兜底");
  assert.match(html, /<meta[^>]+name="description"/, "缺 meta description");
  assert.match(html, /rel="icon"/, "缺 favicon");
  assert.match(html, /<html[^>]+lang="/, "缺 html lang");
  assert.match(html, /<script[^>]+type="module"/, "入口应为 ES module");
});

test("所有本地资源都带 ?v=dev 缓存占位，且零外链", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:"));
  assert.ok(local.length >= 2, "应有本地 css/js 引用");
  for (const v of local) {
    if (/\.(mjs|js|css)(\?|$)/.test(v)) assert.ok(v.includes("?v=dev"), `${v} 缺 ?v=dev`);
  }
  const external = refs.filter((v) => /^(https?:)?\/\//.test(v));
  assert.deepEqual(external, [], "严禁任何外链（CDN / 字体 / 图片）");
  assert.doesNotMatch(html, /@import|fonts\.googleapis|cdn\./);
});

test("js 里引用的每个 id 都在 index.html 中存在（装配表双向闭合）", () => {
  const ids = idsIn(html);
  const used = [...allJs.matchAll(/(?:getElementById|byId)\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(used.length > 20, "js 中应有大量 DOM 装配引用");
  for (const id of used) assert.ok(ids.has(id), `js 引用了不存在的 #${id}`);
});

test("UI_IDS 清单与 index.html 完全对齐", async () => {
  const { UI_IDS } = await import("../js/ui.mjs").catch(() => ({ UI_IDS: null }));
  if (!UI_IDS) return; // ui.mjs 依赖 document，node 下无法 import 时跳过
  const ids = idsIn(html);
  for (const id of UI_IDS) assert.ok(ids.has(id), `UI_IDS 中的 #${id} 在 index.html 里不存在`);
});

test("index.html 引用的每个 js 文件都真实存在", () => {
  const srcs = [...html.matchAll(/src="([^"]+\.mjs)(\?[^"]*)?"/g)].map((m) => m[1]);
  for (const src of srcs) {
    const name = src.split("/").pop();
    assert.ok(jsFiles.includes(name), `index.html 引用了不存在的脚本 ${src}`);
  }
  for (const name of jsFiles) {
    const relative = `js/${name}`;
    const importedByOthers = [...jsSources.entries()].some(([file, src]) => file !== name && src.includes(`./${name}`));
    // solver.mjs 是可解性证明工具，只被测试消费也算有主
    assert.ok(
      html.includes(relative) || importedByOthers || testsSource.includes(name),
      `${name} 既没被 index.html 引用也没被任何模块或测试 import`
    );
  }
});

test("样式具备动效降级、移动端广告避让与触控保护", () => {
  assert.match(css, /prefers-reduced-motion/, "缺 prefers-reduced-motion 降级");
  assert.match(css, /env\(safe-area-inset-bottom\)/, "缺移动端底部安全避让");
  assert.match(css, /touch-action:\s*none/, "核心舞台必须禁用默认滚动");
  assert.match(css, /overscroll-behavior:\s*none/, "缺橡皮筋禁用");
  assert.match(css, /@media\s*\(max-width:\s*899px\)/, "缺移动端断点");
});

test("规则层不碰 DOM 与存储，语言与存档 key 合规", () => {
  const engine = jsSources.get("engine.mjs") ?? "";
  const stripped = engine.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.ok(!stripped.includes(token), `engine.mjs 混入 ${token}`);
  }
  assert.ok(allJs.includes("doin.lang"), "语言偏好必须走 doin.lang");
  assert.ok((jsSources.get("storage.mjs") ?? "").includes("doin.guess.v1"), "存档 key 必须是 doin.guess.v1");
  assert.ok((jsSources.get("storage.mjs") ?? "").includes("catch"), "存档必须带 try/catch 降级");
});

test("声呐包围区按数值刻度映射，不因闭区间计数而越界", () => {
  assert.deepEqual(bandIntervalPercent(13, 88, 13, 88), { left: 0, width: 100 });
  const tail = bandIntervalPercent(67, 88, 13, 88);
  assert.ok(Math.abs(tail.left - (54 / 76) * 100) < 1e-9);
  assert.ok(Math.abs(tail.width - (22 / 76) * 100) < 1e-9);
  const point = bandIntervalPercent(66, 66, 13, 88);
  assert.ok(Math.abs(point.left - (53 / 76) * 100) < 1e-9);
  assert.ok(Math.abs(point.width - (1 / 76) * 100) < 1e-9);
});
