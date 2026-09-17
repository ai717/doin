import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const gameRoot = resolve(__dir, "..");

test("markup: index.html contains required DOIN structural invariants", () => {
  const html = readFileSync(resolve(gameRoot, "index.html"), "utf8");

  assert.ok(html.includes('<html lang="zh-CN">'), "Must include html lang");
  assert.ok(html.includes('<meta name="description"'), "Must include meta description");
  assert.ok(html.includes('rel="icon" href="favicon.svg"'), "Must link favicon.svg");
  assert.ok(html.includes('<a href="/" id="back-home"'), "Must have portal back link");
  assert.ok(html.includes("<noscript>"), "Must include noscript tag");
  assert.ok(
    html.includes('<link rel="stylesheet" href="css/style.css?v=dev">'),
    "CSS link must carry ?v=dev"
  );
  assert.ok(
    html.includes('<script type="module" src="js/main.mjs?v=dev"></script>'),
    "Entry module script must carry ?v=dev"
  );
});

test("markup: bidirectional ID closure between JS references and index.html", () => {
  const html = readFileSync(resolve(gameRoot, "index.html"), "utf8");
  const mainJs = readFileSync(resolve(gameRoot, "js", "main.mjs"), "utf8");
  const uiJs = readFileSync(resolve(gameRoot, "js", "ui.mjs"), "utf8");

  // 提取所有 getElementById 的 ID
  const allJs = mainJs + "\n" + uiJs;
  const idMatches = [...allJs.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map((m) => m[1]);
  const uniqueIds = [...new Set(idMatches)];

  for (const id of uniqueIds) {
    const idRegex = new RegExp(`id=["']${id}["']`);
    assert.ok(idRegex.test(html), `ID "${id}" used in JS must exist in index.html`);
  }
});

test("markup: css/style.css includes responsiveness, touch-action, and reduced-motion", () => {
  const css = readFileSync(resolve(gameRoot, "css", "style.css"), "utf8");

  assert.ok(css.includes("prefers-reduced-motion"), "CSS must support prefers-reduced-motion");
  assert.ok(css.includes("touch-action"), "CSS must specify touch-action to prevent gesture scrolling");
  assert.ok(css.includes("safe-area-inset-bottom"), "CSS must provide bottom padding for mobile ad banner safety");
});
