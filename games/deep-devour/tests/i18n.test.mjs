// i18n：双语表对齐、全站共享语言偏好（localStorage["doin.lang"]）的优先级、插值。
// 双语表是「严格对齐非空」的硬约束（AGENTS.md §5.1）：少一个 key 就会在切语言时
// 直接把英文界面某个格子留空，所以这里对每一个 key 都做非空断言。

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  DEFAULT_LOCALE,
  LANG_KEY,
  LOCALES,
  detectLocale,
  format,
  htmlLang,
  isLocale,
  loadLocale,
  pickLocalized,
  saveLocale,
  strings,
} from "../js/i18n.mjs";

const ARRAY_KEYS = ["tierNames", "helpItems"];

function withNavigator(fake, fn) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: fake, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    Object.defineProperty(globalThis, "navigator", descriptor);
  }
}

function withStore(store, fn) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { value: store, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
}

afterEach(() => {
  delete globalThis.localStorage;
});

describe("语言契约", () => {
  it("共享 key 与语言集合是写死的", () => {
    assert.equal(LANG_KEY, "doin.lang");
    assert.deepEqual(LOCALES, ["zh", "en"]);
    assert.equal(DEFAULT_LOCALE, "zh");
  });

  it("isLocale 只认表内语言", () => {
    assert.equal(isLocale("zh"), true);
    assert.equal(isLocale("en"), true);
    assert.equal(isLocale("zh-CN"), false, "全站偏好只存 zh / en 两个短码");
    assert.equal(isLocale("fr"), false);
    assert.equal(isLocale(""), false);
    assert.equal(isLocale(null), false);
    assert.equal(isLocale(42), false);
  });

  it("strings 对未知输入退回默认语言表", () => {
    assert.equal(strings("fr"), strings(DEFAULT_LOCALE));
    assert.equal(strings(null), strings(DEFAULT_LOCALE));
    assert.equal(strings(undefined), strings(DEFAULT_LOCALE));
  });

  it("htmlLang 给出 BCP-47 标签", () => {
    assert.equal(htmlLang("zh"), "zh-CN");
    assert.equal(htmlLang("en"), "en");
    assert.equal(htmlLang("xx"), "en");
  });
});

describe("双语表对齐", () => {
  const zh = strings("zh");
  const en = strings("en");

  it("两张表的 key 集合完全一致", () => {
    assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  });

  it("每一个 key 都是非空的字符串或字符串数组", () => {
    const keys = Object.keys(zh);
    assert.ok(keys.length > 60, `字符串条目太少（${keys.length}），可能漏了整块文案`);
    for (const key of keys) {
      for (const dict of [zh, en]) {
        const value = dict[key];
        if (ARRAY_KEYS.includes(key)) {
          assert.ok(Array.isArray(value), `${key} 应该是数组`);
          assert.ok(value.length > 0, `${key} 不该是空数组`);
          for (const line of value) {
            assert.equal(typeof line, "string", `${key} 的元素必须是字符串`);
            assert.ok(line.trim().length > 0, `${key} 里有空行`);
          }
        } else {
          assert.equal(typeof value, "string", `${key} 必须是字符串`);
          assert.ok(value.trim().length > 0, `${key} 不能为空`);
        }
      }
      if (ARRAY_KEYS.includes(key)) {
        assert.equal(zh[key].length, en[key].length, `${key} 两侧条数必须一致`);
      }
    }
  });

  it("体型名与玩法说明逐条对齐（切语言不会串行）", () => {
    assert.equal(zh.tierNames.length, 7, "7 阶体型各有一个名字");
    assert.equal(zh.tierNames.length, en.tierNames.length);
    assert.equal(zh.helpItems.length, en.helpItems.length);
    assert.ok(zh.helpItems.length >= 10, "玩法说明要覆盖到后期海域的机制");
  });

  it("插值占位符两侧一致，否则切语言会出现空槽", () => {
    const placeholder = /\{(\d+)\}/g;
    for (const key of Object.keys(zh)) {
      if (ARRAY_KEYS.includes(key)) continue;
      const zhSlots = [...zh[key].matchAll(placeholder)].map((m) => m[1]).sort();
      const enSlots = [...en[key].matchAll(placeholder)].map((m) => m[1]).sort();
      assert.deepEqual(zhSlots, enSlots, `${key} 的占位符不一致`);
    }
  });

  it("语言切换按钮是跨语言文案，两边必须不同", () => {
    assert.notEqual(zh.langLabel, en.langLabel);
    assert.notEqual(zh.langSwitch, en.langSwitch);
  });

  it("玩法说明覆盖到后期四片海域逐步解锁的机制", () => {
    const joined = zh.helpItems.join("\n");
    const topics = [
      ["狂暴连锁", /狂暴/],
      ["鱼群同行", /鱼群|随行鱼/],
      ["深渊压强", /压强/],
      ["咬尾降阶", /尾巴|咬尾/],
    ];
    for (const [label, pattern] of topics) {
      assert.ok(pattern.test(joined), `玩法说明缺少「${label}」`);
    }
  });
});

describe("detectLocale：浏览器语言 → locale", () => {
  it("任何 zh* 标签都判为中文", () => {
    assert.equal(withNavigator({ languages: ["zh-CN", "zh"], language: "zh-CN" }, detectLocale), "zh");
    assert.equal(withNavigator({ languages: [], language: "zh-TW" }, detectLocale), "zh");
    assert.equal(withNavigator({ languages: ["ZH-hans"], language: "ZH-hans" }, detectLocale), "zh", "大小写不敏感");
  });

  it("非中文一律英文（含无 navigator 的极端情况）", () => {
    assert.equal(withNavigator({ languages: ["en-US"], language: "en-US" }, detectLocale), "en");
    assert.equal(withNavigator({ languages: ["ja"], language: "ja" }, detectLocale), "en");
    assert.equal(withNavigator({}, detectLocale), "en");
    assert.equal(withNavigator({ languages: [null, 42], language: "" }, detectLocale), "en");
  });
});

describe("全站共享偏好读写", () => {
  it("存过的合法偏好优先于浏览器语言", () => {
    withStore({ getItem: (k) => (k === LANG_KEY ? "en" : null), setItem() {} }, () => {
      assert.equal(withNavigator({ languages: ["zh-CN"], language: "zh-CN" }, loadLocale), "en");
    });
  });

  it("偏好被手改坏时退回浏览器语言，不会白屏", () => {
    for (const junk of ["fr", "", "zh-CN", "  ", null]) {
      withStore({ getItem: () => junk, setItem() {} }, () => {
        assert.equal(withNavigator({ languages: ["zh-CN"], language: "zh-CN" }, loadLocale), "zh");
        assert.equal(withNavigator({ languages: ["en-US"], language: "en-US" }, loadLocale), "en");
      });
    }
  });

  it("localStorage 被禁用时 loadLocale 仍给出答案", () => {
    withStore(
      {
        getItem() {
          throw new Error("SecurityError");
        },
        setItem() {
          throw new Error("SecurityError");
        },
      },
      () => {
        assert.equal(withNavigator({ languages: ["en-US"], language: "en-US" }, loadLocale), "en");
      },
    );
  });

  it("saveLocale 只接受合法语言，成功返回 true 并写到共享 key", () => {
    const written = [];
    withStore(
      {
        getItem: () => null,
        setItem: (key, value) => written.push([key, value]),
      },
      () => {
        assert.equal(saveLocale("en"), true);
        assert.equal(saveLocale("zh"), true);
        assert.deepEqual(written, [
          [LANG_KEY, "en"],
          [LANG_KEY, "zh"],
        ]);
        assert.equal(saveLocale("fr"), false);
        assert.equal(saveLocale(null), false);
        assert.equal(written.length, 2, "非法语言不该落盘");
      },
    );
  });

  it("写盘失败时 saveLocale 返回 false 而不抛错", () => {
    withStore(
      {
        getItem: () => null,
        setItem() {
          throw new Error("QuotaExceededError");
        },
      },
      () => {
        assert.equal(saveLocale("en"), false);
      },
    );
  });
});

describe("format 插值", () => {
  it("按位置替换 {0} / {1}", () => {
    assert.equal(format("第 {0} 阶", 3), "第 3 阶");
    assert.equal(format("{0} / {1}", 12, 34), "12 / 34");
    assert.equal(format("咬中尾巴！({0} / {1})", 2, 3), "咬中尾巴！(2 / 3)");
  });

  it("同一个占位符出现多次全部替换", () => {
    assert.equal(format("{0}-{0}", 7), "7-7");
  });

  it("缺参数时保留占位符原样，绝不显示 undefined", () => {
    assert.equal(format("成长到第 {0} 阶"), "成长到第 {0} 阶");
    assert.equal(format("{0} / {1}", 5), "5 / {1}");
  });

  it("参数本身是 0 / 空串也照样插进去", () => {
    assert.equal(format("{0}", 0), "0");
    assert.equal(format("{0}", ""), "");
    assert.equal(format("{0}", null), "null");
  });

  it("没有占位符或非字符串输入按原样处理", () => {
    assert.equal(format("静默"), "静默");
    assert.equal(format(123), "123");
    assert.equal(format(null), "null");
    assert.equal(format(undefined), "undefined");
  });
});

describe("关卡与海域的双语字段", () => {
  it("pickLocalized 优先当前语言，缺了退回中文，再缺用兜底", () => {
    const entry = { zh: "珊瑚浅滩", en: "Coral Shallows" };
    assert.equal(pickLocalized(entry, "zh"), "珊瑚浅滩");
    assert.equal(pickLocalized(entry, "en"), "Coral Shallows");
    assert.equal(pickLocalized({ zh: "只有中文" }, "en"), "只有中文", "中文是兜底语言");
    assert.equal(pickLocalized({ en: "only english" }, "zh"), "", "兜底语言也缺 → 空串，绝不显示 undefined");
    assert.equal(pickLocalized({ en: "only english" }, "zh", "兜底"), "兜底");
    assert.equal(pickLocalized(null, "zh", "兜底"), "兜底");
    assert.equal(pickLocalized({}, "en", "兜底"), "兜底");
    assert.equal(pickLocalized({}, "zh"), "");
  });
});
