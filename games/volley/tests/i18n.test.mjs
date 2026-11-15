// Volley i18n tests: key parity, pure English table, interpolation, hot-swap.

import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const { STRINGS, t, getLang, setLang, toggleLang, applyI18n } = await import(`../js/i18n.mjs?t=${Date.now()}`);

test("词典：zh/en key 完全对齐且排序一致", () => {
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.zh).sort(), "key 集合一致");
  assert.ok(Object.keys(STRINGS.zh).length >= 100, "词典量级达标");
});

test("英文表零汉字（langBtn 白名单除外）", () => {
  const han = /[\u4e00-\u9fa5]/;
  for (const [key, value] of Object.entries(STRINGS.en)) {
    if (key === "langBtn") continue;
    assert.ok(!han.test(value), `en.${key} 含汉字: ${value}`);
  }
});

test("t()：插值 {n} 与缺 key 回退", () => {
  assert.equal(t("windLeft", "zh", { n: 3 }), "← 3");
  assert.equal(t("windRight", "en", { n: 5 }), "5 →");
  assert.equal(t("__nope__", "zh"), "__nope__", "缺 key 原样回退");
});

test("getLang/setLang/toggleLang 往返", () => {
  const before = getLang();
  setLang("en");
  assert.equal(getLang(), "en");
  toggleLang();
  assert.equal(getLang(), "zh");
  toggleLang();
  setLang(before);
});

test("源码零裸写中文（i18n.mjs 词典除外，去注释后断言）", () => {
  const han = /[\u4e00-\u9fa5]/;
  const jsDir = join(root, "js");
  for (const file of readdirSync(jsDir)) {
    if (!file.endsWith(".mjs")) continue;
    if (file === "i18n.mjs") continue;
    const raw = readFileSync(join(jsDir, file), "utf8");
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s\/\/[^\n]*/g, "");
    assert.ok(!han.test(code), `js/${file} 代码区含裸中文`);
  }
});

test("index.html 中文节点全部带 data-i18n", () => {
  let html = readFileSync(join(root, "index.html"), "utf8");
  html = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
  // strip tags: every element containing CJK must carry data-i18n on itself
  const re = /<([a-z0-9]+)([^>]*)>([^<]*[\u4e00-\u9fa5][^<]*)<\/\1>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[2] ?? "";
    const hasI18n = /data-i18n/.test(attrs);
    assert.ok(hasI18n, `中文节点缺 data-i18n: <${m[1]}${attrs}>${m[3].slice(0, 24)}…`);
  }
});
