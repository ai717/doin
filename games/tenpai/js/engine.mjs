/**
 * Core Mahjong engine and Tenpai solver for Tenpai King · Wait Finder (雀神听牌王 · 听牌速判)
 * Pure logic, 100% DOM-free, deterministic and fast.
 */

import { TILES, FAN_DEFINITIONS } from './data.mjs';

export const ALL_TILE_IDS = Object.keys(TILES);

/**
 * Parse tile id into suit and value: '3m' -> { suit: 'm', value: 3 }
 */
export function parseTile(tileId) {
  const suit = tileId.slice(-1);
  const value = parseInt(tileId.slice(0, -1), 10);
  return { suit, value, id: tileId };
}

/**
 * Sort tiles in standard Mahjong order: 万 (m) -> 筒 (p) -> 条 (s) -> 字 (z), each by value.
 */
export function sortTiles(tiles) {
  const suitOrder = { m: 1, p: 2, s: 3, z: 4 };
  return [...tiles].sort((a, b) => {
    const pa = parseTile(a);
    const pb = parseTile(b);
    if (pa.suit !== pb.suit) {
      return suitOrder[pa.suit] - suitOrder[pb.suit];
    }
    return pa.value - pb.value;
  });
}

/**
 * Count occurrences of each tile in an array.
 */
export function countTiles(tiles) {
  const counts = {};
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    counts[t] = (counts[t] || 0) + 1;
  }
  return counts;
}

/**
 * Check if 14 tiles form Seven Pairs (七对子).
 */
export function isSevenPairs(counts) {
  const keys = Object.keys(counts);
  if (keys.length !== 7) return false;
  return keys.every(k => counts[k] === 2);
}

/**
 * Check if 14 tiles form Thirteen Orphans (十三幺 / 国士无双).
 */
export function isThirteenOrphans(counts) {
  const required = ['1m', '9m', '1p', '9p', '1s', '9s', '1z', '2z', '3z', '4z', '5z', '6z', '7z'];
  let hasPair = false;
  for (let i = 0; i < required.length; i++) {
    const id = required[i];
    const c = counts[id] || 0;
    if (c === 0) return false;
    if (c === 2) hasPair = true;
    if (c > 2) return false;
  }
  return hasPair && Object.keys(counts).length === 13;
}

/**
 * Standard 4 Melds + 1 Pair recursive solver.
 * Finds if remaining tiles can be completely decomposed into Chows and Pungs.
 */
function canFormMelds(counts, meldsAccum = []) {
  // Find first available tile in sorted order
  const remainingKeys = Object.keys(counts).filter(k => counts[k] > 0);
  if (remainingKeys.length === 0) {
    return { valid: true, melds: meldsAccum };
  }

  const sortedKeys = sortTiles(remainingKeys);
  const first = sortedKeys[0];
  const { suit, value } = parseTile(first);

  // Option 1: Try Pung (刻子) if count >= 3
  if (counts[first] >= 3) {
    counts[first] -= 3;
    meldsAccum.push({ type: 'pung', tiles: [first, first, first] });
    const res = canFormMelds(counts, meldsAccum);
    if (res.valid) return res;
    // Backtrack
    meldsAccum.pop();
    counts[first] += 3;
  }

  // Option 2: Try Chow (顺子) if suited and has next 2 consecutive tiles
  if (suit !== 'z' && value <= 7) {
    const second = `${value + 1}${suit}`;
    const third = `${value + 2}${suit}`;
    if ((counts[second] || 0) > 0 && (counts[third] || 0) > 0) {
      counts[first] -= 1;
      counts[second] -= 1;
      counts[third] -= 1;
      meldsAccum.push({ type: 'chow', tiles: [first, second, third] });
      const res = canFormMelds(counts, meldsAccum);
      if (res.valid) return res;
      // Backtrack
      meldsAccum.pop();
      counts[first] += 1;
      counts[second] += 1;
      counts[third] += 1;
    }
  }

  return { valid: false, melds: [] };
}

/**
 * Check if a 14-tile hand is a winning hand (Hu / Agari).
 * Returns { isWin: boolean, shape: string, pair: string, melds: Array }
 */
export function checkWinningHand(tiles14) {
  if (tiles14.length !== 14) return { isWin: false };

  const counts = countTiles(tiles14);

  // Check Thirteen Orphans
  if (isThirteenOrphans(counts)) {
    return {
      isWin: true,
      shape: 'thirteen_orphans',
      pair: null,
      melds: []
    };
  }

  // Check Seven Pairs
  if (isSevenPairs(counts)) {
    return {
      isWin: true,
      shape: 'seven_pairs',
      pair: null,
      melds: Object.keys(counts).map(k => ({ type: 'pair', tiles: [k, k] }))
    };
  }

  // Standard 4 Melds + 1 Pair
  const possiblePairs = Object.keys(counts).filter(k => counts[k] >= 2);

  for (let i = 0; i < possiblePairs.length; i++) {
    const pairTile = possiblePairs[i];
    const countsClone = { ...counts };
    countsClone[pairTile] -= 2;

    const meldRes = canFormMelds(countsClone, []);
    if (meldRes.valid) {
      return {
        isWin: true,
        shape: 'standard',
        pair: pairTile,
        melds: meldRes.melds
      };
    }
  }

  return { isWin: false };
}

/**
 * Given a 13-tile hand, find ALL winning tiles (Tenpai Waits).
 * Returns array of tile IDs, e.g. ['2s', '5s']
 */
export function findWaits(hand13) {
  const waits = [];

  // Determine candidate tiles to test
  // To be complete and robust, we can test all 34 tiles (takes < 2ms)
  for (let i = 0; i < ALL_TILE_IDS.length; i++) {
    const candidate = ALL_TILE_IDS[i];
    const handCounts = countTiles(hand13);
    // Can only wait for tiles where player currently holds < 4
    if ((handCounts[candidate] || 0) >= 4) continue;

    const test14 = [...hand13, candidate];
    const winRes = checkWinningHand(test14);
    if (winRes.isWin) {
      waits.push(candidate);
    }
  }

  return sortTiles(waits);
}

/**
 * Evaluate Fan and value for a winning 14-tile hand.
 */
export function evaluateHandFan(hand13, winningTile) {
  const hand14 = [...hand13, winningTile];
  const winCheck = checkWinningHand(hand14);
  if (!winCheck.isWin) {
    return { totalFan: 0, fanList: [], primaryShape: 'none' };
  }

  const fanList = [];
  const counts = countTiles(hand14);
  const suitsPresent = new Set();
  let hasTerminalsOrHonors = false;

  for (const t of hand14) {
    const p = parseTile(t);
    suitsPresent.add(p.suit);
    if (p.suit === 'z' || p.value === 1 || p.value === 9) {
      hasTerminalsOrHonors = true;
    }
  }

  // 1. Thirteen Orphans
  if (winCheck.shape === 'thirteen_orphans') {
    fanList.push(FAN_DEFINITIONS.shisanyao);
    return { totalFan: 13, fanList, primaryShape: 'thirteen_orphans' };
  }

  // 2. Nine Gates: 1112345678999 + any same suit
  if (suitsPresent.size === 1 && !suitsPresent.has('z')) {
    const suit = [...suitsPresent][0];
    const vals = hand14.map(t => parseTile(t).value);
    const vCounts = {};
    vals.forEach(v => { vCounts[v] = (vCounts[v] || 0) + 1; });
    const isNineGates = vCounts[1] >= 3 && vCounts[9] >= 3 &&
      [2, 3, 4, 5, 6, 7, 8].every(v => (vCounts[v] || 0) >= 1);
    if (isNineGates) {
      fanList.push(FAN_DEFINITIONS.jiulian);
      return { totalFan: 13, fanList, primaryShape: 'jiulian' };
    }
  }

  // 3. Full Flush: 6 fan
  const isQingyise = suitsPresent.size === 1 && !suitsPresent.has('z');
  if (isQingyise) {
    fanList.push(FAN_DEFINITIONS.qingyise);
  }

  // 4. Half Flush: 3 fan
  const isHunyise = suitsPresent.size === 2 && suitsPresent.has('z');
  if (isHunyise) {
    fanList.push(FAN_DEFINITIONS.hunyise);
  }

  // 5. Seven Pairs: 4 fan
  if (winCheck.shape === 'seven_pairs') {
    fanList.push(FAN_DEFINITIONS.qidui);
  }

  // 6. All Pungs: 2 fan
  if (winCheck.shape === 'standard') {
    const isAllPungs = winCheck.melds.every(m => m.type === 'pung');
    if (isAllPungs) {
      fanList.push(FAN_DEFINITIONS.pengpenghu);
    }
  }

  // 7. All Simples: 1 fan
  if (!hasTerminalsOrHonors) {
    fanList.push(FAN_DEFINITIONS.duanyao);
  }

  // 8. All Chows: 1 fan
  if (winCheck.shape === 'standard') {
    const isAllChows = winCheck.melds.every(m => m.type === 'chow');
    const pairParsed = winCheck.pair ? parseTile(winCheck.pair) : null;
    const isNonHonorPair = pairParsed && pairParsed.suit !== 'z';
    if (isAllChows && isNonHonorPair) {
      fanList.push(FAN_DEFINITIONS.pinghu);
    }
  }

  // Minimum base 1 fan if won without special fans
  if (fanList.length === 0) {
    fanList.push(FAN_DEFINITIONS.base_fan);
  }

  const totalFan = fanList.reduce((acc, f) => acc + f.fan, 0);

  return {
    totalFan,
    fanList,
    primaryShape: winCheck.shape,
    pair: winCheck.pair,
    melds: winCheck.melds
  };
}

/**
 * Analyze all waits and find the highest-scoring wait tile.
 */
export function analyzeAllWaitsWithFan(hand13) {
  const waits = findWaits(hand13);
  let maxFan = 0;
  let bestWait = null;
  const waitDetails = [];

  for (const wait of waits) {
    const evalResult = evaluateHandFan(hand13, wait);
    waitDetails.push({
      tileId: wait,
      fan: evalResult.totalFan,
      fanList: evalResult.fanList,
      pair: evalResult.pair,
      melds: evalResult.melds
    });
    if (evalResult.totalFan > maxFan) {
      maxFan = evalResult.totalFan;
      bestWait = wait;
    }
  }

  return {
    waits,
    waitDetails,
    maxFan,
    bestWait
  };
}
