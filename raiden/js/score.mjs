// Single source of truth for Raiden Lite scoring and star ratings.

import { ENEMIES, TRAINING } from "./levels.mjs";

export const GRAZE_SCORE = 15;
export const GRAZE_ENERGY = 2.5;

export function killScore(type) {
  return ENEMIES[type]?.score ?? 100;
}

export function bossScore(stageIndex) {
  return 2500 + Math.max(0, stageIndex) * 500;
}

export function stageBonus({ lives = 0, bombs = 0 } = {}) {
  return 1200 + Math.max(0, lives) * 250 + Math.max(0, bombs) * 200;
}

export function starsForStage({ damaged = false, bombsUsed = 0 } = {}) {
  let stars = 1;
  if (!damaged) stars += 1;
  if (!bombsUsed) stars += 1;
  return stars;
}

export function starsForTraining(graze = 0) {
  if (graze >= TRAINING.grazeThree) return 3;
  if (graze >= TRAINING.grazeTwo) return 2;
  return 1;
}

export function formatTime(ms) {
  const total = Math.max(0, Math.floor(Number(ms) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
