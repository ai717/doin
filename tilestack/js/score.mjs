/**
 * Score calculation and star evaluation for TileStack (千层瓦片 · 叠叠消)
 * Pure logic, DOM-free.
 */

import { GAME_CONSTANTS } from './data.mjs';

/**
 * Evaluate stars earned for a completed level.
 * 3 Stars: 0 hints used, undos <= 2
 * 2 Stars: <= 1 hint used, undos <= 5
 * 1 Star: Level completed
 */
export function calculateStars(gameState, starCriteria = null) {
  if (gameState.status !== 'won') {
    return 0;
  }

  const maxUndosFor3Stars = starCriteria?.maxUndos ?? 2;
  const maxHintsFor3Stars = starCriteria?.maxHints ?? 0;

  if (gameState.hintsUsed <= maxHintsFor3Stars && gameState.undosCount <= maxUndosFor3Stars) {
    return 3;
  }
  if (gameState.hintsUsed <= 1 && gameState.undosCount <= 5) {
    return 2;
  }
  return 1;
}

/**
 * Calculate final settlement summary including bonuses.
 */
export function calculateSettlement(gameState, levelConfig) {
  const stars = calculateStars(gameState, levelConfig.starCriteria);
  const unusedHints = Math.max(0, GAME_CONSTANTS.MAX_HINTS - gameState.hintsUsed);
  const hintBonus = unusedHints * 150;
  
  let timeBonus = 0;
  if (gameState.isTimed && gameState.timeRemaining > 0) {
    timeBonus = Math.floor(gameState.timeRemaining * 10);
  }

  const totalScore = gameState.score + hintBonus + timeBonus;

  return {
    stars,
    baseScore: gameState.score,
    hintBonus,
    timeBonus,
    totalScore,
    steps: gameState.steps,
    undosCount: gameState.undosCount,
    hintsUsed: gameState.hintsUsed,
    timeElapsed: Math.round(gameState.timeElapsed)
  };
}
