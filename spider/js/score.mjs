// Spider Solitaire Scoring & Rating Module
// Pure calculation, UI displays only what score module dictates.

export const SUIT_MULTIPLIERS = {
  1: 0.8,
  2: 1.0,
  3: 1.5,
  4: 2.0
};

/**
 * Calculates current in-game score and final clear score.
 * @param {Object} params
 * @param {number} params.runsCleared Number of completed 13-card runs (0 to 8)
 * @param {number} params.moves Number of moves made
 * @param {number} params.timeSeconds Elapsed time in seconds
 * @param {number} params.suitCount 1, 2, 3, or 4
 * @param {number} params.par Target par moves for current level
 * @param {boolean} params.isWon Whether all 8 runs are cleared
 * @returns {number} Score (integer >= 0)
 */
export function calculateScore({
  runsCleared = 0,
  moves = 0,
  timeSeconds = 0,
  suitCount = 2,
  par = 100,
  isWon = false
}) {
  const mult = SUIT_MULTIPLIERS[suitCount] || 1.0;
  const baseRunScore = Math.floor(runsCleared * 100 * mult);

  if (!isWon) {
    return Math.max(0, baseRunScore);
  }

  // Bonus when won
  const safePar = Math.max(20, par);
  const safeMoves = Math.max(1, moves);
  const movesRatio = Math.min(2.0, safePar / safeMoves);
  const movesBonus = Math.round(500 * movesRatio * mult);

  const safeSec = Math.max(0, timeSeconds);
  const timeBonus = Math.max(0, Math.round((400 - Math.min(400, safeSec / 2)) * mult));

  const total = baseRunScore + movesBonus + timeBonus;
  return Math.max(0, Math.floor(total));
}

/**
 * Computes stars achieved (0 to 3).
 * @param {Object} params
 * @param {boolean} params.isWon
 * @param {number} params.moves
 * @param {number} params.par
 * @returns {number} 0, 1, 2, or 3
 */
export function calculateStars({ isWon = false, moves = 0, par = 100 }) {
  if (!isWon) return 0;
  const safePar = Math.max(20, par);
  if (moves <= Math.floor(safePar * 1.15)) return 3;
  if (moves <= Math.floor(safePar * 1.5)) return 2;
  return 1;
}
