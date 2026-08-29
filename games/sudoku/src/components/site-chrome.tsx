import { Button } from "@/components/ui/button";
import { useGame } from "@/game/store";
import { useLocale, useT } from "@/i18n";
import type { Locale, LocaleSetting } from "@/i18n";
import type { Difficulty } from "@/engine/types";
import { cn } from "@/lib/utils";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Languages, Menu } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export const NAV = [
  { to: "/", key: "nav.play" },
  { to: "/daily", key: "nav.daily" },
  { to: "/stats", key: "nav.stats" },
  { to: "/how-to", key: "nav.howTo" },
  { to: "/settings", key: "nav.settings" },
] as const;

type IndexSearch = { d?: Difficulty; hl?: Locale };

export function SiteFrame({
  children,
  fill,
}: {
  children: ReactNode;
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-lg flex-col px-2 pt-[max(0.35rem,env(safe-area-inset-top))] md:max-w-7xl md:px-8 md:pt-3",
        fill
          ? "h-dvh overflow-x-hidden pb-[max(0.4rem,env(safe-area-inset-bottom))]"
          : "min-h-dvh pb-[max(2rem,env(safe-area-inset-bottom))]",
      )}
    >
      {children}
      {!fill ? <SiteFooter /> : null}
    </div>
  );
}

export function PageHeading({
  title,
  kicker,
}: {
  title: string;
  kicker?: string;
}) {
  return (
    <header className="mb-8">
      {kicker ? (
        <p className="text-xs font-medium tracking-[0.14em] text-fg-muted">{kicker}</p>
      ) : null}
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-fg md:text-4xl">
        {title}
      </h1>
    </header>
  );
}

export function SiteHeader({
  leading,
  trailing,
}: {
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = useT();
  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 border-b border-border md:h-16 md:gap-2">
      <Link
        to="/"
        className="flex min-w-0 shrink-0 items-baseline gap-2.5 rounded-md px-1 py-1 hover:bg-wash"
      >
        <span className="font-display text-xl font-semibold tracking-tight text-fg md:text-2xl">
          {t("brand.name")}
        </span>
        {t("brand.name") !== t("brand.en") && (
          <span className="hidden text-xs tracking-wide text-fg-muted md:inline">
            {t("brand.en")}
          </span>
        )}
      </Link>
      {leading}
      <div className="min-w-0 flex-1" />
      {trailing}
      <nav className="hidden items-center gap-0.5 text-[15px] md:flex">
        {NAV.map((item) => (
          <HeaderLink
            key={item.to}
            to={item.to}
            label={t(item.key)}
            active={isActive(pathname, item.to)}
          />
        ))}
      </nav>
      <LocaleSwitcher />
      <MoreMenu pathname={pathname} />
    </header>
  );
}

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/" || pathname === "/play";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function HeaderLink({
  to,
  label,
  active,
}: {
  to: (typeof NAV)[number]["to"];
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "rounded-md px-3 py-2",
        active ? "bg-wash text-fg" : "text-fg-muted hover:bg-wash hover:text-fg",
      )}
    >
      {label}
    </Link>
  );
}

const LOCALE_SHORT: Record<Locale, string> = {
  "zh-Hans": "简",
  "zh-Hant": "繁",
  en: "EN",
};

const LOCALE_OPTIONS: { value: LocaleSetting; key: "settings.lang.system" | "settings.lang.zh-Hans" | "settings.lang.zh-Hant" | "settings.lang.en" }[] = [
  { value: "system", key: "settings.lang.system" },
  { value: "zh-Hans", key: "settings.lang.zh-Hans" },
  { value: "zh-Hant", key: "settings.lang.zh-Hant" },
  { value: "en", key: "settings.lang.en" },
];

function LocaleSwitcher() {
  const t = useT();
  const resolved = useLocale();
  const setting = useGame((s) => s.settings.locale ?? "system");
  const setSettings = useGame((s) => s.setSettings);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t("settings.language")}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="h-9 gap-1 px-2 text-xs font-medium tracking-wide text-fg-muted"
      >
        <Languages className="size-4" strokeWidth={1.75} />
        <span className="min-w-[1.25rem] text-center tabular-nums">{LOCALE_SHORT[resolved]}</span>
      </Button>
      {open && (
        <ul
          role="listbox"
          aria-label={t("settings.language")}
          className="absolute right-0 top-full z-40 mt-1 min-w-36 overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 shadow-[var(--shadow)]"
        >
          {LOCALE_OPTIONS.map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                role="option"
                aria-selected={setting === opt.value}
                className={cn(
                  "flex h-9 w-full items-center px-3 text-left text-sm",
                  setting === opt.value ? "bg-wash text-fg" : "text-fg hover:bg-wash",
                )}
                onClick={() => {
                  setSettings({ locale: opt.value });
                  setOpen(false);
                  void navigate({
                    to: ".",
                    search: (prev: IndexSearch) => {
                      const next = { ...prev };
                      if (opt.value === "system") {
                        delete (next as { hl?: string }).hl;
                        return next;
                      }
                      return { ...next, hl: opt.value };
                    },
                    replace: true,
                  });
                }}
              >
                {t(opt.key)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SiteFooter() {
  const t = useT();
  const locale = useLocale();
  return (
    <footer className="mt-16 border-t border-border py-6 text-xs leading-relaxed text-fg-muted">
      <p>
        {locale === "en"
          ? "Free online Sudoku. Play instantly, with hints that explain why."
          : locale === "zh-Hant"
            ? "免費線上數獨。打開就能玩，提示會講為什麼。"
            : "免费在线数独。打开就能玩，提示会讲为什么。"}
      </p>
      <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1" aria-label={t("nav.howTo")}>
        <Link to="/how-to" className="hover:text-fg">
          {t("nav.howTo")}
        </Link>
        <Link to="/daily" className="hover:text-fg">
          {t("nav.daily")}
        </Link>
        <Link to="/" className="hover:text-fg">
          {t("nav.play")}
        </Link>
      </nav>
      <p className="mt-3 flex flex-wrap gap-x-3">
        <Link to="." search={(s: IndexSearch) => ({ ...s, hl: "zh-Hans" as const })} className="hover:text-fg">
          简体
        </Link>
        <Link to="." search={(s: IndexSearch) => ({ ...s, hl: "zh-Hant" as const })} className="hover:text-fg">
          繁體
        </Link>
        <Link to="." search={(s: IndexSearch) => ({ ...s, hl: "en" as const })} className="hover:text-fg">
          English
        </Link>
      </p>
    </footer>
  );
}

function MoreMenu({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative md:hidden" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("nav.menu")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Menu />
      </Button>
      {open && (
        <ul className="absolute right-0 top-full z-30 mt-1 min-w-40 overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 shadow-[var(--shadow)]">
          {NAV.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  "flex h-10 items-center px-3 text-sm",
                  isActive(pathname, item.to)
                    ? "bg-wash text-fg"
                    : "text-fg hover:bg-wash",
                )}
                onClick={() => setOpen(false)}
              >
                {t(item.key)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
