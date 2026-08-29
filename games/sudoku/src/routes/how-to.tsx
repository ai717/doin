import { AppShell } from "@/components/app-shell";
import { PageHeading } from "@/components/site-chrome";
import { TechniqueAtlas } from "@/components/technique-atlas";
import { useLocale, useT } from "@/i18n";
import { howToJsonLd, parseHl, routeHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/how-to")({
  validateSearch: (s: Record<string, unknown>) => {
    const hl = parseHl(s);
    return hl ? { hl } : {};
  },
  head: ({ match }) => routeHead("howTo", match.search.hl),
  component: HowToPage,
});

function HowToPage() {
  const t = useT();
  const locale = useLocale();
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, []);

  const items = [
    ["how.rcb.title", "how.rcb.body"],
    ["how.given.title", "how.given.body"],
    ["how.notes.title", "how.notes.body"],
    ["how.keys.title", "how.keys.body"],
    ["how.hint.title", "how.hint.body"],
    ["how.err.title", "how.err.body"],
  ] as const;

  return (
    <AppShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd(locale)) }}
      />
      <PageHeading kicker={t("brand.name")} title={t("how.title")} />
      <ol className="space-y-6 text-sm leading-relaxed text-fg">
        {items.map(([title, body]) => (
          <li key={title}>
            <p className="font-medium">{t(title)}</p>
            <p className="mt-1 text-fg-muted">{t(body)}</p>
          </li>
        ))}
      </ol>
      <TechniqueAtlas />
    </AppShell>
  );
}