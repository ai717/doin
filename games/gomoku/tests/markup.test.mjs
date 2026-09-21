import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(import.meta.dirname, "..", "index.html"), "utf8");

test("index.html 存在且非空", () => {
  assert.ok(html.length > 1000, "index.html 内容过短");
});

test("html lang 属性存在", () => {
  assert.ok(/<html[^>]+lang="/.test(html), "缺 <html lang=...>");
});

test("meta viewport 存在且含 viewport-fit=cover", () => {
  assert.ok(/<meta[^>]+name="viewport"/.test(html), "缺 meta viewport");
  assert.ok(html.includes("viewport-fit=cover"), "viewport 缺 viewport-fit=cover");
});

test("meta description 存在", () => {
  assert.ok(/<meta[^>]+name="description"/.test(html), "缺 meta description");
});

test("返回门户首页链接 id=back-home + href=/", () => {
  assert.ok(/<a[^>]+href="\/"[^>]*id="back-home"/.test(html), "缺返回首页链接");
});

test("所有 css/mjs 资源带 ?v=dev 缓存占位", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((v) => !/^(https?:)?\/\//.test(v) && !v.startsWith("data:") && /\.(mjs|js|css)(\?|$)/.test(v));
  assert.ok(local.length > 0, "未发现本地资源引用");
  for (const v of local) {
    assert.ok(v.includes("?v=dev"), `资源缺 ?v=dev 占位: ${v}`);
  }
});

test("script type=module 存在", () => {
  assert.ok(/<script[^>]+type="module"/.test(html), "缺 ES module 脚本");
});

test("noscript 兜底存在", () => {
  assert.ok(/<noscript/.test(html), "缺 <noscript>");
});

test("主题预读脚本读 doin.gomoku.v1", () => {
  assert.ok(html.includes("doin.gomoku.v1"), "缺主题预读 localStorage");
});

test("canvas#board 存在 + 640x640", () => {
  assert.ok(/<canvas[^>]+id="board"/.test(html), "缺 canvas#board");
  assert.ok(html.includes('width="640"'), "canvas 缺 width=640");
  assert.ok(html.includes('height="640"'), "canvas 缺 height=640");
});

test("模式选择按钮存在 pve/pvp/tsumego", () => {
  assert.ok(html.includes('data-mode="pve"'), "缺 pve 模式按钮");
  assert.ok(html.includes('data-mode="pvp"'), "缺 pvp 模式按钮");
  assert.ok(html.includes('data-mode="tsumego"'), "缺 tsumego 模式按钮");
});

test("难度档位按钮存在 beginner/intermediate/advanced/master", () => {
  assert.ok(html.includes('data-difficulty="beginner"'), "缺 beginner 按钮");
  assert.ok(html.includes('data-difficulty="intermediate"'), "缺 intermediate 按钮");
  assert.ok(html.includes('data-difficulty="advanced"'), "缺 advanced 按钮");
  assert.ok(html.includes('data-difficulty="master"'), "缺 master 按钮");
});

test("执子方按钮存在 data-side=1/2", () => {
  assert.ok(html.includes('data-side="1"'), "缺执黑按钮");
  assert.ok(html.includes('data-side="2"'), "缺执白按钮");
});

test("核心按钮齐全：悔棋/认输/重开/选关", () => {
  assert.ok(html.includes('id="undo-btn"'), "缺悔棋按钮");
  assert.ok(html.includes('id="resign-btn"'), "缺认输按钮");
  assert.ok(html.includes('id="restart-btn"'), "缺重开按钮");
  assert.ok(html.includes('id="level-btn"'), "缺选关按钮");
});

test("顶部工具按钮：音效/语言/规则", () => {
  assert.ok(html.includes('id="sound-btn"'), "缺音效按钮");
  assert.ok(html.includes('id="lang-btn"'), "缺语言按钮");
  assert.ok(html.includes('id="rules-btn"'), "缺规则按钮");
});

test("弹层结构：result/rules/level 三层齐全", () => {
  assert.ok(html.includes('id="result-layer"'), "缺 result 弹层");
  assert.ok(html.includes('id="rules-layer"'), "缺 rules 弹层");
  assert.ok(html.includes('id="level-layer"'), "缺 level 弹层");
});

test("wrong-toast 错着提示元素存在", () => {
  assert.ok(html.includes('id="wrong-toast"'), "缺 wrong-toast");
});

test("棋谱列表 moves-list 存在", () => {
  assert.ok(html.includes('id="moves-list"'), "缺棋谱列表");
});

test("战绩显示元素齐全", () => {
  assert.ok(html.includes('id="stat-wins"'), "缺胜场元素");
  assert.ok(html.includes('id="stat-draws"'), "缺和棋元素");
  assert.ok(html.includes('id="stat-losses"'), "缺负场元素");
});

test("og/twitter 社交卡片存在", () => {
  assert.ok(html.includes('og:title'), "缺 og:title");
  assert.ok(html.includes('twitter:card'), "缺 twitter:card");
});

test("CSS 必须包含 [hidden] 强制隐藏守卫，防止弹层无故遮挡画面", () => {
  const css = readFileSync(resolve(import.meta.dirname, "../css/style.css"), "utf8");
  assert.ok(css.includes("[hidden]"), "CSS 缺少 [hidden] 选择器");
  assert.ok(css.includes("display: none !important"), "CSS 缺少 display: none !important 守卫");
});

