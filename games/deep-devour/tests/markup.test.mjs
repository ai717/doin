// 标记装配契约：index.html / css / js 三者必须对得上。
// 这里不测玩法，只测「门户铁律」——返回首页、?v=dev 占位、零外链、DOM-free 规则层、
// 以及「JS 里引用的每一个 id 都真的存在于 HTML」。最后一条是最容易悄悄坏掉的：
// 改个 id 名字，代码不报错，只是那一格仪表永远不更新。

import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

const html = read("../index.html");
const css = read("../css/style.css");
const uiSrc = read("../js/ui.mjs");
const mainSrc = read("../js/main.mjs");
const renderSrc = read("../js/render.mjs");
const engineSrc = read("../js/engine.mjs");
const storageSrc = read("../js/storage.mjs");
const i18nSrc = read("../js/i18n.mjs");

const JS_FILES = ["engine", "game", "score", "storage", "i18n", "audio", "render", "ui", "main"].map((name) => ({
  name,
  src: read(`../js/${name}.mjs`),
}));

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));

describe("文档骨架与 SEO", () => {
  it("基本 head 契约齐全", () => {
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<html[^>]+lang="zh-CN"/);
    assert.match(html, /<meta charset="utf-8">/i);
    assert.match(html, /<meta name="viewport"[^>]+width=device-width/);
    assert.match(html, /<meta name="description" content="[^"]{40,}"/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<link rel="icon"[^>]*href="favicon\.svg"/);
  });

  it("canonical / og 指向正式域名，且是绝对地址", () => {
    assert.match(html, /<link rel="canonical" href="https:\/\/doin\.win\/deep-devour\/">/);
    assert.match(html, /<meta property="og:url" content="https:\/\/doin\.win\/deep-devour\/">/);
  });

  it("没有遗留的 TODO / lorem / 占位文案", () => {
    for (const token of ["TODO", "FIXME", "lorem", "占位文案", "XXX"]) {
      assert.ok(!html.includes(token), `index.html 残留 ${token}`);
    }
  });
});

describe("门户铁律", () => {
  it("返回门户链接是唯一的绝对路径例外", () => {
    assert.match(html, /<a class="brass-link" id="back-home" href="\/">/);
    const absolutes = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((match) => match[1]);
    assert.deepEqual(absolutes, ["/"], "除返回首页外，任何 src/href 都不许写绝对路径");
  });

  it("js / css 一律相对路径；本地资源不得写 /games/<slug>/", () => {
    for (const { name, src } of JS_FILES) {
      assert.ok(!src.includes("/games/deep-devour/"), `${name}.mjs 出现了本地开发前缀`);
      assert.ok(!/from\s+"\/[^"]+"/.test(src), `${name}.mjs 用了绝对导入路径`);
    }
    assert.ok(!css.includes("/games/deep-devour/"), "style.css 出现了本地开发前缀");
  });

  it("资源全部带 ?v=dev 占位、入口是 ES module", () => {
    assert.match(html, /<link rel="stylesheet" href="css\/style\.css\?v=dev">/);
    assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
    const localAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((value) => !/^https?:/.test(value) && /\.(mjs|js|css)(\?|$)/.test(value));
    assert.ok(localAssets.length >= 2);
    for (const asset of localAssets) assert.ok(asset.includes("?v=dev"), `${asset} 缺 ?v=dev`);
  });

  it("零外部网络依赖：没有任何资源标签指向别的域名", () => {
    // canonical / alternate 是 SEO 声明，不是要加载的资源，允许是绝对地址。
    const external = [...html.matchAll(/<(?:link|script|img|source|iframe|video|audio)\b[^>]*>/g)]
      .map((match) => match[0])
      .filter((tag) => !/rel="(?:canonical|alternate)"/.test(tag))
      .map((tag) => (tag.match(/(?:src|href)="([^"]+)"/) ?? [])[1])
      .filter((value) => value && /^(?:https?:)?\/\//.test(value));
    assert.deepEqual(external, [], `index.html 引用了外部资源：${external.join(", ")}`);
    assert.ok(!/url\(\s*['"]?https?:/i.test(css), "css 里出现了远程资源");
    for (const { name, src } of JS_FILES) {
      assert.ok(!/["'`]https?:\/\//.test(src), `${name}.mjs 里出现了远程地址`);
    }
  });

  it("有 noscript 兜底且文案与 i18n 表一致", () => {
    assert.match(html, /<noscript>/);
    const match = html.match(/<noscript><p class="noscript">([^<]+)<\/p><\/noscript>/);
    assert.ok(match, "noscript 结构被改动");
    assert.ok(i18nSrc.includes(match[1].trim()), "noscript 文案应来自 i18n 表");
  });

  it("canvas 舞台带 role/aria 描述", () => {
    assert.match(html, /<canvas id="sea"[^>]*role="img"[^>]*aria-label="[^"]+"/);
  });
});

describe("规则层隔离", () => {
  it("engine.mjs 是 DOM-free 的（先剥注释再判，和 check-game 口径一致）", () => {
    const code = engineSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const token of ["document.", "window.", "localStorage", "sessionStorage"]) {
      assert.ok(!code.includes(token), `engine 混入了 ${token}`);
    }
  });

  it("render.mjs 不碰 localStorage，也不自己算分", () => {
    assert.ok(!renderSrc.includes("localStorage"));
    assert.ok(!renderSrc.includes("stats.score"), "分数字段只能由 engine 维护");
  });

  it("UI 层不写死分数：一律走 score.mjs 的格式化函数", () => {
    assert.match(uiSrc, /from "\.\/score\.mjs"/);
    assert.ok(!uiSrc.includes("stats.score +"), "UI 不许自己累加分数");
  });

  it("存储与语言偏好各自只有一个入口文件", () => {
    assert.match(storageSrc, /doin\.deep-devour\.v1/);
    assert.match(storageSrc, /catch/);
    assert.match(i18nSrc, /doin\.lang/);
    for (const { name, src } of JS_FILES) {
      if (name === "storage") continue;
      assert.ok(!src.includes("doin.deep-devour.v1"), `${name}.mjs 不该自己拼存档 key`);
    }
  });

  it("JS 里没有任何 alert / confirm / prompt 弹窗（铁律 1）", () => {
    // 先剥注释：解释「为什么不用 confirm()」的注释不该被当成用了 confirm()。
    const strip = (source) =>
      source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const { name, src } of JS_FILES) {
      const code = strip(src);
      for (const bad of ["alert", "confirm", "prompt"]) {
        assert.ok(!new RegExp(`\\b${bad}\\s*\\(`).test(code), `${name}.mjs 用了 ${bad}()`);
      }
    }
  });
});

describe("id / class 装配对得上", () => {
  it("ui.mjs 登记的每一个 id 都存在于 index.html", () => {
    const block = uiSrc.match(/const ids = \[([\s\S]*?)\];/);
    assert.ok(block, "找不到 ui.mjs 的 id 清单");
    const ids = [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    assert.ok(ids.length > 40, `id 清单太短（${ids.length}）`);
    const missing = ids.filter((id) => !htmlIds.has(id));
    assert.deepEqual(missing, [], `JS 引用了 HTML 中不存在的 id：${missing.join(", ")}`);
  });

  it("main.mjs 直接取的 id（canvas / 视口）也在", () => {
    const ids = [...mainSrc.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
    assert.ok(ids.length >= 2);
    for (const id of ids) assert.ok(htmlIds.has(id), `main.mjs 取的 #${id} 不存在`);
  });

  it("面板的 aria-labelledby 都指向真实存在的标题 id", () => {
    const targets = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(targets.length >= 6, "六个面板都应该有 aria-labelledby");
    for (const id of targets) assert.ok(htmlIds.has(id), `aria-labelledby 指向了不存在的 #${id}`);
  });

  it("ui.mjs 动态生成的节点类名都有对应样式", () => {
    for (const cls of ["level-cell", "zone-card", "pearl-slot", "pearl-core", "tally-cell", "toast"]) {
      assert.ok(uiSrc.includes(cls), `ui.mjs 里没用到 ${cls}`);
      assert.ok(css.includes(`.${cls}`), `style.css 缺少 .${cls} 的样式`);
    }
  });

  it("六个覆盖面板都在；非开场面板默认隐藏，开场面板由 JS 打开", () => {
    for (const name of ["levels", "result", "help", "paused", "abyss"]) {
      assert.ok(htmlIds.has(`panel-${name}`), `缺少 #panel-${name}`);
      assert.match(html, new RegExp(`id="panel-${name}"[^>]*hidden`), `#panel-${name} 默认应是 hidden`);
    }
    assert.ok(htmlIds.has("panel-ready"));
    assert.ok(!/id="panel-ready"[^>]*hidden/.test(html), "开场面板自身不该 hidden");
    assert.match(html, /<div class="overlay" id="overlay" hidden>/);
    assert.match(mainSrc, /ui\.showPanel\("ready"\)/, "开场面板必须由 JS 主动打开");
  });
});

describe("样式契约", () => {
  it("带 prefers-reduced-motion 降级", () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /animation: none !important/);
  });

  it("覆盖桌面 / 平板 / 移动 / 小屏四档视口", () => {
    assert.match(css, /@media \(max-width: 900px\)/);
    assert.match(css, /@media \(max-width: 768px\)/);
    assert.match(css, /@media \(max-width: 390px\)/);
  });

  it("移动端底部留出广告安全区（≥60px），关键操作不贴底", () => {
    assert.match(css, /max\(68px, calc\(16px \+ env\(safe-area-inset-bottom\)\)\)/);
  });

  it("桌面端核心舞台收在 1100px 内，两侧留出广告安全留白", () => {
    const porthole = css.match(/\.porthole\s*\{[\s\S]*?\}/);
    assert.ok(porthole, "找不到 .porthole 规则");
    assert.match(porthole[0], /width:\s*min\(1100px,\s*100%\)/);
    const cabinet = css.match(/\.cabinet\s*\{[\s\S]*?\}/);
    assert.ok(cabinet, "找不到 .cabinet 规则");
    assert.match(cabinet[0], /padding:\s*\d+px\s+\d+px\s+\d+px/, "桌面端四边都要留白");
  });

  it("没有 !important 满天飞的技术债", () => {
    const count = (css.match(/!important/g) ?? []).length;
    assert.ok(count <= 12, `!important 用了 ${count} 次，说明选择器层级失控`);
  });
});
