import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-chrome";
import { DIFFICULTIES } from "@/engine/types";
import type { Difficulty } from "@/engine/types";
import { correctFillCounts, liveScore } from "@/game/score";
import { liveElapsed, useGame } from "@/game/store";
import { MAX_HINTS, MAX_MISTAKES } from "@/game/types";
import { formatNumber, useT } from "@/i18n";
import { playSfx } from "@/lib/sfx";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { ChevronDown, Pause, Play, Plus, Trophy } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function PlayHeader({
  kind,
  difficulty,
  onNewGame,
  onPickDifficulty,
}: {
  kind: "free" | "daily";
  difficulty?: Difficulty;
  onNewGame: () => void;
  onPickDifficulty: (d: Difficulty) => void;
}) {
  const t = useT();
  return (
    <SiteHeader
      leading={
        <DifficultyMenu
          kind={kind}
          difficulty={difficulty}
          onPick={onPickDifficulty}
        />
      }
      trailing={
        kind === "free" ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("hud.newGame")}
            onClick={onNewGame}
          >
            <Plus />
          </Button>
        ) : null
      }
    />
  );
}

export function PlayHud({
  timer,
  mistakes,
  hintUsed,
  canPause,
  paused,
  onPause,
  onResume,
}: {
  timer?: ReactNode;
  mistakes: number;
  hintUsed: number;
  canPause?: boolean;
  paused?: boolean;
  onPause: () => void;
  onResume: () => void;
}) {
  const game = useGame((s) => s.activeGame());
  const ink = useGame((s) => s.stats.ink ?? 0);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [game?.startedAt]);

  const counts = game
    ? correctFillCounts(game.board, game.solution)
    : { filled: 0, empty: 1 };
  const live = game
    ? liveScore({
        difficulty: game.difficulty,
        elapsedMs: liveElapsed(game),
        mistakes: game.mistakes,
        hintUsed: game.hintUsed,
        kind: game.kind,
        filled: counts.filled,
        empty: counts.empty,
      }).live
    : 0;
  const lifetime = ink + (game?.status === "won" ? 0 : live);
  const t = useT();

  return (
    <div className="flex flex-col gap-2 md:gap-3">
      <div className="hidden lg:block">
        <ScoreHero live={live} />
      </div>
      <div className="grid grid-cols-5 items-start lg:grid-cols-4">
        <div className="lg:hidden">
          <ScoreHero live={live} compact />
        </div>
        <HudStat label={t("hud.lifetime")} value={formatNumber(lifetime)} />
        <HudStat
          label={t("hud.mistakes")}
          value={`${mistakes}/${MAX_MISTAKES}`}
          warn={mistakes >= MAX_MISTAKES - 1}
        />
        <HudStat
          label={t("hud.hints")}
          value={`${Math.min(hintUsed, MAX_HINTS)}/${MAX_HINTS}`}
          warn={hintUsed >= MAX_HINTS}
        />
        <HudStat
          label={t("hud.time")}
          value={timer ?? "0:00"}
          as="button"
          ariaLabel={paused ? t("hud.resume") : t("hud.pause")}
          disabled={!canPause && !paused}
          onClick={paused ? onResume : onPause}
          extra={
            paused ? (
              <Play className="size-3 text-fg-muted" />
            ) : (
              <Pause className="size-3 text-fg-muted" />
            )
          }
        />
      </div>
    </div>
  );
}

function ScoreHero({ live, compact }: { live: number; compact?: boolean }) {
  const t = useT();
  const reduce = useGame((s) => s.settings.reduceMotion);
  const prev = useRef<number | null>(null);
  const [pop, setPop] = useState<"up" | "down" | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (prev.current == null) {
      prev.current = live;
      return;
    }
    const d = live - prev.current;
    prev.current = live;
    if (d === 0) return;
    setDelta(d);
    setPop(d > 0 ? "up" : "down");
    setFlash((n) => n + 1);
    if (d > 0) playSfx("stamp");
    const id = window.setTimeout(() => {
      setPop(null);
      setDelta(null);
    }, 720);
    return () => window.clearTimeout(id);
  }, [live]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center",
        compact ? "gap-0.5 pt-0" : "pt-0.5",
      )}
    >
      <div className="relative flex items-center gap-1.5 md:gap-2">
        <Trophy
          className={cn(
            "text-accent",
            compact ? "size-4" : "size-6 md:size-7",
            !reduce && pop === "up" && "score-trophy",
          )}
          strokeWidth={1.6}
          aria-hidden
        />
        <span
          className={cn(
            "font-semibold leading-none tabular-nums text-fg",
            compact ? "text-lg" : "text-3xl md:text-4xl",
            !reduce && pop === "up" && "score-pop",
            !reduce && pop === "down" && "score-dip",
          )}
        >
          {formatNumber(live)}
        </span>
        {delta != null && !reduce && (
          <span
            key={flash}
            className={cn(
              "score-delta pointer-events-none absolute left-1/2 top-0 font-semibold tabular-nums",
              compact ? "text-[10px]" : "text-sm",
              delta > 0 ? "text-accent" : "text-fg-muted",
            )}
          >
            {delta > 0 ? `+${delta}` : String(delta)}
          </span>
        )}
      </div>
      <span
        className={cn(
          "font-medium tracking-wide text-fg-muted",
          compact ? "text-[10px]" : "mt-1.5 text-[11px]",
        )}
      >
        {t("hud.score")}
      </span>
    </div>
  );
}

function HudStat({
  label,
  value,
  warn,
  as,
  ariaLabel,
  disabled,
  onClick,
  extra,
}: {
  label: string;
  value: ReactNode;
  warn?: boolean;
  as?: "button";
  ariaLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  extra?: ReactNode;
}) {
  const className = "flex min-w-0 flex-col items-center gap-1 px-0.5";
  const body = (
    <>
      <span className="text-[10px] font-medium tracking-wide text-fg-muted md:text-[11px]">{label}</span>
      <span
        className={cn(
          "flex items-center gap-1 text-sm font-medium leading-none tabular-nums md:text-lg",
          warn ? "text-conflict" : "text-fg",
        )}
      >
        {value}
        {extra}
      </span>
    </>
  );
  if (as === "button") {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={onClick}
        className={cn(className, "rounded-md disabled:opacity-40")}
      >
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

function DifficultyMenu({
  kind,
  difficulty,
  onPick,
}: {
  kind: "free" | "daily";
  difficulty?: Difficulty;
  onPick: (d: Difficulty) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const t = useT();
  const label =
    kind === "daily" ? t("diff.today") : difficulty ? t(`diff.${difficulty}`) : t("diff.free");

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-1 rounded-md px-2 text-sm font-medium hover:bg-wash"
      >
        {label}
        <ChevronDown className="size-4 text-fg-muted" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 min-w-40 overflow-hidden rounded-lg border border-border bg-bg-elevated py-1 shadow-[var(--shadow)]"
        >
          {DIFFICULTIES.map((d) => (
            <li key={d}>
              <button
                type="button"
                role="option"
                aria-selected={kind === "free" && difficulty === d}
                onClick={() => {
                  setOpen(false);
                  onPick(d);
                }}
                className={cn(
                  "flex h-10 w-full items-center px-3 text-left text-sm",
                  kind === "free" && difficulty === d
                    ? "bg-wash text-fg"
                    : "text-fg hover:bg-wash",
                )}
              >
                {t(`diff.${d}`)}
              </button>
            </li>
          ))}
          <li className="my-1 border-t border-border" />
          <li>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/daily" });
              }}
              className={cn(
                "flex h-10 w-full items-center px-3 text-left text-sm",
                kind === "daily" ? "bg-wash text-fg" : "text-fg hover:bg-wash",
              )}
            >
              {t("diff.todayPuzzle")}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
