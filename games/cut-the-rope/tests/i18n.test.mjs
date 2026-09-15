import test from "node:test";
import assert from "node:assert/strict";
import { DICTS, getLang, setLang, t } from "../js/i18n.mjs";

test("i18n: dictionary symmetry and non-empty values", () => {
  const zhKeys = Object.keys(DICTS.zh);
  const enKeys = Object.keys(DICTS.en);

  assert.deepEqual(zhKeys.sort(), enKeys.sort(), "zh and en keys must be exactly identical");

  for (const key of zhKeys) {
    assert.ok(DICTS.zh[key] && DICTS.zh[key].trim().length > 0, `zh[${key}] must be non-empty`);
    assert.ok(DICTS.en[key] && DICTS.en[key].trim().length > 0, `en[${key}] must be non-empty`);
  }
});

test("i18n: getLang and setLang behavior", () => {
  assert.equal(setLang("en"), "en");
  assert.equal(getLang(), "en");
  assert.equal(setLang("zh"), "zh");
  assert.equal(getLang(), "zh");
});

test("i18n: t() returns correct translation", () => {
  assert.equal(t("gameTitle", "zh"), "割绳子");
  assert.equal(t("gameTitle", "en"), "Cut the Rope");
  assert.equal(t("non_existent_key", "zh"), "non_existent_key");
});
