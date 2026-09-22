// markup.test.mjs — 标记装配契约
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

  it("无外链资源（零 CDN / 零 webfont）", () => {
    const external = [...html.matchAll(/(?:src|href)="((https?:)?\/\/[^"]+)"/g)].map((m) => m[1]);
    assert.equal(external.length, 0, `存在外链: ${external.join(", ")}`);
  });

  it("存在 favicon 与 meta description 与 html lang", () => {
    assert.ok(/rel="icon"/.test(html), "缺 favicon");
    assert.ok(/<meta[^>]+name="description"/.test(html), "缺 meta description");
    assert.ok(/<html[^>]+lang=/.test(html), "缺 html lang");
  });
});

describe("markup: DOM id 与 JS 引用闭合", () => {
  const mainSrc = readFileSync(resolve(gameDir, "js", "main.mjs"), "utf8");
  const uiSrc = readFileSync(resolve(gameDir, "js", "ui.mjs"), "utf8");
  const allSrc = `${mainSrc}\n${uiSrc}`;

  const referencedIds = new Set();
  for (const m of allSrc.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)) referencedIds.add(m[1]);
  for (const m of allSrc.matchAll(/\$\(\s*["']([^"']+)["']\s*\)/g)) referencedIds.add(m[1]);

  it("至少引用了主舞台与 HUD 的关键节点", () => {
    for (const id of ["game-app", "holes-grid", "hud-score", "hud-combo", "hud-time"]) {
      assert.ok(referencedIds.has(id), `JS 未引用 ${id}`);
    }
  });

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

  it("CSS 包含窄屏媒体查询", () => {
    assert.ok(/@media[^{]*\(max-width/.test(css), "CSS 无响应式");
  });

  it("移动端底部预留广告安全避让区", () => {
    assert.ok(/--safe-bottom:\s*6[0-9]px/.test(css), "移动端未按红线预留底部安全间距");
  });

  it("核心操作区声明 touch-action: none 且禁用橡皮筋", () => {
    assert.ok(/\.garden\s*\{[^}]*touch-action:\s*none/s.test(css), "garden 缺 touch-action:none");
    assert.ok(/overscroll-behavior:\s*none/.test(css), "未禁用 overscroll");
  });
});

describe("markup: 分层契约", () => {
  it("engine.mjs 不碰 DOM 或存储", () => {
    const src = readFileSync(resolve(gameDir, "js", "engine.mjs"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const leaks = ["document.", "window.", "localStorage", "sessionStorage"].filter((t) => src.includes(t));
    assert.equal(leaks.length, 0, `engine 混入: ${leaks.join(", ")}`);
  });

  it("game.mjs 不碰 DOM 或存储", () => {
    const src = readFileSync(resolve(gameDir, "js", "game.mjs"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    const leaks = ["document.", "window.", "localStorage"].filter((t) => src.includes(t));
    assert.equal(leaks.length, 0, `game 混入: ${leaks.join(", ")}`);
  });

  it("localStorage 只集中在 storage/i18n 两处且带 try/catch", () => {
    for (const file of ["storage.mjs", "i18n.mjs"]) {
      const src = readFileSync(resolve(gameDir, "js", file), "utf8");
      assert.ok(src.includes("localStorage"), `${file} 应集中处理存储`);
      assert.ok(src.includes("catch"), `${file} 缺 try/catch 降级`);
    }
  });
});
