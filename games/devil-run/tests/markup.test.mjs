// 恶魔迷途 · 标记装配契约测试
//
// 这一套测试守的是「组装层」而不是玩法规则：
//   index.html 的骨架是否满足门户底线、资源是否带缓存占位、
//   JS 引用的 id 是否真的存在、样式是否覆盖响应式与动效降级、
//   以及规则层（engine/game/levels/score）有没有偷偷碰 DOM。
//
// 任何一条挂掉都意味着门户门禁或分层纪律被破坏，必须先修再谈玩法。

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(import.meta.dirname, "..");
const SLUG = "devil-run";

const htmlPath = resolve(dir, "index.html");
const cssPath = resolve(dir, "css", "style.css");
const html = readFileSync(htmlPath, "utf8");
const css = readFileSync(cssPath, "utf8");

function readJsSources() {
  const jsDir = resolve(dir, "js");
  return readdirSync(jsDir)
    .filter((name) => name.endsWith(".mjs"))
    .map((name) => ({ name, src: readFileSync(resolve(jsDir, name), "utf8") }));
}

// 剥离注释后的源码：用于「不许碰 DOM」「不许出现敏感全局」这类断言。
// 注释里提到 document 是允许的（本作注释大量在讲分层纪律）。
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

// ============================================================ 门户底线骨架

test("markup: 门户底线骨架齐全（返回首页 / noscript / 画布 / 图标 / lang / description）", () => {
  assert.ok(
    /<a[^>]+href="\/"[^>]*id="back-home"/.test(html) ||
      /<a[^>]+id="back-home"[^>]*href="\/"/.test(html),
    "缺少返回首页链接 <a href=\"/\" id=\"back-home\">"
  );
  assert.ok(/<noscript/.test(html), "缺少 <noscript> 兜底提示");
  assert.ok(/<canvas[^>]+id="stage"/.test(html), "缺少 <canvas id=\"stage\">");
  assert.ok(/rel="icon"/.test(html), "缺少 favicon");
  assert.ok(/<html[^>]+lang="[a-z]{2}/.test(html), "<html> 缺少 lang 属性");
  assert.ok(/<meta[^>]+name="description"[^>]+content="[^"]{20,}"/.test(html), "缺少有实质内容的 meta description");
  assert.ok(/<meta[^>]+name="viewport"/.test(html), "缺少 viewport");
  assert.ok(/<title>[^<]+<\/title>/.test(html), "缺少 <title>");
});

// ============================================================ 缓存占位与路径

test("markup: 本地资源一律带 ?v=dev 缓存占位", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter(
      (v) =>
        !/^(https?:)?\/\//.test(v) &&
        !v.startsWith("data:") &&
        /\.(mjs|js|css)(\?|$)/.test(v)
    );
  assert.ok(assets.length >= 2, `本地资源太少，疑似漏挂: ${assets.join(", ")}`);
  for (const asset of assets) {
    assert.ok(asset.includes("?v=dev"), `${asset} 缺少 ?v=dev 缓存占位`);
  }
});

test("markup: 入口脚本是 ES module 且页面无任何外部网络依赖", () => {
  assert.ok(
    /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/.test(html),
    "入口脚本必须是 type=\"module\" 的 js/main.mjs?v=dev"
  );

  // 页面本体：零外链资源。
  // rel="canonical" 与 og:* / twitter:* 是 SEO 元信息（指向自己的生产域名），不是资源引用，放行。
  const SEO_REL = /rel="(?:canonical|alternate)"/;
  const META_PROP = /(?:property|name)="(?:og:|twitter:)/;
  const resourceTags = [...html.matchAll(/<(?:script|link|img|iframe|audio|video|source)\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /https?:\/\//.test(tag))
    .filter((tag) => !SEO_REL.test(tag) && !META_PROP.test(tag));
  assert.deepEqual(resourceTags, [], `页面引用了外部资源: ${resourceTags.join(" | ")}`);

  // 零 webfont
  assert.ok(!/@import\s+url\(/.test(css), "CSS 不得 @import 外部样式");
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(css), "CSS 不得引用外部字体");
});

test("markup: 源码内不出现绝对游戏路径（只用相对路径）", () => {
  const sources = [html, css, ...readJsSources().map((f) => f.src)];
  for (const src of sources) {
    assert.ok(!new RegExp(`/games/${SLUG}/`).test(src), `泄漏了本地路径 /games/${SLUG}/`);
    assert.ok(!new RegExp(`["'\`]/${SLUG}/`).test(src), `泄漏了生产绝对路径 /${SLUG}/`);
  }
});

// ============================================================ id 契约

test("markup: JS 引用的每一个 id 都在 index.html 里存在", () => {
  const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(htmlIds.size >= 40, `index.html 的 id 数量异常偏少（${htmlIds.size}），疑似骨架被截断`);

  const missing = [];
  for (const file of readJsSources()) {
    const src = stripComments(file.src);
    // ui.mjs / main.mjs 用 $("id") 与 getElementById("id") 两种写法
    for (const m of src.matchAll(/getElementById\(\s*"([^"]+)"\s*\)/g)) {
      if (!htmlIds.has(m[1])) missing.push(`${file.name}: getElementById("${m[1]}")`);
    }
    for (const m of src.matchAll(/(?:^|[^\w$])\$\(\s*"([^"]+)"\s*\)/g)) {
      if (!htmlIds.has(m[1])) missing.push(`${file.name}: $("${m[1]}")`);
    }
    // querySelector("#id") 也要能对上
    for (const m of src.matchAll(/querySelector\(\s*"#([A-Za-z][\w-]*)"\s*\)/g)) {
      if (!htmlIds.has(m[1])) missing.push(`${file.name}: querySelector("#${m[1]}")`);
    }
  }
  assert.deepEqual(missing, [], `JS 引用了不存在的 id:\n  ${missing.join("\n  ")}`);
});

test("markup: 弹层结构的 hidden / aria 契约完整", () => {
  const layers = [...html.matchAll(/<div class="layer"[^>]*id="([^"]+)"[^>]*>/g)];
  assert.ok(layers.length >= 3, `弹层数量异常（${layers.length}），应有选关/结算/规则三层`);
  for (const [tag, id] of layers.map((m) => [m[0], m[1]])) {
    assert.ok(/\bhidden\b/.test(tag), `弹层 #${id} 初始必须 hidden`);
    assert.ok(/role="dialog"/.test(tag), `弹层 #${id} 缺少 role="dialog"`);
    assert.ok(/aria-modal="true"/.test(tag), `弹层 #${id} 缺少 aria-modal`);
    assert.ok(/aria-labelledby="[^"]+"/.test(tag), `弹层 #${id} 缺少 aria-labelledby`);
  }
  // 结算层的三个出口按钮必须存在（下一关 / 重玩 / 留在此关）
  for (const id of ["result-next", "result-replay", "result-close"]) {
    assert.ok(new RegExp(`id="${id}"`).test(html), `结算层缺少 #${id}`);
  }
});

test("markup: 操作台是实体道具键而非四角浮动按钮", () => {
  for (const id of ["pad-left", "pad-right", "pad-jump", "btn-restart", "btn-sound", "btn-rules", "btn-lang"]) {
    assert.ok(new RegExp(`id="${id}"`).test(html), `操作台缺少 #${id}`);
  }
  // 三个方向键必须是 <button type="button">，避免误触表单提交
  const padTags = [...html.matchAll(/<button[^>]*id="pad-[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.equal(padTags.length, 3, "方向键应有三个");
  for (const tag of padTags) {
    assert.ok(/type="button"/.test(tag), `方向键缺少 type="button": ${tag}`);
    assert.ok(/aria-label="[^"]+"/.test(tag), `方向键缺少 aria-label: ${tag}`);
  }
});

// ============================================================ 样式契约

test("markup: 样式覆盖响应式断点、动效降级与广告安全缓冲", () => {
  assert.ok(existsSync(cssPath), "缺少 css/style.css");

  // 动效降级（硬性红线）
  assert.ok(css.includes("prefers-reduced-motion"), "缺少 prefers-reduced-motion 降级");

  // 三档断点：移动合并 / 小屏微调 / 大屏加固
  assert.ok(/@media\s*\(max-width:\s*768px\)/.test(css), "缺少 768px 移动端断点");
  assert.ok(/@media\s*\(max-width:\s*420px\)/.test(css), "缺少 420px 小屏断点");
  assert.ok(/@media\s*\(min-width:\s*1100px\)/.test(css), "缺少 1100px 大屏断点");

  // 触屏与手势
  assert.ok(css.includes("touch-action: none"), "画布缺少 touch-action: none");
  assert.ok(css.includes("touch-action: manipulation"), "按钮缺少 touch-action: manipulation");

  // 移动端底部广告安全缓冲（AGENTS.md §4.2 强制红线）
  assert.ok(
    /padding-bottom:\s*max\(68px/.test(css) || css.includes("max(68px, calc(16px + env(safe-area-inset-bottom)))"),
    "缺少移动端底部 68px 广告安全缓冲"
  );
  assert.ok(css.includes("env(safe-area-inset"), "缺少安全区 inset 适配");
});

test("markup: 桌面端主舞台居中且宽度受控（为侧边广告留白）", () => {
  // 机台外壳必须有 max-width 上限，避免在宽屏上贴边铺满
  assert.ok(/\.cabinet\s*\{[^}]*max-width:\s*\d{3,4}px/.test(css), ".cabinet 缺少 max-width 上限");
  const m = css.match(/\.cabinet\s*\{[^}]*max-width:\s*(\d{3,4})px/);
  const maxWidth = Number(m[1]);
  assert.ok(maxWidth <= 1100, `.cabinet 的 max-width=${maxWidth}px 超过 1100px 安全线`);
  assert.ok(/\.cabinet\s*\{[^}]*margin:\s*0 auto/.test(css), ".cabinet 未水平居中");
});

test("markup: 严禁三大老套排版病（无固定四角 / 无右侧卡片集群 / 无死白死黑）", () => {
  // 1) 不得出现 position: fixed 的四角浮动控件（弹层 .layer 是遮罩，属于例外）
  const fixedRules = [...css.matchAll(/\.([a-zA-Z][\w-]*)\s*\{[^}]*position:\s*fixed/g)].map((m) => m[1]);
  assert.deepEqual(fixedRules, ["layer"], `除弹层遮罩外不得有 position:fixed 控件，实际: ${fixedRules.join(", ")}`);

  // 2) 顶边必须是内嵌状态栏（marquee），而不是四角散落
  assert.ok(/\.marquee\s*\{[^}]*display:\s*flex/.test(css), "缺少顶部一体化铭牌栏 .marquee");
  assert.ok(/\.machine\s*\{[^}]*grid-template-columns/.test(css), "缺少左右翼对称布局的 .machine 网格");

  // 3) 背景必须是环境渐变，不能是纯白/纯黑
  assert.ok(/body\s*\{[^}]*radial-gradient/.test(css), "body 缺少环境径向渐变");
  assert.ok(/body\s*\{[^}]*linear-gradient/.test(css), "body 缺少底层线性渐变");
  assert.ok(!/background(-color)?:\s*#(?:fff|ffffff|000|000000)\b/i.test(css), "出现死白/死黑纯色背景");
});

// ============================================================ 分层纪律

test("markup: 规则层（engine/game/levels/score/audio）剥离注释后完全 DOM-free", () => {
  const RULE_LAYERS = ["engine.mjs", "game.mjs", "levels.mjs", "score.mjs"];
  for (const name of RULE_LAYERS) {
    const src = stripComments(readFileSync(resolve(dir, "js", name), "utf8"));
    for (const token of ["document.", "window.", "localStorage", "sessionStorage", "navigator."]) {
      assert.ok(!src.includes(token), `${name} 不得触碰 ${token}`);
    }
  }
});

test("markup: localStorage 只允许出现在 storage.mjs 与 i18n.mjs", () => {
  const allowed = new Set(["storage.mjs", "i18n.mjs"]);
  const offenders = [];
  for (const file of readJsSources()) {
    if (allowed.has(file.name)) continue;
    if (stripComments(file.src).includes("localStorage")) offenders.push(file.name);
  }
  assert.deepEqual(offenders, [], `以下模块私自读写 localStorage: ${offenders.join(", ")}`);
});

test("markup: i18n 使用全站共享 key doin.lang", () => {
  const src = readFileSync(resolve(dir, "js", "i18n.mjs"), "utf8");
  assert.ok(src.includes('"doin.lang"') || src.includes("'doin.lang'"), "i18n 未使用全站共享 key doin.lang");
  assert.ok(!/doin\.[a-z-]+\.lang/.test(src), "i18n 出现了私有语言 key");
});

// ============================================================ 模块图完整性

test("markup: js/ 下的相对导入全部能解析到真实文件", () => {
  const jsDir = resolve(dir, "js");
  const files = new Set(readdirSync(jsDir));
  const missing = [];
  for (const file of readJsSources()) {
    for (const m of stripComments(file.src).matchAll(/from\s+"(\.[^"]+)"/g)) {
      const spec = m[1].replace(/^\.\//, "");
      if (!files.has(spec)) missing.push(`${file.name} → ${m[1]}`);
    }
  }
  assert.deepEqual(missing, [], `存在无法解析的导入:\n  ${missing.join("\n  ")}`);
});

test("markup: 每个模块都可以被独立加载（无语法/副作用崩溃）", async () => {
  // engine/levels/score/storage/i18n 都是纯模块，可以在 Node 里直接 import。
  // ui/render/main 依赖 DOM，不在本断言范围（由浏览器预览与门禁负责）。
  for (const name of ["engine.mjs", "levels.mjs", "score.mjs", "storage.mjs", "i18n.mjs", "game.mjs"]) {
    const mod = await import(new URL(`../js/${name}`, import.meta.url).href);
    assert.ok(mod && typeof mod === "object", `${name} 未能正常导出`);
  }
});

// ============================================================ 无障碍与体验兜底

test("markup: 关键交互元素具备 aria 标注与实时区域", () => {
  // 画布要有可读名称
  assert.ok(/<canvas[^>]+aria-label="[^"]+"/.test(html), "画布缺少 aria-label");
  // 轻提示要有 aria-live，死亡/提示才能被读屏捕获
  assert.ok(/aria-live="polite"/.test(html), "缺少 aria-live 实时区域");
  // 音效键要能表达开关状态
  assert.ok(/id="btn-sound"[^>]*aria-pressed="(true|false)"/.test(html), "#btn-sound 缺少 aria-pressed");
  // 左右翼要有分组语义
  assert.ok(/<aside[^>]+class="wing wing-left"[^>]+aria-label="[^"]+"/.test(html), "左翼缺少 aria-label");
  assert.ok(/<aside[^>]+class="wing wing-right"[^>]+aria-label="[^"]+"/.test(html), "右翼缺少 aria-label");
});

test("markup: 资源完整（favicon / 封面登记 / 测试目录）", () => {
  assert.ok(existsSync(resolve(dir, "favicon.svg")), "缺少 favicon.svg");

  const tests = readdirSync(resolve(dir, "tests")).filter((n) => n.endsWith(".test.mjs"));
  assert.ok(tests.length >= 3, `测试文件不足 3 个（实际 ${tests.length}），T2 建议 6+`);
});
