import test from "node:test";
import assert from "node:assert/strict";
import * as I18n from "../js/i18n.mjs";
import { ALL_RELICS } from "../js/engine.mjs";

test("i18n: 存储键严格使用全站共享 key doin.lang", () => {
  assert.equal(I18n.STORAGE_KEY, "doin.lang");
});

test("i18n: 中英双表键名集合严格 1:1 对齐且非空", () => {
  const zhKeys = Object.keys(I18n.DICTIONARY.zh).sort();
  const enKeys = Object.keys(I18n.DICTIONARY.en).sort();

  const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
  const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));

  assert.deepEqual(missingInEn, [], `英文字典缺失键: ${missingInEn.join(", ")}`);
  assert.deepEqual(missingInZh, [], `中文字典缺失键: ${missingInZh.join(", ")}`);

  for (const [lang, dict] of Object.entries(I18n.DICTIONARY)) {
    for (const [key, val] of Object.entries(dict)) {
      assert.ok(typeof val === "string" && val.trim().length > 0, `[${lang}] 键 ${key} 不能为空`);
    }
  }
});

test("i18n: 覆盖全量 20 张遗物卡名称与描述", () => {
  for (const relic of ALL_RELICS) {
    const nameKey = `${relic.id}_name`;
    const descKey = `${relic.id}_desc`;

    assert.ok(I18n.DICTIONARY.zh[nameKey], `中文缺失遗物名: ${nameKey}`);
    assert.ok(I18n.DICTIONARY.zh[descKey], `中文缺失遗物描述: ${descKey}`);
    assert.ok(I18n.DICTIONARY.en[nameKey], `英文缺失遗物名: ${nameKey}`);
    assert.ok(I18n.DICTIONARY.en[descKey], `英文缺失遗物描述: ${descKey}`);
  }
});

test("i18n: 动态变量插值替换", () => {
  const textZh = I18n.t("finalWave", "zh", { w: 18 });
  assert.equal(textZh, "防守波次: 18 / 20");

  const textEn = I18n.t("finalWave", "en", { w: 18 });
  assert.equal(textEn, "Wave Defended: 18 / 20");
});
