// markup.test.mjs — 标记装配契约测试
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(__dirname, "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
const css = readFileSync(resolve(gameDir, "css", "style.css"), "utf8");

describe("markup: index.html 结构契约", () => {
  it("存在 <a href=\"/\" id=\"back-home\"> 返回首页", () => {
    assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html), "缺 back-home");
  });

  it("存在 <noscript>", () => {
    assert.ok(/<noscript>/.test(html), "缺 noscript");
  });

  it("入口脚本带 type=module 与 ?v=dev", () => {
    assert.ok(/<script[^>]+type="module"[^>]+src="[^"]+\?v=dev"/.test(html),
      "入口脚本缺 type=module 或 ?v=dev");
  });

  it("所有本地 css/js 资源带 ?v=dev", () => {
    const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:"));
    const missingDev = refs.filter((v) => !v.includes("?v=dev") && /\.(mjs|js|css)(\?|$)/.test(v));
    assert.equal(missingDev.length, 0, `以下资源缺 ?v=dev: ${missingDev.join(", ")}`);
  });

  it("存在 favicon 引用", () => {
    assert.ok(/rel="icon"/.test(html), "缺 favicon");
  });

  it("存在 meta description", () => {
    assert.ok(/<meta[^>]+name="description"/.test(html), "缺 meta description");
  });

  it("html 有 lang 属性", () => {
    assert.ok(/<html[^>]+lang=/.test(html), "缺 html lang");
  });
});

describe("markup: DOM id 与 JS 引用闭合", () => {
  // 收集 main.mjs / ui.mjs 里引用的 getElementById / $("xxx")
  const mainSrc = readFileSync(resolve(gameDir, "js", "main.mjs"), "utf8");
  const uiSrc = readFileSync(resolve(gameDir, "js", "ui.mjs"), "utf8");
  const allSrc = mainSrc + "\n" + uiSrc;

  const referencedIds = new Set();
  for (const m of allSrc.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)) {
    referencedIds.add(m[1]);
  }
  for (const m of allSrc.matchAll(/\$\(\s*["']([^"']+)["']\s*\)/g)) {
    referencedIds.add(m[1]);
  }
  // 排除 $ 函数不是 DOM 查询的情况 — 简单起见用另一种正则
  for (const m of uiSrc.matchAll(/this\.dom\.\w+\s*=\s*\$\(\s*["']([^"']+)["']\s*\)/g)) {
    referencedIds.add(m[1]);
  }

  for (const id of referencedIds) {
    it(`JS 引用的 id="${id}" 在 HTML 中存在`, () => {
      assert.ok(html.includes(`id="${id}"`), `HTML 中缺 id="${id}"`);
    });
  }
});

describe("markup: 样式契约", () => {
  it("CSS 包含 prefers-reduced-motion 降级", () => {
    assert.ok(css.includes("prefers-reduced-motion"), "CSS 缺 reduced-motion 降级");
  });

  it("CSS 包含媒体查询 @media 适配窄屏", () => {
    assert.ok(css.includes("@media"), "CSS 无响应式");
  });
});

describe("markup: engine 层 DOM-free 契约", () => {
  const engineSrc = readFileSync(resolve(gameDir, "js", "engine.mjs"), "utf8");
  // 去除注释后检查
  const cleaned = engineSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const leaks = ["document.", "window.", "localStorage", "sessionStorage"].filter((t) =>
    cleaned.includes(t)
  );
  it("engine.mjs 不碰 DOM 或存储", () => {
    assert.equal(leaks.length, 0, `engine 混入: ${leaks.join(", ")}`);
  });
});
