import { useGame } from "@/game/store";
import { translate, type MessageKey } from "./core.ts";
import { resolveLocale } from "./locale.ts";

export type { Locale, LocaleSetting, MessageKey } from "./core";
export { LOCALES, detectLocale, htmlLang, localeTag, resolveLocale } from "./locale";
export {
  t,
  translate,
  setI18nLocale,
  getI18nLocale,
  formatNumber,
  diffLabel,
  techLabel,
  stampLabel,
  unitLabelI18n,
  applyDocumentLocale,
} from "./core";

export function useLocale() {
  const setting = useGame((s) => s.settings.locale ?? "system");
  return resolveLocale(setting);
}

export function useT() {
  const locale = useLocale();
  return (key: MessageKey, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
}