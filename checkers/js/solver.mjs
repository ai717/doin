// solver.mjs - exhaustive solver for solo chain-hop puzzles.
// DOM-free and dependency-free. The move generator is the engine's own
// legalMovesFrom, so a puzzle verified here has exactly the same legal moves
// as the playable board. A "solution" is a move sequence whose LAST move is
// the first time a red marble lands on the goal hole; deeper continuations are
// pruned, which makes the count a count of distinct optimal lines.
import {
  HOLE_COUNT, RED, EMPTY,
  legalMovesFrom, applySoloMove,
} from "./engine.mjs";

export const DEFAULT_MAX_NODES = 400000;

export function boardFromEntries(entries) {
  const board = Array(HOLE_COUNT).fill(EMPTY);
  for (const [hole, player] of entries) {
    if (Number.isInteger(hole) && hole >= 0 && hole < HOLE_COUNT
      && (player === RED || player === 2)) board[hole] = player;
  }
  return board;
}

function lightState(board) {
  return { board, status: "playing", turn: RED, moveCount: 0, history: [] };
}

function redMoves(board) {
  const state = lightState(board);
  const out = [];
  for (let hole = 0; hole < HOLE_COUNT; hole += 1) {
    if (board[hole] === RED) out.push(...legalMovesFrom(state, hole));
  }
  return out;
}

export function solveBoard(board, goal, maxDepth = 3, options = {}) {
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;
  const limit = options.maxSolutions ?? 4;
  const solutions = [];
  let count = 0;
  let nodes = 0;
  let aborted = false;
  let shortest = null;

  // Iterate by depth so `shortest` is genuinely the shortest line: a plain
  // DFS finds whatever its first branch reaches, which can be a longer line.
  function walk(current, sequence, depthLimit) {
    if (aborted) return;
    for (const move of redMoves(current)) {
      const state = lightState(current);
      const next = applySoloMove(state, move, RED);
      if (next === state) continue;
      nodes += 1;
      if (nodes > maxNodes) { aborted = true; return; }
      const line = [...sequence, { from: move.from, to: move.to, hops: move.hops }];
      if (next.board[goal] === RED) {
        // First contact with the goal: never extend this line, and only
        // credit it to the layer it actually belongs to.
        if (line.length === depthLimit) {
          count += 1;
          if (solutions.length < limit) solutions.push(line);
        }
        continue;
      }
      if (line.length < depthLimit) walk(next.board, line, depthLimit);
      if (aborted) return;
    }
  }

  const validGoal = Number.isInteger(goal) && goal >= 0 && goal < HOLE_COUNT
    && board[goal] !== RED;
  if (validGoal && maxDepth >= 1) {
    for (let depth = 1; depth <= maxDepth && !aborted; depth += 1) {
      const before = count;
      walk(board, [], depth);
      // Only the first solved layer is an optimal line. Once found, deeper
      // layers are irrelevant (and factorially larger), so stop here: `count`
      // is then exactly the number of distinct optimal solutions.
      if (count > before) { shortest = depth; break; }
    }
  }

  return {
    count,
    solutions,
    nodes,
    aborted,
    shortest,
    hops: solutions.length ? solutions[0].reduce((n, m) => n + m.hops, 0) : 0,
  };
}

export function solvePuzzle(level, maxDepth = 3, options = {}) {
  return solveBoard(boardFromEntries(level.board), level.goal, maxDepth, options);
}

// A puzzle is publishable when exactly one line reaches the goal within par
// moves, that line has par moves, and it really is a chain-hop (not a step).
export function verifyPuzzle(level, options = {}) {
  const report = solvePuzzle(level, level.par ?? 3, options);
  const unique = report.count === 1 && !report.aborted;
  return {
    ...report,
    unique,
    optimal: report.shortest === (level.par ?? 3),
    chain: report.hops >= 2,
    ok: unique && report.shortest === (level.par ?? 3) && report.hops >= 2,
  };
}
