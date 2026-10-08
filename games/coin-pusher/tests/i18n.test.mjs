// i18n.test.mjs — 双语表完备性 / 英文零汉字 / 源码零裸写中文 / 语言偏好读写 / 占位符
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  LOCALES, LANG_KEY, DEFAULT_LOCALE, strings, format, isLocale, detectLocale, loadLocale, saveLocale, htmlLang
} from "../js/i18n.mjs";

const jsDir = join(import.meta.dirname, "..", "js");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const CJK = /[\u4e00-\u9fff]/;

const zh = LOCALES.zh;
const en = LOCALES.en;

describe("i18n: 双语表完备性", () => {
  it("zh / en 键集完全一致", () => {
    const a = Object.keys(zh).sort();
    const b = Object.keys(en).sort();
    const onlyZh = a.filter((k) => !b.includes(k));
    const onlyEn = b.filter((k) => !a.includes(k));
    assert.deepEqual(onlyZh, [], `英文表缺：${onlyZh.join(",")}`);
    assert.deepEqual(onlyEn, [], `中文表缺：${onlyEn.join(",")}`);
  });

  it("没有空值键", () => {
    for (const [key, value] of Object.entries(zh)) {
      assert.equal(typeof value, "string", `zh.${key} 不是字符串`);
      assert.ok(value.length > 0, `zh.${key} 为空`);
    }
    for (const [key, value] of Object.entries(en)) {
      assert.equal(typeof value, "string", `en.${key} 不是字符串`);
      assert.ok(value.length > 0, `en.${key} 为空`);
    }
  });

  it("英文表零汉字（白名单：langBtn 的语言标识）", () => {
    const offenders = Object.entries(en)
      .filter(([key, value]) => key !== "langBtn" && CJK.test(value))
      .map(([key]) => key);
    assert.deepEqual(offenders, [], `英文表混入汉字：${offenders.join(",")}`);
  });

  it("中文表不该出现明显未翻译的英文句子", () => {
    // 只拦「整句英文」这种明显漏翻，不拦 2¹⁸ / ×2 之类的符号
    const offenders = Object.entries(zh)
      .filter(([key]) => !["langBtn", "langName", "soundOn", "soundOff"].includes(key))
      .filter(([, value]) => /\b[a-z]{3,}\s+[a-z]{3,}\s+[a-z]{3,}\b/.test(value) && !/[，。、：；]/.test(value))
      .map(([key]) => key);
    assert.deepEqual(offenders, [], `中文表疑似漏翻：${offenders.join(",")}`);
  });

  it("已删除的章节 / 关卡 / 星级 / 双人相关 key 不得残留", () => {
    const gone = [
      "level", "levels", "chapter", "chapters", "stage", "stars", "star1", "star2", "star3",
      "duel", "duelTurn", "duelP1", "duelP2", "modeCampaign", "modeArcade", "modeDuel",
      "aim", "power", "charge", "coinsLeft", "goal", "nextLevel", "levelClear"
    ];
    for (const key of gone) {
      assert.equal(key in zh, false, `zh 仍残留 ${key}`);
      assert.equal(key in en, false, `en 仍残留 ${key}`);
    }
  });

  it("无尽机台 / 账户 / 投币口 / 沟槽 / 掉落记录相关 key 齐备", () => {
    for (const key of [
      "credits", "creditsUnit", "creditPick", "creditDesc", "start",
      "chuteLabel", "chuteDesc", "gutterLabel", "gutterDesc",
      "dropLog", "dropLogEmpty", "modeEndless", "runStats", "endTitle", "endLine",
      "bestDrops", "runs", "toastTokenSpawn", "toastLostCoin"
    ]) {
      assert.ok(key in zh, `zh 缺 ${key}`);
      assert.ok(key in en, `en 缺 ${key}`);
    }
  });
});

describe("i18n: 占位符", () => {
  it("format 支持任意字母占位符（含 {l} / {i}）", () => {
    assert.equal(format("zh", "creditsUnit", { n: 50 }), "50 枚");
    assert.equal(format("en", "creditsUnit", { n: 50 }), "50");
    assert.equal(format("zh", "runStats", { i: 3, d: 2, l: 1 }), "投入 3 枚 · 落袋 2 枚 · 侧沟丢 1 枚");
    assert.equal(format("en", "runStats", { i: 3, d: 2, l: 1 }), "3 inserted · 2 dropped · 1 lost to gutters");
  });

  it("未知 key 原样返回，缺失占位符填空串而不是 undefined", () => {
    assert.equal(format("zh", "noSuchKey"), "noSuchKey");
    assert.equal(format("zh", "creditsUnit", {}), " 枚");
    assert.equal(format("zh", "creditsUnit"), " 枚");
  });

  it("同一 key 的中英占位符集合一致", () => {
    const names = (s) => new Set([...s.matchAll(/\{([a-zA-Z]+)\}/g)].map((m) => m[1]));
    for (const key of Object.keys(zh)) {
      const a = [...names(zh[key])].sort();
      const b = [...names(en[key])].sort();
      assert.deepEqual(a, b, `${key} 的占位符中英不一致：${a} vs ${b}`);
    }
  });

  it("双语的换行 / 标点长度没有数量级差异（防漏翻整段）", () => {
    for (const key of Object.keys(zh)) {
      const a = zh[key].length;
      const b = en[key].length;
      assert.ok(a > 0 && b > 0);
      assert.ok(b / a < 6 && a / b < 6, `${key} 中英长度差过大：${a} vs ${b}`);
    }
  });
});

describe("i18n: 语言偏好读写（全站共享 doin.lang）", () => {
  it("键名与默认语言固定", () => {
    assert.equal(LANG_KEY, "doin.lang");
    assert.equal(DEFAULT_LOCALE, "zh");
  });

  it("isLocale 只认 zh / en", () => {
    assert.equal(isLocale("zh"), true);
    assert.equal(isLocale("en"), true);
    for (const bad of ["zh-CN", "EN", "", null, undefined, 0, {}]) assert.equal(isLocale(bad), false);
  });

  it("saveLocale / loadLocale 往返，非法值不写坏偏好", () => {
    const map = new Map();
    const prev = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k)
    };
    try {
      saveLocale("en");
      assert.equal(map.get(LANG_KEY), "en");
      assert.equal(loadLocale(), "en");
      assert.equal(htmlLang(), "en");
      saveLocale("zh");
      assert.equal(loadLocale(), "zh");
      assert.equal(htmlLang(), "zh-CN");
      saveLocale("fr");
      assert.equal(loadLocale(), "zh", "非法语言不得写入");
      // 存储不可用时不抛错
      globalThis.localStorage = { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); }, removeItem() { throw new Error("x"); } };
      assert.doesNotThrow(() => saveLocale("en"));
      assert.doesNotThrow(() => loadLocale());
    } finally {
      globalThis.localStorage = prev;
    }
  });

  it("detectLocale 无存储时按 navigator.language 回退", () => {
    const prevLs = globalThis.localStorage;
    delete globalThis.localStorage;
    const setNav = (value) => Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
    try {
      setNav({ language: "en-US" });
      assert.equal(detectLocale(), "en");
      setNav({ language: "zh-CN" });
      assert.equal(detectLocale(), "zh");
      setNav({});
      assert.equal(detectLocale(), DEFAULT_LOCALE);
    } finally {
      globalThis.localStorage = prevLs;
      setNav({ language: "en-US", userAgent: "node" });
    }
  });

  it("strings() 对非法语言回落到默认表", () => {
    assert.equal(strings("fr"), zh);
    assert.equal(strings(undefined), zh);
    assert.equal(strings("en"), en);
  });
});

describe("i18n: 源码零裸写中文", () => {
  const files = readdirSync(jsDir).filter((f) => f.endsWith(".mjs") && f !== "i18n.mjs");

  it("除 i18n.mjs 外，任何 js 模块都不得裸写中文字符串", () => {
    const offenders = [];
    for (const file of files) {
      const code = stripComments(readFileSync(join(jsDir, file), "utf8"));
      const hit = code.match(/[\u4e00-\u9fff]+/g);
      if (hit) offenders.push(`${file}: ${hit.slice(0, 3).join("/")}`);
    }
    assert.deepEqual(offenders, [], `裸写中文：${offenders.join(" | ")}`);
  });

  it("index.html 的中文静态文本都有 data-i18n 或 data-i18n-aria 接管", () => {
    const html = readFileSync(join(import.meta.dirname, "..", "index.html"), "utf8");
    // 去掉注释与 script 块后，逐行找出带中文的文本行
    const body = html
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<script[\s\S]*?<\/script>/g, "");
    const lines = body.split("\n").filter((l) => CJK.test(l));
    const offenders = lines.filter((l) => {
      // 属性值里带 data-i18n 的整行放行
      if (/data-i18n(-aria)?="/.test(l)) return false;
      // <title> 在运行时由 i18n 覆写；<meta name="description"> 是站点 SEO 元信息，
      // 面向中文门户固定中文，两者都不属于界面文本
      if (/^\s*<title>/.test(l)) return false;
      if (/^\s*<meta\s+name="description"/.test(l)) return false;
      return true;
    }).map((l) => l.trim().slice(0, 60));
    assert.deepEqual(offenders, [], `HTML 中文未走 i18n：\n${offenders.join("\n")}`);
  });
});
