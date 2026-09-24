import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

const html = read("../index.html");
const css = read("../css/style.css");
const uiSrc = read("../js/ui.mjs");
const mainSrc = read("../js/main.mjs");
const engineSrc = read("../js/engine.mjs");
const i18nSrc = read("../js/i18n.mjs");

const JS_FILES = ["engine", "game", "score", "storage", "i18n", "audio", "render", "ui", "main"].map(
  (n) => read(`../js/${n}.mjs`),
);

test("index.html: document skeleton and meta", () => {
  assert.match(html, /<!DOCTYPE html>/i);
  assert.match(html, /<html[^>]+lang=/i);
  assert.match(html, /<meta charset="UTF-8">/i);
  assert.match(html, /<meta name="viewport"[^>]+width=device-width/i);
  assert.match(html, /<meta name="description"[^>]+content="[^"]+"/i);
  assert.match(html, /<title>[^<]+<\/title>/i);
});

test("index.html: portal contract — back-home, noscript, canvas", () => {
  assert.match(html, /<a href="\/" id="back-home"/);
  assert.match(html, /<noscript>/i);
  assert.match(html, /<canvas id="game-canvas"[^>]*aria-label=/i);
});

test("index.html: module script and stylesheet carry ?v=dev", () => {
  assert.match(html, /<script type="module" src="js\/main\.mjs\?v=dev"><\/script>/);
  assert.match(html, /<link rel="stylesheet" href="css\/style\.css\?v=dev">/);
});

test("zero external network dependencies (no CDN / remote http(s))", () => {
  assert.ok(!/https?:\/\//i.test(html), "index.html must not reference remote URLs");
  assert.ok(!/https?:\/\//i.test(css), "css must not reference remote URLs");
  for (const src of JS_FILES) {
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/i.test(src), "js must not fetch remote URLs");
  }
});

test("no alert()/confirm()/prompt() anywhere in js", () => {
  for (const src of JS_FILES) {
    assert.ok(!/\balert\s*\(/.test(src), "alert() is forbidden");
    assert.ok(!/\bconfirm\s*\(/.test(src), "confirm() is forbidden");
    assert.ok(!/\bprompt\s*\(/.test(src), "prompt() is forbidden");
  }
});

test("i18n uses the shared doin.lang key", () => {
  assert.match(i18nSrc, /doin\.lang/);
});

test("storage uses a versioned doin.<slug>.v1 key and guards with try/catch", () => {
  const storageSrc = read("../js/storage.mjs");
  assert.match(storageSrc, /doin\.watermelon-2048\.v1/);
  assert.match(storageSrc, /catch/);
});

test("engine.mjs stays DOM-free (no document/window/storage in code)", () => {
  // 与 check-game.mjs 一致：先剥离注释，再禁用宿主对象。
  const code = engineSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!/\bdocument\s*\./.test(code), "engine must not touch document");
  assert.ok(!/\bwindow\s*\./.test(code), "engine must not touch window");
  assert.ok(!/\blocalStorage\b/.test(code), "engine must not touch localStorage");
  assert.ok(!/\bsessionStorage\b/.test(code), "engine must not touch sessionStorage");
});

test("every id referenced from JS exists in index.html", () => {
  const ids = new Set();
  const patterns = [/byId\("([^"]+)"\)/g, /getElementById\("([^"]+)"\)/g];
  for (const src of [uiSrc, mainSrc]) {
    for (const re of patterns) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(src)) !== null) ids.add(m[1]);
    }
  }
  assert.ok(ids.size > 20, `expected many id refs, found ${ids.size}`);
  const missing = [...ids].filter((id) => !html.includes(`id="${id}"`));
  assert.deepEqual(missing, [], `ids referenced in JS but absent from HTML: ${missing.join(", ")}`);
});

test("the .mode-tabs hook used by querySelector exists", () => {
  assert.match(uiSrc, /querySelector\("\.mode-tabs"\)/);
  assert.match(html, /class="mode-tabs"/);
});

test("css honors reduced-motion and ships the responsive breakpoints", () => {
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /max-width:\s*900px/); // 桌面双栏 → 单栏的转折
  assert.match(css, /max-width:\s*768px/); // 移动紧凑 + 底部广告安全避让
  assert.match(css, /max-width:\s*390px/); // 小屏视口兜底
  assert.match(css, /env\(safe-area-inset-bottom\)/); // 移动端安全区
});

test("all overlays start hidden except the ready dialog", () => {
  // pause / result / help 默认 hidden，ready 默认显示
  assert.match(html, /id="pause-modal"[^>]*hidden/);
  assert.match(html, /id="result-modal"[^>]*hidden/);
  assert.match(html, /id="help-modal"[^>]*hidden/);
  assert.match(html, /id="toast"[^>]*hidden/);
  assert.ok(!/id="ready-modal"[^>]*hidden/.test(html), "ready dialog should be visible on load");
});
