// markup.test.mjs — index.html 语义骨架、CSS 主题、DOM 结构契约
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const html = read("index.html");
const css = read("css/style.css");
const engineJs = read("js/engine.mjs");
const storageJs = read("js/storage.mjs");
const i18nJs = read("js/i18n.mjs");
const audioJs = read("js/audio.mjs");

const htmlIds = () => new Set([...html.matchAll(/id="([^"]+)"/g)].map((x) => x[1]));

// =========================================================================
// T1：语义骨架必备件
// =========================================================================

test("T1：返回首页绝对链接 + noscript 提示", () => {
  assert.ok(html.includes('<a href="/"'), "返回首页绝对链接");
  assert.ok(/<noscript>[\s\S]*<\/noscript>/.test(html), "noscript 提示");
});

test("T1：本地资源全部带 ?v=dev 缓存占位", () => {
  const links = [...html.matchAll(/<(?:link|script)\s+[^>]*(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 2, "至少含 css 与脚本");
  for (const href of links) {
    if (href.startsWith("data:") || href.startsWith("https:")) continue;
    if (!/\.(js|mjs|css)(\?|$)/.test(href)) continue;
    assert.ok(href.includes("?v=dev"), `${href} 必须带 ?v=dev`);
  }
});

test("T1：head 含 SEO 描述 + favicon", () => {
  assert.ok(/<meta\s+name="description"/.test(html), "SEO 描述");
  assert.ok(html.includes('rel="icon"'), "favicon 链接");
});

// =========================================================================
// T1：DOM 结构契约（5 工位 / 3 窗口 / 4 猫 / 5 Tab / HUD）
// =========================================================================

test("T1：5 工位全部在 stage 中存在", () => {
  for (const sid of ["roast", "grind", "extract", "latte", "serve"]) {
    assert.ok(html.includes(`data-station="${sid}"`), `${sid} 工位存在`);
  }
});

test("T1：3 窗口全部存在", () => {
  for (const wid of ["window_takeout", "window_terrace", "window_garden"]) {
    assert.ok(html.includes(`data-window="${wid}"`), `${wid} 窗口存在`);
  }
});

test("T1：5 Tab 全部存在", () => {
  for (const tab of ["stations", "drinks", "cats", "guests", "shop"]) {
    assert.ok(html.includes(`data-tab="${tab}"`), `${tab} tab 存在`);
  }
});

test("T1：HUD 五项数据展示位", () => {
  for (const id of ["coins-val", "rps-val", "stars-val", "stage-badge-val", "bowls-val"]) {
    assert.ok(htmlIds().has(id), `HUD 元素 #${id} 存在`);
  }
});

test("T1：想念桶弹窗有 buckets 容器", () => {
  assert.ok(html.includes('id="offline-buckets"'), "想念桶弹窗有 buckets 容器");
});

test("T1：浮层模态（guide + offline）含 hidden 默认关闭", () => {
  assert.ok(html.includes('id="modal-guide"') && html.includes('id="modal-offline"'), "guide + offline 浮层都存在");
  assert.ok(/id="modal-guide"[^>]*class="modal-backdrop hidden"/.test(html), "modal-guide 默认 hidden");
  assert.ok(/id="modal-offline"[^>]*class="modal-backdrop hidden"/.test(html), "modal-offline 默认 hidden");
});

// =========================================================================
// T1：i18n 数据-i18n 覆盖
// =========================================================================

test("T1：所有 5 个 Tab 按钮都带 data-i18n", () => {
  const tabBtnRegex = /<button[^>]*role="tab"[^>]*data-i18n="([^"]+)"/g;
  const tabs = [...html.matchAll(tabBtnRegex)].map((m) => m[1]);
  assert.ok(tabs.length >= 5, `至少 5 个 Tab 带 data-i18n（实际 ${tabs.length}）`);
});

test("T1：HUD label 与 toast/浮层 关键文案都有 data-i18n 占位", () => {
  const required = [
    "backHome",
    "langSwitch",
    "gameTitle",
    "labelCoins",
    "labelRps",
    "labelStars",
    "labelStage",
    "labelBowls",
    "reputation_local",
    "station_roast",
    "drink_espresso",
    "cat_orange",
    "guest_officecat",
    "reputation_popular",
    "offlineTitle",
    "offlineGreeting",
    "offlineMessage",
    "claimBtn",
    "noscript",
  ];
  for (const key of required) {
    assert.ok(html.includes(`data-i18n="${key}"`), `i18n key "${key}" 在 HTML 有 data-i18n 引用`);
  }
});

// =========================================================================
// T1：CSS 主题契约（午后奶黄 / 木质咖啡棕 / 严禁白底/黑底大平铺）
// =========================================================================

test("T1：CSS 含午后奶黄主题变量", () => {
  assert.ok(css.includes("--cream"), "含 --cream 变量");
  assert.ok(css.includes("--warm-cream"), "含 --warm-cream 变量");
  assert.ok(css.includes("--wood-mid") || css.includes("--wood-deep"), "含木质变量");
  assert.ok(css.includes("--cat-orange"), "含 --cat-orange 变量");
});

test("T1：CSS 严禁四角浮动按钮（无 position:fixed 顶角按钮）", () => {
  // 主按钮 / HUD 元素应使用 flex/grid 布局，不在四角散落
  // bar-btn 在 #stage-bar 内属于"屋檐门牌"内嵌（合规），不应有顶角独立 fixed 按钮
  const fixedBtnCount = (css.match(/position:\s*fixed/g) || []).length;
  // 只允许 modal / toast 用 fixed
  assert.ok(fixedBtnCount >= 1 && fixedBtnCount <= 3, `position:fixed 数量 ${fixedBtnCount}（仅 modal/toast）`);
});

test("T1：移动端底部避让", () => {
  assert.ok(/padding-bottom:\s*max\(68px/.test(css), "移动端 padding-bottom 含 max(68px, ...)");
  assert.ok(/env\(safe-area-inset-bottom\)/.test(css), "含 env(safe-area-inset-bottom) iOS 安全区");
});

test("T1：防误触 + reduced motion 降级", () => {
  assert.ok(css.includes("touch-action: none"), "touch-action: none 防误触");
  assert.ok(css.includes("overscroll-behavior: none"), "overscroll-behavior: none 禁用下拉刷新");
  assert.ok(/prefers-reduced-motion: reduce/.test(css), "prefers-reduced-motion 降级");
});

test("T1：CSS 严禁裸白底/裸黑底大平铺（应使用渐变/微光主题）", () => {
  // body 不应是纯 #fff 或 #000
  const bodyBlock = css.match(/html,\s*body\s*\{[^}]+\}/);
  assert.ok(bodyBlock, "html, body 块存在");
  assert.ok(!/background:\s*#fff\s*[;}]/.test(bodyBlock[0]), "body 背景非纯白");
  assert.ok(!/background:\s*#000\s*[;}]/.test(bodyBlock[0]), "body 背景非纯黑");
  assert.ok(/linear-gradient/.test(bodyBlock[0]) || /gradient/.test(bodyBlock[0]), "body 背景含渐变");
});

// =========================================================================
// T1：模块契约（DOM-free / 共享偏好 / 存档 key / 降级）
// =========================================================================

test("T1：engine/storage/i18n/audio 模块契约", () => {
  function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  }
  // engine 纯逻辑
  assert.equal(/document\.|window\.|localStorage/.test(stripComments(engineJs)), false, "engine 纯逻辑不碰 DOM/存储");
  // storage 用统一 key
  assert.ok(storageJs.includes('"doin.catcafe.v1"'), "存档 key = doin.catcafe.v1");
  // i18n 用共享偏好 key
  assert.ok(i18nJs.includes('"doin.lang"'), "语言偏好 key = doin.lang");
  // audio 不依赖 document
  assert.equal(/document\.|window\./.test(audioJs), false, "audio 不依赖 DOM 全局");
});