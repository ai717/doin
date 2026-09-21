// 恶魔迷途 · 多语言层测试
// 重点：中英双表严格对齐、共享 key doin.lang、格式化占位安全、语言探测兜底。

import test from "node:test";
import assert from "node:assert/strict";

import {
  LOCALES,
  LANG_KEY,
  DEFAULT_LOCALE,
  isLocale,
  strings,
  format,
  detectLocale,
  loadLocale,
  saveLocale,
  htmlLang
} from "../js/i18n.mjs";

// ---------------------------------------------------------------- 基本契约

test("支持中英双语，且共享 key 为 doin.lang", () => {
  assert.deepEqual([...LOCALES], ["zh", "en"]);
  assert.equal(LANG_KEY, "doin.lang", "必须使用全站共享语言 key");
  assert.equal(DEFAULT_LOCALE, "zh");
});

test("isLocale 只认可 zh / en，拒绝其他输入", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  for (const bad of ["jp", "ZH", "", null, undefined, 0, {}, []]) {
    assert.equal(isLocale(bad), false, `${JSON.stringify(bad)} 不应被认可`);
  }
});

test("strings 对未知语言回退到默认语言，不返回 undefined", () => {
  for (const bad of ["jp", null, undefined, 123]) {
    const s = strings(bad);
    assert.ok(s && typeof s === "object", `strings(${bad}) 应回退`);
    assert.equal(s.title, strings("zh").title);
  }
});

// ---------------------------------------------------------------- 双表对齐

test("中英双表键集合完全一致（无缺失、无多余）", () => {
  const zh = Object.keys(strings("zh")).sort();
  const en = Object.keys(strings("en")).sort();
  const onlyZh = zh.filter((k) => !en.includes(k));
  const onlyEn = en.filter((k) => !zh.includes(k));
  assert.deepEqual(onlyZh, [], `英文表缺少: ${onlyZh.join(", ")}`);
  assert.deepEqual(onlyEn, [], `中文表缺少: ${onlyEn.join(", ")}`);
  assert.equal(zh.length, en.length);
});

test("双表所有取值均为非空字符串（无漏翻空壳）", () => {
  const empties = [];
  for (const loc of LOCALES) {
    for (const [key, val] of Object.entries(strings(loc))) {
      if (typeof val !== "string" || val.trim() === "") {
        empties.push(`${loc}.${key}`);
      }
    }
  }
  assert.deepEqual(empties, [], `以下条目为空:\n${empties.join("\n")}`);
});

test("双表键数量达到界面需求规模（≥60 键）", () => {
  assert.ok(
    Object.keys(strings("zh")).length >= 60,
    `中文表仅 ${Object.keys(strings("zh")).length} 键，界面文案可能不全`
  );
});

test("关键界面文案在两种语言下都非空（抽查）", () => {
  const required = [
    "title", "tagline", "backHome", "rules", "sound",
    "nodeLabel", "levelLabel", "timeLabel", "bestLabel",
    "deathLabel", "candleLabel", "sealLabel"
  ];
  for (const loc of LOCALES) {
    const s = strings(loc);
    for (const key of required) {
      assert.ok(
        typeof s[key] === "string" && s[key].trim() !== "",
        `${loc}.${key} 缺失或为空`
      );
    }
  }
});

// ---------------------------------------------------------------- 格式化

test("format 正确替换位置占位符", () => {
  assert.equal(format("{0}-{1}", 3, 2), "3-2");
  assert.equal(format("关卡 {0}", 7), "关卡 7");
  assert.equal(format("无占位"), "无占位");
});

test("format 对缺失参数保留原占位符，不输出 undefined", () => {
  assert.equal(format("{0} 和 {1}", "A"), "A 和 {1}");
  assert.doesNotMatch(format("{0}{1}", "x"), /undefined/);
});

test("format 容忍数字 0 作为参数（不被当成缺失）", () => {
  assert.equal(format("第 {0} 关", 0), "第 0 关");
});

test("levelName 模板在双表下都能正确格式化（关卡编号 {0}-{1}）", () => {
  for (const loc of LOCALES) {
    const out = format(strings(loc).levelName, 5, 3);
    assert.ok(out.includes("5") && out.includes("3"), `${loc} 关卡编号格式异常: ${out}`);
    assert.doesNotMatch(out, /\{|\}/, `${loc} 关卡编号残留占位符: ${out}`);
  }
  // levelLabel 只是纯文本标题，也应双语非空
  for (const loc of LOCALES) {
    assert.ok(strings(loc).levelLabel.trim() !== "", `${loc}.levelLabel 为空`);
  }
});

// ---------------------------------------------------------------- 语言持久化

test("saveLocale 只接受合法语言，非法输入返回 false", () => {
  assert.equal(saveLocale("jp"), false);
  assert.equal(saveLocale(null), false);
  assert.equal(saveLocale(undefined), false);
  assert.equal(saveLocale({}), false);
});

test("saveLocale → loadLocale 往返一致（带内存桩模拟浏览器存储）", () => {
  // Node 环境没有 localStorage，这里注入一个最小桩来验证读写契约。
  const map = new Map();
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
  try {
    assert.equal(saveLocale("en"), true);
    assert.equal(loadLocale(), "en");
    assert.equal(map.get(LANG_KEY), "en", "应写入共享 key doin.lang");
    assert.equal(saveLocale("zh"), true);
    assert.equal(loadLocale(), "zh");
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});

test("存储中是被污染的语言值时，loadLocale 回退到探测结果", () => {
  const map = new Map();
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k)
  };
  try {
    map.set(LANG_KEY, "klingon");
    const out = loadLocale();
    assert.ok(LOCALES.includes(out), `污染值下应回退为合法语言，实得 ${out}`);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});

test("localStorage 不可用时 saveLocale 静默返回 false（不抛错）", () => {
  assert.doesNotThrow(() => {
    saveLocale("zh");
    saveLocale("en");
  });
});

test("detectLocale 在无 navigator 环境下安全返回（不抛错）", () => {
  assert.doesNotThrow(() => detectLocale());
  const out = detectLocale();
  assert.ok(LOCALES.includes(out), `探测结果 ${out} 应为合法语言`);
});

test("loadLocale 在无存储环境下也能返回合法语言", () => {
  const out = loadLocale();
  assert.ok(LOCALES.includes(out), `loadLocale 返回 ${out} 应合法`);
});

// ---------------------------------------------------------------- html lang

test("htmlLang 把内部语言映射为正确的 html lang 属性", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  // 未知输入不应输出 undefined
  assert.equal(typeof htmlLang("jp"), "string");
  assert.doesNotMatch(String(htmlLang("jp")), /undefined/);
});
