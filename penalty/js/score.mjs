// Single scoring authority. The UI never recomputes goals or the winner.

import { SIDES } from "./engine.mjs";

export function goalsOf(summary, side) {
  return summary?.score?.[side] ?? 0;
}

export function leader(summary) {
  const a = goalsOf(summary, "side_a");
  const b = goalsOf(summary, "side_b");
  return a === b ? null : a > b ? "side_a" : "side_b";
}

// Stars reflect the winning margin; a drawn or unfinished match has none.
export function rate(summary) {
  if (!summary?.winner || !SIDES.includes(summary.winner)) return 0;
  const margin = Math.abs(goalsOf(summary, "side_a") - goalsOf(summary, "side_b"));
  if (margin >= 3) return 3;
  if (margin >= 2) return 2;
  return 1;
}

export function scoreLine(summary) {
  return `${goalsOf(summary, "side_a")} : ${goalsOf(summary, "side_b")}`;
}

// Per-side shot dots for the scoreboard tray.
export function shotDots(summary, side) {
  return (summary?.results ?? []).filter((shot) => shot.shooter === side).map((shot) => shot.result);
}

export function isDecisive(summary) {
  return Boolean(summary?.suddenDeath) && Boolean(summary?.winner);
}
