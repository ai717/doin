/**
 * Tenon rating and performance evaluation for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * Pure logic, DOM-free.
 */

import { RATINGS, GAME_CONSTANTS } from './data.mjs';

/**
 * Calculate Tenon rating for a completed lock level.
 * Gold Tenon: 0 hints, moves <= optimalMoves * 1.2
 * Silver Tenon: <= 1 hint
 * Bronze Tenon: Completed
 */
export function calculateTenonRating(gameState, optimalMoves) {
  if (gameState.status !== 'won') {
    return null;
  }

  const maxStepsForGold = Math.ceil(optimalMoves * 1.2);

  if (gameState.hintsUsed <= GAME_CONSTANTS.GOLD_TENON_HINTS && gameState.steps <= maxStepsForGold) {
    return { ...RATINGS.gold, stars: 3 };
  }
  if (gameState.hintsUsed <= GAME_CONSTANTS.SILVER_TENON_HINTS) {
    return { ...RATINGS.silver, stars: 2 };
  }
  return { ...RATINGS.bronze, stars: 1 };
}

/**
 * Build completion settlement summary.
 */
export function buildSettlementSummary(gameState, levelConfig) {
  const rating = calculateTenonRating(gameState, levelConfig.optimalMoves);

  return {
    levelId: levelConfig.id,
    rating,
    stars: rating ? rating.stars : 0,
    steps: gameState.steps,
    optimalMoves: levelConfig.optimalMoves,
    hintsUsed: gameState.hintsUsed,
    triviaZh: levelConfig.triviaZh,
    triviaEn: levelConfig.triviaEn
  };
}
