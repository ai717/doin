import test from "node:test";
import assert from "node:assert/strict";
import { LANG_KEY, STRINGS, t } from "../js/i18n.mjs";

test("i18n: shared preference key is doin.lang", () => {
  assert.equal(LANG_KEY, "doin.lang");
});

test("i18n: zh and en string keys must align perfectly and be non-empty", () => {
  const zhKeys = Object.keys(STRINGS.zh).sort();
  const enKeys = Object.keys(STRINGS.en).sort();

  assert.deepEqual(zhKeys, enKeys, "ZH and EN dictionaries must have identical key sets");

  for (const k of zhKeys) {
    assert.ok(STRINGS.zh[k] && typeof STRINGS.zh[k] === "string", `zh.${k} must be non-empty string`);
    assert.ok(STRINGS.en[k] && typeof STRINGS.en[k] === "string", `en.${k} must be non-empty string`);
  }
});

test("i18n: translation function interpolates parameters correctly", () => {
  const rendered = t("winDesc", "zh", {
    time: "00:15.2",
    moves: 42,
    tps: "2.8",
  });
  assert.ok(rendered.includes("00:15.2"));
  assert.ok(rendered.includes("42"));
  assert.ok(rendered.includes("2.8"));
});
