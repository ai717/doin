/**
 * Picross Engine
 * Pure logic module, 100% DOM-free and storage-free.
 */

export const CELL_EMPTY = 0;
export const CELL_PAINT = 1;
export const CELL_CROSS = 2;

const placementsCache = new Map();

/**
 * Derives clues for a single row or column of 0/1 values.
 * e.g. [0, 1, 1, 0, 1] -> [2, 1]
 * [0, 0, 0] -> []
 */
export function deriveLineClues(line) {
  const clues = [];
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === 1) {
      count++;
    } else if (count > 0) {
      clues.push(count);
      count = 0;
    }
  }
  if (count > 0) {
    clues.push(count);
  }
  return clues;
}

/**
 * Derives row and column clues from a 2D binary grid (rows x cols).
 */
export function deriveGridClues(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const rowClues = [];
  for (let r = 0; r < rows; r++) {
    rowClues.push(deriveLineClues(grid[r]));
  }
  const colClues = [];
  for (let c = 0; c < cols; c++) {
    const col = [];
    for (let r = 0; r < rows; r++) {
      col.push(grid[r][c]);
    }
    colClues.push(deriveLineClues(col));
  }
  return { rowClues, colClues };
}

/**
 * Generates all possible placements of given clues on a line of specified length.
 * Results are cached by key `len:clues.join(',')`.
 */
export function getAllPlacements(len, clues) {
  const key = `${len}:${clues.join(",")}`;
  if (placementsCache.has(key)) {
    return placementsCache.get(key);
  }

  if (clues.length === 0) {
    const emptyLine = [new Array(len).fill(0)];
    placementsCache.set(key, emptyLine);
    return emptyLine;
  }

  const results = [];
  const line = new Array(len).fill(0);

  function backtrack(clueIdx, pos) {
    if (clueIdx === clues.length) {
      for (let i = pos; i < len; i++) {
        line[i] = 0;
      }
      results.push([...line]);
      return;
    }

    const blockLen = clues[clueIdx];
    let remLen = 0;
    for (let c = clueIdx + 1; c < clues.length; c++) {
      remLen += 1 + clues[c];
    }

    const maxStart = len - remLen - blockLen;
    for (let start = pos; start <= maxStart; start++) {
      for (let i = pos; i < start; i++) {
        line[i] = 0;
      }
      for (let i = start; i < start + blockLen; i++) {
        line[i] = 1;
      }
      if (clueIdx < clues.length - 1) {
        line[start + blockLen] = 0;
      }
      const nextPos = clueIdx < clues.length - 1 ? start + blockLen + 1 : start + blockLen;
      backtrack(clueIdx + 1, nextPos);
    }
  }

  backtrack(0, 0);
  placementsCache.set(key, results);
  return results;
}

/**
 * Filters all possible placements against the current line state.
 * currentLine values: 0 = unknown, 1 = must be 1, 2 = must be 0 (crossed).
 */
export function getValidPlacements(len, clues, currentLine) {
  const all = getAllPlacements(len, clues);
  const filtered = [];
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    let ok = true;
    for (let j = 0; j < len; j++) {
      const cell = currentLine[j];
      if (cell === CELL_PAINT && p[j] !== 1) {
        ok = false;
        break;
      }
      if (cell === CELL_CROSS && p[j] !== 0) {
        ok = false;
        break;
      }
    }
    if (ok) {
      filtered.push(p);
    }
  }
  return filtered;
}

/**
 * Solves a single line using overlap/intersection logic.
 * Returns deductions for cells that must be paint (1) or cross (2).
 */
export function solveLine(len, clues, currentLine) {
  const valid = getValidPlacements(len, clues, currentLine);
  if (valid.length === 0) {
    return { possible: false, mustPaint: [], mustCross: [], isComplete: false };
  }

  const mustPaint = [];
  const mustCross = [];

  for (let c = 0; c < len; c++) {
    if (currentLine[c] === CELL_EMPTY) {
      let allOne = true;
      let allZero = true;
      for (let i = 0; i < valid.length; i++) {
        if (valid[i][c] === 1) {
          allZero = false;
        } else {
          allOne = false;
        }
      }
      if (allOne) mustPaint.push(c);
      else if (allZero) mustCross.push(c);
    }
  }

  const isComplete = valid.length === 1 && currentLine.every((v, i) => (v === CELL_PAINT ? valid[0][i] === 1 : v === CELL_CROSS ? valid[0][i] === 0 : false));

  return { possible: true, mustPaint, mustCross, isComplete, validCount: valid.length };
}

/**
 * Tests whether a line of current grid values matches the given clues exactly.
 */
export function isLineSatisfied(line, clues) {
  const actualClues = [];
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === CELL_PAINT) {
      count++;
    } else if (count > 0) {
      actualClues.push(count);
      count = 0;
    }
  }
  if (count > 0) {
    actualClues.push(count);
  }

  if (clues.length !== actualClues.length) return false;
  for (let i = 0; i < clues.length; i++) {
    if (clues[i] !== actualClues[i]) return false;
  }
  return true;
}

/**
 * Solves a Picross grid and counts total solutions up to maxSolutions.
 * Uses line-deduction relaxation followed by backtracking depth-first search.
 */
export function solveGrid(rowClues, colClues, rows, cols, maxSolutions = 2) {
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(CELL_EMPTY));
  let solutionsCount = 0;
  let firstSolution = null;

  function deduce(g) {
    let changed = true;
    while (changed) {
      changed = false;
      // rows
      for (let r = 0; r < rows; r++) {
        const line = g[r];
        const valid = getValidPlacements(cols, rowClues[r], line);
        if (valid.length === 0) return false;
        for (let c = 0; c < cols; c++) {
          if (line[c] === CELL_EMPTY) {
            let allOne = true;
            let allZero = true;
            for (let i = 0; i < valid.length; i++) {
              if (valid[i][c] === 1) allZero = false;
              else allOne = false;
            }
            if (allOne) {
              g[r][c] = CELL_PAINT;
              changed = true;
            } else if (allZero) {
              g[r][c] = CELL_CROSS;
              changed = true;
            }
          }
        }
      }
      // cols
      for (let c = 0; c < cols; c++) {
        const line = [];
        for (let r = 0; r < rows; r++) line.push(g[r][c]);
        const valid = getValidPlacements(rows, colClues[c], line);
        if (valid.length === 0) return false;
        for (let r = 0; r < rows; r++) {
          if (line[r] === CELL_EMPTY) {
            let allOne = true;
            let allZero = true;
            for (let i = 0; i < valid.length; i++) {
              if (valid[i][r] === 1) allZero = false;
              else allOne = false;
            }
            if (allOne) {
              g[r][c] = CELL_PAINT;
              changed = true;
            } else if (allZero) {
              g[r][c] = CELL_CROSS;
              changed = true;
            }
          }
        }
      }
    }
    return true;
  }

  const allSolutions = [];

  function search(g) {
    if (solutionsCount >= maxSolutions) return;
    const cloned = g.map((row) => [...row]);
    if (!deduce(cloned)) return;

    let unassigned = null;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (cloned[r][c] === CELL_EMPTY) {
          unassigned = { r, c };
          break;
        }
      }
      if (unassigned) break;
    }

    if (!unassigned) {
      solutionsCount++;
      const sol = cloned.map((row) => row.map((v) => (v === CELL_PAINT ? 1 : 0)));
      allSolutions.push(sol);
      if (!firstSolution) {
        firstSolution = sol;
      }
      return;
    }

    // Branch 1: Paint
    cloned[unassigned.r][unassigned.c] = CELL_PAINT;
    search(cloned);

    // Branch 2: Cross
    cloned[unassigned.r][unassigned.c] = CELL_CROSS;
    search(cloned);
  }

  search(grid);
  return {
    count: solutionsCount,
    unique: solutionsCount === 1,
    solution: firstSolution,
    solutions: allSolutions,
  };
}

/**
 * Calculates smart hint.
 * First seeks any row or column where logic proves a cell without guessing.
 * If none found (e.g. user already has mistakes or grid is stalled), falls back to comparing with target.
 */
export function getSmartHint(grid, rowClues, colClues, target) {
  const rows = grid.length;
  const cols = grid[0].length;

  // 1. Try row line deduction
  for (let r = 0; r < rows; r++) {
    const res = solveLine(cols, rowClues[r], grid[r]);
    if (res.possible) {
      if (res.mustPaint.length > 0) {
        return { row: r, col: res.mustPaint[0], val: CELL_PAINT, reason: "row" };
      }
      if (res.mustCross.length > 0) {
        return { row: r, col: res.mustCross[0], val: CELL_CROSS, reason: "row" };
      }
    }
  }

  // 2. Try col line deduction
  for (let c = 0; c < cols; c++) {
    const colLine = [];
    for (let r = 0; r < rows; r++) colLine.push(grid[r][c]);
    const res = solveLine(rows, colClues[c], colLine);
    if (res.possible) {
      if (res.mustPaint.length > 0) {
        return { row: res.mustPaint[0], col: c, val: CELL_PAINT, reason: "col" };
      }
      if (res.mustCross.length > 0) {
        return { row: res.mustCross[0], col: c, val: CELL_CROSS, reason: "col" };
      }
    }
  }

  // 3. Fallback: find any cell that does not match target
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const expected = target[r][c] === 1 ? CELL_PAINT : CELL_CROSS;
      if (grid[r][c] !== expected) {
        return { row: r, col: c, val: expected, reason: "target" };
      }
    }
  }

  return null;
}

/**
 * Creates initial game state for a given level object.
 */
export function createGame(level) {
  const rows = level.rows;
  const cols = level.cols;
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(CELL_EMPTY));

  return {
    levelId: level.id,
    chapterKey: level.chapterKey,
    titleKey: level.titleKey,
    rows,
    cols,
    target: level.target,
    rowClues: level.rowClues,
    colClues: level.colClues,
    grid,
    mistakes: 0,
    history: [],
    redoStack: [],
    status: "playing", // 'playing' | 'won'
    startTime: null,
    elapsedMs: 0,
    hintsUsed: 0,
  };
}

/**
 * Checks if current grid matches the victory condition.
 * Victory is achieved when all target 1 cells are painted,
 * and no target 0 cells are painted!
 */
export function checkVictory(state) {
  const { rows, cols, grid, target } = state;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const isTarget = target[r][c] === 1;
      const isPainted = grid[r][c] === CELL_PAINT;
      if (isTarget !== isPainted) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Applies player action to state immutably.
 */
export function applyAction(state, action) {
  if (state.status === "won" && action.type !== "RESTART") {
    return state;
  }

  switch (action.type) {
    case "SET_CELL": {
      const { row, col, val } = action;
      if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) return state;
      const prevVal = state.grid[row][col];
      if (prevVal === val) return state;

      // Check mistake: painting a cell that should be 0, or crossing a cell that should be 1
      const isTarget = state.target[row][col] === 1;
      let newMistake = false;
      if (val === CELL_PAINT && !isTarget) {
        newMistake = true;
      } else if (val === CELL_CROSS && isTarget) {
        newMistake = true;
      }

      const nextGrid = state.grid.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? val : c)) : [...r]
      );

      const nextHistory = [
        ...state.history,
        { type: "CELL", row, col, prevVal, newVal: val, wasMistake: newMistake },
      ];

      const nextState = {
        ...state,
        grid: nextGrid,
        mistakes: newMistake ? state.mistakes + 1 : state.mistakes,
        history: nextHistory,
        redoStack: [],
        startTime: state.startTime || Date.now(),
      };

      if (checkVictory(nextState)) {
        nextState.status = "won";
      }

      return nextState;
    }

    case "BATCH_SET": {
      const { changes } = action; // array of { row, col, val }
      if (!changes || changes.length === 0) return state;

      let changed = false;
      let additionalMistakes = 0;
      const recordedChanges = [];
      const nextGrid = state.grid.map((r) => [...r]);

      for (const { row, col, val } of changes) {
        if (row < 0 || row >= state.rows || col < 0 || col >= state.cols) continue;
        const prevVal = nextGrid[row][col];
        if (prevVal !== val) {
          nextGrid[row][col] = val;
          changed = true;
          const isTarget = state.target[row][col] === 1;
          let isMistake = false;
          if (val === CELL_PAINT && !isTarget) isMistake = true;
          else if (val === CELL_CROSS && isTarget) isMistake = true;
          if (isMistake) additionalMistakes++;
          recordedChanges.push({ row, col, prevVal, newVal: val, wasMistake: isMistake });
        }
      }

      if (!changed) return state;

      const nextState = {
        ...state,
        grid: nextGrid,
        mistakes: state.mistakes + additionalMistakes,
        history: [...state.history, { type: "BATCH", changes: recordedChanges }],
        redoStack: [],
        startTime: state.startTime || Date.now(),
      };

      if (checkVictory(nextState)) {
        nextState.status = "won";
      }

      return nextState;
    }

    case "UNDO": {
      if (state.history.length === 0) return state;
      const nextHistory = [...state.history];
      const last = nextHistory.pop();
      const nextGrid = state.grid.map((r) => [...r]);

      if (last.type === "CELL") {
        nextGrid[last.row][last.col] = last.prevVal;
      } else if (last.type === "BATCH") {
        for (let i = last.changes.length - 1; i >= 0; i--) {
          const ch = last.changes[i];
          nextGrid[ch.row][ch.col] = ch.prevVal;
        }
      }

      return {
        ...state,
        grid: nextGrid,
        history: nextHistory,
        redoStack: [...state.redoStack, last],
      };
    }

    case "HINT": {
      const hint = getSmartHint(state.grid, state.rowClues, state.colClues, state.target);
      if (!hint) return state;

      const nextGrid = state.grid.map((r, ri) =>
        ri === hint.row ? r.map((c, ci) => (ci === hint.col ? hint.val : c)) : [...r]
      );

      const nextState = {
        ...state,
        grid: nextGrid,
        hintsUsed: state.hintsUsed + 1,
        history: [
          ...state.history,
          {
            type: "CELL",
            row: hint.row,
            col: hint.col,
            prevVal: state.grid[hint.row][hint.col],
            newVal: hint.val,
            wasMistake: false,
          },
        ],
        redoStack: [],
      };

      if (checkVictory(nextState)) {
        nextState.status = "won";
      }

      return nextState;
    }

    case "RESTART": {
      return createGame({
        id: state.levelId,
        chapterKey: state.chapterKey,
        titleKey: state.titleKey,
        rows: state.rows,
        cols: state.cols,
        target: state.target,
        rowClues: state.rowClues,
        colClues: state.colClues,
      });
    }

    default:
      return state;
  }
}

/**
 * Calculates earned star rating (1-3 stars) based on mistake count.
 */
export function calculateStars(mistakes) {
  if (mistakes === 0) return 3;
  if (mistakes <= 3) return 2;
  return 1;
}

/**
 * 32-bit PRNG for deterministic testing.
 */
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
