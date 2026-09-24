// 霓虹弹珠台 · 标记装配契约测试
// 覆盖：index.html 语义骨架 / 返回首页 / 缓存占位 / 语言共享键 / 存储隔离 / 机台关键元素 / CSS 守卫
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css", "style.css"), "utf8");

function readAll(dir, extensions) {
  const out = [];
  for (const name of readdirSync(resolve(root, dir))) {
    const p = resolve(root, dir, name);
    if (statSync(p).isDirectory()) continue;
    if (extensions.some((e) => name.endsWith(e))) out.push(readFileSync(p, "utf8"));
  }
  return out;
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

test("index.html 存在且非空", () => {
  assert.ok(html.length > 1000, "index.html 内容过短");
});

test("html lang 属性存在", () => {
  assert.ok(/<html[^>]+lang="/.test(html), "缺 <html lang=...>");
});

test("meta viewport 存在（移动端安全区适配）", () => {
  assert.ok(/<meta[^>]+name="viewport"/.test(html), "缺 meta viewport");
});

test("meta description 存在", () => {
  assert.ok(/<meta[^>]+name="description"/.test(html), "缺 meta description");
});

test("返回门户首页链接 id=back-home + href=/（平台唯一绝对路径）", () => {
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html), "缺返回首页链接");
});

test("所有 css/mjs 资源带 ?v=dev 缓存占位", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(local.length > 0, "未发现本地资源引用");
  for (const v of local) assert.ok(v.includes("?v=dev"), `资源缺 ?v=dev 占位: ${v}`);
});

test("script type=module 存在", () => {
  assert.ok(/<script[^>]+type="module"/.test(html), "缺 ES module 脚本");
});

test("noscript 兜底存在", () => {
  assert.ok(/<noscript/.test(html), "缺 <noscript>");
});

test("favicon 存在", () => {
  assert.ok(/rel="icon"/.test(html), "缺 favicon");
});

test("机台骨架：canvas 600×800 舞台 + 实体底座操作台", () => {
  assert.ok(/<canvas[^>]+id="board"/.test(html), "缺 canvas#board");
  assert.ok(html.includes('width="600"'), "canvas 缺 width=600");
  assert.ok(html.includes('height="800"'), "canvas 缺 height=800");
  assert.ok(html.includes('id="deck"'), "缺实体底座操作台");
  assert.ok(html.includes('id="btn-flip-l"'), "缺左挡板键");
  assert.ok(html.includes('id="btn-flip-r"'), "缺右挡板键");
  assert.ok(html.includes('id="btn-launch"'), "缺发射键");
  assert.ok(html.includes('id="btn-nudge"'), "缺摇机键");
});

test("双栏机台：左右机关牌匾与计分 LCD 分区齐全", () => {
  assert.ok(html.includes('id="panel-left"'), "缺左侧机关牌匾");
  assert.ok(html.includes('id="panel-right"'), "缺右侧计分 LCD");
  assert.ok(html.includes('id="score-lcd"'), "缺得分 LCD");
  assert.ok(html.includes('id="combo-meter"'), "缺连击仪表");
  assert.ok(html.includes('id="balls-dots"'), "缺弹珠显示");
  assert.ok(html.includes('id="bricks-left"'), "缺剩余砖块显示");
});

test("移动端紧凑 HUD 与安全区适配存在", () => {
  assert.ok(html.includes('id="mobile-hud"'), "缺移动端 HUD");
  const safeArea = css.includes("env(safe-area-inset-bottom)") || css.includes("safe-area-inset-bottom");
  assert.ok(safeArea, "CSS 缺安全区适配");
  assert.ok(css.includes("touch-action"), "CSS 缺 touch-action 防滚动干扰");
});

test("模式与浮层：章节/生存双模式、start/help/clear/over 四浮层", () => {
  assert.ok(html.includes('id="btn-stage-mode"'), "缺章节闯关入口");
  assert.ok(html.includes('id="btn-survival-mode"'), "缺街机生存入口");
  assert.ok(html.includes('id="level-grid"'), "缺选关网格");
  assert.ok(html.includes('id="screen-start"'), "缺 start 浮层");
  assert.ok(html.includes('id="screen-help"'), "缺 help 浮层");
  assert.ok(html.includes('id="screen-clear"'), "缺 clear 浮层");
  assert.ok(html.includes('id="screen-over"'), "缺 over 浮层");
});

test("机关指示灯齐全（缓冲/翻靶/弹射/转盘/滚道/斜坡）", () => {
  for (const id of ["lamp-bumper", "lamp-target", "lamp-sling", "lamp-spinner", "lamp-rollover", "lamp-ramp"]) {
    assert.ok(html.includes(`id="${id}"`), `缺机关指示灯 ${id}`);
  }
});

test("CSS 必须包含 [hidden] 强制隐藏守卫，防止浮层无故遮挡画面", () => {
  assert.ok(css.includes("[hidden]"), "CSS 缺少 [hidden] 选择器");
  assert.ok(css.includes("display: none !important"), "CSS 缺少 display: none !important 守卫");
});

test("CSS 动效降级：prefers-reduced-motion", () => {
  assert.ok(css.includes("prefers-reduced-motion"), "CSS 缺 reduced-motion 降级");
});

test("全站共享语言键 doin.lang（禁止私有语言 key）", () => {
  const js = readAll("js", [".mjs"]).join("\n");
  assert.ok(js.includes("doin.lang"), "语言偏好未读写全站共享 key doin.lang");
});

test("存档键 doin.pinball.v1 在存储模块出现", () => {
  const storage = readFileSync(resolve(root, "js", "storage.mjs"), "utf8");
  assert.ok(storage.includes("doin.pinball.v1"), "存储键应为 doin.pinball.v1");
});

test("存储模块带 try/catch 静默降级", () => {
  const storage = readFileSync(resolve(root, "js", "storage.mjs"), "utf8");
  assert.ok(storage.includes("catch"), "存储模块应 try/catch 降级");
});

test("规则层 DOM-Free：engine.mjs 不碰 DOM/存储（注释已剥离）", () => {
  const engine = stripComments(readFileSync(resolve(root, "js", "engine.mjs"), "utf8"));
  for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
    assert.ok(!engine.includes(token), `engine.mjs 混入 ${token}`);
  }
});

test("模块分层齐全：engine/game/storage/i18n/audio/render/ui/main + levels", () => {
  for (const name of ["engine", "game", "storage", "i18n", "audio", "render", "ui", "main", "levels"]) {
    const p = resolve(root, "js", `${name}.mjs`);
    assert.ok(statSync(p).isFile(), `缺 js/${name}.mjs`);
  }
});
