import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test("markup: HTML 静态标记契约核查", () => {
  const htmlPath = path.resolve("games/pong/index.html");
  const html = fs.readFileSync(htmlPath, "utf-8");

  // 1. 必须包含返回首页链接
  assert.ok(html.includes('href="/"'), "必须包含 href='/' 返回首页");
  assert.ok(html.includes('id="back-home"'), "返回首页必须具有 id='back-home'");

  // 2. 必须包含 noscript 兜底
  assert.ok(html.includes("<noscript>"), "必须包含 noscript 兜底");

  // 3. 所有本地 script 和 link 必须带 ?v=dev
  const linkMatches = html.match(/<link[^>]+href="([^"]+)"/g) || [];
  for (const m of linkMatches) {
    if (m.includes(".css") || m.includes(".svg")) {
      assert.ok(m.includes("?v=dev"), `link 资源未带 ?v=dev: ${m}`);
    }
  }

  const scriptMatches = html.match(/<script[^>]+src="([^"]+)"/g) || [];
  for (const m of scriptMatches) {
    assert.ok(m.includes("?v=dev"), `script 资源未带 ?v=dev: ${m}`);
  }

  // 4. 严禁出现绝对路径 /games/pong 或 /pong/
  assert.ok(!html.includes('"/games/pong'), "禁止出现 /games/pong 绝对路径");
  assert.ok(!html.includes('src="/pong'), "禁止出现 /pong 绝对路径");

  // 5. 必须为 ES module 入口
  assert.ok(html.includes('type="module"'), "必须使用 type='module'");
});