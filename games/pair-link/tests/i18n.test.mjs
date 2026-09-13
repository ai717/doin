// 语言层单测：中英键完全对齐 / 无空值 / 语言探测 / format 替换 / 非法语言回退。
import test from "node:test";
import assert from "node:assert/strict";

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
  t,
  table
} from "../js/i18n.mjs";

function withGlobals(overrides, fn) {
  const saved = new Map();
  const names = Object.keys(overrides);
  names.forEach((name) => {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      value: overrides[name],
      configurable: true,
      writable: true
    });
  });
  try {
    return fn();
  } finally {
    names.forEach((name) => {
      const descriptor = saved.get(name);
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    });
  }
}

function fakeStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    dump: () => Object.fromEntries(map)
  };
}

/* ------------------------------------------------------------ 契约 */

test("i18n 契约：LOCALES / LANG_KEY / DEFAULT_LOCALE 符合全站约定", () => {
  assert.deepEqual(LOCALES, ["zh", "en"]);
  assert.equal(LANG_KEY, "doin.lang");
  assert.ok(LOCALES.includes(DEFAULT_LOCALE));
});

test("中英文键值对 100% 对齐，且没有空字符串或 undefined", () => {
  const zhKeys = Object.keys(strings.zh).sort();
  const enKeys = Object.keys(strings.en).sort();
  assert.deepEqual(zhKeys, enKeys, "中英键集合必须完全相等");
  assert.ok(zhKeys.length >= 40, "文案表规模异常");

  zhKeys.forEach((key) => {
    const zh = strings.zh[key];
    const en = strings.en[key];
    assert.equal(typeof zh, "string", "zh." + key + " 必须是字符串");
    assert.equal(typeof en, "string", "en." + key + " 必须是字符串");
    assert.ok(zh.trim().length > 0, "zh." + key + " 不得为空");
    assert.ok(en.trim().length > 0, "en." + key + " 不得为空");
    assert.notEqual(zh, undefined);
    assert.notEqual(en, undefined);
  });
});

test("占位符对齐：同一键在两种语言里使用的变量集合一致", () => {
  const varsOf = (value) => {
    const found = new Set();
    String(value).replace(/\{(\w+)\}/g, (_, key) => {
      found.add(key);
      return "";
    });
    return [...found].sort();
  };
  Object.keys(strings.zh).forEach((key) => {
    assert.deepEqual(
      varsOf(strings.zh[key]),
      varsOf(strings.en[key]),
      "键 " + key + " 的占位符在中英两表中必须一致"
    );
  });
});

/* ------------------------------------------------------------ 探测 */

test("isLocale / htmlLang：非法语言一律回退", () => {
  assert.equal(isLocale("zh"), true);
  assert.equal(isLocale("en"), true);
  assert.equal(isLocale("fr"), false);
  assert.equal(isLocale(""), false);
  assert.equal(isLocale(null), false);
  assert.equal(isLocale(undefined), false);
  assert.equal(isLocale(123), false);
  assert.equal(htmlLang("zh"), "zh-CN");
  assert.equal(htmlLang("en"), "en");
  assert.equal(htmlLang("fr"), "en", "非法语言回退默认（非中文即英文）");
  assert.equal(htmlLang(null), "en");
});

test("detectLocale：已保存偏好优先于浏览器语言", () => {
  withGlobals(
    {
      window: { localStorage: fakeStorage({ [LANG_KEY]: "en" }) },
      navigator: { language: "zh-CN" }
    },
    () => {
      assert.equal(detectLocale(), "en");
      assert.equal(loadLocale(), "en");
    }
  );

  withGlobals(
    {
      window: { localStorage: fakeStorage({ [LANG_KEY]: "zh" }) },
      navigator: { language: "en-US" }
    },
    () => {
      assert.equal(detectLocale(), "zh");
    }
  );

  withGlobals(
    {
      window: { localStorage: fakeStorage({ [LANG_KEY]: "klingon" }) },
      navigator: { language: "zh-Hant" }
    },
    () => {
      assert.equal(detectLocale(), "zh", "非法保存值应忽略并回退到浏览器语言");
    }
  );
});

test("detectLocale：zh* 使用中文，其余语言回退英文", () => {
  const cases = [
    ["zh", "zh"],
    ["zh-CN", "zh"],
    ["zh-TW", "zh"],
    ["ZH-hans", "zh"],
    ["en", "en"],
    ["en-US", "en"],
    ["fr-FR", "en"],
    ["ja", "en"]
  ];
  cases.forEach(([language, expected]) => {
    withGlobals({ window: { localStorage: fakeStorage({}) }, navigator: { language: language } }, () => {
      assert.equal(detectLocale(), expected, "语言 " + language + " 应判定为 " + expected);
    });
  });
});

test("detectLocale：storage 与 navigator 均不可用时回退 DEFAULT_LOCALE", () => {
  withGlobals({ window: undefined, navigator: undefined }, () => {
    assert.equal(detectLocale(), DEFAULT_LOCALE);
  });

  withGlobals(
    {
      window: {
        get localStorage() {
          throw new Error("blocked");
        }
      },
      navigator: undefined
    },
    () => {
      assert.equal(detectLocale(), DEFAULT_LOCALE, "storage 抛错必须静默降级");
    }
  );
});

test("saveLocale：合法值写入 doin.lang；非法值不写入且不抛错", () => {
  const storage = fakeStorage({});
  withGlobals({ window: { localStorage: storage } }, () => {
    saveLocale("en");
    assert.equal(storage.dump()[LANG_KEY], "en");
    saveLocale("fr");
    assert.equal(storage.dump()[LANG_KEY], "en", "非法语言不得覆盖已保存值");
    saveLocale(null);
    assert.equal(storage.dump()[LANG_KEY], "en");
  });

  withGlobals(
    {
      window: {
        localStorage: {
          getItem: () => null,
          setItem: () => {
            throw new Error("QuotaExceededError");
          }
        }
      }
    },
    () => {
      assert.doesNotThrow(() => saveLocale("zh"));
    }
  );
});

/* ------------------------------------------------------------ 取词与格式化 */

test("table / t：非法语言回退默认语言，未知键回退键名", () => {
  assert.equal(table("zh"), strings.zh);
  assert.equal(table("en"), strings.en);
  assert.equal(table("fr"), strings[DEFAULT_LOCALE]);
  assert.equal(t("en", "appTitle"), strings.en.appTitle);
  assert.equal(t("zh", "appTitle"), strings.zh.appTitle);
  assert.equal(t("fr", "appTitle"), strings[DEFAULT_LOCALE].appTitle, "非法语言走默认表");
  assert.equal(t("en", "definitelyMissingKey"), "definitelyMissingKey");
});

test("format：变量替换、缺变量保留占位符、多余变量忽略", () => {
  assert.equal(format("Level {n}", { n: 3 }), "Level 3");
  assert.equal(format("{a} + {b}", { a: 1 }), "1 + {b}", "缺变量必须保留原占位符");
  assert.equal(format("{a}", { a: 1, b: 2 }), "1", "多余变量必须忽略");
  assert.equal(format("{n}{n}", { n: "x" }), "xx");
  assert.equal(format("no placeholder", { n: 1 }), "no placeholder");
  assert.equal(format("", { n: 1 }), "");
  assert.equal(format(null, { n: 1 }), "");
  assert.equal(format(undefined), "");
  assert.equal(format("plain"), "plain");
  assert.equal(format("{n}", { n: null }), "null", "null 会被字符串化，不得抛错");
});

test("format 与真实文案组合：棋盘无障碍标签可正确生成", () => {
  const zh = format(t("zh", "cellTile"), { r: 3, c: 5, name: "圆环" });
  assert.ok(zh.includes("3") && zh.includes("5") && zh.includes("圆环"));
  const en = format(t("en", "cellTile"), { r: 3, c: 5, name: "Ring" });
  assert.ok(en.includes("3") && en.includes("5") && en.includes("Ring"));
  const board = format(t("zh", "boardAria"), { rows: 8, cols: 10 });
  assert.ok(board.includes("8") && board.includes("10"));
});
