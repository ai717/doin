import type { CheerMark } from "@/game/cheer";
import { useGame } from "@/game/store";
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { useEffect } from "react";

export function CheerOverlay() {
  const cheer = useGame((s) => s.cheer);
  const dismiss = useGame((s) => s.dismissCheer);
  const reduce = useGame((s) => s.settings.reduceMotion);
  if (!cheer) return null;
  return <CheerCard mark={cheer} reduce={reduce} onDismiss={dismiss} />;
}

function CheerCard({
  mark,
  reduce,
  onDismiss,
}: {
  mark: CheerMark;
  reduce: boolean;
  onDismiss: () => void;
}) {
  const t = useT();
  const kicker = t(`cheer.${mark}.kicker` as MessageKey);
  const line = t(`cheer.${mark}.line` as MessageKey);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      role="dialog"
      aria-label={kicker}
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-fg/55 px-6"
      onClick={onDismiss}
    >
      {!reduce && <InkBurst />}
      <div
        className={
          reduce
            ? "relative text-center"
            : "cheer-rise relative text-center"
        }
      >
        <p
          className={
            reduce
              ? "font-sans text-5xl font-semibold tracking-tight text-accent"
              : "cheer-stamp font-sans text-5xl font-semibold tracking-tight text-accent"
          }
        >
          {kicker}
        </p>
        <p className="mt-3 text-base text-bg md:text-lg">{line}</p>
        <p className="mt-8 text-xs tracking-wide text-bg/70">{t("cheer.tap")}</p>
      </div>
    </div>
  );
}

function InkBurst() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {DOTS.map((d) => (
        <span
          key={d.i}
          className="cheer-dot absolute rounded-full bg-accent"
          style={{
            left: d.x,
            top: d.y,
            width: d.s,
            height: d.s,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}

const DOTS = [
  { i: 1, x: "18%", y: "28%", s: 10, delay: "0ms" },
  { i: 2, x: "78%", y: "22%", s: 14, delay: "40ms" },
  { i: 3, x: "12%", y: "68%", s: 8, delay: "80ms" },
  { i: 4, x: "86%", y: "62%", s: 12, delay: "60ms" },
  { i: 5, x: "48%", y: "16%", s: 6, delay: "20ms" },
  { i: 6, x: "52%", y: "80%", s: 9, delay: "100ms" },
  { i: 7, x: "30%", y: "44%", s: 5, delay: "50ms" },
  { i: 8, x: "70%", y: "48%", s: 7, delay: "90ms" },
];