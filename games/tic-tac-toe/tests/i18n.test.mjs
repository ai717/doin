import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_LOCALE,
  LANG_KEY,
  LOCALES,
  detectLocale,
  format,
  htmlLang,
  isLocale,
  loadLocale,
  saveLocale,
  strings,
} from "../js/i18n.mjs";

// 极简 localStorage 桩（node 环境无 window）。
function installStorage(initial = new Map()) {
  const store = new Map(initial);
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  return store;
}

test("字符串表：zh/en 键完全对齐，不允许缺翻译", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  // en 允许个别键为空串（如 streakUnit：英文无对应量词），但必须显式声明。
  const enEmptyAllowed = new Set(["streakUnit"]);
  for (const [key, value] of Object.entries(zh)) {
    assert.ok(String(value).length > 0, `zh.${key} 不能是空串`);
    const enValue = en[key];
    assert.equal(typeof enValue, typeof value, `en.${key} 类型必须与 zh.${key} 一致`);
    if (!enEmptyAllowed.has(key)) {
      assert.ok(String(enValue).length > 0, `en.${key} 不能是空串`);
    }
  }
});

test("strings：非法 locale 回退默认语言", () => {
  assert.equal(strings("fr"), strings(DEFAULT_LOCALE));
  assert.equal(strings(undefined), strings("zh"));
});

test("isLocale / LOCALES：只认 zh 与 en", () => {
  assert.deepEqual([...LOCALES], ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("jp"), false);
  assert.equal(isLocale(""), false);
});

test("detectLocale：navigator 语言 zh* → 中文，其余 → 英文", () => {
  const original = globalThis.navigator;
  const probe = (languages, language) => {
    Object.defineProperty(globalThis, "navigator", {
      value: { languages, language },
      configurable: true,
    });
    return detectLocale();
  };
  try {
    assert.equal(probe(["zh-CN", "en"], "zh-CN"), "zh");
    assert.equal(probe(["en-US", "zh"], "en-US"), "zh");
    assert.equal(probe(["zh-Hant-TW"], "zh-Hant-TW"), "zh");
    assert.equal(probe(["en-US"], "en-US"), "en");
    assert.equal(probe(["ja-JP"], "ja-JP"), "en");
    assert.equal(probe([], ""), "en");
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
  }
});

test("loadLocale：共享偏好 doin.lang 优先于浏览器语言", () => {
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { languages: ["zh-CN"], language: "zh-CN" },
    configurable: true,
  });
  try {
    installStorage();
    assert.equal(loadLocale(), "zh");

    installStorage([[LANG_KEY, "en"]]);
    assert.equal(loadLocale(), "en");

    installStorage([[LANG_KEY, "hack"]]);
    assert.equal(loadLocale(), "zh");
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
  }
});

test("saveLocale：只写合法值；localStorage 抛错时静默返回 false", () => {
  const store = installStorage();
  assert.equal(saveLocale("en"), true);
  assert.equal(store.get(LANG_KEY), "en");
  assert.equal(saveLocale("fr"), false);

  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: () => {},
  };
  assert.equal(saveLocale("en"), false);
});

test("htmlLang：locale → HTML lang 属性值", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("format：{0} 占位插值，缺参保留原样", () => {
  assert.equal(format("第 {0} 行第 {1} 列", "2", "3"), "第 2 行第 3 列");
  assert.equal(format("Row {0} of {1}", "2"), "Row 2 of {1}");
});
