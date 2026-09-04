import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { SHOP_ITEMS } from "../js/score.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css/style.css"), "utf8");
const main = readFileSync(resolve(root, "js/main.mjs"), "utf8");
const ui = readFileSync(resolve(root, "js/ui.mjs"), "utf8");

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const declaredRefs = new Set([...main.matchAll(/^\s{2}(\w+): byId\(/gm)].map((match) => match[1]));

describe("markup contract", () => {
  it("声明 main.mjs 用 byId 查找的每一个 id", () => {
    const wanted = [...main.matchAll(/byId\("([^"]+)"\)/g)].map((match) => match[1]);
    assert.ok(wanted.length >= 40, "装配层应绑定完整 HUD / 弹窗 / 商店");
    for (const id of wanted) {
      assert.ok(htmlIds.has(id), `index.html 缺少 id="${id}"`);
    }
  });

  it("ui.mjs 引用的每个 refs 都在 main.mjs 声明（含商店动态 ref）", () => {
    const used = new Set([...ui.matchAll(/refs\.(\w+)/g)].map((match) => match[1]));
    const dynamic = [...ui.matchAll(/(?:button|name|desc): "(\w+)"/g)].map((match) => match[1]);
    assert.ok(used.size >= 30, "UI 层应绑定完整界面");
    assert.equal(dynamic.length, 9, "商店三件货各有按钮 / 名称 / 描述三个 ref");
    for (const key of [...used, ...dynamic]) {
      assert.ok(declaredRefs.has(key), `main.mjs 的 refs 表缺少 ${key}`);
    }
  });

  it("画布 2d 上下文取自 refs.canvas", () => {
    assert.match(main, /refs\.canvas\.getContext\("2d"\)/);
  });

  it("脚本与样式全部外链，并带 ?v=dev 占位（构建时替换为 BUILD_ID）", () => {
    assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
    assert.match(html, /<link rel="stylesheet" href="css\/style\.css\?v=dev">/);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/, "不允许内联脚本");
    assert.doesNotMatch(html, /<style>/, "不允许内联样式");
  });

  it("画布保持 800×600 内部坐标系，移动端只靠 CSS 缩放", () => {
    assert.match(html, /<canvas id="gameCanvas" width="800" height="600"><\/canvas>/);
    assert.match(css, /aspect-ratio: 4 \/ 3;/);
  });

  it("商店三件货的 data-type / data-cost 与 score.mjs 唯一口径一致", () => {
    const cards = [...html.matchAll(/data-type="([^"]+)" data-cost="(\d+)"/g)].map((match) => [
      match[1],
      Number(match[2]),
    ]);
    assert.deepEqual(cards, SHOP_ITEMS.map((item) => [item.type, item.cost]));
  });

  it("样式带移动端适配与 reduced-motion 降级", () => {
    assert.match(css, /@media \(max-width: 840px\)/);
    assert.match(css, /@media \(max-width: 560px\)/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /\.toast\.is-visible/);
    assert.match(css, /\.val-time\.is-urgent/);
  });

  it("默认中文 + SEO 兜底：title / description / noscript 齐全", () => {
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, /<noscript>/);
    assert.match(html, /<link rel="icon" href="favicon\.svg"/);
  });

  it("返回首页链接指向站点根", () => {
    assert.match(html, /<a class="ctrl-btn" href="\/" id="back-home">/);
  });
});
