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

test("index.html 存在且内容完整", () => {
  assert.ok(html.length > 4000, "index.html 内容过短");
  assert.ok(/<html[^>]+lang="/.test(html), "缺 html lang");
  assert.ok(/<meta[^>]+name="viewport"/.test(html), "缺 viewport");
  assert.ok(html.includes("viewport-fit=cover"), "viewport 缺 viewport-fit=cover");
  assert.ok(/<meta[^>]+name="description"/.test(html), "缺 meta description");
  assert.ok(html.includes('rel="canonical"'), "缺 canonical");
  assert.ok(html.includes("og:title") && html.includes("twitter:card"), "缺社交卡片");
});

test("返回门户、favicon、ES module 与缓存占位齐备", () => {
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html), "缺返回首页链接");
  assert.ok(/rel="icon"[^>]+href="favicon\.svg/.test(html), "缺 favicon.svg");
  const svg = readFileSync(resolve(gameRoot, "favicon.svg"), "utf8");
  assert.ok(svg.includes("<svg") && svg.includes("viewBox"), "favicon.svg 非法");
  assert.ok(!/[\u4e00-\u9fa5]/.test(svg), "favicon.svg 含汉字");

  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  const local = refs.filter((value) => !/^(https?:)?\/\//.test(value) && !value.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(value));
  assert.ok(local.length >= 2, "未发现本地资源");
  for (const value of local) assert.ok(value.includes("?v=dev"), `资源缺 ?v=dev: ${value}`);

  assert.ok(/<script[^>]+type="module"[^>]+src=/.test(html), "缺 ES module 入口");
  const inline = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>/g)];
  assert.equal(inline.length, 0, "index.html 不得含内联脚本");
  assert.ok(/<noscript/.test(html), "缺 noscript 兜底");
});

test("机台结构：顶栏 / 三栏舞台 / 底部仪表 / 五层弹层", () => {
  for (const token of ["topbar", "arena", "wing wing-left", "board-stage", "wing wing-right", "instrument-bar"]) {
    assert.ok(html.includes(token), `缺结构 ${token}`);
  }
  assert.ok(html.includes('id="board"') && html.includes('role="grid"'), "缺棋盘容器");
  assert.ok(html.includes('id="radar"'), "缺大九宫雷达");
  for (const id of ["levels-layer", "settings-layer", "help-layer", "result-layer", "confirm-layer"]) {
    assert.ok(html.includes(`id="${id}"`), `缺弹层 ${id}`);
    assert.ok(new RegExp(`id="${id}"[^>]*hidden`).test(html), `${id} 未带 hidden 初值`);
  }
  for (const id of ["undo-btn", "hint-btn", "levels-btn", "restart-btn", "settings-btn", "sound-btn", "lang-btn", "help-btn"]) {
    assert.ok(html.includes(`id="${id}"`), `缺按钮 ${id}`);
  }
  assert.ok(html.includes('data-mode="duel"') && html.includes('data-mode="campaign"'), "缺模式按钮");
  for (const tier of ["novice", "duelist", "master", "infallible"]) {
    assert.ok(html.includes(`data-tier="${tier}"`), `缺 AI 档位 ${tier}`);
  }
  assert.ok(html.includes('id="pvp-toggle"'), "缺同屏双人开关");
  assert.ok(html.includes('id="levels-grid"'), "缺选关网格");
});

test("棋盘 81 格必须由 JS 注入，HTML 里不得写死", () => {
  assert.equal((html.match(/class="cell"/g) ?? []).length, 0, "HTML 中出现静态棋子格");
  const ui = readFileSync(resolve(gameRoot, "js", "ui.mjs"), "utf8");
  assert.ok(ui.includes("buildBoard") && ui.includes("dataset.index"), "棋盘未由 ui.mjs 注入");
});

test("所有中文文本节点都挂 data-i18n 或被 JS 引用", () => {
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
  assert.ok(/data-i18n-aria="/.test(html), "缺 data-i18n-aria");
  for (const match of html.matchAll(/<[^>]*aria-label="([^"]*[\u4e00-\u9fa5]+[^"]*)"[^>]*>/g)) {
    assert.ok(match[0].includes("data-i18n-aria"), `aria-label 含中文但未声明 data-i18n-aria: ${match[1]}`);
  }
});

test("JS 运行源码零裸写中文（与门禁 i18n-clean 同构）", () => {
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
  assert.deepEqual(offenders, [], `源码硬编码中文:\n${offenders.join("\n")}`);
});

test("CSS 契约：降级 / 安全区 / 触控拦截 / 实体位移 / 隐藏守卫", () => {
  assert.ok(css.includes("[hidden]") && css.includes("display: none !important"), "缺 [hidden] 守卫");
  assert.ok(css.includes("prefers-reduced-motion"), "缺动效降级");
  assert.ok(css.includes("env(safe-area-inset-bottom)"), "缺移动端安全区避让");
  assert.ok(css.includes("touch-action: none"), "缺 touch-action 拦截");
  assert.ok(css.includes("overscroll-behavior: none"), "缺滚动拦截");
  assert.ok(css.includes("radial-gradient"), "缺径向柔光");
  assert.ok(css.includes("translateY(2px)"), "缺按下位移");
  assert.ok(css.includes("@media (max-width: 768px)"), "缺移动端断点");
});

test("js/ 分层齐全且 engine 严格 DOM-free", () => {
  const names = readdirSync(resolve(gameRoot, "js"));
  for (const file of ["engine.mjs", "game.mjs", "ui.mjs", "storage.mjs", "i18n.mjs", "audio.mjs", "main.mjs", "ai.mjs", "puzzles.mjs", "score.mjs"]) {
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
  assert.ok(!all.includes("location.reload"), "源码不得使用 location.reload");
  assert.ok(!all.includes("alert("), "源码不得使用 alert");
});
