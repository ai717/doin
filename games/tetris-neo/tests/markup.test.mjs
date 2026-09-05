import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { BOARDS, DIFFICULTIES } from "../js/storage.mjs";
import { BOARD_CONFIGS } from "../js/engine.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "index.html"), "utf8");
const css = readFileSync(resolve(root, "css/style.css"), "utf8");
const main = readFileSync(resolve(root, "js/main.mjs"), "utf8");

const htmlIds = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const wantedIds = [...main.matchAll(/getElementById\((["'])([^"']+)\1\)/g)].map((match) => match[2]);

function pillValues(groupId) {
  const block = html.slice(html.indexOf(`id="${groupId}"`));
  const end = block.indexOf("</div>");
  return [...block.slice(0, end).matchAll(/data-val="([^"]+)"/g)].map((match) => match[1]);
}

describe("markup contract", () => {
  it("main.mjs 用 getElementById 查找的每个 id 都在 index.html 里", () => {
    assert.ok(wantedIds.length >= 20, `装配层应绑定完整 HUD / 浮层 / 手柄，实际 ${wantedIds.length} 个`);
    for (const id of wantedIds) {
      assert.ok(htmlIds.has(id), `index.html 缺少 id="${id}"`);
    }
    assert.ok(htmlIds.has("tetris") && htmlIds.has("next-canvas"), "两块画布必须在位");
  });

  it("脚本与样式全部外链并带 ?v=dev 占位（构建时替换为 BUILD_ID）", () => {
    assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
    assert.match(html, /<link rel="stylesheet" href="css\/style\.css\?v=dev">/);
    assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>/, "除 JSON-LD 外不允许内联脚本");
    assert.doesNotMatch(html, /<style>/, "不允许内联样式");
  });

  it("不引用任何外部资源（CDN / 字体 / 图片）", () => {
    assert.doesNotMatch(html, /<script[^>]+src="https?:/);
    assert.doesNotMatch(html, /<link[^>]+href="https?:/);
    assert.doesNotMatch(html, /<img[^>]+src="https?:/);
    assert.doesNotMatch(css, /@import/);
    assert.doesNotMatch(css, /url\(\s*["']?https?:/);
  });

  it("返回首页链接指向站点根，noscript 兜底在位", () => {
    assert.match(html, /<a id="back-home" class="chip-btn" href="\/"/);
    assert.match(html, /<noscript><p id="noscript-tip">[^<]+<\/p><\/noscript>/);
  });

  it("默认中文 + SEO 兜底：lang / title / description / icon 齐全", () => {
    assert.match(html, /<html lang="zh-CN">/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+">/);
    assert.match(html, /<link rel="icon"/);
    assert.match(html, /<meta name="viewport" content="[^"]*width=device-width/);
  });

  it("难度 / 尺寸胶囊的 data-val 与存档白名单、棋盘表一致", () => {
    assert.deepEqual(pillValues("diff-pills"), [...DIFFICULTIES]);
    assert.deepEqual(pillValues("board-pills"), [...BOARDS]);
    for (const board of BOARDS) {
      const config = BOARD_CONFIGS[board];
      assert.ok(config, `engine 缺 ${board} 棋盘配置`);
      assert.match(html, new RegExp(`data-val="${board}"[^>]*>${config.cols}×${config.rows}<`));
    }
    assert.match(html, /data-val="normal"[^>]*active|active[^>]*data-val="normal"/, "默认档应预选中");
  });

  it("样式带移动端适配与 reduced-motion 降级", () => {
    assert.match(css, /@media \((min|max)-width:/, "必须有响应式断点");
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /\.gamepad-area/);
    assert.match(css, /\.screen-frame/);
  });

  it("装配层不直接碰 localStorage，存档全走 storage.mjs", () => {
    assert.doesNotMatch(main, /localStorage/, "main.mjs 不得出现裸 localStorage");
    assert.match(main, /from "\.\/storage\.mjs"/);
    assert.match(main, /from "\.\/i18n\.mjs"/);
    assert.match(main, /from "\.\/engine\.mjs"/);
  });

  it("规则数值只有一份口径：main.mjs 不再自带棋盘 / 难度 / 消行分数表", () => {
    assert.doesNotMatch(main, /const BOARD_CONFIGS/, "棋盘表必须来自 engine.mjs");
    assert.doesNotMatch(main, /const DIFFICULTY_CONFIGS/, "难度表必须来自 engine.mjs");
    assert.doesNotMatch(main, /\[0, 100, 300, 500, 800\]/, "消行分数必须走 scoreForLines");
  });
});
