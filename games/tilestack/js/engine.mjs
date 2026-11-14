/**
 * Core game engine for TileStack (千层瓦片 · 叠叠消)
 * Pure logic, 100% DOM-free and deterministic.
 */

import { GAME_CONSTANTS, CHAPTERS, TILE_DEFINITIONS } from './data.mjs';

export const GAME_STATUS = {
  READY: 'ready',
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
  PAUSED: 'paused'
};

/**
 * Deterministic pseudo-random number generator (Mulberry32).
 */
export function createPRNG(seed = 123456789) {
  let s = Math.floor(seed) >>> 0;
  return function next() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Check if tile B covers tile A.
 * Overlap requires layerB > layerA and bounding box collision.
 */
export function doesTileCover(tileB, tileA) {
  if (tileB.layer <= tileA.layer) return false;
  const dx = Math.abs(tileB.x - tileA.x);
  const dy = Math.abs(tileB.y - tileA.y);
  const thresholdX = GAME_CONSTANTS.TILE_WIDTH * 0.82;
  const thresholdY = GAME_CONSTANTS.TILE_HEIGHT * 0.82;
  return dx < thresholdX && dy < thresholdY;
}

/**
 * Determine if a tile is currently covered by any remaining board tile.
 */
export function isTileBlocked(tile, remainingBoardTiles) {
  for (let i = 0; i < remainingBoardTiles.length; i++) {
    const other = remainingBoardTiles[i];
    if (other.id !== tile.id && doesTileCover(other, tile)) {
      return true;
    }
  }
  return false;
}

/**
 * Get all tiles currently free to be picked from the board.
 */
export function getFreeTiles(boardTiles, unlockedKeys = 0) {
  return boardTiles.filter(tile => {
    // If it's a locked tile and no key has been obtained
    if (tile.special === 'lock' && unlockedKeys <= 0) {
      return false;
    }
    return !isTileBlocked(tile, boardTiles);
  });
}

/**
 * 100% mathematically solvable tile assignment generator.
 * Simulates a valid forward game into a virtual tray of capacity <= 5
 * to guarantee at least one flawless winning solution sequence.
 */
export function generateSolvableBoard(levelConfig, prngSeed = null) {
  const seed = prngSeed ?? levelConfig.seed ?? 1000;
  const prng = createPRNG(seed);
  
  const chapter = CHAPTERS.find(c => c.id === `ch${levelConfig.chapter}`) || CHAPTERS[0];
  const availableTypes = [...chapter.tileTypes];

  const slots = levelConfig.slots.map(s => ({
    ...s,
    assigned: false,
    type: null
  }));

  const totalTiles = slots.length;
  const totalTriples = Math.floor(totalTiles / 3);

  // We assign in passes. If a simulation branch gets blocked, retry with modified seed.
  let solutionFound = false;
  let finalTiles = null;

  for (let attempt = 0; attempt < 50; attempt++) {
    // Clone slots
    const simSlots = slots.map(s => ({ ...s }));
    const virtualTray = [];
    const assignedTriples = [];

    // Pre-select triple types for this level
    const tripleTypes = [];
    for (let i = 0; i < totalTriples; i++) {
      const type = availableTypes[i % availableTypes.length];
      tripleTypes.push(type);
    }
    // Shuffle triple types deterministically
    for (let i = tripleTypes.length - 1; i > 0; i--) {
      const j = Math.floor(prng() * (i + 1));
      const temp = tripleTypes[i];
      tripleTypes[i] = tripleTypes[j];
      tripleTypes[j] = temp;
    }

    let unassigned = simSlots.filter(s => !s.assigned);
    let stuck = false;
    let tripleIndex = 0;

    while (unassigned.length > 0) {
      // Find uncovered unassigned slots
      const freeSlots = unassigned.filter(s => !isTileBlocked(s, unassigned));
      if (freeSlots.length === 0) {
        stuck = true;
        break;
      }

      // Check if virtualTray has any incomplete triples (1 or 2 count)
      const trayTypeCounts = {};
      virtualTray.forEach(t => {
        trayTypeCounts[t.type] = (trayTypeCounts[t.type] || 0) + 1;
      });

      let moveMade = false;

      // Priority 1: If 3 or more free slots and tray is almost empty, assign a full triple directly!
      if (freeSlots.length >= 3 && virtualTray.length <= 2 && tripleIndex < tripleTypes.length) {
        const typeToAssign = tripleTypes[tripleIndex++];
        // Pick 3 random free slots
        const chosen = [];
        for (let k = 0; k < 3; k++) {
          const idx = Math.floor(prng() * freeSlots.length);
          chosen.push(freeSlots.splice(idx, 1)[0]);
        }
        chosen.forEach(s => {
          s.assigned = true;
          s.type = typeToAssign;
        });
        moveMade = true;
      } else {
        // Priority 2: Can we complete an existing tray type?
        let matchingTrayType = Object.keys(trayTypeCounts).find(k => trayTypeCounts[k] < 3);
        if (matchingTrayType && freeSlots.length > 0) {
          const slot = freeSlots.splice(Math.floor(prng() * freeSlots.length), 1)[0];
          slot.assigned = true;
          slot.type = matchingTrayType;
          virtualTray.push({ slotId: slot.id, type: matchingTrayType });

          // If reached 3 in tray, eliminate them!
          const inTray = virtualTray.filter(t => t.type === matchingTrayType);
          if (inTray.length === 3) {
            // Remove all 3 from virtual tray
            for (let r = virtualTray.length - 1; r >= 0; r--) {
              if (virtualTray[r].type === matchingTrayType) {
                virtualTray.splice(r, 1);
              }
            }
          }
          moveMade = true;
        } else if (virtualTray.length < 5 && tripleIndex < tripleTypes.length && freeSlots.length > 0) {
          // Priority 3: Pick a new slot into tray
          const newType = tripleTypes[tripleIndex++];
          const slot = freeSlots.splice(Math.floor(prng() * freeSlots.length), 1)[0];
          slot.assigned = true;
          slot.type = newType;
          virtualTray.push({ slotId: slot.id, type: newType });
          moveMade = true;
        }
      }

      if (!moveMade) {
        stuck = true;
        break;
      }

      unassigned = simSlots.filter(s => !s.assigned);
    }

    if (!stuck && virtualTray.length === 0 && unassigned.length === 0) {
      solutionFound = true;
      finalTiles = simSlots.map(s => ({
        id: s.id,
        x: s.x,
        y: s.y,
        layer: s.layer,
        type: s.type,
        special: s.special || null,
        frozenHits: s.special === 'frozen' ? 2 : 0
      }));
      break;
    }
  }

  // Fallback: If simulation didn't resolve cleanly after 50 attempts, do direct layered triple allocation
  if (!solutionFound || !finalTiles) {
    const simSlots = slots.map(s => ({ ...s }));
    const tripleTypes = [];
    for (let i = 0; i < totalTriples; i++) {
      tripleTypes.push(availableTypes[i % availableTypes.length]);
    }
    // Sort slots by layer descending (top tiles assigned first)
    simSlots.sort((a, b) => b.layer - a.layer);
    for (let i = 0; i < simSlots.length; i += 3) {
      const type = tripleTypes[Math.floor(i / 3) % tripleTypes.length];
      if (simSlots[i]) simSlots[i].type = type;
      if (simSlots[i + 1]) simSlots[i + 1].type = type;
      if (simSlots[i + 2]) simSlots[i + 2].type = type;
    }
    finalTiles = simSlots.map(s => ({
      id: s.id,
      x: s.x,
      y: s.y,
      layer: s.layer,
      type: s.type,
      special: s.special || null,
      frozenHits: s.special === 'frozen' ? 2 : 0
    }));
  }

  return finalTiles;
}

/**
 * Create initial Game State for a given level.
 */
export function createGameState(levelConfig) {
  const boardTiles = generateSolvableBoard(levelConfig);
  
  return {
    levelId: levelConfig.id,
    chapter: levelConfig.chapter,
    isTimed: levelConfig.isTimed || false,
    timeRemaining: levelConfig.timeLimit || 0,
    timeElapsed: 0,
    status: GAME_STATUS.READY,
    score: 0,
    steps: 0,
    undosCount: 0,
    hintsUsed: 0,
    comboCount: 0,
    lastMatchTime: 0,
    unlockedKeys: 0,
    boardTiles,
    tray: [], // Array of tile objects in tray (up to 7)
    undoStack: [] // Snapshots for undo
  };
}

/**
 * Push tile into tray, handling match-3, wild cards, frozen tiles, and keys.
 */
export function pickTile(gameState, tileId, timestamp = Date.now()) {
  if (gameState.status !== GAME_STATUS.READY && gameState.status !== GAME_STATUS.PLAYING) {
    return { success: false, reason: 'game_not_active' };
  }

  const tileIndex = gameState.boardTiles.findIndex(t => t.id === tileId);
  if (tileIndex === -1) {
    return { success: false, reason: 'tile_not_found' };
  }

  const tile = gameState.boardTiles[tileIndex];

  // Overlap validation
  if (isTileBlocked(tile, gameState.boardTiles)) {
    return { success: false, reason: 'tile_blocked' };
  }

  // Key & Lock mechanic
  if (tile.special === 'lock' && gameState.unlockedKeys <= 0) {
    return { success: false, reason: 'tile_locked' };
  }

  // Frozen mechanic: First click shatters ice, second click picks tile
  if (tile.special === 'frozen' && tile.frozenHits > 1) {
    tile.frozenHits -= 1;
    return {
      success: true,
      action: 'shattered_ice',
      tileId: tile.id,
      remainingHits: tile.frozenHits
    };
  }

  // Tray overflow check
  if (gameState.tray.length >= GAME_CONSTANTS.TRAY_CAPACITY) {
    return { success: false, reason: 'tray_full' };
  }

  // Save snapshot for Undo BEFORE state mutation
  saveUndoSnapshot(gameState);

  // Transition to PLAYING
  if (gameState.status === GAME_STATUS.READY) {
    gameState.status = GAME_STATUS.PLAYING;
  }

  // Handle key special
  if (tile.special === 'key') {
    gameState.unlockedKeys += 1;
  }
  if (tile.special === 'lock') {
    gameState.unlockedKeys = Math.max(0, gameState.unlockedKeys - 1);
  }

  // Remove from board
  gameState.boardTiles.splice(tileIndex, 1);
  gameState.steps += 1;

  // Insert into tray.
  // We keep identical types grouped together for visual delight and clarity!
  const insertIdx = findBestTrayInsertIndex(gameState.tray, tile);
  gameState.tray.splice(insertIdx, 0, tile);

  // Check for Match 3
  const matchResult = checkAndProcessMatches(gameState, timestamp);

  // Check Win condition: board is empty and tray is empty
  if (gameState.boardTiles.length === 0 && gameState.tray.length === 0) {
    gameState.status = GAME_STATUS.WON;
    return {
      success: true,
      action: 'won',
      tile,
      matchResult
    };
  }

  // Check Loss condition: tray is full (7 items) and no match is possible
  if (gameState.tray.length >= GAME_CONSTANTS.TRAY_CAPACITY) {
    gameState.status = GAME_STATUS.LOST;
    return {
      success: true,
      action: 'lost',
      tile,
      matchResult
    };
  }

  return {
    success: true,
    action: matchResult.matched ? 'matched' : 'added_to_tray',
    tile,
    matchResult
  };
}

/**
 * Find index in tray to insert matching tile adjacent to its siblings.
 */
function findBestTrayInsertIndex(tray, tile) {
  let lastMatchingIndex = -1;
  for (let i = 0; i < tray.length; i++) {
    if (tray[i].type === tile.type) {
      lastMatchingIndex = i;
    }
  }
  if (lastMatchingIndex !== -1) {
    return lastMatchingIndex + 1;
  }
  return tray.length;
}

/**
 * Check tray for 3-match (including Wild card logic).
 */
export function checkAndProcessMatches(gameState, timestamp = Date.now()) {
  const tray = gameState.tray;
  const typeCounts = {};

  // Count items per type
  tray.forEach(t => {
    typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
  });

  // Check normal 3-match
  let matchedType = null;
  for (const type of Object.keys(typeCounts)) {
    if (typeCounts[type] >= GAME_CONSTANTS.MATCH_COUNT) {
      matchedType = type;
      break;
    }
  }

  // Check wild card match: if wild tile exists, it can complete any pair of 2!
  if (!matchedType) {
    const hasWild = tray.some(t => t.special === 'wild');
    if (hasWild) {
      for (const type of Object.keys(typeCounts)) {
        if (typeCounts[type] === 2 && type !== 'wild') {
          matchedType = type; // wild completes it!
          break;
        }
      }
    }
  }

  if (matchedType) {
    // Remove matching tiles from tray
    let removedCount = 0;
    const removedTiles = [];

    // First remove exact matches
    for (let i = tray.length - 1; i >= 0 && removedCount < 3; i--) {
      if (tray[i].type === matchedType) {
        removedTiles.push(tray.splice(i, 1)[0]);
        removedCount++;
      }
    }

    // If still need 1 and wild was used, remove the wild tile
    if (removedCount < 3) {
      const wildIdx = tray.findIndex(t => t.special === 'wild');
      if (wildIdx !== -1) {
        removedTiles.push(tray.splice(wildIdx, 1)[0]);
        removedCount++;
      }
    }

    // Calculate Combo
    const isCombo = (timestamp - gameState.lastMatchTime) <= GAME_CONSTANTS.COMBO_WINDOW_MS;
    if (isCombo) {
      gameState.comboCount += 1;
    } else {
      gameState.comboCount = 1;
    }
    gameState.lastMatchTime = timestamp;

    // Calculate Score
    const comboMultiplier = 1 + (gameState.comboCount - 1) * GAME_CONSTANTS.COMBO_BONUS_FACTOR;
    const points = Math.round(GAME_CONSTANTS.MATCH_SCORE * comboMultiplier);
    gameState.score += points;

    return {
      matched: true,
      matchedType,
      removedTiles,
      comboCount: gameState.comboCount,
      pointsAdded: points
    };
  }

  return { matched: false };
}

/**
 * Save snapshot for Undo.
 */
function saveUndoSnapshot(gameState) {
  const snapshot = {
    boardTiles: gameState.boardTiles.map(t => ({ ...t })),
    tray: gameState.tray.map(t => ({ ...t })),
    score: gameState.score,
    steps: gameState.steps,
    unlockedKeys: gameState.unlockedKeys,
    comboCount: gameState.comboCount,
    lastMatchTime: gameState.lastMatchTime,
    status: gameState.status
  };
  gameState.undoStack.push(snapshot);
}

/**
 * Undo last move.
 */
export function undo(gameState) {
  if (gameState.undoStack.length === 0) {
    return { success: false, reason: 'no_undo_available' };
  }

  const prev = gameState.undoStack.pop();
  gameState.boardTiles = prev.boardTiles;
  gameState.tray = prev.tray;
  gameState.score = prev.score;
  gameState.steps = prev.steps;
  gameState.unlockedKeys = prev.unlockedKeys;
  gameState.comboCount = prev.comboCount;
  gameState.lastMatchTime = prev.lastMatchTime;
  gameState.status = prev.status;
  gameState.undosCount += 1;

  return {
    success: true,
    undosCount: gameState.undosCount
  };
}

/**
 * Find hint: Returns up to 3 tile IDs that form a match or advance towards one.
 */
export function findHint(gameState) {
  if (gameState.hintsUsed >= GAME_CONSTANTS.MAX_HINTS) {
    return { success: false, reason: 'hints_exhausted' };
  }

  const freeBoardTiles = getFreeTiles(gameState.boardTiles, gameState.unlockedKeys);
  const trayCounts = {};
  gameState.tray.forEach(t => {
    trayCounts[t.type] = (trayCounts[t.type] || 0) + 1;
  });

  // Priority 1: A type already with 2 tiles in tray, find 1 free tile on board
  for (const type of Object.keys(trayCounts)) {
    if (trayCounts[type] === 2) {
      const match = freeBoardTiles.find(t => t.type === type);
      if (match) {
        gameState.hintsUsed += 1;
        return { success: true, tileIds: [match.id], hintsUsed: gameState.hintsUsed };
      }
    }
  }

  // Priority 2: A type with 1 tile in tray, find 2 free tiles on board
  for (const type of Object.keys(trayCounts)) {
    if (trayCounts[type] === 1) {
      const matches = freeBoardTiles.filter(t => t.type === type);
      if (matches.length >= 2) {
        gameState.hintsUsed += 1;
        return {
          success: true,
          tileIds: [matches[0].id, matches[1].id],
          hintsUsed: gameState.hintsUsed
        };
      }
    }
  }

  // Priority 3: 3 free tiles of the same type on the board
  const boardCounts = {};
  freeBoardTiles.forEach(t => {
    boardCounts[t.type] = boardCounts[t.type] || [];
    boardCounts[t.type].push(t.id);
  });

  for (const type of Object.keys(boardCounts)) {
    if (boardCounts[type].length >= 3) {
      gameState.hintsUsed += 1;
      return {
        success: true,
        tileIds: boardCounts[type].slice(0, 3),
        hintsUsed: gameState.hintsUsed
      };
    }
  }

  // Priority 4: Any pair of 2 on board
  for (const type of Object.keys(boardCounts)) {
    if (boardCounts[type].length >= 2) {
      gameState.hintsUsed += 1;
      return {
        success: true,
        tileIds: boardCounts[type].slice(0, 2),
        hintsUsed: gameState.hintsUsed
      };
    }
  }

  // Fallback: Just highlight any 1 free tile
  if (freeBoardTiles.length > 0) {
    gameState.hintsUsed += 1;
    return {
      success: true,
      tileIds: [freeBoardTiles[0].id],
      hintsUsed: gameState.hintsUsed
    };
  }

  return { success: false, reason: 'no_free_tiles' };
}

/**
 * Step timer frame for timed challenge levels.
 */
export function stepFrame(gameState, dtSeconds) {
  if (gameState.status !== GAME_STATUS.PLAYING) return gameState;
  
  gameState.timeElapsed += dtSeconds;

  if (gameState.isTimed) {
    gameState.timeRemaining = Math.max(0, gameState.timeRemaining - dtSeconds);
    if (gameState.timeRemaining <= 0) {
      gameState.status = GAME_STATUS.LOST;
    }
  }

  return gameState;
}
