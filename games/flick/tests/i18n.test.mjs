import test from "node:test";
import assert from "node:assert/strict";

import { LANG_KEY, hasKey, htmlLang, otherLocale, strings, t } from "../js/i18n.mjs";
import { BOARDS, DIFFICULTIES } from "../js/levels.mjs";
import { reasonKey, resultTitleKey, seatLabelKey, turnLabelKey } from "../js/score.mjs";

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
  assert.equal(t("zh", "roundRatio", { n: 3, max: 60 }), "3 / 60");
  assert.equal(t("en", "roundRatio", { n: 3, max: 60 }), "3 / 60");
  assert.equal(t("zh", "resultBest", { rounds: 8, time: "00:42" }), "最佳 8 回合 · 00:42");
  assert.equal(t("en", "missingKey"), "missingKey");
  assert.equal(t("zh", "roundRatio", {}), "{n} / {max}");
  assert.equal(otherLocale("zh"), "en");
  assert.equal(otherLocale("en"), "zh");
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(hasKey("en", "appTitle"), true);
  assert.equal(hasKey("en", "noSuchKey"), false);
});

test("双语：盘面与难度数据键在双表存在", () => {
  for (const board of BOARDS) {
    assert.ok(hasKey("zh", board.nameKey), `zh 缺 ${board.nameKey}`);
    assert.ok(hasKey("en", board.nameKey), `en 缺 ${board.nameKey}`);
    assert.ok(hasKey("zh", board.descKey), `zh 缺 ${board.descKey}`);
    assert.ok(hasKey("en", board.descKey), `en 缺 ${board.descKey}`);
  }
  for (const level of DIFFICULTIES) {
    assert.ok(hasKey("zh", level.nameKey), `zh 缺 ${level.nameKey}`);
    assert.ok(hasKey("en", level.nameKey), `en 缺 ${level.nameKey}`);
  }
});

test("双语：计分模块产出的键全部有双语条目", () => {
  const keys = [
    turnLabelKey("solo", "south", "south"),
    turnLabelKey("solo", "north", "south"),
    turnLabelKey("duel", "south", "south"),
    turnLabelKey("duel", "north", "south"),
    seatLabelKey("solo", "south", "south"),
    seatLabelKey("solo", "north", "south"),
    seatLabelKey("duel", "south", "south"),
    seatLabelKey("duel", "north", "south"),
    resultTitleKey("solo", "south", "south"),
    resultTitleKey("solo", "north", "south"),
    resultTitleKey("solo", "draw", "south"),
    resultTitleKey("duel", "south", "south"),
    resultTitleKey("duel", "north", "south"),
    reasonKey("cleared"),
    reasonKey("limit"),
  ];
  for (const key of keys) {
    assert.ok(hasKey("zh", key), `zh 缺 ${key}`);
    assert.ok(hasKey("en", key), `en 缺 ${key}`);
  }
});
