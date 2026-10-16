// Bomber - scoring single source of truth. UI must never recompute stars.
import { rating, demolitionRate, timeLeftSeconds } from "./engine.mjs";

export function clamp(value, min, max) {
  const num = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, num));
}

export function formatClock(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export function formatPercent(value) {
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

export function starsFor(state) {
  return rating(state).stars;
}

export function partsFor(state) {
  const info = rating(state);
  if (state.status !== "won") return 0;
  if (state.mode === "puzzle") {
    const saved = Math.max(0, Math.max(1, state.par) + 1 - state.stats.bombsUsed);
    return saved * 6 + (info.oneChain ? 8 : 0) + info.stars * 2;
  }
  return Math.round(demolitionRate(state) * 10) + state.stats.maxChain * 2 + info.stars * 3;
}

export function summary(state) {
  const info = rating(state);
  const elapsed = Math.max(0, state.timeLimit - state.timeLeft) / 60;
  return {
    status: state.status,
    stars: info.stars,
    timeOk: info.timeOk,
    demoOk: info.demoOk,
    oneChain: info.oneChain,
    elapsedSeconds: elapsed,
    remainingSeconds: timeLeftSeconds(state),
    demo: demolitionRate(state),
    maxChain: state.stats.maxChain,
    bombsUsed: state.stats.bombsUsed,
    par: state.par,
    kills: state.stats.kills,
    enemiesTotal: state.stats.enemiesTotal,
    parts: partsFor(state),
  };
}
