import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { STRINGS, t, stageName, getLang, setLang, toggleLang } from "../js/i18n.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const jsDir = resolve(here, "..", "js");

test("中英词典 key 完全对齐", () => {
  const zh = Object.keys(STRINGS.zh).sort();
  const en = Object.keys(STRINGS.en).sort();
  assert.deepEqual(en, zh);
});

test("英文词典零汉字（语言切换按钮白名单除外）", () => {
  for (const [key, value] of Object.entries(STRINGS.en)) {
    if (key === "langBtn") continue;
    assert.ok(!/\u4e00-\u9fa5/.test(String(value)), `${key} 含汉字: ${value}`);
  }
});

test("22 关关卡名与五个段位在中英双表中都存在", () => {
  for (let i = 1; i <= 22; i += 1) {
    const key = `stage${i}`;
    assert.ok(STRINGS.zh[key], `缺 ${key} zh`);
    assert.ok(STRINGS.en[key], `缺 ${key} en`);
    assert.ok(!/\u4e00-\u9fa5/.test(STRINGS.en[key]));
  }
  for (const tier of ["Bronze", "Silver", "Gold", "Platinum", "Diamond"]) {
    assert.ok(STRINGS.zh[`tier${tier}`]);
    assert.ok(STRINGS.en[`tier${tier}`]);
  }
});

test("文案插值与关卡名查询", () => {
  assert.equal(t("stageLabel", "zh", { n: 3 }), "第 3 关");
  assert.equal(t("stageLabel", "en", { n: 3 }), "STAGE 3");
  assert.equal(t("roundLabel", "en", { n: 2 }), "ROUND 2");
  assert.equal(t("missing-key", "zh"), "missing-key");
  assert.equal(stageName(0, "zh"), STRINGS.zh.stage1);
  assert.equal(stageName(21, "en"), STRINGS.en.stage22);
});

test("语言偏好读写与切换（无 localStorage 时回退）", () => {
  const original = getLang();
  const toggled = toggleLang();
  assert.ok(toggled === "zh" || toggled === "en");
  assert.equal(getLang(), toggled);
  setLang(original);
  assert.equal(getLang(), original);
});

test("运行源码零裸写中文（i18n 词典与测试除外）", () => {
  const files = readdirSync(jsDir).filter((name) => name.endsWith(".mjs") && name !== "i18n.mjs");
  const offenders = [];
  for (const name of files) {
    const source = readFileSync(resolve(jsDir, name), "utf8");
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/[^\n]*/gm, "")
      .replace(/\s\/\/[^\n]*/g, "");
    if (/[\u4e00-\u9fa5]/.test(code)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `以下模块裸写中文: ${offenders.join(", ")}`);
});
