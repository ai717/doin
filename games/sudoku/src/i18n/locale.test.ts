import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  LANG_KEY,
  LOCALES,
  detectLocale,
  htmlLang,
  readSharedLocale,
  resolveLocale,
  writeSharedLocale,
} from "./locale.ts";

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installNavigator(language: string, languages: string[] = [language]) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { language, languages },
  });
}

function installStorage(initial = new Map<string, string>()) {
  const store = new Map(initial);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
    },
  });
  return store;
}

afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  else delete (globalThis as { navigator?: unknown }).navigator;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("LANG_KEY constant", () => {
  it("equals doin.lang", () => {
    assert.equal(LANG_KEY, "doin.lang");
    assert.deepEqual([...LOCALES], ["zh-Hans", "zh-Hant", "en"]);
  });
});

describe("readSharedLocale", () => {
  it("parses valid language keys", () => {
    installStorage(new Map([[LANG_KEY, "en"]]));
    assert.equal(readSharedLocale(), "en");

    installStorage(new Map([[LANG_KEY, "zh-Hans"]]));
    assert.equal(readSharedLocale(), "zh-Hans");

    installStorage(new Map([[LANG_KEY, "zh-Hant"]]));
    assert.equal(readSharedLocale(), "zh-Hant");
  });

  it("resolves zh to Hans or Hant based on navigator", () => {
    installNavigator("zh-CN", ["zh-CN"]);
    installStorage(new Map([[LANG_KEY, "zh"]]));
    assert.equal(readSharedLocale(), "zh-Hans");

    installNavigator("zh-TW", ["zh-TW"]);
    assert.equal(readSharedLocale(), "zh-Hant");
  });

  it("returns null on invalid or missing key", () => {
    installStorage(new Map([[LANG_KEY, "klingon"]]));
    assert.equal(readSharedLocale(), null);

    installStorage();
    assert.equal(readSharedLocale(), null);
  });

  it("gracefully catches localStorage errors", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("QuotaExceededError");
      },
    });
    assert.equal(readSharedLocale(), null);
  });
});

describe("writeSharedLocale", () => {
  it("writes unified shared language codes", () => {
    const store = installStorage();
    writeSharedLocale("en");
    assert.equal(store.get(LANG_KEY), "en");

    writeSharedLocale("zh-Hans");
    assert.equal(store.get(LANG_KEY), "zh");

    writeSharedLocale("zh-Hant");
    assert.equal(store.get(LANG_KEY), "zh");

    writeSharedLocale("system");
    assert.equal(store.has(LANG_KEY), false);
  });

  it("gracefully handles localStorage throwing", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    assert.doesNotThrow(() => writeSharedLocale("en"));
  });
});

describe("resolveLocale with doin.lang", () => {
  it("prefers explicit doin.lang over system default", () => {
    installNavigator("zh-CN", ["zh-CN"]);
    installStorage(new Map([[LANG_KEY, "en"]]));
    assert.equal(resolveLocale("system"), "en");

    installNavigator("en-US", ["en-US"]);
    installStorage(new Map([[LANG_KEY, "zh"]]));
    assert.equal(resolveLocale("system"), "zh-Hans");
  });

  it("preserves zh-Hant variant when doin.lang is zh", () => {
    installStorage(new Map([[LANG_KEY, "zh"]]));
    assert.equal(resolveLocale("zh-Hant"), "zh-Hant");
    assert.equal(resolveLocale("zh-Hans"), "zh-Hans");
  });

  it("falls back to detectLocale when no shared preference", () => {
    installStorage();
    installNavigator("en-US", ["en-US"]);
    assert.equal(resolveLocale("system"), "en");
    assert.equal(resolveLocale(undefined), "en");

    installNavigator("zh-CN", ["zh-CN"]);
    assert.equal(resolveLocale("system"), "zh-Hans");
  });
});
