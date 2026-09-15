// markup.test.mjs: 页面装配契约 —— 相对路径、零外链、缓存占位、返回键、降级兜底

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(here, "..");
const html = readFileSync(resolve(gameDir, "index.html"), "utf8");
const css = readFileSync(resolve(gameDir, "css", "style.css"), "utf8");

test("存在返回门户的绝对链接（唯一允许的绝对路径）", () => {
  const tag = html.match(/<a[^>]*id="back-home"[^>]*>/);
  assert.ok(tag, "缺 id=back-home 的首页链接");
  assert.match(tag[0], /href="\/"/);
});

test("本地样式与脚本全部使用相对路径并带 ?v=dev 占位", () => {
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((v) => !v.startsWith("data:") && !/^(https?:)?\/\//.test(v) && v !== "/");
  assert.ok(refs.length >= 2, `本地引用过少：${refs.length}`);
  for (const ref of refs) {
    assert.ok(!ref.startsWith("/"), `不得使用绝对路径：${ref}`);
    if (/\.(mjs|js|css)(\?|$)/.test(ref)) {
      assert.ok(ref.includes("?v=dev"), `缺缓存占位：${ref}`);
    }
  }
});

test("零外部网络依赖：无 CDN / webfont / 外链图片音视频", () => {
  const external = [...html.matchAll(/(?:src|href)="((?:https?:)?\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(external, [], `存在外链：${external.join(", ")}`);
  assert.ok(!/@import/.test(css), "CSS 不得 @import 外部资源");
  const cssUrls = [...css.matchAll(/url\((?!['"]?data:)([^)]+)\)/g)].map((m) => m[1]);
  for (const u of cssUrls) {
    assert.ok(!/^https?:/.test(u.replace(/['"]/g, "")), `CSS 外链：${u}`);
  }
});

test("不含任何硬编码统计/广告标签（由构建统一注入）", () => {
  assert.ok(!/gtag|googletagmanager|adsbygoogle|G-D67E3XTNSS/.test(html), "首页不得硬编码统计/广告");
  assert.ok(!/<script[^>]+src="https/.test(html));
});

test("语义骨架：lang / viewport / description / noscript / module 入口", () => {
  assert.match(html, /<html[^>]+lang="/);
  assert.match(html, /<meta[^>]+name="viewport"/);
  assert.match(html, /<meta[^>]+name="description"/);
  assert.match(html, /<noscript/);
  assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/);
  assert.match(html, /rel="icon"/);
});

test("舞台 canvas 有可读的无障碍标注", () => {
  assert.match(html, /<canvas[^>]+id="board"/);
  assert.match(html, /<canvas[^>]+aria-label="/);
  assert.match(html, /role="img"/);
});

test("HUD 不在四角散落：系统控制项收在铁盒顶盖内", () => {
  const lid = html.match(/<header class="lid">([\s\S]*?)<\/header>/);
  assert.ok(lid, "缺铁盒顶盖");
  assert.match(lid[1], /id="back-home"/);
  assert.match(lid[1], /id="btn-sound"/);
  assert.match(lid[1], /id="btn-lang"/);
  assert.match(lid[1], /id="btn-help"/);
});

test("双栏沉浸舞台：两翼牌匾 + 铁盒 + 盒底操作台", () => {
  assert.match(html, /class="wing wing--left"/);
  assert.match(html, /class="wing wing--right"/);
  assert.match(html, /class="tin"/);
  assert.match(html, /class="console"/);
  assert.match(css, /@media \(min-width: 900px\)/);
});

test("动效带 prefers-reduced-motion 降级", () => {
  assert.match(css, /prefers-reduced-motion/);
});

test("模块分层齐全：engine / game / render / score / storage / i18n / audio", () => {
  for (const file of ["engine.mjs", "game.mjs", "render.mjs", "score.mjs", "storage.mjs", "i18n.mjs", "audio.mjs"]) {
    assert.ok(existsSync(resolve(gameDir, "js", file)), `缺 js/${file}`);
  }
});

test("engine 与 game 保持 DOM-free、存储-free", () => {
  for (const file of ["engine.mjs", "game.mjs"]) {
    // 先剥离注释，避免"不碰 document"这类说明文字造成误判
    const src = readFileSync(resolve(gameDir, "js", file), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const banned of ["document", "window", "localStorage", "navigator"]) {
      assert.ok(!src.includes(banned), `js/${file} 不应触碰 ${banned}`);
    }
  }
});

test("测试文件齐全：engine / levels / storage / i18n / markup", () => {
  const files = readdirSync(resolve(gameDir, "tests")).filter((n) => n.endsWith(".test.mjs"));
  for (const name of ["engine.test.mjs", "levels.test.mjs", "storage.test.mjs", "i18n.test.mjs", "markup.test.mjs"]) {
    assert.ok(files.includes(name), `缺 tests/${name}`);
  }
});
