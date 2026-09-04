import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_LOCALE,
  LANG_KEY,
  LOCALES,
  detectLocale,
  format,
  htmlLang,
  isLocale,
  loadLocale,
  saveLocale,
  strings,
} from "../js/i18n.mjs";

// 极简 localStorage 桩（node 环境无 window）。
function installStorage(initial = new Map()) {
  const store = new Map(initial);
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  return store;
}

test("字符串表：zh/en 键完全对齐，不允许缺翻译", () => {
  const zh = strings("zh");
  const en = strings("en");
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const [key, value] of Object.entries(zh)) {
    assert.ok(String(value).length > 0, `zh.${key} 不能是空串`);
    assert.ok(String(en[key]).length > 0, `en.${key} 不能是空串`);
  }
});

test("strings：非法 locale 回退默认语言", () => {
  assert.equal(strings("fr"), strings(DEFAULT_LOCALE));
  assert.equal(strings(undefined), strings("zh"));
});

test("isLocale / LOCALES：只认 zh 与 en", () => {
  assert.deepEqual([...LOCALES], ["zh", "en"]);
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("jp"), false);
  assert.equal(isLocale(""), false);
});

test("detectLocale：navigator 语言 zh* → 中文，其余 → 英文", () => {
  const original = globalThis.navigator;
  const probe = (languages, language) => {
    Object.defineProperty(globalThis, "navigator", {
      value: { languages, language },
      configurable: true,
    });
    return detectLocale();
  };
  try {
    assert.equal(probe(["zh-CN", "en"], "zh-CN"), "zh");
    assert.equal(probe(["en-US", "zh"], "en-US"), "zh"); // 列表里任何 zh 都算中文用户
    assert.equal(probe(["zh-Hant-TW"], "zh-Hant-TW"), "zh");
    assert.equal(probe(["en-US"], "en-US"), "en");
    assert.equal(probe(["ja-JP"], "ja-JP"), "en");
    assert.equal(probe([], ""), "en");
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
  }
});

test("loadLocale：共享偏好 doin.lang 优先于浏览器语言", () => {
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { languages: ["zh-CN"], language: "zh-CN" },
    configurable: true,
  });
  try {
    installStorage();
    assert.equal(loadLocale(), "zh"); // 无偏好 → 跟浏览器

    installStorage([[LANG_KEY, "en"]]);
    assert.equal(loadLocale(), "en"); // 有偏好 → 用偏好（即使浏览器是中文）

    installStorage([[LANG_KEY, "hack"]]);
    assert.equal(loadLocale(), "zh"); // 非法值 → 忽略，回落浏览器检测
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
  }
});

test("saveLocale：只写合法值；localStorage 抛错时静默返回 false", () => {
  const store = installStorage();
  assert.equal(saveLocale("en"), true);
  assert.equal(store.get(LANG_KEY), "en");
  assert.equal(saveLocale("fr"), false);

  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("quota");
    },
    removeItem: () => {},
  };
  assert.equal(saveLocale("en"), false);
});

test("loadLocale：localStorage 不可访问时不炸，回落浏览器语言", () => {
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    value: { languages: ["en-US"], language: "en-US" },
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    get() {
      throw new Error("security");
    },
    configurable: true,
  });
  try {
    assert.equal(loadLocale(), "en");
  } finally {
    Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
    delete globalThis.localStorage;
  }
});

test("htmlLang：locale → HTML lang 属性值", () => {
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
});

test("format：{0} 占位插值，缺参保留原样", () => {
  assert.equal(format("第 {0} 关", 3), "第 3 关");
  assert.equal(format("开采达成金钱 ${0}（目标配额 ${1}）！", 1200, 1000), "开采达成金钱 $1200（目标配额 $1000）！");
  assert.equal(format("no placeholders"), "no placeholders");
  assert.equal(format("{0} missing"), "{0} missing");
});

test("文案键覆盖 HUD / 弹窗 / 商店全部界面元素", () => {
  const zh = strings("zh");
  const required = [
    "title",
    "backHome",
    "target",
    "money",
    "record",
    "dynamite",
    "level",
    "time",
    "levelValue",
    "dynamiteValue",
    "secondsValue",
    "moneyValue",
    "pauseTitle",
    "resumeBtn",
    "winTitle",
    "winDesc",
    "winBtn",
    "loseTitle",
    "loseDesc",
    "loseBtn",
    "shopTitle",
    "walletLabel",
    "nextLevelTip",
    "itemDynaName",
    "itemPotionName",
    "itemPolishName",
    "buyBtn",
    "boughtBtn",
    "noMoney",
    "startNextLevel",
    "tipClaw",
    "tipBomb",
    "langShort",
  ];
  for (const key of required) {
    assert.ok(typeof zh[key] === "string" && zh[key].length > 0, `缺少文案 ${key}`);
    assert.ok(typeof zh[key] === "string", `${key} 必须是字符串（模板用 format 插值，不存函数）`);
  }
});
