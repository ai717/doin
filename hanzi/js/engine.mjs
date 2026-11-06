/**
 * Glyph Craft (字灵拆拆乐) - Pure Logic Engine
 * 100% Deterministic, DOM-free.
 * Implements DAG Glyph Alchemy, Radical Disassembly, Physical Reaction & Infinite Undo.
 */

import {
  GLYPH_TYPES,
  GLYPH_CATALOG,
  SYNTHESIS_RECIPES,
  DISASSEMBLY_RULES,
  OBSTACLE_REACTIONS
} from './data.mjs';

let uidCounter = 1;
export function generateUid(prefix = 'g') {
  return `${prefix}_${Date.now().toString(36)}_${uidCounter++}`;
}

export function createGlyphInstance(glyphId) {
  const meta = GLYPH_CATALOG[glyphId];
  if (!meta) {
    throw new Error(`Unknown glyph ID: ${glyphId}`);
  }
  return {
    uid: generateUid('glyph'),
    id: glyphId,
    char: meta.char,
    enName: meta.enName,
    icon: meta.icon,
    color: meta.color,
    element: meta.element
  };
}

export function cloneState(state) {
  return {
    levelId: state.levelId,
    steps: state.steps,
    won: state.won,
    discoveredGlyphs: new Set(state.discoveredGlyphs),
    trayGlyphs: state.trayGlyphs.map(g => ({ ...g })),
    obstacles: state.obstacles.map(o => ({ ...o })),
    hero: { ...state.hero },
    undoStack: [...state.undoStack]
  };
}

export function createInitialState(level) {
  const trayGlyphs = (level.initialGlyphs || []).map(gid => createGlyphInstance(gid));
  const obstacles = (level.obstacles || []).map(obs => ({
    id: obs.id,
    type: obs.type,
    x: obs.x,
    y: obs.y,
    nameKey: obs.nameKey,
    resolved: false,
    currentState: 'normal'
  }));

  const discoveredGlyphs = new Set();
  trayGlyphs.forEach(g => discoveredGlyphs.add(g.id));

  return {
    levelId: level.id,
    steps: 0,
    won: false,
    discoveredGlyphs,
    trayGlyphs,
    obstacles,
    hero: {
      x: level.hero.startX,
      y: level.hero.startY,
      targetX: level.hero.endX,
      targetY: level.hero.endY,
      hasReached: false
    },
    undoStack: []
  };
}

function pushUndoSnapshot(state) {
  const snapshot = {
    trayGlyphs: state.trayGlyphs.map(g => ({ ...g })),
    obstacles: state.obstacles.map(o => ({ ...o })),
    hero: { ...state.hero },
    steps: state.steps,
    won: state.won,
    discoveredGlyphs: new Set(state.discoveredGlyphs)
  };
  state.undoStack.push(snapshot);
}

/**
 * Can two glyph types be synthesized together?
 */
export function findSynthesisResult(typeA, typeB) {
  for (const recipe of SYNTHESIS_RECIPES) {
    const [r0, r1] = recipe.inputs;
    if ((r0 === typeA && r1 === typeB) || (r0 === typeB && r1 === typeA)) {
      return recipe.result;
    }
  }
  return null;
}

/**
 * Synthesize two glyphs in the tray
 */
export function synthesizeGlyphs(state, uidA, uidB) {
  if (state.won || uidA === uidB) return { success: false, reason: 'invalid_call' };

  const idxA = state.trayGlyphs.findIndex(g => g.uid === uidA);
  const idxB = state.trayGlyphs.findIndex(g => g.uid === uidB);
  if (idxA === -1 || idxB === -1) return { success: false, reason: 'glyph_not_found' };

  const glyphA = state.trayGlyphs[idxA];
  const glyphB = state.trayGlyphs[idxB];
  const resultType = findSynthesisResult(glyphA.id, glyphB.id);

  if (!resultType) {
    return { success: false, reason: 'no_recipe' };
  }

  pushUndoSnapshot(state);

  // Remove the two source glyphs
  const newTray = state.trayGlyphs.filter(g => g.uid !== uidA && g.uid !== uidB);
  const newGlyph = createGlyphInstance(resultType);
  newTray.push(newGlyph);

  state.trayGlyphs = newTray;
  state.steps += 1;
  state.discoveredGlyphs.add(resultType);

  return {
    success: true,
    action: 'synthesize',
    createdGlyph: newGlyph,
    sound: 'zither_chord'
  };
}

/**
 * Disassemble a compound glyph in the tray into its radicals
 */
export function disassembleGlyph(state, uid) {
  if (state.won) return { success: false, reason: 'game_won' };

  const idx = state.trayGlyphs.findIndex(g => g.uid === uid);
  if (idx === -1) return { success: false, reason: 'glyph_not_found' };

  const target = state.trayGlyphs[idx];
  const components = DISASSEMBLY_RULES[target.id];

  if (!components || components.length === 0) {
    return { success: false, reason: 'not_compound' };
  }

  pushUndoSnapshot(state);

  // Remove target compound and add component radicals
  const newTray = state.trayGlyphs.filter(g => g.uid !== uid);
  const newGlyphs = components.map(cid => createGlyphInstance(cid));
  newGlyphs.forEach(g => {
    newTray.push(g);
    state.discoveredGlyphs.add(g.id);
  });

  state.trayGlyphs = newTray;
  state.steps += 1;

  return {
    success: true,
    action: 'disassemble',
    createdGlyphs: newGlyphs,
    sound: 'slice_crack'
  };
}

/**
 * Slice / extract radicals from a stage obstacle (e.g. Forest obstacle)
 */
export function sliceSceneObstacle(state, obstacleId) {
  if (state.won) return { success: false, reason: 'game_won' };

  const obs = state.obstacles.find(o => o.id === obstacleId);
  if (!obs || obs.resolved) return { success: false, reason: 'obstacle_invalid' };

  const reaction = OBSTACLE_REACTIONS[obs.type];
  if (!reaction || !reaction.canDisassemble) {
    return { success: false, reason: 'cannot_disassemble' };
  }

  pushUndoSnapshot(state);

  // Resolve the obstacle by dismantling it
  obs.resolved = true;
  obs.currentState = 'dismantled';

  const yieldedGlyphs = reaction.disassembleYield.map(gid => createGlyphInstance(gid));
  yieldedGlyphs.forEach(g => {
    state.trayGlyphs.push(g);
    state.discoveredGlyphs.add(g.id);
  });

  state.steps += 1;
  checkLevelVictory(state);

  return {
    success: true,
    action: 'slice_obstacle',
    yieldedGlyphs,
    sound: 'slice_crack'
  };
}

/**
 * Drag and drop a glyph onto an obstacle in the stage
 */
export function applyGlyphToObstacle(state, glyphUid, obstacleId) {
  if (state.won) return { success: false, reason: 'game_won' };

  const glyphIdx = state.trayGlyphs.findIndex(g => g.uid === glyphUid);
  if (glyphIdx === -1) return { success: false, reason: 'glyph_not_found' };

  const obs = state.obstacles.find(o => o.id === obstacleId);
  if (!obs || obs.resolved) return { success: false, reason: 'obstacle_invalid' };

  const reaction = OBSTACLE_REACTIONS[obs.type];
  if (!reaction) return { success: false, reason: 'no_reaction' };

  const glyph = state.trayGlyphs[glyphIdx];
  const canTrigger = reaction.triggers.includes(glyph.id);

  if (!canTrigger) {
    return { success: false, reason: 'reaction_mismatch' };
  }

  pushUndoSnapshot(state);

  // Consume the glyph
  state.trayGlyphs.splice(glyphIdx, 1);

  // Resolve the obstacle
  obs.resolved = true;
  obs.currentState = reaction.resultState;
  state.steps += 1;

  // Check victory
  checkLevelVictory(state);

  return {
    success: true,
    action: 'reaction',
    reactionType: reaction.resultState,
    sound: reaction.effectSound,
    messageKey: reaction.messageKey
  };
}

function checkLevelVictory(state) {
  const allResolved = state.obstacles.every(o => o.resolved);
  if (allResolved) {
    state.won = true;
    state.hero.x = state.hero.targetX;
    state.hero.y = state.hero.targetY;
    state.hero.hasReached = true;
  }
}

/**
 * Undo last action
 */
export function undo(state) {
  if (state.undoStack.length === 0) {
    return { success: false, reason: 'empty_stack' };
  }

  const snapshot = state.undoStack.pop();
  state.trayGlyphs = snapshot.trayGlyphs;
  state.obstacles = snapshot.obstacles;
  state.hero = snapshot.hero;
  state.steps = snapshot.steps;
  state.won = snapshot.won;
  state.discoveredGlyphs = snapshot.discoveredGlyphs;

  return { success: true, action: 'undo' };
}
