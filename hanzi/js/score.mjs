/**
 * Glyph Craft (字灵拆拆乐) - Score and Assessment Engine
 * Zero DOM, pure calculation.
 */

export function calculateLevelStars(level, state) {
  if (!state.won) {
    return { stars: 0, star1: false, star2: false, star3: false };
  }

  // Star 1: Cleared
  const star1 = true;
  // Star 2: Frugal Steps (steps <= optimalSteps)
  const star2 = state.steps <= level.optimalSteps;
  // Star 3: Easter Egg / Glyph Discovery
  const star3 = state.discoveredGlyphs && state.discoveredGlyphs.has(level.eggGlyph);

  let stars = 1;
  if (star2) stars += 1;
  if (star3) stars += 1;

  return { stars, star1, star2, star3 };
}

export function getRankTitle(totalStars) {
  if (totalStars >= 56) return { id: 'cangjie', key: 'rank_cangjie', icon: '📜' };
  if (totalStars >= 41) return { id: 'sage', key: 'rank_sage', icon: '☯️' };
  if (totalStars >= 26) return { id: 'master', key: 'rank_master', icon: '🖋️' };
  if (totalStars >= 11) return { id: 'scholar', key: 'rank_scholar', icon: '📖' };
  return { id: 'apprentice', key: 'rank_apprentice', icon: '🖌️' };
}
