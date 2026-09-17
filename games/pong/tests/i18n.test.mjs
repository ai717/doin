import test from "node:test";
import assert from "node:assert/strict";
import {
  strings,
  format,
  htmlLang,
  LOCALES
} from "../js/i18n.mjs";

test("i18n: 中英双表所有键严格对齐且非空", () => {
  const zh = strings("zh");
  const en = strings("en");

  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();

  assert.deepEqual(zhKeys, enKeys, "中英字典键集合必须完全一致");

  for (const k of zhKeys) {
    assert.ok(typeof zh[k] === "string" && zh[k].length > 0, `zh[${k}] 不能为空`);
    assert.ok(typeof en[k] === "string" && en[k].length > 0, `en[${k}] 不能为空`);
  }
});

test("i18n: format 参数插值替换", () => {
  const res = format("最终比分：{0} - {1}", 5, 3);
  assert.equal(res, "最终比分：5 - 3");
});

test("i18n: htmlLang 映射正确", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});