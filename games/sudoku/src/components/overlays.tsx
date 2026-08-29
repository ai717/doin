import { Button } from "@/components/ui/button";
import { StampIcon } from "@/components/stamp-icon";
import { liveElapsed, useGame } from "@/game/store";
import { formatNumber, stampLabel, useT } from "@/i18n";
import { formatTime } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export function PauseOverlay() {
  const resume = useGame((s) => s.resumePlay);
  const game = useGame((s) => s.activeGame());
  const startGame = useGame((s) => s.startGame);
  const idle = useGame((s) => s.pauseIdle);
  const t = useT();
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-bg/80 backdrop-blur-sm">
      <p className="font-display text-2xl text-fg">
        {idle ? t("pause.idleTitle") : t("pause.title")}
      </p>
      {idle ? (
        <p className="mt-2 px-6 text-center text-sm text-fg-muted">{t("pause.idleBody")}</p>
      ) : null}
      <div className="mt-6 flex w-full max-w-xs flex-col gap-2 px-6">
        <Button onClick={resume}>{t("pause.continue")}</Button>
        {game?.kind === "free" && (
          <Button
            variant="secondary"
            onClick={() => void startGame("free", game.difficulty)}
          >
            {t("pause.new")}
          </Button>
        )}
        <Button variant="ghost" asChild>
          <Link to="/settings">{t("nav.settings")}</Link>
        </Button>
      </div>
    </div>
  );
}

export function ResultOverlay() {
  const game = useGame((s) => s.activeGame());
  const startGame = useGame((s) => s.startGame);
  const viewSolution = useGame((s) => s.viewSolution);
  const cheers = useGame((s) => s.settings.cheers);
  const reduce = useGame((s) => s.settings.reduceMotion);
  const t = useT();
  if (!game || (game.status !== "won" && game.status !== "lost")) return null;
  const won = game.status === "won";
  const flourish = won && cheers && !reduce;
  const elapsed = liveElapsed(game);
  const stats = useGame.getState().stats.byDifficulty[game.difficulty];
  const isRecord = won && stats.bestMs === elapsed;
  const score = won ? game.score : undefined;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-fg/40 px-4">
      <div
        role="dialog"
        aria-labelledby="result-title"
        className={`relative w-full max-w-sm overflow-hidden rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow)] ${flourish ? "win-card" : ""}`}
      >
        {flourish && <WinBurst />}
        <p
          id="result-title"
          className={`text-3xl text-fg ${flourish ? "cheer-stamp font-sans font-semibold" : "font-display"}`}
        >
          {won ? t("result.won") : t("result.lost")}
        </p>
        <p className="mt-2 text-sm text-fg-muted">
          {won ? (
            <>
              {t(`diff.${game.difficulty}`)} · {formatTime(elapsed)}
              {game.hintUsed === 0
                ? ` · ${t("result.noHint")}`
                : ` · ${t("result.hintsUsed", { n: game.hintUsed })}`}
            </>
          ) : (
            t("result.lostBody")
          )}
        </p>
        {isRecord && won && (
          <p className="mt-2 text-sm font-medium text-accent">{t("result.record")}</p>
        )}
        {score && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-fg-muted">{t("result.score")}</span>
              <span className="font-display text-3xl tabular-nums text-fg">
                {score.total}
              </span>
            </div>
            <dl className="mt-3 space-y-1 text-sm text-fg-muted">
              <ScoreRow label={t("result.base")} value={score.base} />
              {score.time > 0 && <ScoreRow label={t("result.time")} value={score.time} signed />}
              {score.clean > 0 && <ScoreRow label={t("result.clean")} value={score.clean} signed />}
              {score.daily > 0 && <ScoreRow label={t("result.daily")} value={score.daily} signed />}
            </dl>
            <p className="mt-3 text-sm text-fg-muted">
              {t("result.ink")}{" "}
              <span className="tabular-nums text-fg">
                {formatNumber(score.inkBefore)}
                {" → "}
                {formatNumber(score.inkAfter)}
              </span>
            </p>
            {score.newStamps.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {score.newStamps.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-sm border border-accent px-2 py-0.5 font-display text-sm text-accent"
                  >
                    <StampIcon id={id} className="size-3.5" />
                    {stampLabel(id, "name")}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="mt-6 flex flex-col gap-2">
          {won && game.kind === "daily" ? (
            <>
              <Button asChild>
                <Link to="/" search={{ d: game.difficulty }}>
                  {t("diff.free")}
                </Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/stats">{t("nav.stats")}</Link>
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => startGame(game.kind, game.difficulty, true)}>
                {t("play.again")}
              </Button>
              {!won && (
                <Button variant="secondary" onClick={viewSolution}>
                  {t("result.view")}
                </Button>
              )}
              <Button variant={won ? "secondary" : "ghost"} asChild>
                <Link to="/stats">{t("nav.stats")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function WinBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <span className="cheer-dot absolute left-[12%] top-[18%] size-2.5 rounded-full bg-accent" />
      <span className="cheer-dot absolute right-[16%] top-[22%] size-3 rounded-full bg-accent" style={{ animationDelay: "50ms" }} />
      <span className="cheer-dot absolute left-[20%] bottom-[24%] size-2 rounded-full bg-accent" style={{ animationDelay: "80ms" }} />
      <span className="cheer-dot absolute right-[14%] bottom-[20%] size-2.5 rounded-full bg-accent" style={{ animationDelay: "110ms" }} />
    </div>
  );
}

function ScoreRow({
  label,
  value,
  signed,
}: {
  label: string;
  value: number;
  signed?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums text-fg">
        {signed && value > 0 ? `+${value}` : value}
      </dd>
    </div>
  );
}

export function HintPanel() {
  const hint = useGame((s) => s.hint);
  const advance = useGame((s) => s.advanceHint);
  const dismiss = useGame((s) => s.dismissHint);
  const fill = useGame((s) => s.fillHint);
  const t = useT();
  if (!hint) return null;
  const { level, step } = hint;
  const look =
    level === 1
      ? step.units[0]
        ? step.units[0].kind === "row"
          ? t("hint.lookRow", { n: step.units[0].index + 1 })
          : step.units[0].kind === "col"
            ? t("hint.lookCol", { n: step.units[0].index + 1 })
            : t("hint.lookBox")
        : t("hint.lookHere")
      : step.message;
  return (
    <div className="rounded-md border border-border bg-bg-elevated px-3 py-2">
      <p className="text-sm leading-snug text-fg">{look}</p>
      <div className="mt-2 flex gap-2">
        {level < 3 && step.technique !== "conflict" && (
          <Button size="sm" onClick={level === 1 ? advance : fill}>
            {level === 1 ? t("hint.give") : t("hint.fill")}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {t("hint.self")}
        </Button>
      </div>
      {level >= 2 && step.technique !== "conflict" && (
        <a
          href={`/how-to#${step.technique}`}
          className="mt-2 inline-block text-xs text-fg-muted underline-offset-2 hover:underline"
        >
          {t("hint.learn")}
        </a>
      )}
    </div>
  );
}

export function ConfirmNewDialog() {
  const pending = useGame((s) => s.confirmNew);
  const cancel = useGame((s) => s.cancelConfirm);
  const confirm = useGame((s) => s.confirmPending);
  const t = useT();
  if (!pending) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-fg/40 px-6">
      <div
        role="dialog"
        aria-labelledby="new-game-title"
        className="w-full max-w-sm rounded-xl bg-bg-elevated p-6 shadow-[var(--shadow)]"
      >
        <h2 id="new-game-title" className="font-display text-xl text-fg">
          {t("confirm.title")}
        </h2>
        <p className="mt-2 text-sm text-fg-muted">{t("confirm.body")}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={cancel}>
            {t("confirm.cancel")}
          </Button>
          <Button onClick={() => void confirm()}>{t("confirm.ok")}</Button>
        </div>
      </div>
    </div>
  );
}