// Spider Solitaire Heuristic Solver & Solvability Checker
// Used to verify that deals are playable, make progress, and reach completion.

import { SpiderEngine, cloneColumns, cloneCards } from './engine.mjs';

/**
 * State hash for transposition detection in solver.
 */
function hashState(columns, stockLength, completedRunsCount) {
  const colStrs = columns.map((col) => {
    return col
      .map((c) => (c.faceUp ? `${c.suit[0]}${c.rank}` : '?'))
      .join(',');
  });
  return `${stockLength}|${completedRunsCount}|${colStrs.sort().join(';')}`;
}

/**
 * Evaluates board quality.
 * Higher score = closer to victory.
 */
function evaluateState(engine) {
  let score = engine.completedRuns.length * 5000;

  for (let c = 0; c < 10; c++) {
    const col = engine.columns[c];
    if (col.length === 0) {
      score += 200; // Empty column is super valuable
      continue;
    }

    let faceDownCount = 0;
    for (const card of col) {
      if (!card.faceUp) faceDownCount++;
    }
    // Penalize face-down cards
    score -= faceDownCount * 30;

    // Reward same-suit descending sequences
    for (let i = 0; i < col.length - 1; i++) {
      if (col[i].faceUp && col[i + 1].faceUp) {
        if (col[i].rank === col[i + 1].rank + 1) {
          if (col[i].suit === col[i + 1].suit) {
            score += 40; // Same-suit connection
          } else {
            score += 10; // Off-suit connection
          }
        }
      }
    }
  }

  return score;
}

/**
 * Searches for solution or verifies clearability with a greedy best-first / heuristic search.
 * @param {SpiderEngine} engine Initialized engine
 * @param {number} maxIterations Search budget
 * @returns {{ solved: boolean, completedRuns: number, steps: number }}
 */
export function solveSpider(engine, maxIterations = 600) {
  const visited = new Set();
  let iterations = 0;
  let steps = 0;

  while (iterations < maxIterations) {
    iterations++;

    if (engine.isWon) {
      return { solved: true, completedRuns: engine.completedRuns.length, steps };
    }

    const stateHash = hashState(engine.columns, engine.stock.length, engine.completedRuns.length);
    if (visited.has(stateHash)) {
      // Reached repeated state; try undoing or dealing stock
      if (engine.remainingStockDeals > 0) {
        engine.dealStock();
        steps++;
        continue;
      } else {
        break;
      }
    }
    visited.add(stateHash);

    // Find all legal moves
    const hint = engine.getHint();
    if (hint) {
      const res = engine.move(hint.fromCol, hint.cardIndex, hint.toCol);
      if (res.success) {
        steps++;
        continue;
      }
    }

    // If no good move, deal stock if available
    if (engine.remainingStockDeals > 0) {
      engine.dealStock();
      steps++;
      continue;
    }

    // No moves and no stock deals left
    break;
  }

  return {
    solved: engine.isWon,
    completedRuns: engine.completedRuns.length,
    steps
  };
}

/**
 * Tests if a given deal has high solvability / clearing capacity.
 */
export function verifyDeal(seed, suitCount = 2, iterations = 500) {
  const engine = new SpiderEngine({ seed, suitCount });
  const result = solveSpider(engine, iterations);
  return {
    seed,
    suitCount,
    solved: result.solved,
    completedRuns: result.completedRuns,
    steps: result.steps
  };
}
