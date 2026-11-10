// i18n.test.mjs - table parity / English purity / public helpers
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LANG_KEY, LOCALES, htmlLang, lookup, normalizeLocale, strings, translate,
  difficultyName, modeName, sideName,
} from "../js/i18n.mjs";
import { DIFFICULTIES } from "../js/ai.mjs";
import { MODES } from "../js/game.mjs";

const HAN = /[\u4e00-\u9fa5]/;

function walk(table, visit, prefix = "") {
  for (const [key, value] of Object.entries(table)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") walk(value, visit, path);
    else visit(path, value);
  }
}

describe("i18n: table structure", () => {
  it("both locales exist and expose identical key trees", () => {
    assert.deepEqual(LOCALES, ["zh", "en"]);
    const zhKeys = [];
    const enKeys = [];
    walk(strings.zh, (path) => zhKeys.push(path));
    walk(strings.en, (path) => enKeys.push(path));
    assert.deepEqual(enKeys.sort(), zhKeys.sort());
  });

  it("every leaf is a non-empty string in both tables", () => {
    walk(strings.zh, (path, value) => {
      assert.equal(typeof value, "string", `zh.${path} is not a string`);
      assert.ok(value.trim().length > 0, `zh.${path} is empty`);
    });
    walk(strings.en, (path, value) => {
      assert.equal(typeof value, "string", `en.${path} is not a string`);
      assert.ok(value.trim().length > 0, `en.${path} is empty`);
    });
  });

  it("the English table has no Chinese except the language button", () => {
    walk(strings.en, (path, value) => {
      if (/langBtn/i.test(path)) return;
      assert.ok(!HAN.test(value), `en.${path} contains Chinese: ${value}`);
    });
  });

  it("placeholders match between the two tables", () => {
    const slots = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
    walk(strings.zh, (path, value) => {
      assert.equal(slots(strings.en[path] ?? ""), slots(value), `placeholder mismatch at ${path}`);
    });
  });
});

describe("i18n: lookups", () => {
  it("translate substitutes variables and falls back safely", () => {
    assert.equal(translate("zh", "hopBanner", { n: 6 }), "惊现 6 连绝妙大跳！");
    assert.equal(translate("en", "hopBanner", { n: 6 }), "Brilliant 6-hop chain!");
    assert.equal(translate("en", "logJump", { n: 3 }), "3 hops");
    assert.equal(translate("en", "hopBanner", {}), "Brilliant {n}-hop chain!");
    assert.equal(translate("zh", "missingKey"), "missingKey");
    assert.equal(translate("xx", "help"), strings.zh.help);
    assert.equal(translate("en", "diff"), "diff", "nested tables are not top-level strings");
  });

  it("locale normalisation and html lang mapping", () => {
    assert.equal(normalizeLocale("en"), "en");
    assert.equal(normalizeLocale("EN"), "zh");
    assert.equal(normalizeLocale(null), "zh");
    assert.equal(htmlLang("en"), "en");
    assert.equal(htmlLang("zh"), "zh-CN");
  });

  it("nested lookups cover every difficulty, mode and side", () => {
    for (const id of DIFFICULTIES) {
      assert.equal(difficultyName("en", id), strings.en.diff[id]);
      assert.ok(!HAN.test(difficultyName("en", id)), `en.diff.${id} has Chinese`);
      assert.equal(difficultyName("xx", id), strings.zh.diff[id]);
    }
    for (const id of Object.values(MODES)) {
      assert.equal(modeName("en", id), strings.en.mode[id]);
      assert.equal(modeName("zh", id), strings.zh.mode[id]);
    }
    for (const id of ["red", "blue"]) {
      assert.equal(sideName("en", id), strings.en.side[id]);
      assert.equal(sideName("zh", id), strings.zh.side[id]);
    }
    assert.equal(lookup("en", "diff", "unknown"), "unknown");
    assert.equal(lookup("en", "missing", "x"), "x");
  });

  it("language preference uses the portal-wide key", () => {
    assert.equal(LANG_KEY, "doin.lang");
  });
});
