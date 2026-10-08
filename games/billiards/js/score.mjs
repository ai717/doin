// Scoring single source of truth. UI never computes stars on its own.

export const MAX_STARS = 3;

export function parOf(table) {
  return table?.par ?? 0;
}

/** Three stars need the table cleared inside par with zero fouls. */
export function rateClear({ cleared, shots, par, fouls }) {
  if (!cleared) return { stars: 0, withinPar: false, flawless: false };
  const withinPar = shots <= par;
  const flawless = fouls === 0;
  const stars = withinPar && flawless ? 3 : withinPar ? 2 : 1;
  return { stars, withinPar, flawless };
}

export function clearSummary({ cleared, shots, par, fouls, bestRun }) {
  const rating = rateClear({ cleared, shots, par, fouls });
  return {
    cleared,
    shots,
    par,
    fouls,
    bestRun: bestRun ?? 0,
    overPar: cleared ? Math.max(0, shots - par) : 0,
    ...rating,
  };
}

/** Run tiers used for combo feedback: 3 and 5 in a row step the motif up. */
export function runTier(run) {
  if (run >= 5) return 3;
  if (run >= 3) return 2;
  if (run >= 2) return 1;
  return 0;
}

export function duelScoreLine(wins, losses) {
  return { wins, losses, played: wins + losses };
}

/** Progress flag: clearing a table opens the next one. */
export function unlockedThrough(tableIds, results) {
  let idx = 0;
  for (let i = 0; i < tableIds.length; i += 1) {
    if (results?.[tableIds[i]]?.cleared) idx = Math.min(i + 1, tableIds.length - 1);
    else break;
  }
  return idx;
}

export function isTableUnlocked(tableIds, results, tableId) {
  const idx = tableIds.indexOf(tableId);
  if (idx <= 0) return true;
  return Boolean(results?.[tableIds[idx - 1]]?.cleared);
}
