import test from "node:test";
import assert from "node:assert/strict";

import { TRANSLATIONS, setLanguage, t } from "../js/i18n.mjs";

test("Chinese and English translation tables remain complete and aligned", () => {
  assert.deepEqual(Object.keys(TRANSLATIONS.zh).sort(), Object.keys(TRANSLATIONS.en).sort());
  assert.ok(Object.values(TRANSLATIONS.zh).every(Boolean));
  assert.ok(Object.values(TRANSLATIONS.en).every(Boolean));
});

test("language changes accept only supported locales", () => {
  setLanguage("en");
  assert.equal(t("btnStart"), "ENGAGE HARMONY");
  assert.equal(setLanguage("fr"), "en");
  setLanguage("zh");
  assert.equal(t("btnStart"), "开启共振");
});
