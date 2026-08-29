export const LOCALES = ["zh-Hans", "zh-Hant", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export type LocaleSetting = Locale | "system";

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

export function resolveLocale(setting: LocaleSetting | undefined): Locale {
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