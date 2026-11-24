import test from "node:test";
import assert from "node:assert/strict";

import { strings, t, hasKey, otherLocale, htmlLang, LANG_KEY } from "../js/i18n.mjs";
import { GLYPHS, CHAPTERS } from "../js/data.mjs";

const HAN = /[\u4e00-\u9fa5]/;

function placeholders(value) {
  return [...String(value).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(",");
}

test("双语：中英键完全对齐且都非空", () => {
  const zh = Object.keys(strings.zh).sort();
  const en = Object.keys(strings.en).sort();
  assert.deepEqual(en, zh);
  for (const key of zh) {
    assert.ok(String(strings.zh[key]).trim().length > 0, `zh.${key} 为空`);
    assert.ok(String(strings.en[key]).trim().length > 0, `en.${key} 为空`);
  }
  assert.equal(LANG_KEY, "doin.lang");
});

test("双语：英文表零汉字（语言切换按钮除外）", () => {
  for (const [key, value] of Object.entries(strings.en)) {
    if (key === "langShort") continue;
    assert.equal(HAN.test(value), false, `en.${key} 含汉字: ${value}`);
  }
  assert.equal(strings.en.langShort, "中文");
});

test("双语：同键占位符完全一致", () => {
  for (const key of Object.keys(strings.zh)) {
    assert.equal(placeholders(strings.zh[key]), placeholders(strings.en[key]), `${key} 占位符不一致`);
  }
});

test("双语：t 能替换变量并回退", () => {
  assert.equal(t("zh", "levelLabel", { n: 3 }), "第 3 关");
  assert.equal(t("en", "levelLabel", { n: 3 }), "Level 3");
  assert.equal(t("en", "chapterHeading", { n: 1, name: "Sun & Moon" }), "Chapter 1 · Sun & Moon");
  assert.equal(t("zh", "missingKey"), "missingKey");
  assert.equal(t("zh", "levelLabel", {}), "第 {n} 关");
  assert.equal(otherLocale("zh"), "en");
  assert.equal(otherLocale("en"), "zh");
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(hasKey("zh", "appTitle"), true);
  assert.equal(hasKey("en", "appTitle"), true);
  assert.equal(hasKey("en", "noSuchKey"), false);
});

test("数据：章节名键在双表中存在", () => {
  for (const chapter of CHAPTERS) {
    assert.ok(hasKey("zh", chapter.nameKey), `zh 缺 ${chapter.nameKey}`);
    assert.ok(hasKey("en", chapter.nameKey), `en 缺 ${chapter.nameKey}`);
  }
});

test("数据：英文释义零汉字，本字保留汉字", () => {
  for (const [id, glyph] of Object.entries(GLYPHS)) {
    assert.equal(HAN.test(glyph.en), false, `${id} 英文释义含汉字`);
    assert.equal(HAN.test(glyph.char), true, `${id} 本字应为汉字`);
    assert.equal(HAN.test(glyph.zh), true, `${id} 中文释义应为汉字`);
  }
});
