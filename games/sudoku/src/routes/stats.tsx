import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/site-chrome";
import { StampIcon } from "@/components/stamp-icon";
import { DIFFICULTIES } from "@/engine/types";
import { STAMPS } from "@/game/score";
import { useGame } from "@/game/store";
import { formatNumber, stampLabel, useT } from "@/i18n";
import { cn, formatTime, todayId } from "@/lib/utils";
import { parseHl, routeHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";

export const Route = createFileRoute("/stats")({
  validateSearch: (s: Record<string, unknown>) => {
    const hl = parseHl(s);
    return hl ? { hl } : {};
  },
  head: ({ match }) => routeHead("stats", match.search.hl),
  component: StatsPage,
});

function StatsPage() {
  const hydrate = useGame((s) => s.hydrate);
  const stats = useGame((s) => s.stats);
  const t = useT();
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const total = DIFFICULTIES.reduce((n, d) => n + stats.byDifficulty[d].completed, 0);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const startWeekday = new Date(year, month, 1).getDay();
  const cells = useMemo(() => {
    const pad = (startWeekday + 6) % 7;
    return Array.from({ length: pad + days }, (_, i) => {
      if (i < pad) return null;
      const day = i - pad + 1;
      const id = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { day, id, done: Boolean(stats.dailyHistory[id]) };
    });
  }, [stats.dailyHistory, year, month, days, startWeekday]);
  const unlocked = STAMPS.filter((s) => stats.stamps?.[s.id]).length;

  return (
    <AppShell>
      <PageHeading kicker={t("brand.name")} title={t("stats.title")} />
      {total === 0 && (
        <p className="mt-2 text-sm text-fg-muted">
          {t("stats.empty")}
          <Link to="/" search={{ d: "easy" }} className="ml-2 text-fg underline-offset-2 hover:underline">
            {t("stats.startEasy")}
          </Link>
        </p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("stats.total")} value={formatNumber(stats.ink ?? 0)} />
        <Stat label={t("stats.best")} value={formatNumber(stats.bestScore ?? 0)} />
        <Stat label={t("stats.streak")} value={String(stats.streak)} />
        <Stat label={t("stats.done")} value={String(total)} />
      </div>
      <div className="mt-8 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-wash text-left text-fg-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t("stats.diff")}</th>
              <th className="px-3 py-2 font-medium">{t("stats.games")}</th>
              <th className="px-3 py-2 font-medium">{t("stats.bestTime")}</th>
              <th className="px-3 py-2 font-medium">{t("stats.avg")}</th>
              <th className="px-3 py-2 font-medium">{t("stats.noHint")}</th>
            </tr>
          </thead>
          <tbody>
            {DIFFICULTIES.map((d) => {
              const row = stats.byDifficulty[d];
              return (
                <tr key={d} className="border-t border-border">
                  <td className="px-3 py-2">{t(`diff.${d}`)}</td>
                  <td className="px-3 py-2 tabular-nums">{row.completed}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.bestMs != null ? formatTime(row.bestMs) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.completed > 0
                      ? formatTime(row.totalMs / row.completed)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.noHintCompleted}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-sm font-medium text-fg-muted">
        {t("stats.stamps", { n: unlocked, total: STAMPS.length })}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STAMPS.map((s) => {
          const got = Boolean(stats.stamps?.[s.id]);
          return (
            <div
              key={s.id}
              className={cn(
                "flex flex-col gap-2 rounded-md border px-3 py-3",
                got
                  ? "border-border-strong bg-bg-elevated text-fg"
                  : "border-border bg-wash text-fg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border",
                  got ? "border-accent text-accent" : "border-border",
                )}
              >
                <StampIcon id={s.id} className="size-4" />
              </span>
              <p className="font-display text-base leading-none">{stampLabel(s.id, "name")}</p>
              <p className="text-xs leading-snug">{stampLabel(s.id, "hint")}</p>
            </div>
          );
        })}
      </div>

      <h2 className="mt-10 text-sm font-medium text-fg-muted">
        {t("stats.monthDaily", { n: now.getMonth() + 1 })}
      </h2>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-fg-muted">
        {([1, 2, 3, 4, 5, 6, 7] as const).map((w) => (
          <div key={w} className="py-1">
            {t(`stats.wd.${w}`)}
          </div>
        ))}
        {cells.map((c, i) =>
          c ? (
            <div
              key={c.id}
              className={cn(
                "flex aspect-square items-center justify-center rounded-sm text-xs tabular-nums",
                c.done ? "bg-accent text-accent-fg" : "bg-wash text-fg",
                c.id === todayId() && "ring-1 ring-fg",
              )}
            >
              {c.day}
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated px-3 py-3">
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums text-fg">{value}</p>
    </div>
  );
}