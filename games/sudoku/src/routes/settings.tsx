import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useGame } from "@/game/store";
import { useT } from "@/i18n";
import type { LocaleSetting } from "@/i18n";
import { cn } from "@/lib/utils";
import { parseHl, routeHead } from "@/lib/seo";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/settings")({
  validateSearch: (s: Record<string, unknown>) => {
    const hl = parseHl(s);
    return hl ? { hl } : {};
  },
  head: ({ match }) => routeHead("settings", match.search.hl),
  component: SettingsPage,
});

function SettingsPage() {
  const hydrate = useGame((s) => s.hydrate);
  const settings = useGame((s) => s.settings);
  const setSettings = useGame((s) => s.setSettings);
  const storageOk = useGame((s) => s.storageOk);
  const clearAllData = useGame((s) => s.clearAllData);
  const navigate = useNavigate();
  const [confirmClear, setConfirmClear] = useState(false);
  const t = useT();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <AppShell>
      <PageHeading kicker={t("brand.name")} title={t("settings.title")} />
      <p className="mb-8 text-sm text-fg-muted">{t("settings.lead")}</p>

      {!storageOk && (
        <p className="mb-8 rounded-md border border-border bg-wash px-3 py-2 text-sm text-fg-muted">
          {t("settings.noStorage")}
        </p>
      )}

      <section>
        <h2 className="text-xs font-medium tracking-wide text-fg-muted">
          {t("settings.language")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-border bg-bg-elevated p-1 sm:grid-cols-4">
          {(
            [
              ["system", "settings.lang.system"],
              ["zh-Hans", "settings.lang.zh-Hans"],
              ["zh-Hant", "settings.lang.zh-Hant"],
              ["en", "settings.lang.en"],
            ] as const
          ).map(([value, key]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSettings({ locale: value as LocaleSetting })}
              className={cn(
                "h-9 rounded-sm px-2 text-xs font-medium",
                (settings.locale ?? "system") === value
                  ? "bg-wash text-fg"
                  : "text-fg-muted",
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-medium tracking-wide text-fg-muted">
          {t("settings.appearance")}
        </h2>
        <Segmented
          value={settings.theme}
          onChange={(theme) => setSettings({ theme })}
          options={[
            { value: "system", label: t("settings.theme.system") },
            { value: "light", label: t("settings.theme.light") },
            { value: "dark", label: t("settings.theme.dark") },
          ]}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-medium tracking-wide text-fg-muted">
          {t("settings.input")}
        </h2>
        <Segmented
          value={settings.inputMode}
          onChange={(inputMode) => setSettings({ inputMode })}
          options={[
            { value: "auto", label: t("settings.input.auto") },
            { value: "cell", label: t("settings.input.cell") },
            { value: "digit", label: t("settings.input.digit") },
          ]}
        />
      </section>

      <section className="mt-8 divide-y divide-border rounded-lg border border-border bg-bg-elevated">
        <Toggle
          label={t("settings.autoCheck")}
          checked={settings.autoCheck}
          onChange={(autoCheck) => setSettings({ autoCheck })}
        />
        <Toggle
          label={t("settings.highlightSame")}
          checked={settings.highlightSame}
          onChange={(highlightSame) => setSettings({ highlightSame })}
        />
        <Toggle
          label={t("settings.autoNotes")}
          checked={settings.autoNotes}
          onChange={(autoNotes) => setSettings({ autoNotes })}
        />
        <Toggle
          label={t("settings.showTimer")}
          checked={settings.showTimer}
          onChange={(showTimer) => setSettings({ showTimer })}
        />
        <Toggle
          label={t("settings.reduceMotion")}
          checked={settings.reduceMotion}
          onChange={(reduceMotion) => setSettings({ reduceMotion })}
        />
        <Toggle
          label={t("settings.sound")}
          checked={settings.sound}
          onChange={(sound) => setSettings({ sound })}
        />
        <Toggle
          label={t("settings.cheers")}
          checked={settings.cheers}
          onChange={(cheers) => setSettings({ cheers })}
        />
      </section>

      <div className="mt-10">
        <Button variant="outline" className="w-full" onClick={() => setConfirmClear(true)}>
          {t("settings.clear")}
        </Button>
      </div>

      {confirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/40 px-6">
          <div className="w-full max-w-sm rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow)]">
            <h2 className="font-display text-xl">{t("settings.clear")}</h2>
            <p className="mt-2 text-sm text-fg-muted">{t("settings.clearBody")}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmClear(false)}>
                {t("settings.clearCancel")}
              </Button>
              <Button
                onClick={() => {
                  clearAllData();
                  setConfirmClear(false);
                  void navigate({ to: "/" });
                }}
              >
                {t("settings.clearOk")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1 rounded-md border border-border bg-bg-elevated p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 rounded-sm text-xs font-medium",
            value === o.value ? "bg-wash text-fg" : "text-fg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}



