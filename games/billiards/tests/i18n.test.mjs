// i18n.test.mjs — 中英双表对齐 + 英文零汉字 + 源码零未封装中文 + HTML/JS 引用键闭合
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { LOCALES, LANG_KEY, DEFAULT_LOCALE, strings, isLocale, htmlLang, normalizeLang, otherLang, t, format } from "../js/i18n.mjs";

const HAN_RE = /[\u4e00-\u9fff]/;
const gameDir = join(import.meta.dirname, "..");
const jsDir = join(gameDir, "js");
const jsFiles = readdirSync(jsDir).filter((f) => f.endsWith(".mjs"));

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("i18n: 基本契约", () => {
  it("语言 key 是全站共享的 doin.lang", () => {
    assert.equal(LANG_KEY, "doin.lang");
  });
  it("LOCALES 与默认语言合法", () => {
    assert.deepEqual([...LOCALES], ["zh", "en"]);
    assert.ok(LOCALES.includes(DEFAULT_LOCALE));
    assert.equal(isLocale("zh"), true);
    assert.equal(isLocale("jp"), false);
    assert.equal(normalizeLang("jp"), "zh");
    assert.equal(normalizeLang(undefined), "zh");
    assert.equal(otherLang("zh"), "en");
    assert.equal(otherLang("en"), "zh");
  });
  it("htmlLang 映射正确", () => {
    assert.equal(htmlLang("zh"), "zh-CN");
    assert.equal(htmlLang("en"), "en");
    assert.equal(htmlLang("bogus"), "zh-CN");
  });
  it("t 缺失键回落到 zh 再回落键名", () => {
    assert.equal(t("gameTitle", "en"), "Felt & Cue");
    assert.equal(t("gameTitle", "jp"), strings.zh.gameTitle, "未知语言回落中文");
    assert.equal(t("__nope__", "en"), "__nope__");
  });
  it("format 替换 {var} 占位符", () => {
    assert.equal(format("combo", "zh", { n: 3 }), "连击 3");
    assert.equal(format("combo", "en", { n: 3 }), "Run x3");
    assert.equal(format("turnFlag", "en", { p: "Player 1" }), "Player 1 to shoot");
    assert.equal(format("combo", "en", {}), "Run x", "缺失变量填空串不炸");
  });
});

describe("i18n: 中英键对齐且非空", () => {
  const zhKeys = Object.keys(strings.zh);
  const enKeys = Object.keys(strings.en);
  it("键集合完全一致", () => {
    assert.deepEqual(zhKeys.slice().sort(), enKeys.slice().sort());
  });
  it("所有值非空字符串", () => {
    for (const key of zhKeys) {
      assert.equal(typeof strings.zh[key], "string", `zh.${key} 非字符串`);
      assert.ok(strings.zh[key].trim().length > 0, `zh.${key} 为空`);
      assert.equal(typeof strings.en[key], "string", `en.${key} 非字符串`);
      assert.ok(strings.en[key].trim().length > 0, `en.${key} 为空`);
    }
  });
  it("两组占位符一致（{s}/{p}/{n} 数量与名称对齐）", () => {
    const ph = (s) => (s.match(/\{(\w+)\}/g) ?? []).slice().sort().join(",");
    for (const key of zhKeys) {
      assert.equal(ph(strings.en[key]), ph(strings.zh[key]), `${key} 占位符不一致`);
    }
  });
});

describe("i18n: 英文表零汉字（红线）", () => {
  // 白名单：语言切换按钮标识（AGENTS.md 允许）
  const WHITELIST = new Set(["langName"]);
  for (const key of Object.keys(strings.en)) {
    it(`en.${key} 不含汉字`, () => {
      if (WHITELIST.has(key)) return;
      assert.equal(HAN_RE.test(strings.en[key]), false, `en.${key} 含汉字：${strings.en[key]}`);
    });
  }
});

describe("i18n: 源码零未封装中文（红线）", () => {
  for (const file of jsFiles) {
    if (file === "i18n.mjs") continue;
    it(`${file} 不含裸写中文`, () => {
      const src = stripComments(readFileSync(join(jsDir, file), "utf8"));
      const hits = src.match(/(["'`])[^"'`\r\n]*[\u4e00-\u9fff]+[^"'`\r\n]*\1/g);
      assert.equal(hits, null, `${file} 含裸写中文：${hits?.slice(0, 2).join(", ")}`);
    });
  }
});

describe("i18n: HTML 与 JS 引用的键全部闭合", () => {
  const html = readFileSync(join(gameDir, "index.html"), "utf8");
  const zhKeys = new Set(Object.keys(strings.zh));

  it("index.html 的 data-i18n / data-i18n-aria 键都存在", () => {
    const keys = [
      ...[...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]),
      ...[...html.matchAll(/data-i18n-aria="([^"]+)"/g)].map((m) => m[1]),
    ];
    assert.ok(keys.length > 20, `覆盖节点太少：${keys.length}`);
    for (const key of keys) {
      assert.ok(zhKeys.has(key), `index.html 引用了不存在的键 ${key}`);
    }
  });

  it("JS 中 t()/format() 引用的字面量键都存在", () => {
    for (const file of jsFiles) {
      if (file === "i18n.mjs") continue;
      const src = stripComments(readFileSync(join(jsDir, file), "utf8"));
      const keys = [
        ...[...src.matchAll(/\bt\(\s*"([^"]+)"/g)].map((m) => m[1]),
        ...[...src.matchAll(/\bformat\(\s*"([^"]+)"/g)].map((m) => m[1]),
      ];
      for (const key of keys) {
        assert.ok(zhKeys.has(key), `${file} 引用了不存在的键 ${key}`);
      }
    }
  });

  it("index.html 中每个含中文的文本节点都带 data-i18n 或有 JS 覆盖", () => {
    const clean = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "");
    const allJs = jsFiles.map((f) => readFileSync(join(jsDir, f), "utf8")).join("\n");
    const nodes = [...clean.matchAll(/<([a-zA-Z0-9-]+)([^>]*)>([^<]*[\u4e00-\u9fff]+[^<]*)<\/\1/g)];
    for (const [, tag, attrs, text] of nodes) {
      if (tag === "title" || tag === "script") continue;
      if (attrs.includes("data-i18n")) continue;
      const id = attrs.match(/id="([^"]+)"/)?.[1] ?? null;
      assert.ok(id && allJs.includes(`"${id}"`), `未覆盖的中文节点 <${tag}> ${text.trim().slice(0, 12)}`);
    }
  });

  it("球局名与犯规名等派生键齐全", () => {
    const ids = readFileSync(join(jsDir, "tables.mjs"), "utf8").match(/id:\s*"(table_\d+)"/g) ?? [];
    const tableIds = ids.map((s) => s.match(/"(table_\d+)"/)[1]);
    assert.ok(tableIds.length >= 10, "至少 10 局球局");
    for (const id of tableIds) assert.ok(zhKeys.has(id), `缺球局名键 ${id}`);
    for (const f of ["illegal_break", "scratch", "no_contact", "wrong_ball", "no_rail", "eight_early"]) {
      assert.ok(zhKeys.has(`fool_${f}`), `缺犯规名键 fool_${f}`);
    }
    for (const s of ["center", "follow", "draw", "side"]) {
      assert.ok(zhKeys.has(`spin_${s}`), `缺旋转名键 spin_${s}`);
    }
  });
});

describe("i18n: 语言切换不得刷新页面（红线）", () => {
  it("运行源码零 location.reload", () => {
    for (const file of jsFiles) {
      const src = stripComments(readFileSync(join(jsDir, file), "utf8"));
      assert.equal(src.includes("location.reload"), false, `${file} 含 location.reload`);
    }
  });
  it("index.html 内联脚本也不刷新", () => {
    const html = readFileSync(join(gameDir, "index.html"), "utf8");
    assert.equal(html.includes("location.reload"), false);
  });
});
