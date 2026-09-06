export const LOCALES = ["zh-Hans", "zh-Hant", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type LocaleSetting = Locale | "system";
export const LANG_KEY = "doin.lang";

function detectChineseVariant(): "zh-Hans" | "zh-Hant" {
  if (typeof navigator === "undefined") return "zh-Hans";
  const list =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  for (const raw of list) {
    const l = (raw || "").toLowerCase();
    if (
      l.startsWith("zh-tw") ||
      l.startsWith("zh-hk") ||
      l.startsWith("zh-mo") ||
      l.includes("hant")
    ) {
      return "zh-Hant";
    }
  }
  return "zh-Hans";
}

export function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "zh-Hans";
  const list =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  for (const raw of list) {
    const l = (raw || "").toLowerCase();
    if (
      l.startsWith("zh-tw") ||
      l.startsWith("zh-hk") ||
      l.startsWith("zh-mo") ||
      l.includes("hant")
    ) {
      return "zh-Hant";
    }
    if (l.startsWith("zh")) return "zh-Hans";
    if (l.startsWith("en")) return "en";
  }
  return "zh-Hans";
}

export function readSharedLocale(): Locale | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(LANG_KEY);
    if (!raw) return null;
    const l = raw.toLowerCase();
    if (l === "en") return "en";
    if (l === "zh-hant") return "zh-Hant";
    if (l === "zh-hans") return "zh-Hans";
    if (l.startsWith("zh")) {
      return detectChineseVariant();
    }
    return null;
  } catch {
    return null;
  }
}

export function writeSharedLocale(setting: LocaleSetting): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (setting === "system") {
      localStorage.removeItem(LANG_KEY);
    } else if (setting === "en") {
      localStorage.setItem(LANG_KEY, "en");
    } else if (setting === "zh-Hans" || setting === "zh-Hant") {
      localStorage.setItem(LANG_KEY, "zh");
    }
  } catch {
    // ignore quota/privacy mode errors
  }
}

export function resolveLocale(setting: LocaleSetting | undefined): Locale {
  const shared = readSharedLocale();
  if (shared) {
    if (shared === "en") return "en";
    if (setting === "zh-Hant") return "zh-Hant";
    if (setting === "zh-Hans") return "zh-Hans";
    return shared;
  }
  if (setting && setting !== "system") return setting;
  return detectLocale();
}

export function htmlLang(locale: Locale): string {
  if (locale === "zh-Hant") return "zh-TW";
  if (locale === "en") return "en";
  return "zh-CN";
}

export function localeTag(locale: Locale): string {
  return htmlLang(locale);
}