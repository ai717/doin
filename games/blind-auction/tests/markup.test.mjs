// 装配契约测试：index.html 骨架、缓存占位、id 双向闭合、动效降级。
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const indexHtml = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css", "style.css"), "utf8");
const mainSrc = readFileSync(resolve(root, "js", "main.mjs"), "utf8");
const renderSrc = readFileSync(resolve(root, "js", "render.mjs"), "utf8");

test("index.html 存在且为标记外链型（不含内联实现代码）", () => {
  assert.ok(indexHtml.includes("<!DOCTYPE html>"));
  assert.ok(indexHtml.includes('<script type="module" src="js/main.mjs?v=dev"></script>'));
  assert.ok(indexHtml.includes('rel="stylesheet" href="css/style.css?v=dev"'));
  assert.ok(indexHtml.includes('rel="icon" href="favicon.svg"'));
});

test("本地资源全部带 ?v=dev 占位", () => {
  const assets = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = assets.filter((v) => /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(local.length > 0);
  for (const v of local) assert.ok(v.includes("?v=dev"), `${v} 缺 v=dev`);
});

test("含返回首页链接与 noscript 兜底", () => {
  assert.ok(/<a[^>]+href="\/"/.test(indexHtml), "缺 href=/ 返回首页");
  assert.ok(indexHtml.includes("<noscript>"));
  assert.ok(indexHtml.includes('lang="zh-CN"'));
  assert.ok(indexHtml.includes('<meta name="description"'));
});

test("main.mjs 引用的静态 id 在 index.html 中闭合", () => {
  const staticIds = ["game-app", "btn-lang", "btn-sound", "btn-help"];
  for (const id of staticIds) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html 缺 id="${id}"（main 静态引用）`);
  }
});

test("render.mjs 动态生成的 id 与 main 的引用闭合", () => {
  // 对局中由 render 输出、main 动态引用的 id
  const dynamicIds = ["timer", "bid-slider", "bid-value", "my-cash"];
  for (const id of dynamicIds) {
    assert.ok(mainSrc.includes(`getElementById("${id}")`), `main 未引用 ${id}`);
    assert.ok(renderSrc.includes(`id="${id}"`), `render 未输出 id="${id}"`);
  }
  // 舞台动画锚点由 render 输出（CSS 依赖）
  for (const id of ["stage-inner", "crate-box", "crate-stand"]) {
    assert.ok(renderSrc.includes(`id="${id}"`), `render 未输出 id="${id}"`);
  }
});

test("render data-action 与 main 事件路由闭合", () => {
  const actions = [...renderSrc.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(actions.length > 0);
  for (const action of actions) {
    assert.ok(mainSrc.includes(`"${action}"`) || mainSrc.includes(`'${action}'`), `main 未处理 data-action=${action}`);
  }
});

test("CSS 含动效降级与移动端安全区", () => {
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(css.includes("env(safe-area-inset-bottom)"));
  assert.ok(css.includes("max-width: 768px"));
  assert.ok(css.includes("overscroll-behavior: none"));
});

test("CSS 禁止描边圈：出现径向柔光渐变（createRadialGradient 语义）", () => {
  // 本体高亮必须用无边界径向渐变而非描边轮廓
  assert.ok(css.includes("radial-gradient(circle, rgba(255, 208, 138,"), "crate-glow 缺失径向柔光");
});

test("engine/ai/game/score 不碰 DOM 与存储（DOM-free 契约）", () => {
  const forbidden = ["document.", "window.", "localStorage", "sessionStorage"];
  for (const file of ["engine.mjs", "ai.mjs", "game.mjs", "score.mjs"]) {
    const src = readFileSync(resolve(root, "js", file), "utf8");
    // 剥注释后检查
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const token of forbidden) {
      assert.ok(!code.includes(token), `${file} 触碰 ${token}`);
    }
  }
});

test("模块文件齐备", () => {
  for (const file of ["engine.mjs", "ai.mjs", "game.mjs", "score.mjs", "storage.mjs", "i18n.mjs", "challenge.mjs", "audio.mjs", "render.mjs", "main.mjs"]) {
    assert.ok(existsSync(resolve(root, "js", file)), `缺 js/${file}`);
  }
});
