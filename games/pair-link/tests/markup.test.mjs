// 标记与装配静态契约：DOCTYPE / lang / viewport / meta / favicon / noscript / 返回门户 /
// ?v=dev 占位 / 相对 import / DOM id 闭合 / 字体栈 / 390px / 动效降级 /
// 零外链 / 无 alert / 无营销式页头页尾 / 母题表完整性。
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import { MOTIFS, TINTS } from "../js/motifs.mjs";
import { strings } from "../js/i18n.mjs";

const gameRoot = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(gameRoot, "index.html"), "utf8");
const css = readFileSync(resolve(gameRoot, "css", "style.css"), "utf8");
const jsDir = resolve(gameRoot, "js");
const jsFiles = readdirSync(jsDir).filter((name) => name.endsWith(".mjs"));
const jsSources = Object.fromEntries(
  jsFiles.map((name) => [name, readFileSync(resolve(jsDir, name), "utf8")])
);
const allJs = Object.values(jsSources).join("\n");

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/* ------------------------------------------------------------ 基础标记 */

test("index.html：DOCTYPE / html lang / viewport / meta description / favicon", () => {
  assert.match(html, /^<!DOCTYPE html>/i);
  assert.match(html, /<html[^>]+lang="[a-zA-Z-]+"/);
  assert.match(html, /<meta[^>]+name="viewport"[^>]+width=device-width/);
  assert.match(html, /<meta[^>]+name="description"[^>]+content="[^"]{10,}"/);
  assert.match(html, /<link[^>]+rel="icon"[^>]+href="favicon\.svg\?v=dev"/);
  assert.ok(existsSync(resolve(gameRoot, "favicon.svg")), "favicon.svg 必须存在");
});

test("index.html：<noscript> 兜底与返回门户首页链接", () => {
  assert.match(html, /<noscript>/);
  assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"|id="back-home"[^>]*href="\/"/);
});

test("index.html：本地 CSS / JS 引用必须带 ?v=dev，且入口为 ES module", () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => !/^(https?:)?\/\//.test(value) && !value.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(value));
  assert.ok(assets.length >= 2, "至少应引用 css/style.css 与 js/main.mjs");
  assets.forEach((value) => assert.ok(value.includes("?v=dev"), value + " 缺少 ?v=dev 占位"));
  assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/);
});

test("路径规范：游戏内部不得出现绝对路径，唯一例外是返回首页的 href=\"/\"", () => {
  const offenders = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((value) => value !== "/" && (value.startsWith("/") || /^[a-zA-Z]:\\/.test(value) || value.startsWith("file://")));
  assert.deepEqual(offenders, [], "index.html 存在绝对路径");

  const jsOffenders = [];
  Object.entries(jsSources).forEach(([name, source]) => {
    const code = stripComments(source);
    if (/"\/games\//.test(code) || /"\/pair-link\//.test(code) || /file:\/\//.test(code)) jsOffenders.push(name);
  });
  assert.deepEqual(jsOffenders, [], "JS 内不得写死绝对路径");
});

test("导入闭合：所有相对 import 指向真实存在的文件，且不携带查询串", () => {
  const problems = [];
  Object.entries(jsSources).forEach(([name, source]) => {
    const specifiers = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    specifiers.forEach((spec) => {
      if (!spec.startsWith(".")) {
        problems.push(name + " 引入了非相对路径: " + spec);
        return;
      }
      if (spec.includes("?")) {
        problems.push(
          name + " 的 import 携带查询串（Node 原生测试无法解析）: " + spec
        );
        return;
      }
      const target = resolve(jsDir, spec);
      if (!existsSync(target) || !statSync(target).isFile()) {
        problems.push(name + " 的 import 目标不存在: " + spec);
      }
    });
  });
  assert.deepEqual(problems, []);
  assert.equal(jsFiles.length, 10, "js/ 下应有 10 个模块");
});

test("index.html 与 js/ 之间不存在遗留占位符", () => {
  assert.ok(!html.includes("<slug>"), "index.html 残留 <slug> 占位");
  assert.ok(!allJs.includes("<slug>"), "js/ 残留 <slug> 占位");
  assert.ok(!/TODO|FIXME|伪代码/.test(allJs), "js/ 不得残留 TODO / 伪代码标记");
});

/* ------------------------------------------------------------ DOM id 闭合 */

test("DOM id 闭合：JS 引用的每个 id 都存在于 index.html", () => {
  const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const referenced = new Set();
  allJs.replace(/(?:getElementById|byId)\("([^"]+)"\)/g, (_, id) => {
    referenced.add(id);
    return "";
  });
  allJs.replace(/querySelector\("#([A-Za-z0-9_-]+)"\)/g, (_, id) => {
    referenced.add(id);
    return "";
  });
  const missing = [...referenced].filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, [], "JS 引用了 index.html 中不存在的 id");
  assert.ok(referenced.size >= 30, "被引用的 id 数量异常偏少，检查是否漏了装配");
});

test("DOM id 契约：任务书 1.6 节列出的关键节点全部存在", () => {
  const required = [
    "app",
    "back-home",
    "stage",
    "board-wrap",
    "board",
    "fx",
    "hud",
    "level-plaque",
    "level-name",
    "timer",
    "timer-ring",
    "timer-text",
    "combo-lamp",
    "combo-count",
    "combo-ring",
    "score-value",
    "best-value",
    "stars",
    "btn-hint",
    "hint-count",
    "btn-shuffle",
    "shuffle-count",
    "btn-pause",
    "btn-restart",
    "btn-sound",
    "btn-lang",
    "btn-help",
    "overlay",
    "panel-start",
    "panel-pause",
    "panel-result",
    "panel-help",
    "panel-levels",
    "board-live",
    "toast"
  ];
  const htmlIds = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const missing = required.filter((id) => !htmlIds.has(id));
  assert.deepEqual(missing, []);
});

test("i18n 闭合：index.html 的每个 data-i18n 键在中英两表中都存在且非空", () => {
  const keys = new Set();
  [...html.matchAll(/data-i18n(?:-label|-title)?="([^"]+)"/g)].forEach((m) => keys.add(m[1]));
  assert.ok(keys.size >= 30, "data-i18n 键数量异常偏少");
  const missing = [];
  keys.forEach((key) => {
    if (typeof strings.zh[key] !== "string" || strings.zh[key].trim() === "") missing.push("zh." + key);
    if (typeof strings.en[key] !== "string" || strings.en[key].trim() === "") missing.push("en." + key);
  });
  assert.deepEqual(missing, []);
});

/* ------------------------------------------------------------ 样式契约 */

test("CSS：系统字体栈、零 WebFont、390px 适配与横向不溢出", () => {
  assert.match(css, /system-ui/);
  assert.ok(!/@font-face/.test(css), "不得内嵌 WebFont");
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(css), "不得引用在线字体");
  assert.match(css, /@media\s*\(max-width:\s*768px\)/);
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /aspect-ratio:\s*12\s*\/\s*10/, "棋盘必须保持 12:10 逻辑盘比例");
});

test("CSS：桌面双栏沉浸舞台，不做手机竖屏壳", () => {
  assert.match(css, /#stage\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /#hud\s*\{[^}]*flex:\s*0 0/s, "侧栏必须是固定宽度的一栏");
  assert.ok(!/max-width:\s*4[0-9]{2}px/.test(css.split("@media")[0]), "基础样式不得把页面锁成手机宽度");
  assert.ok(!/9\s*\/\s*16/.test(css), "不得把页面锁成 9:16 竖屏比例");
});

test("CSS：prefers-reduced-motion 降级覆盖，且不改变规则结果", () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  const block = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(block, /animation-duration/);
  assert.match(block, /transition-duration/);
});

test("CSS：零外链资源，图片只允许内联 data URI", () => {
  const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1].trim().replace(/^["']|["']$/g, ""));
  const remote = urls.filter((value) => !value.startsWith("data:"));
  assert.deepEqual(remote, [], "CSS 中出现了非 data URI 的外链资源");
  assert.ok(urls.length >= 1, "至少应有一处内联噪点纹理");
});

/* ------------------------------------------------------------ 零外链与交互底线 */

test("零外链：无 CDN / 远程 API / 外链图片 / 远程音频", () => {
  const remoteInHtml = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((value) => /^(https?:)?\/\//.test(value));
  assert.deepEqual(remoteInHtml, [], "index.html 不得引用远程资源");

  const js = stripComments(allJs);
  assert.ok(!/\bfetch\s*\(/.test(js), "不得使用 fetch 调用远程 API");
  assert.ok(!/XMLHttpRequest/.test(js), "不得使用 XMLHttpRequest");
  assert.ok(!/new\s+Image\s*\(/.test(js), "不得加载远程图片");
  assert.ok(!/new\s+Audio\s*\(/.test(js), "不得加载外部音频文件");
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(js), "JS 中不得出现远程 URL");
});

test("交互底线：无 alert、无原生模态框阻塞，反馈走页面内 toast", () => {
  const js = stripComments(allJs);
  assert.ok(!/\balert\s*\(/.test(js), "禁止使用 alert");
  assert.ok(!/\bprompt\s*\(/.test(js), "禁止使用 prompt");
  assert.ok(!/\bconfirm\s*\(/.test(js), "本作无破坏性操作，不应使用 confirm");
  assert.match(html, /id="toast"/);
});

test("无营销式页头页尾", () => {
  assert.ok(!/<footer/i.test(html), "不得制作传统页尾");
  assert.ok(!/class="[^"]*(hero|banner|marketing|newsletter)/i.test(html));
  assert.ok(!/<h1/i.test(html), "不得用大标题占据游戏区域");
});

test("可访问性：aria-live 播报区与关键 aria 属性齐备", () => {
  assert.match(html, /id="board-live"[^>]*aria-live="polite"/);
  assert.match(html, /id="board"[^>]*role="grid"/);
  assert.match(html, /aria-label="[^"]+"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(css, /:focus-visible/);
});

/* ------------------------------------------------------------ 模块职责 */

test("engine.mjs：纯规则层，绝不接触 DOM / 存储 / 计时器", () => {
  const code = stripComments(jsSources["engine.mjs"]);
  ["document.", "window.", "localStorage", "sessionStorage", "requestAnimationFrame", "querySelector"].forEach((token) => {
    assert.ok(!code.includes(token), "engine.mjs 混入了 " + token);
  });
  assert.match(code, /export function findLinkPath/);
  assert.match(code, /export function hasAnyPair/);
  assert.match(code, /export function createState/);
});

test("score.mjs：计分唯一口径，UI 不得自算分数", () => {
  assert.match(jsSources["score.mjs"], /export function clearScore/);
  assert.match(jsSources["score.mjs"], /export function endBonus/);
  assert.match(jsSources["score.mjs"], /export function starsFor/);
  assert.ok(!/\bscore\s*\+=/.test(stripComments(jsSources["ui.mjs"])), "ui.mjs 不得自行累加分数");
  assert.ok(!/100\s*\+\s*30/.test(stripComments(jsSources["ui.mjs"])));
});

test("storage.mjs：唯一存档出口；语言偏好读写只允许出现在 i18n.mjs", () => {
  const users = Object.entries(jsSources)
    .filter(([, source]) => stripComments(source).includes("localStorage"))
    .map(([name]) => name)
    .sort();
  assert.deepEqual(users, ["i18n.mjs", "storage.mjs"], "localStorage 只允许出现在 storage.mjs 与 i18n.mjs");
  assert.match(jsSources["storage.mjs"], /catch/);
  assert.match(jsSources["i18n.mjs"], /catch/);
  assert.match(jsSources["storage.mjs"], /doin\.pair-link\.v1/);
});

test("i18n.mjs：统一读写全站共享 key doin.lang", () => {
  assert.match(jsSources["i18n.mjs"], /doin\.lang/);
  const langWriters = Object.entries(jsSources).filter(([name, source]) =>
    name !== "i18n.mjs" && /localStorage\.setItem\(\s*"doin\.lang"/.test(source)
  );
  assert.deepEqual(langWriters, [], "除 i18n.mjs 外不得私自写语言偏好");
});

test("audio.mjs：纯 Web Audio 程序化合成，零外部音频文件", () => {
  const code = stripComments(jsSources["audio.mjs"]);
  assert.match(code, /AudioContext/);
  assert.match(code, /createOscillator/);
  assert.match(code, /catch/);
  assert.ok(!/\.mp3|\.wav|\.ogg/.test(code));
});

test("render.mjs：只读 engine state，负责 DPR / ResizeObserver", () => {
  const code = stripComments(jsSources["render.mjs"]);
  assert.match(code, /devicePixelRatio/);
  assert.match(code, /ResizeObserver/);
  assert.match(code, /prefers-reduced-motion/);
  assert.ok(!/applyPick|shuffleBoard/.test(code), "render 不得改动规则状态");
});

/* ------------------------------------------------------------ 母题表 */

test("母题表：12 个母题形状与颜色两两不同，path 为自包含 SVG 数据", () => {
  assert.equal(MOTIFS.length, 12);
  assert.equal(new Set(MOTIFS.map((m) => m.id)).size, 12);
  assert.equal(new Set(MOTIFS.map((m) => m.key)).size, 12);
  assert.equal(new Set(MOTIFS.map((m) => m.tint)).size, 12, "12 个母题必须各配一个专属琉璃色");
  MOTIFS.forEach((motif) => {
    assert.ok(TINTS[motif.tint], motif.key + " 的 tint 不在 TINTS 表中");
    motif.paths.forEach((d) => {
      assert.match(d, /^M[\s\S]+Z$/, motif.key + " 的 path 必须是闭合路径");
      assert.ok(!/https?:/.test(d), "path 不得含外链");
    });
  });
  const paths = MOTIFS.flatMap((m) => m.paths);
  assert.equal(new Set(paths).size, paths.length, "path 数据必须两两不同");
});
