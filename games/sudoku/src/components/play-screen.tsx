import { SudokuBoard } from "@/components/sudoku-board";
import { Keypad } from "@/components/keypad";
import { ToolBar } from "@/components/tool-bar";
import { PlayHeader, PlayHud } from "@/components/play-header";
import { SiteFrame } from "@/components/site-chrome";
import {
  ConfirmNewDialog,
  HintPanel,
  PauseOverlay,
  ResultOverlay,
} from "@/components/overlays";
import { CheerOverlay } from "@/components/cheer-overlay";
import { Button } from "@/components/ui/button";
import type { Difficulty } from "@/engine/types";
import { MAX_HINTS } from "@/game/types";
import { liveElapsed, useGame } from "@/game/store";
import { formatTime } from "@/lib/utils";
import { useLocale, useT } from "@/i18n";
import { seoCopy } from "@/lib/seo";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";

export function PlayScreen({
  kind,
  difficulty,
}: {
  kind: "free" | "daily";
  difficulty?: Difficulty;
}) {
  const hydrate = useGame((s) => s.hydrate);
  const hydrated = useGame((s) => s.hydrated);
  const startGame = useGame((s) => s.startGame);
  const openGame = useGame((s) => s.openGame);
  const generating = useGame((s) => s.generating);
  const generateError = useGame((s) => s.generateError);
  const game = useGame((s) => (kind === "daily" ? s.daily : s.free));
  const selected = useGame((s) => s.selected);
  const hint = useGame((s) => s.hint);
  const noteMode = useGame((s) => s.noteMode);
  const digitLock = useGame((s) => s.digitLock);
  const settings = useGame((s) => s.settings);
  const selectCell = useGame((s) => s.selectCell);
  const inputDigit = useGame((s) => s.inputDigit);
  const toggleNoteDigit = useGame((s) => s.toggleNoteDigit);
  const erase = useGame((s) => s.erase);
  const undo = useGame((s) => s.undo);
  const redo = useGame((s) => s.redo);
  const toggleNoteMode = useGame((s) => s.toggleNoteMode);
  const fillNotes = useGame((s) => s.fillNotes);
  const requestHint = useGame((s) => s.requestHint);
  const pause = useGame((s) => s.pause);
  const resumePlay = useGame((s) => s.resumePlay);
  const moveSelection = useGame((s) => s.moveSelection);
  const resolvedInput = useGame((s) => s.resolvedInput);
  const revealSolution = useGame((s) => s.revealSolution);
  const onboarded = useGame((s) => s.onboarded);
  const markOnboarded = useGame((s) => s.markOnboarded);
  const coach = useGame((s) => s.coach);
  const dismissCoach = useGame((s) => s.dismissCoach);
  const navigate = useNavigate();
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (kind === "daily") {
      void startGame("daily", "medium");
      return;
    }
    const existing = useGame.getState().free;
    const live =
      existing &&
      (existing.status === "playing" ||
        existing.status === "paused" ||
        existing.status === "won");
    if (difficulty) {
      if (live && existing.difficulty === difficulty) {
        openGame("free");
        return;
      }
      void startGame("free", difficulty);
      return;
    }
    if (live) {
      openGame("free");
    } else {
      void startGame("free", useGame.getState().lastDifficulty);
    }
  }, [hydrated, kind, difficulty, startGame, openGame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const g = useGame.getState().activeGame();
      if (!g || g.status !== "playing") {
        if (e.code === "Space" || e.key === "Escape") {
          e.preventDefault();
          useGame.getState().resumePlay();
        }
        return;
      }
      if (e.code.startsWith("Digit") || e.code.startsWith("Numpad")) {
        const n = Number(e.code.replace("Digit", "").replace("Numpad", ""));
        if (n >= 1 && n <= 9) {
          e.preventDefault();
          inputDigit(n);
          return;
        }
      }
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        inputDigit(Number(e.key));
        return;
      }
      if (e.key === "0" || e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        erase();
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        moveSelection(-1, 0);
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        moveSelection(1, 0);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        moveSelection(0, -1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(0, 1);
      }
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        toggleNoteMode();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      if (e.key === "Z" && e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        redo();
      } else if (e.key === "z" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        requestHint();
      }
      if (e.code === "Space") {
        e.preventDefault();
        pause();
      }
      if (e.key === "Escape") {
        useGame.getState().dismissHint();
        useGame.getState().dismissCoach();
        useGame.getState().dismissCheer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputDigit, erase, moveSelection, toggleNoteMode, undo, redo, requestHint, pause]);

  const digitFirst = resolvedInput() === "digit";
  const playing = game?.status === "playing";
  const idle = useIdlePause(Boolean(playing && !generating), game?.startedAt, () => {
    pause({ idle: true });
  });
  const sameDigit =
    selected != null ? (game?.board[selected]?.value ?? null) : digitLock;

  const pickDifficulty = (d: Difficulty) => {
    if (kind === "daily") {
      void navigate({ to: "/", search: { d } });
      return;
    }
    if (
      game?.difficulty === d &&
      (game.status === "playing" || game.status === "paused")
    ) {
      return;
    }
    void startGame("free", d);
  };

  const keypad = game ? (
    <Keypad
      board={game.board}
      noteMode={noteMode}
      digitLock={digitLock}
      digitFirst={digitFirst}
      disabled={!playing}
      onDigit={(d) => {
        if (digitFirst && selected == null) {
          useGame.getState().setDigitLock(
            useGame.getState().digitLock === d ? null : d,
          );
        }
        inputDigit(d);
      }}
      onLongPress={toggleNoteDigit}
    />
  ) : null;

  return (
    <SiteFrame fill>
      <PlayHeader
        kind={kind}
        difficulty={game?.difficulty ?? difficulty}
        onNewGame={() => void startGame("free", game?.difficulty ?? difficulty ?? "easy")}
        onPickDifficulty={pickDifficulty}
      />
      <h1 className="sr-only">{seoCopy(kind === "daily" ? "daily" : "home", locale).h1}</h1>

      {game && coach ? (
        <CoachTip kind={coach} onDismiss={dismissCoach} />
      ) : game && idle.remind ? (
        <IdleRemind
          bannerRef={idle.bannerRef}
          onPause={() => pause({ idle: true })}
          onStay={idle.stay}
        />
      ) : null}

      <div className="play-stage">
        <div className="board-slot relative min-h-0">
          {!game ? (
            <div className="sudoku-board-frame rounded-lg border border-border bg-board" />
          ) : (
            <>
              <SudokuBoard
                board={game.board}
                selected={selected}
                hint={hint}
                autoCheck={settings.autoCheck}
                highlightSame={settings.highlightSame}
                sameDigit={sameDigit}
                reveal={revealSolution ? game.solution : null}
                onSelect={selectCell}
                onSelectOnly={(i) => selectCell(i, { skipFill: true })}
                onNote={toggleNoteDigit}
                disabled={!playing || generating}
              />
              {generating && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-bg/50">
                  <p className="text-sm text-fg-muted">{t("play.generating")}</p>
                </div>
              )}
              {game.status === "paused" && <PauseOverlay />}
              {(game.status === "won" || (game.status === "lost" && !revealSolution)) && (
                <ResultOverlay />
              )}
            </>
          )}
        </div>

        <div className="play-side">
          {generateError && (
            <div className="flex items-center justify-between rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm">
              <span>{generateError}</span>
              <Button
                size="sm"
                onClick={() => void startGame(kind, difficulty ?? "easy", true)}
              >
                {t("play.retry")}
              </Button>
            </div>
          )}
          {generating && !game && (
            <p className="text-center text-sm text-fg-muted">{t("play.generating")}</p>
          )}
          {revealSolution && game && (
            <div className="flex items-center justify-between rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm">
              <span>{t("play.solution")}</span>
              <Button
                size="sm"
                onClick={() => void startGame(game.kind, game.difficulty, true)}
              >
                {t("play.again")}
              </Button>
            </div>
          )}
          {hydrated && !onboarded && !coach ? (
            <div className="flex items-start justify-between gap-3 rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm">
              <p className="leading-snug text-fg-muted">
                {t("play.onboard")}
              </p>
              <Button size="sm" variant="ghost" onClick={markOnboarded}>
                {t("play.gotIt")}
              </Button>
            </div>
          ) : null}
          {hint && playing && <HintPanel />}
          {game && (
            <>
              <PlayHud
                timer={
                  settings.showTimer ? <Timer gameId={game.startedAt} /> : undefined
                }
                mistakes={game.mistakes}
                hintUsed={game.hintUsed}
                canPause={playing}
                paused={game.status === "paused"}
                onPause={pause}
                onResume={resumePlay}
              />
              <ToolBar
                noteMode={noteMode}
                canUndo={game.undo.length > 0}
                canRedo={game.redo.length > 0}
                disabled={!playing}
                hintLeft={Math.max(0, MAX_HINTS - game.hintUsed)}
                hintOpen={Boolean(hint)}
                onUndo={undo}
                onRedo={redo}
                onErase={erase}
                onToggleNote={toggleNoteMode}
                onFillNotes={fillNotes}
                onHint={requestHint}
              />
              <div className="hidden lg:block">{keypad}</div>
            </>
          )}
        </div>
        <div className="shrink-0 pt-1.5 lg:hidden">{keypad}</div>
      </div>
      <ConfirmNewDialog />
      <CheerOverlay />
    </SiteFrame>
  );
}

const IDLE_REMIND_MS = 90_000;
const IDLE_PAUSE_MS = 135_000;
const IDLE_SNOOZE_MS = 180_000;

function useIdlePause(
  active: boolean,
  gameId: string | undefined,
  onAutoPause: () => void,
) {
  const [remind, setRemind] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const last = useRef(Date.now());
  const snoozeUntil = useRef(0);
  const autoFired = useRef(false);
  const onAuto = useRef(onAutoPause);
  onAuto.current = onAutoPause;

  useEffect(() => {
    if (!active) {
      setRemind(false);
      autoFired.current = false;
      last.current = Date.now();
      return;
    }
    last.current = Date.now();
    autoFired.current = false;
    const bump = (e: Event) => {
      if (bannerRef.current?.contains(e.target as Node)) return;
      last.current = Date.now();
      setRemind(false);
    };
    window.addEventListener("pointerdown", bump, { passive: true });
    window.addEventListener("keydown", bump, { passive: true });
    const id = window.setInterval(() => {
      const now = Date.now();
      if (now < snoozeUntil.current) return;
      const idleFor = now - last.current;
      if (idleFor >= IDLE_PAUSE_MS && !autoFired.current) {
        autoFired.current = true;
        setRemind(false);
        onAuto.current();
        return;
      }
      if (idleFor >= IDLE_REMIND_MS) setRemind(true);
    }, 1000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [active, gameId]);

  return {
    remind,
    bannerRef,
    stay: () => {
      snoozeUntil.current = Date.now() + IDLE_SNOOZE_MS;
      last.current = Date.now();
      setRemind(false);
    },
  };
}

function IdleRemind({
  bannerRef,
  onPause,
  onStay,
}: {
  bannerRef: RefObject<HTMLDivElement | null>;
  onPause: () => void;
  onStay: () => void;
}) {
  const t = useT();
  return (
    <div
      ref={bannerRef}
      className="mt-2 flex shrink-0 flex-col gap-2 rounded-md border border-border-strong bg-bg-elevated px-3 py-2.5 shadow-[var(--shadow)] md:flex-row md:items-center md:gap-4"
    >
      <p className="min-w-0 flex-1 text-sm leading-snug text-fg">{t("pause.remind")}</p>
      <div className="flex shrink-0 gap-2 self-start md:self-center">
        <Button size="sm" variant="ghost" onClick={onStay}>
          {t("pause.remindStay")}
        </Button>
        <Button size="sm" onClick={onPause}>
          {t("hud.pause")}
        </Button>
      </div>
    </div>
  );
}

function Timer({ gameId }: { gameId: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, [gameId]);
  const game = useGame.getState().activeGame();
  if (!game) return null;
  return (
    <span className="tabular-nums">{formatTime(liveElapsed(game))}</span>
  );
}

function CoachTip({
  kind,
  onDismiss,
}: {
  kind: "note" | "keyboard";
  onDismiss: () => void;
}) {
  const t = useT();
  const copy =
    kind === "note"
      ? {
          title: t("play.coachNoteTitle"),
          body: t("play.coachNoteBody"),
        }
      : {
          title: t("play.coachKeyTitle"),
          body: t("play.coachKeyBody"),
        };
  return (
    <div className="mt-2 flex shrink-0 flex-col gap-2 rounded-md border border-border-strong bg-bg-elevated px-3 py-2.5 shadow-[var(--shadow)] md:flex-row md:items-center md:gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{copy.title}</p>
        <p className="mt-0.5 text-sm leading-snug text-fg-muted">{copy.body}</p>
      </div>
      <Button size="sm" className="shrink-0 self-start md:self-center" onClick={onDismiss}>
        {t("play.gotIt")}
      </Button>
    </div>
  );
}
