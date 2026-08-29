import { PlayScreen } from "@/components/play-screen";
import { DIFFICULTIES } from "@/engine/types";
import type { Difficulty } from "@/engine/types";
import { parseHl, routeHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/play")({
  validateSearch: (s: Record<string, unknown>): { d?: Difficulty; hl?: "zh-Hans" | "zh-Hant" | "en" } => {
    const d = s.d;
    const hl = parseHl(s);
    const out: { d?: Difficulty; hl?: "zh-Hans" | "zh-Hant" | "en" } = {};
    if (typeof d === "string" && (DIFFICULTIES as string[]).includes(d)) {
      out.d = d as Difficulty;
    }
    if (hl) out.hl = hl;
    return out;
  },
  head: ({ match }) => routeHead("home", match.search.hl),
  component: PlayPage,
});

function PlayPage() {
  const { d } = Route.useSearch();
  return <PlayScreen kind="free" difficulty={d} />;
}