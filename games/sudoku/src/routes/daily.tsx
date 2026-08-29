import { PlayScreen } from "@/components/play-screen";
import { parseHl, routeHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/daily")({
  validateSearch: (s: Record<string, unknown>) => {
    const hl = parseHl(s);
    return hl ? { hl } : {};
  },
  head: ({ match }) => routeHead("daily", match.search.hl),
  component: () => <PlayScreen kind="daily" />,
});