// markup.test.mjs - semantic skeleton / DOM-JS closure / i18n coverage /
// CSS degradation / audio call-surface reconciliation.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { strings } from "../js/i18n.mjs";

const gameDir = join(import.meta.dirname, "..");
const html = readFileSync(join(gameDir, "index.html"), "utf8");
const jsDir = join(gameDir, "js");
const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith(".mjs"));
const sources = Object.fromEntries(jsFiles.map((f) => [f, readFileSync(join(jsDir, f), "utf8")]));
const allJs = Object.values(sources).join("\n");
const css = readdirSync(join(gameDir, "css"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(gameDir, "css", f), "utf8"))
  .join("\n");

const htmlIds = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const HAN = /[\u4e00-\u9fa5]/;
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "");

function hasI18nKey(key) {
  let node = strings.zh;
  for (const part of key.split(".")) {
    if (!node || typeof node !== "object" || !(part in node)) return false;
    node = node[part];
  }
  return typeof node === "string";
}

// Walk a CSS @media block by brace depth - a naive indexOf("}") truncates
// at the first nested rule.
function mediaBlock(text, condition) {
  const start = text.indexOf(condition);
  if (start < 0) return "";
  let depth = 0;
  let opened = false;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === "{") { depth += 1; opened = true; }
    else if (text[i] === "}") {
      depth -= 1;
      if (opened && depth === 0) return text.slice(start, i + 1);
    }
  }
  return "";
}

describe("markup: document skeleton", () => {
  it("doctype / lang / charset / viewport / description / icon", () => {
    assert.ok(/^<!DOCTYPE html>/i.test(html.trim()));
    assert.match(html, /<html[^>]+lang="[^"]+"/);
    assert.match(html, /<meta[^>]+charset="UTF-8"/i);
    assert.match(html, /<meta[^>]+name="viewport"[^>]+viewport-fit=cover/);
    assert.match(html, /<meta[^>]+name="description"/);
    assert.ok(existsSync(join(gameDir, "favicon.svg")));
    assert.match(html, /<link[^>]+rel="icon"/);
  });

  it("stylesheet and entry module both carry the cache placeholder", () => {
    assert.match(html, /<link[^>]+href="css\/style\.css\?v=dev"/);
    assert.match(html, /<script[^>]+type="module"[^>]+src="js\/main\.mjs\?v=dev"/);
  });

  it("noscript fallback, portal link and unique ids", () => {
    assert.match(html, /<noscript>[\s\S]*<\/noscript>/);
    assert.match(html, /<a[^>]+href="\/"[^>]*id="back-home"/);
    assert.deepEqual(htmlIds.filter((id, i) => htmlIds.indexOf(id) !== i), []);
  });
});

describe("markup: DOM <-> JS closure", () => {
  it("every id referenced by JS exists in the HTML", () => {
    const refs = new Set();
    for (const m of allJs.matchAll(/getElementById\("([^"]+)"\)/g)) refs.add(m[1]);
    for (const m of allJs.matchAll(/\$\("([^"]+)"\)/g)) refs.add(m[1]);
    assert.ok(refs.size > 10, "the id scan found almost nothing");
    assert.deepEqual([...refs].filter((id) => !htmlIds.includes(id)), []);
  });

  it("every button is wired to a JS handler", () => {
    const buttons = [...html.matchAll(/<button[^>]+id="([^"]+)"/g)].map((m) => m[1]);
    const missing = buttons.filter((id) => !allJs.includes(`"${id}"`) && !allJs.includes(`'${id}'`));
    assert.deepEqual(missing, []);
  });

  it("SVG board exists with touch constraints", () => {
    assert.match(html, /<svg[^>]+id="board"/);
    assert.match(html, /viewBox="-300 -300 600 600"/);
    assert.match(css, /touch-action:\s*none/);
    assert.match(css, /overscroll-behavior:\s*none/);
  });

  it("all layers the renderer writes to are present", () => {
    for (const id of ["star-plate", "star-inlay", "hole-layer", "trail-layer", "target-layer", "marble-layer", "flyer-layer"]) {
      assert.ok(htmlIds.includes(id), `missing SVG layer ${id}`);
    }
  });
});

describe("markup: language purity", () => {
  it("static Chinese nodes declare data-i18n (or are JS-owned by id)", () => {
    const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
    const offenders = [];
    for (const m of clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fa5]+[^<]*)<\/\1>/g)) {
      const tag = m[1].toLowerCase();
      if (tag === "title" || tag === "script") continue;
      if (m[2].includes("data-i18n")) continue;
      const id = m[2].match(/id="([^"]+)"/)?.[1];
      if (id && (allJs.includes(`"${id}"`) || allJs.includes(`'${id}'`))) continue;
      offenders.push(`<${tag}> ${m[3].trim().slice(0, 14)}`);
    }
    assert.deepEqual(offenders, []);
  });

  it("every data-i18n key resolves in the dictionary, including dotted groups", () => {
    const keys = new Set([
      ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/data-i18n-aria="([^"]+)"/g)].map((m) => m[1]),
    ]);
    assert.ok(keys.size > 20);
    assert.deepEqual([...keys].filter((key) => !hasI18nKey(key)), []);
  });

  it("runtime sources other than i18n.mjs contain no Chinese string literals", () => {
    const offenders = [];
    for (const [file, src] of Object.entries(sources)) {
      if (file === "i18n.mjs") continue;
      const code = stripComments(src).replace(/(^|[^:])\/\/.*$/gm, "$1");
      const matches = code.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fa5]+[^"'`\r\n]*\1/g);
      if (matches) offenders.push(`${file}: ${matches.slice(0, 2).join(", ")}`);
    }
    assert.deepEqual(offenders, []);
  });

  it("no reload: language switching is in place", () => {
    assert.ok(!allJs.includes("location.reload"));
    assert.ok(allJs.includes("doin.lang"));
    assert.ok(sources["ui.mjs"].includes("data-i18n"));
    assert.ok(sources["ui.mjs"].includes("data-i18n-aria"));
  });
});

describe("markup: CSS contracts", () => {
  it("reduced motion removes animation only, never hides an interactive part", () => {
    const block = mediaBlock(css, "@media (prefers-reduced-motion: reduce)");
    assert.ok(block.length > 0);
    assert.match(block, /animation-duration/);
    assert.match(block, /transition-duration/);
    assert.ok(!/display\s*:\s*none/.test(block), "reduced motion must not hide anything");
  });

  it("mobile bottom clearance and safe area", () => {
    assert.match(css, /env\(safe-area-inset-bottom\)/);
    assert.match(css, /max\(68px/);
  });

  it("no external resources", () => {
    assert.deepEqual([...html.matchAll(/(?:src|href)="(https?:)?\/\//g)], []);
    assert.ok(!/@import\s+url\(/i.test(css));
  });

  it("braces are balanced so no rule is silently swallowed", () => {
    const clean = stripComments(css);
    const open = (clean.match(/\{/g) || []).length;
    const close = (clean.match(/\}/g) || []).length;
    assert.equal(open, close, `${open} opening vs ${close} closing braces`);
  });
});

describe("markup: first-frame play and audio surface", () => {
  it("opens on a ready board with resident mode entry, no blocking overlay", () => {
    assert.match(html, /id="mode-row"/);
    assert.match(html, /id="difficulty-row"/);
    assert.match(html, /<div id="help-panel" class="overlay" hidden>/);
    assert.match(html, /<div id="result-panel" class="overlay" hidden>/);
  });

  it("every sfx name called by ui/main is exported by audio.mjs", () => {
    const audio = sources["audio.mjs"];
    const block = audio.slice(audio.indexOf("export const sfx"), audio.lastIndexOf("};"));
    const exported = new Set([...block.matchAll(/^\s{2}(\w+)\(/gm)].map((m) => m[1]));
    assert.ok(exported.size >= 8, `only ${exported.size} cues found`);
    const calls = new Set();
    for (const file of ["ui.mjs", "main.mjs"]) {
      for (const m of sources[file].matchAll(/onSfx\(\s*"(\w+)"/g)) calls.add(m[1]);
      for (const m of sources[file].matchAll(/\bsfx\.(\w+)\s*\(/g)) calls.add(m[1]);
    }
    assert.deepEqual([...calls].filter((name) => !exported.has(name)), []);
  });

  it("the debug handle is a getter-based global", () => {
    assert.match(sources["main.mjs"], /globalThis\.__checkers\s*=/);
    assert.match(sources["main.mjs"], /get game\(\)/);
    assert.match(sources["main.mjs"], /querySelector\?\.\("#tea-room"\)/);
  });
});
