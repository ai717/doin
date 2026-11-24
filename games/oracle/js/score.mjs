// Pure scoring helpers: star rating, time formatting and progress totals.

import { LEVELS } from "./levels.mjs";

export function starsFor(errors) {
  const value = Math.floor(Number(errors));
  if (!Number.isFinite(value) || value <= 0) return 3;
  if (value <= 2) return 2;
  return 1;
}

export function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function tableOf(records) {
  return records && typeof records === "object" ? records : {};
}

export function totalStars(records = {}) {
  const table = tableOf(records);
  return LEVELS.reduce((sum, level) => sum + Math.max(0, Math.min(3, Number(table[level.id]?.stars) || 0)), 0);
}

export function chapterStars(records = {}, chapterIndex) {
  const table = tableOf(records);
  return LEVELS.filter((level) => level.chapterIndex === chapterIndex)
    .reduce((sum, level) => sum + Math.max(0, Math.min(3, Number(table[level.id]?.stars) || 0)), 0);
}

export function chapterComplete(records = {}, chapterIndex) {
  const table = tableOf(records);
  const levels = LEVELS.filter((level) => level.chapterIndex === chapterIndex);
  return levels.length > 0 && levels.every((level) => (Number(table[level.id]?.stars) || 0) > 0);
}

export function allComplete(records = {}) {
  const table = tableOf(records);
  return LEVELS.every((level) => (Number(table[level.id]?.stars) || 0) > 0);
}
