// i18n.test.mjs - table parity / English purity / level-name coverage
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LANG_KEY, LOCALES, chapterName, colorName, errorText, htmlLang, instructionName,
  lessonText, levelName, lookup, normalizeLocale, strings, translate,
} from "../js/i18n.mjs";
import { CHAPTERS, LEVEL_COUNT, LEVELS } from "../js/levels.mjs";

const HAN = /[\u4e00-\u9fa5]/;

function walk(table, visit, prefix = "") {
  for (const [key, value] of Object.entries(table)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") walk(value, visit, path);
    else visit(path, value);
  }
}

describe("i18n: table structure", () => {
  it("both locales expose identical key trees", () => {
    assert.deepEqual(LOCALES, ["zh", "en"]);
    const zhKeys = [];
    const enKeys = [];
    walk(strings.zh, (path) => zhKeys.push(path));
    walk(strings.en, (path) => enKeys.push(path));
    assert.deepEqual(enKeys.sort(), zhKeys.sort());
  });

  it("every leaf is a non-empty string", () => {
    for (const locale of LOCALES) {
      walk(strings[locale], (path, value) => {
        assert.equal(typeof value, "string", `${locale}.${path} is not a string`);
        assert.ok(value.trim().length > 0, `${locale}.${path} is empty`);
      });
    }
  });

  it("the English table has no Chinese except the language button", () => {
    walk(strings.en, (path, value) => {
      if (/langBtn/i.test(path)) return;
      assert.ok(!HAN.test(value), `en.${path} contains Chinese: ${value}`);
    });
  });

  it("placeholders match between the two tables", () => {
    const slots = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    const at = (table, path) => path.split(".").reduce((node, key) => (node ? node[key] : undefined), table);
    walk(strings.zh, (path, value) => {
      assert.equal(slots(at(strings.en, path) ?? ""), slots(value), `placeholder mismatch at ${path}`);
    });
  });

  it("names every level and chapter that levels.mjs ships", () => {
    for (const entry of LEVELS) {
      for (const locale of LOCALES) {
        assert.ok(!HAN.test(levelName(locale, entry.id)) || locale === "zh", `en level ${entry.id} has Chinese`);
        assert.notEqual(levelName(locale, entry.id), String(entry.id), `level ${entry.id} is unnamed`);
        assert.notEqual(chapterName(locale, entry.chapter), String(entry.chapter), `chapter ${entry.chapter} is unnamed`);
        assert.ok(lessonText(locale, entry.chapter).length > 8, `chapter ${entry.chapter} lesson is too short`);
      }
    }
    const ids = new Set(LEVELS.map((l) => l.id));
    assert.equal(ids.size, LEVEL_COUNT);
    const chapterIds = new Set(LEVELS.map((l) => l.chapter));
    assert.equal(chapterIds.size, CHAPTERS.length);
    for (const id of chapterIds) assert.ok(strings.zh.chapter[id], `missing zh.chapter.${id}`);
  });
});

describe("i18n: lookups", () => {
  it("translate substitutes variables and falls back safely", () => {
    assert.equal(translate("zh", "lineCount", { n: 7 }), "7 行");
    assert.equal(translate("en", "lineCount", { n: 7 }), "7 lines");
    assert.equal(translate("en", "overPar", { n: 2 }), "2 lines over par");
    assert.equal(translate("en", "overPar", {}), "{n} lines over par");
    assert.equal(translate("zh", "missingKey"), "missingKey");
    assert.equal(translate("xx", "help"), strings.zh.help);
    assert.equal(translate("en", "op"), "op", "nested tables are not top-level strings");
  });

  it("locale normalisation and html lang mapping", () => {
    assert.equal(normalizeLocale("en"), "en");
    assert.equal(normalizeLocale("EN"), "zh");
    assert.equal(normalizeLocale(null), "zh");
    assert.equal(htmlLang("en"), "en");
    assert.equal(htmlLang("zh"), "zh-CN");
  });

  it("nested groups resolve every op, color and chapter", () => {
    for (const op of ["f", "l", "r", "j", "a", "p"]) {
      assert.equal(lookup("en", "op", op), strings.en.op[op]);
      assert.ok(!HAN.test(lookup("en", "op", op)), `en.op.${op} has Chinese`);
      assert.equal(lookup("xx", "op", op), strings.zh.op[op]);
    }
    for (const color of ["r", "b", "g"]) {
      assert.equal(colorName("en", color), strings.en.color[color]);
      assert.equal(colorName("zh", color), strings.zh.color[color]);
    }
    assert.equal(lookup("en", "op", "zzz"), "zzz");
    assert.equal(lookup("en", "missing", "x"), "x");
  });

  it("instructionName composes op and color", () => {
    assert.equal(instructionName("zh", "F"), "前进");
    assert.equal(instructionName("zh", "F:r"), "前进·红格");
    assert.equal(instructionName("en", "A:b"), "Act · Blue");
    assert.equal(instructionName("en", "p"), "Call");
    assert.equal(instructionName("en", ""), "");
    assert.equal(instructionName("en", "Q"), "Q");
  });

  it("errorText reports the offending slot line", () => {
    assert.equal(errorText("zh", { code: "blocked", at: { proc: "main", ip: 2 } }), "第 3 行撞墙或踩空，执行中断。");
    assert.equal(errorText("en", { code: "loop", at: { proc: "proc1", ip: 0 } }), "Line 1 detected a recursive loop. Execution stopped.");
    assert.equal(errorText("en", { code: "limit", at: null }), "Step limit reached, execution halted.");
    assert.equal(errorText("zh", null), "第 ? 行撞墙或踩空，执行中断。");
    assert.equal(errorText("en", { code: "nonsense" }), "Line ? hit a wall or a pit. Execution stopped.");
  });

  it("language preference uses the portal-wide key", () => {
    assert.equal(LANG_KEY, "doin.lang");
  });
});
