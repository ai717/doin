// markup.test.mjs — 语义标记 / 资源缓存占位 / DOM 与 JS 双向闭合 / CSS 降级契约
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const gameDir = join(import.meta.dirname, "..");
const html = readFileSync(join(gameDir, "index.html"), "utf8");
const jsDir = join(gameDir, "js");
const cssDir = join(gameDir, "css");
const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith(".mjs"));
const css = readdirSync(cssDir).filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(cssDir, f), "utf8")).join("\n");

const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

describe("markup: 文档骨架", () => {
  it("DOCTYPE / lang / charset / viewport 齐全", () => {
    assert.ok(/^<!DOCTYPE html>/i.test(html.trim()));
    assert.match(html, /<html[^>]+lang="[^"]+"/);
    assert.match(html, /<meta[^>]+charset="UTF-8"/i);
    assert.match(html, /<meta[^>]+name="viewport"[^>]+viewport-fit=cover/);
    assert.match(html, /<meta[^>]+name="description"/);
  });
  it("favicon 与样式表存在", () => {
    assert.match(html, /rel="icon"/);
    assert.ok(existsSync(join(gameDir, "favicon.svg")), "favicon.svg 缺失");
    assert.ok(existsSync(join(cssDir, "style.css")), "css/style.css 缺失");
  });
  it("入口脚本是 ES module", () => {
    assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/);
  });
  it("noscript 兜底且带 i18n 键", () => {
    assert.match(html, /<noscript>[\s\S]*data-i18n="noscript"[\s\S]*<\/noscript>/);
  });
  it("返回门户链接指向站点根", () => {
    assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/);
  });
  it("id 全局唯一", () => {
    const dupes = htmlIds.filter((id, i) => htmlIds.indexOf(id) !== i);
    assert.deepEqual(dupes, [], `重复 id：${dupes.join(",")}`);
  });
});

describe("markup: 资源缓存占位（T1 v-dev）", () => {
  it("所有本地 js/css 资源都带 ?v=dev", () => {
    const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1])
      .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
    assert.ok(assets.length > 0);
    const bad = assets.filter((v) => !v.includes("?v=dev"));
    assert.deepEqual(bad, [], `缺 ?v=dev：${bad.join(",")}`);
  });
  it("引用的本地文件真实存在", () => {
    const local = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((m) => m[1].split("?")[0])
      .filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && v.includes("."));
    for (const rel of local) {
      assert.ok(existsSync(join(gameDir, rel)), `引用了不存在的文件 ${rel}`);
    }
  });
});

describe("markup: DOM 与 JS 双向闭合", () => {
  const jsSources = jsFiles.map((f) => stripComments(readFileSync(join(jsDir, f), "utf8")));

  it("JS 取用的每个 id 都在 HTML 里存在", () => {
    const wanted = new Set();
    for (const src of jsSources) {
      for (const m of src.matchAll(/getElementById\(\s*"([^"]+)"\s*\)/g)) wanted.add(m[1]);
      for (const m of src.matchAll(/\bbyId\(\s*"([^"]+)"\s*\)/g)) wanted.add(m[1]);
      for (const m of src.matchAll(/querySelector\(\s*"#([^"]+)"\s*\)/g)) wanted.add(m[1]);
    }
    assert.ok(wanted.size > 20, `取用 id 太少：${wanted.size}`);
    for (const id of wanted) {
      if (id === "stage-title") continue; // 有 .club-title 兜底
      assert.ok(htmlIds.includes(id), `JS 取用了 HTML 中不存在的 id：${id}`);
    }
  });

  it("JS 取用的每个 class 选择器都在 HTML 里存在", () => {
    const needed = [".club-title", ".mode-card", ".spin-btn"];
    for (const sel of needed) {
      assert.ok(html.includes(sel.slice(1)), `HTML 缺 ${sel}`);
    }
    // .spin-btn 由 ui.mjs 在 #spin-set 内查询，必须真的在容器里
    const spinBlock = html.match(/<div class="spin-set" id="spin-set">([\s\S]*?)<\/div>/);
    assert.ok(spinBlock && (spinBlock[1].match(/class="spin-btn"/g) ?? []).length === 3, "三档旋转按钮要在 #spin-set 内");
  });

  it("HTML 里声明的交互件都被 JS 绑定", () => {
    const allJs = jsSources.join("\n");
    const interactive = [...html.matchAll(/<(?:button|a)([^>]*)id="([^"]+)"([^>]*)>/g)].map((m) => m[2]);
    const unbound = interactive.filter((id) => !allJs.includes(`"${id}"`));
    assert.deepEqual(unbound, [], `声明了却没接线：${unbound.join(",")}`);
  });

  it("画布有初始尺寸与无障碍标注", () => {
    const canvas = html.match(/<canvas([^>]*)/);
    assert.ok(canvas, "缺 canvas");
    assert.match(canvas[1], /width="\d+"/);
    assert.match(canvas[1], /height="\d+"/);
    assert.match(canvas[1], /aria-label="[^"]+"/);
  });

  it("浮层：菜单默认可见，其余默认隐藏", () => {
    for (const id of ["ov-tables", "ov-help", "ov-result", "ov-pause"]) {
      const tag = html.match(new RegExp(`<div class="overlay" id="${id}"([^>]*)>`));
      assert.ok(tag, `缺浮层 ${id}`);
      assert.match(tag[1], /\bhidden\b/, `${id} 必须默认 hidden`);
    }
    const menu = html.match(/<div class="overlay" id="ov-menu"([^>]*)>/);
    assert.ok(menu && !/\bhidden\b/.test(menu[1]), "菜单应默认可见");
  });

  it("手中球操作条默认隐藏", () => {
    assert.match(html, /id="place-bar"[^>]*\bhidden\b/);
  });
});

describe("markup: CSS 降级与移动端避让", () => {
  it("尊重 prefers-reduced-motion", () => {
    assert.ok(css.includes("prefers-reduced-motion"));
    const block = css.match(/@media[^{]*prefers-reduced-motion[^{]*\{([\s\S]*?)\n\}/);
    assert.ok(block, "缺 reduced-motion 媒体块");
    assert.equal(/display\s*:\s*none/.test(block[1]), false, "降级不得隐藏核心交互件");
  });
  it("有移动端断点", () => {
    assert.match(css, /@media[^{]*max-width/);
  });
  it("有刘海屏安全区避让", () => {
    assert.match(css, /env\(\s*safe-area-inset/);
  });
  it("画布/舞台禁用浏览器手势", () => {
    assert.match(css, /touch-action\s*:\s*none/);
  });
  it("CSS 大括号配对", () => {
    const noComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    let depth = 0;
    for (const ch of noComments) {
      if (ch === "{") depth += 1;
      else if (ch === "}") depth -= 1;
      assert.ok(depth >= 0, "多余的 }");
    }
    assert.equal(depth, 0, "CSS 大括号不配对");
  });
});

describe("markup: 模块清单完整", () => {
  it("分层模块齐备", () => {
    for (const file of ["engine.mjs", "game.mjs", "rules.mjs", "tables.mjs", "score.mjs", "storage.mjs", "i18n.mjs", "audio.mjs", "render.mjs", "ui.mjs", "main.mjs"]) {
      assert.ok(existsSync(join(jsDir, file)), `缺 ${file}`);
    }
  });
  it("engine.mjs 与 game.mjs 不碰 DOM（可在 Node 直接跑）", () => {
    for (const file of ["engine.mjs", "game.mjs", "rules.mjs", "tables.mjs", "score.mjs"]) {
      const src = stripComments(readFileSync(join(jsDir, file), "utf8"));
      for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
        assert.equal(src.includes(token), false, `${file} 混入 ${token}`);
      }
    }
  });
  it("tests/ 至少覆盖 engine / storage / i18n / markup 四类", () => {
    const names = readdirSync(join(gameDir, "tests")).filter((f) => f.endsWith(".test.mjs"));
    assert.ok(names.length >= 4, `测试文件 ${names.length} 个`);
    for (const want of ["engine.test.mjs", "storage.test.mjs", "i18n.test.mjs", "markup.test.mjs"]) {
      assert.ok(names.includes(want), `缺 ${want}`);
    }
  });
});
