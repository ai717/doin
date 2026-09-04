import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_LOCALE,
  LOCALES,
  detectLocale,
  gameTitle,
  htmlLang,
  isLocale,
  strings,
} from "../js/i18n.mjs";

test("语言表：仅 zh / en，默认 zh", () => {
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(DEFAULT_LOCALE, "zh");
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("jp"), false);
});

test("字符串表：zh/en 键完全对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const [key, value] of Object.entries(zh)) {
    assert.ok(String(value).length > 0, `zh.${key} 不能是空串`);
    assert.ok(String(en[key]).length > 0, `en.${key} 不能是空串`);
  }
});

test("detectLocale：任意 zh* → zh，其余 → en", () => {
  const original = globalThis.navigator;
  const stub = (value) => Object.defineProperty(globalThis, "navigator", { value, configurable: true });
  try {
    stub({ languages: [], language: "en-US" });
    assert.equal(detectLocale(), "en");
    stub({ languages: ["en-US", "zh-CN"], language: "en-US" });
    assert.equal(detectLocale(), "zh");
    stub({ languages: [], language: "zh" });
    assert.equal(detectLocale(), "zh");
  } finally {
    stub(original);
  }
});

test("gameTitle：en 用 en.title，缺省回落中文 title", () => {
  const game = { title: "扫雷", en: { title: "Minesweeper" } };
  assert.equal(gameTitle(game, "en"), "Minesweeper");
  assert.equal(gameTitle(game, "zh"), "扫雷");
  assert.equal(gameTitle({ title: "2048" }, "en"), "2048");
  assert.equal(gameTitle({}, "en"), "");
});

test("htmlLang：zh → zh-CN，en → en", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});
