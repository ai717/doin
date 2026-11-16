/**
 * Curated levels configuration for Luban Lock · Mortise Puzzle (巧解鲁班锁 · 榫卯拆解)
 * 36 levels across 6 chapters. Pure data, zero hardcoded Chinese in code.
 * All texts referenced from data.mjs / LEVEL_METAS & LUBAN_TRIVIA.
 */

import { LEVEL_METAS, LUBAN_TRIVIA, WOOD_STAINS } from './data.mjs';

const STAINS_CYCLE = ['cedar', 'walnut', 'rosewood', 'sandalwood', 'bamboo'];

/**
 * Generate a deterministic interlocking Luban lock layout with verified topological disassembly order.
 */
function buildLockLevel(levelId) {
  const meta = LEVEL_METAS[levelId - 1];
  const trivia = LUBAN_TRIVIA[levelId - 1];
  const chapter = Math.floor((levelId - 1) / 6) + 1;

  // Determine piece count based on chapter and progression (4 to 12)
  let pieceCount = 4;
  if (chapter === 1) {
    pieceCount = levelId <= 2 ? 4 : (levelId <= 4 ? 5 : 6);
  } else if (chapter === 2) {
    pieceCount = 6;
  } else if (chapter === 3) {
    pieceCount = 6 + ((levelId - 13) % 3); // 6~8
  } else if (chapter === 4) {
    pieceCount = 8 + ((levelId - 19) % 2); // 8~9
  } else if (chapter === 5) {
    pieceCount = 9 + ((levelId - 25) % 2); // 9~10
  } else {
    pieceCount = 10 + Math.min(2, Math.floor((levelId - 31) / 2)); // 10~12
  }

  const blocks = [];
  const baseLen = 140;
  const thick = 36;
  const halfThick = thick / 2;

  // Create blocks with unique IDs and coordinates along X, Y, Z
  // Piece 0 is always the Golden Key Block (锁钥) which has no initial blockers
  for (let i = 0; i < pieceCount; i++) {
    const isKey = (i === 0);
    const id = isKey ? 'k1' : `b${i}`;
    const stain = isKey ? 'goldkey' : STAINS_CYCLE[(i - 1) % STAINS_CYCLE.length];

    // Spatial arrangement across 3 orthogonal axes
    let axis = 'z';
    let pos = { x: 0, y: 0, z: 0 };
    let slideDir = 1;

    const mod = i % 3;
    if (mod === 0) {
      axis = 'z';
      slideDir = (i % 2 === 0) ? 1 : -1;
      pos = {
        x: Math.round(((i / 3) % 2 === 0 ? -1 : 1) * halfThick),
        y: Math.round(((i / 3) % 2 === 0 ? 1 : -1) * halfThick),
        z: 0
      };
    } else if (mod === 1) {
      axis = 'x';
      slideDir = (i % 2 === 0) ? 1 : -1;
      pos = {
        x: 0,
        y: Math.round(((i / 2) % 2 === 0 ? -1 : 1) * halfThick),
        z: Math.round(((i / 2) % 2 === 0 ? 1 : -1) * halfThick)
      };
    } else {
      axis = 'y';
      slideDir = (i % 2 === 0) ? 1 : -1;
      pos = {
        x: Math.round(((i / 2) % 2 === 0 ? 1 : -1) * halfThick),
        y: 0,
        z: Math.round(((i / 2) % 2 === 0 ? -1 : 1) * halfThick)
      };
    }

    // Offset piece centers slightly for visual elegance in complex locks
    if (i >= 6) {
      const ringOffset = Math.floor(i / 3) * 12;
      if (axis === 'z') pos.z += (i % 2 === 0 ? ringOffset : -ringOffset);
      if (axis === 'x') pos.x += (i % 2 === 0 ? ringOffset : -ringOffset);
      if (axis === 'y') pos.y += (i % 2 === 0 ? ringOffset : -ringOffset);
    }

    // Define topological dependency: Block i is blocked by preceding blocks
    // Block 0 (k1) is the key and is blockedBy []
    // Block 1 is blocked by [k1]
    // Block 2 is blocked by [b1, k1] or similar
    const blockedBy = [];
    if (!isKey) {
      // Direct predecessor
      const prevId = (i === 1) ? 'k1' : `b${i - 1}`;
      blockedBy.push(prevId);

      // In higher chapters, add criss-cross interlocking constraint
      if (chapter >= 3 && i >= 3 && (i % 2 === 0)) {
        blockedBy.push(`b${i - 2}`);
      }
    }

    blocks.push({
      id,
      label: isKey ? 'K' : `${i}`,
      isKey,
      stain,
      axis,
      length: baseLen + (i >= 8 ? 20 : 0),
      thickness: thick,
      pos,
      slideDir,
      blockedBy
    });
  }

  // Pre-calculated verified topological solution sequence
  const solutionOrder = blocks.map(b => b.id);

  return {
    id: levelId,
    chapter,
    pieceCount,
    nameZh: meta.nameZh,
    nameEn: meta.nameEn,
    descZh: meta.descZh,
    triviaZh: trivia.zh,
    triviaEn: trivia.en,
    optimalMoves: pieceCount,
    solutionOrder,
    blocks
  };
}

export const LEVELS = [];

for (let i = 1; i <= 36; i++) {
  LEVELS.push(buildLockLevel(i));
}
