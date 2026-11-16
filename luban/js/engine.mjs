/**
 * Core lock engine and mortise solver for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * Pure logic, 100% DOM-free, deterministic and verified.
 */

import { GAME_CONSTANTS } from './data.mjs';

export const GAME_STATUS = {
  READY: 'ready',
  PLAYING: 'playing',
  WON: 'won'
};

/**
 * Check if a block is free to slide out from the lock.
 * A block can slide out if none of the blocks listed in its blockedBy array
 * are present in the currently remaining blocks.
 */
export function canBlockMove(block, remainingBlocks) {
  const remainingIds = new Set(remainingBlocks.map(b => b.id));
  const activeBlockers = block.blockedBy.filter(bId => remainingIds.has(bId));

  if (activeBlockers.length === 0) {
    return { canMove: true, blockers: [] };
  }
  return { canMove: false, blockers: activeBlockers };
}

/**
 * Find all blocks that can currently be legally slid out.
 */
export function getMovableBlocks(remainingBlocks) {
  return remainingBlocks.filter(b => canBlockMove(b, remainingBlocks).canMove);
}

/**
 * Initialize game state for a given level configuration.
 */
export function createGameState(levelConfig) {
  return {
    levelId: levelConfig.id,
    chapter: levelConfig.chapter,
    totalPieces: levelConfig.pieceCount,
    optimalMoves: levelConfig.optimalMoves,
    remainingBlocks: levelConfig.blocks.map(b => ({ ...b })),
    extractedBlocks: [],
    steps: 0,
    hintsUsed: 0,
    status: GAME_STATUS.READY,
    viewAngle: 0, // 0, 90, 180, 270
    undoStack: []
  };
}

/**
 * Attempt to remove/slide a block out of the lock.
 */
export function tryExtractBlock(gameState, blockId) {
  if (gameState.status === GAME_STATUS.WON) {
    return { success: false, reason: 'game_already_won' };
  }

  const blockIndex = gameState.remainingBlocks.findIndex(b => b.id === blockId);
  if (blockIndex === -1) {
    return { success: false, reason: 'block_not_found' };
  }

  const block = gameState.remainingBlocks[blockIndex];
  const moveCheck = canBlockMove(block, gameState.remainingBlocks);

  if (!moveCheck.canMove) {
    return {
      success: false,
      reason: 'blocked',
      block,
      blockers: moveCheck.blockers
    };
  }

  // Save snapshot for Undo BEFORE mutating state
  saveUndoSnapshot(gameState);

  if (gameState.status === GAME_STATUS.READY) {
    gameState.status = GAME_STATUS.PLAYING;
  }

  // Extract block
  const extracted = gameState.remainingBlocks.splice(blockIndex, 1)[0];
  gameState.extractedBlocks.push(extracted);
  gameState.steps += 1;

  // Check Win condition: all blocks extracted!
  const isWon = gameState.remainingBlocks.length === 0;
  if (isWon) {
    gameState.status = GAME_STATUS.WON;
  }

  return {
    success: true,
    block: extracted,
    isWon,
    remainingCount: gameState.remainingBlocks.length
  };
}

/**
 * Undo last block extraction.
 */
export function undo(gameState) {
  if (gameState.undoStack.length === 0) {
    return { success: false, reason: 'no_undo_available' };
  }

  const snapshot = gameState.undoStack.pop();
  gameState.remainingBlocks = snapshot.remainingBlocks;
  gameState.extractedBlocks = snapshot.extractedBlocks;
  gameState.steps = snapshot.steps;
  gameState.status = snapshot.status;

  return {
    success: true,
    remainingCount: gameState.remainingBlocks.length
  };
}

/**
 * Find hint: returns which block(s) can be removed right now.
 */
export function findHint(gameState) {
  if (gameState.status === GAME_STATUS.WON) {
    return { success: false, reason: 'game_already_won' };
  }

  const movables = getMovableBlocks(gameState.remainingBlocks);
  if (movables.length === 0) {
    return { success: false, reason: 'no_movable_blocks' };
  }

  gameState.hintsUsed += 1;
  return {
    success: true,
    movableBlockIds: movables.map(b => b.id),
    recommendedBlockId: movables[0].id,
    hintsUsed: gameState.hintsUsed
  };
}

/**
 * Rotate the isometric camera view by 90 degrees.
 */
export function rotateViewAngle(gameState, direction = 1) {
  const angles = GAME_CONSTANTS.ISOMETRIC_ANGLES;
  let idx = angles.indexOf(gameState.viewAngle);
  if (idx === -1) idx = 0;

  idx = (idx + direction + angles.length) % angles.length;
  gameState.viewAngle = angles[idx];
  return gameState.viewAngle;
}

function saveUndoSnapshot(gameState) {
  const snapshot = {
    remainingBlocks: gameState.remainingBlocks.map(b => ({ ...b })),
    extractedBlocks: gameState.extractedBlocks.map(b => ({ ...b })),
    steps: gameState.steps,
    status: gameState.status
  };
  gameState.undoStack.push(snapshot);
}
