import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const gameRoot = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(gameRoot, "index.html"), "utf8");
const css = readFileSync(resolve(gameRoot, "css", "style.css"), "utf8");

function sourceFiles() {
  const out = [];
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.isDirectory()) {
        if (name.name === "tests" || name.name === "node_modules") continue;
        walk(resolve(dir, name.name), `${prefix}${name.name}/`);
      } else if (/\.(mjs|js)$/.test(name.name)) {
        out.push({ path: `${prefix}${name.name}`, src: readFileSync(resolve(dir, name.name), "utf8") });
      }
    }
  };
  walk(resolve(gameRoot, "js"), "js/");
  return out;
}

test("index.html 基础 SEO 与移动端声明齐全", () => {
  assert.ok(html.length > 4000);
  assert.ok(/<html[^>]+lang="/.test(html));
  assert.ok(/<meta[^>]+name="viewport"/.test(html));
  assert.ok(html.includes("viewport-fit=cover"));
  assert.ok(/<meta[^>]+name="description"/.test(html));
  assert.ok(html.includes('rel="canonical"'));
  assert.ok(html.includes("og:title") && html.includes("twitter:card"));
});

test("返回门户 / favicon / module / 缓存占位 / noscript", () => {
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html));
  assert.ok(/rel="icon"[^>]+href="favicon\.svg/.test(html));
  const svg = readFileSync(resolve(gameRoot, "favicon.svg"), "utf8");
  assert.ok(svg.includes("<svg") && svg.includes("viewBox"));
  assert.ok(!/[\u4e00-\u9fa5]/.test(svg), "favicon.svg 含汉字");

  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const local = refs.filter((value) => !/^(https?:)?\/\//.test(value) && !value.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(value));
  assert.ok(local.length >= 2);
  for (const value of local) assert.ok(value.includes("?v=dev"), `资源缺 ?v=dev: ${value}`);

  assert.ok(/<script[^>]+type="module"[^>]+src=/.test(html));
  assert.equal([...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>/g)].length, 0, "禁止内联脚本");
  assert.ok(/<noscript/.test(html));
});

test("机台结构：三栏舞台 / Canvas / 底部操作台 / 四层弹层", () => {
  for (const token of ["topbar", "arena", "wing wing-left", "board-stage", "wing wing-right", "instrument-bar", "move-pad", "pump-btn"]) {
    assert.ok(html.includes(token), `缺结构 ${token}`);
  }
  assert.ok(html.includes('id="stage"') && html.includes('<canvas'), "缺 Canvas 舞台");
  assert.ok(html.includes('role="dialog"'));
  for (const id of ["levels-layer", "pause-layer", "result-layer", "help-layer"]) {
    assert.ok(html.includes(`id="${id}"`), `缺弹层 ${id}`);
    assert.ok(new RegExp(`id="${id}"[^>]*hidden`).test(html), `${id} 未带 hidden 初值`);
  }
  for (const id of ["levels-btn", "restart-btn", "pump-btn", "pause-btn", "sound-btn", "lang-btn", "help-btn", "level-plate"]) {
    assert.ok(html.includes(`id="${id}"`), `缺按钮/挂件 ${id}`);
  }
  for (const id of ["era-value", "pooka-count", "fygar-count", "lives-dots", "score-value", "best-value", "fossil-count", "fossil-slots"]) {
    assert.ok(html.includes(`id="${id}"`), `缺 HUD ${id}`);
  }
  for (const dir of ["up", "down", "left", "right"]) {
    assert.ok(html.includes(`data-dir="${dir}"`), `缺十字键 ${dir}`);
  }
});

test("所有中文文本节点挂 data-i18n 或被 JS 引用", () => {
  const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  const jsCode = sourceFiles().map((file) => file.src).join("\n");
  const offenders = [];
  for (const match of clean.matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)) {
    const [, tag, attrs, rawText] = match;
    if (tag.toLowerCase() === "title" || tag.toLowerCase() === "script") continue;
    if (attrs.includes("data-i18n")) continue;
    const id = (attrs.match(/id="([^"]+)"/) ?? [])[1];
    if (id && (jsCode.includes(`"${id}"`) || jsCode.includes(`'${id}'`))) continue;
    offenders.push(`<${tag}> ${rawText.trim().slice(0, 16)}`);
  }
  assert.deepEqual(offenders, [], `index.html 未覆盖中文节点: ${offenders.join(", ")}`);

  const declared = (html.match(/data-i18n="/g) ?? []).length;
  assert.ok(declared >= 30, `data-i18n 声明过少（${declared}）`);
  assert.ok(/data-i18n-aria="/.test(html));
  for (const match of html.matchAll(/<[^>]*aria-label="([^"]*[\u4e00-\u9fa5]+[^"]*)"[^>]*>/g)) {
    assert.ok(match[0].includes("data-i18n-aria"), `aria-label 含中文但未声明 data-i18n-aria: ${match[1]}`);
  }
});

test("JS 源码零裸写中文（门禁 i18n-clean 同构）", () => {
  const offenders = [];
  for (const file of sourceFiles()) {
    if (file.path === "js/i18n.mjs") continue;
    const code = file.src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/(["'`])中文\1/g, '""');
    const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
    if (matches) offenders.push(`${file.path}: ${matches.slice(0, 2).join(", ")}`);
  }
  assert.deepEqual(offenders, []);
});

test("CSS 契约：降级 / 安全区 / 触控拦截 / 实体位移 / 隐藏守卫", () => {
  assert.ok(css.includes("[hidden]") && css.includes("display: none !important"));
  assert.ok(css.includes("prefers-reduced-motion"));
  assert.ok(css.includes("env(safe-area-inset-bottom)"));
  assert.ok(css.includes("touch-action: none"));
  assert.ok(css.includes("overscroll-behavior: none"));
  assert.ok(css.includes("radial-gradient"));
  assert.ok(css.includes("translateY(2px)"));
  assert.ok(css.includes("@media (max-width: 768px)"));
});

test("模块分层齐全，engine 严格 DOM-free", () => {
  const names = readdirSync(resolve(gameRoot, "js"));
  for (const file of ["engine.mjs", "game.mjs", "ui.mjs", "render.mjs", "storage.mjs", "i18n.mjs", "audio.mjs", "main.mjs", "levels.mjs", "score.mjs"]) {
    assert.ok(names.includes(file), `缺 js/${file}`);
  }
  const engine = readFileSync(resolve(gameRoot, "js", "engine.mjs"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.ok(!engine.includes(token), `engine.mjs 混入 ${token}`);
  }
  const all = sourceFiles()
    .map((file) => file.src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"))
    .join("\n");
  assert.ok(!all.includes("location.reload"));
  assert.ok(!all.includes("alert("));
});
