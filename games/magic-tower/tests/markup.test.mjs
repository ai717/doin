// markup.test.mjs — 语义标记 / 缓存占位 / DOM 与 JS 双向闭合 / i18n 覆盖 / CSS 降级
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LEVELS } from "../js/levels.mjs";
import { strings } from "../js/i18n.mjs";

const gameDir = join(import.meta.dirname, "..");
const html = readFileSync(join(gameDir, "index.html"), "utf8");
const jsDir = join(gameDir, "js");
const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith(".mjs"));
const jsSources = jsFiles.map((f) => readFileSync(join(jsDir, f), "utf8"));
const allJs = jsSources.join("\n");
const css = readdirSync(join(gameDir, "css"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(gameDir, "css", f), "utf8"))
  .join("\n");

const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const HAN = /[\u4e00-\u9fa5]/;

describe("markup: 文档骨架", () => {
  it("DOCTYPE / lang / charset / viewport / description 齐备", () => {
    assert.ok(/^<!DOCTYPE html>/i.test(html.trim()));
    assert.match(html, /<html[^>]+lang="[^"]+"/);
    assert.match(html, /<meta[^>]+charset="UTF-8"/i);
    assert.match(html, /<meta[^>]+name="viewport"[^>]+viewport-fit=cover/);
    assert.match(html, /<meta[^>]+name="description"/);
  });

  it("favicon 与样式表存在且带缓存占位", () => {
    assert.ok(existsSync(join(gameDir, "favicon.svg")));
    assert.match(html, /<link[^>]+rel="icon"/);
    assert.match(html, /<link[^>]+href="css\/style\.css\?v=dev"/);
  });

  it("入口脚本是 ES module 且带 ?v=dev", () => {
    assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/);
  });

  it("noscript 兜底与返回门户链接", () => {
    assert.match(html, /<noscript>[\s\S]*<\/noscript>/);
    assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/);
  });

  it("id 全局唯一", () => {
    const dupes = htmlIds.filter((id, i) => htmlIds.indexOf(id) !== i);
    assert.deepEqual(dupes, []);
  });
});

describe("markup: DOM 与脚本双向闭合", () => {
  it("脚本里 getElementById 的每个 id 都在 HTML 中存在", () => {
    const refs = new Set();
    for (const match of allJs.matchAll(/getElementById\("([^"]+)"\)/g)) refs.add(match[1]);
    for (const match of allJs.matchAll(/\$\("([^"]+)"\)/g)) refs.add(match[1]);
    const missing = [...refs].filter((id) => !htmlIds.includes(id));
    assert.deepEqual(missing, []);
  });

  it("HTML 里的交互按钮都有对应的事件接线", () => {
    const buttons = [...html.matchAll(/<button[^>]+id="([^"]+)"/g)].map((m) => m[1]);
    const missing = buttons.filter((id) => !allJs.includes(`"${id}"`) && !allJs.includes(`'${id}'`));
    assert.deepEqual(missing, []);
  });

  it("盘面画布存在并声明触控约束", () => {
    assert.match(html, /<canvas[^>]+id="board"/);
    assert.match(css, /touch-action:\s*none/);
    assert.match(css, /overscroll-behavior:\s*none/);
  });
});

describe("markup: 语言与纯净化", () => {
  it("HTML 中文节点都声明了 data-i18n", () => {
    const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
    const offenders = [];
    for (const match of clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)) {
      const tag = match[1].toLowerCase();
      if (tag === "title" || tag === "script") continue;
      if (match[2].includes("data-i18n")) continue;
      // 允许由 JS 按 id 动态覆盖的节点（与 check-game 的 i18n-clean 口径一致）
      const idMatch = match[2].match(/id="([^"]+)"/);
      if (idMatch && (allJs.includes(`"${idMatch[1]}"`) || allJs.includes(`'${idMatch[1]}'`))) continue;
      offenders.push(`<${tag}> ${match[3].trim().slice(0, 12)}`);
    }
    assert.deepEqual(offenders, []);
  });

  it("HTML 声明的 data-i18n 键在词典里都存在", () => {
    const keys = new Set([...html.matchAll(/data-i18n(?:-aria)?="([^"]+)"/g)].map((m) => m[1]));
    const missing = [...keys].filter((key) => strings.zh[key] === undefined);
    assert.deepEqual(missing, []);
  });

  it("严禁 location.reload，语言切换必须原地热更新", () => {
    assert.ok(!allJs.includes("location.reload"));
    assert.ok(allJs.includes("doin.lang"));
    assert.ok(allJs.includes("data-i18n"));
  });
});

describe("markup: CSS 降级与安全区", () => {
  it("带 prefers-reduced-motion 降级", () => {
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  });

  it("移动端底部预留广告避让间距", () => {
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    assert.match(css, /max\(68px|max\(72px/);
  });

  it("零外链资源", () => {
    const external = [...html.matchAll(/(?:src|href)="(https?:)?\/\//g)];
    assert.deepEqual(external, []);
    assert.ok(!/@import\s+url\(/i.test(css));
  });
});

describe("markup: 数据与视图同源", () => {
  it("关卡数量与总表一致，且本作首屏即可玩（无需选关遮罩）", () => {
    assert.equal(LEVELS.length, 24);
    assert.ok(!/class="[^"]*level-select/.test(html), "首屏不得强制选关遮罩");
    assert.match(html, /id="btn-compass"/, "必须有常驻的楼层切换入口");
  });
});
