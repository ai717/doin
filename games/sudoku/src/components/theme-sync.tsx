import { useEffect } from "react";
import { useGame } from "@/game/store";
import { applyDocumentLocale } from "@/i18n/core";
import { parseHl } from "@/lib/seo";
import { useRouterState } from "@tanstack/react-router";

export function ThemeSync() {
  const theme = useGame((s) => s.settings.theme);
  const reduce = useGame((s) => s.settings.reduceMotion);
  const locale = useGame((s) => s.settings.locale);
  const hydrate = useGame((s) => s.hydrate);
  const setSettings = useGame((s) => s.setSettings);
  const flushSave = useGame((s) => s.flushSave);
  const pause = useGame((s) => s.pause);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const hl = parseHl((search ?? {}) as unknown as Record<string, unknown>);
    if (hl) setSettings({ locale: hl });
  }, [search, setSettings]);

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale, pathname]);

  useEffect(() => {
    const apply = () => {
      const dark =
        theme === "dark" ||
        (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.classList.toggle("reduce-motion", reduce);
    };
    apply();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme, reduce]);

  useEffect(() => {
    const onHide = () => {
      if (document.hidden) {
        pause();
        flushSave();
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushSave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushSave);
    };
  }, [pause, flushSave]);

  return null;
}