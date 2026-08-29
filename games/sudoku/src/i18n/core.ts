import { MESSAGES, type MessageKey } from "./messages.ts";
import { htmlLang, localeTag, resolveLocale, type Locale, type LocaleSetting } from "./locale.ts";
import { seoTitle } from "../lib/seo.ts";
import type { Difficulty, TechniqueId, UnitKind } from "../engine/types.ts";

export type { Locale, LocaleSetting, MessageKey };

let current: Locale = "zh-Hans";

export function setI18nLocale(locale: Locale) {
  current = locale;
}

export function getI18nLocale(): Locale {
  return current;
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] == null ? `{${k}}` : String(vars[k]),
  );
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const table = MESSAGES[locale] ?? MESSAGES["zh-Hans"];
  return interpolate(table[key] ?? MESSAGES["zh-Hans"][key], vars);
}

export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(current, key, vars);
}

export function formatNumber(n: number, locale?: Locale): string {
  return n.toLocaleString(localeTag(locale ?? current));
}

export function diffLabel(d: Difficulty): string {
  return t(`diff.${d}`);
}

export function techLabel(id: TechniqueId): string {
  return t(`tech.${id}`);
}

export function stampLabel(id: string, part: "name" | "hint"): string {
  return t(`stamp.${id}.${part}` as MessageKey);
}

export function unitLabelI18n(kind: UnitKind, index: number): string {
  if (kind === "row") return t("unit.row", { n: index + 1 });
  if (kind === "col") return t("unit.col", { n: index + 1 });
  return t(`unit.box.${index}` as MessageKey);
}

export function applyDocumentLocale(setting: LocaleSetting | undefined) {
  const locale = resolveLocale(setting);
  setI18nLocale(locale);
  if (typeof document === "undefined") return locale;
  document.documentElement.lang = htmlLang(locale);
  document.documentElement.dataset.locale = locale;
  document.title = seoTitle(window.location.pathname, locale);
  return locale;
}